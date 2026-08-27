import { Pool } from 'pg';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getAgentDefinition } from '../agents/index.js';
import { AgentRunner } from '../agents/runner.js';
import { createLLMClient } from './factory.js';
import { Evaluator } from './evaluator.js';
import { createChildLogger } from '../logger.js';
import { RAGRetriever } from '../rag/retriever.js';
import { loadPrompts } from '../prompts/loader.js';
import { config } from '../config/index.js';

const log = createChildLogger('benchmark-runner');
const __dirname = dirname(fileURLToPath(import.meta.url));

// Estimated costs per 1,000,000 tokens
const COST_PER_M_TOKENS: Record<string, { input: number; output: number }> = {
  'gemini-1.5-flash': { input: 0.075, output: 0.30 },
  'gemini-1.5-pro': { input: 1.25, output: 5.00 },
  'llama3-8b-8192': { input: 0.05, output: 0.08 },
  'llama3-70b-8192': { input: 0.59, output: 0.79 },
  'gpt-4o': { input: 5.00, output: 15.00 },
  'gpt-4o-mini': { input: 0.150, output: 0.600 },
  'mock-model': { input: 0.0, output: 0.0 },
};

function calculateCostEstimate(model: string, inputTokens: number, outputTokens: number): number {
  const modelKey = Object.keys(COST_PER_M_TOKENS).find(k => model.toLowerCase().includes(k)) || 'gemini-1.5-flash';
  const rate = COST_PER_M_TOKENS[modelKey];
  const inputCost = (inputTokens / 1_000_000) * rate.input;
  const outputCost = (outputTokens / 1_000_000) * rate.output;
  return inputCost + outputCost;
}

export interface BenchmarkRunOptions {
  agentId: string;
  provider: string;
  model: string;
  promptVersion: string;
  datasetVersion: string;
}

export class BenchmarkRunner {
  constructor(private readonly pool: Pool) {}

  /**
   * Run a benchmark across all evaluation cases in the golden dataset.
   */
  async run(options: BenchmarkRunOptions): Promise<string> {
    const { agentId, provider, model, promptVersion, datasetVersion } = options;

    log.info({ agentId, provider, model, promptVersion }, 'Starting benchmark run');

    // 1. Insert evaluation run
    const runRes = await this.pool.query(
      `INSERT INTO evaluation_runs (dataset_version, status)
       VALUES ($1, 'running') RETURNING id`,
      [datasetVersion],
    );
    const runId = runRes.rows[0].id;

    try {
      // 2. Load golden dataset
      const datasetPath = join(__dirname, '..', 'data', 'golden-dataset.json');
      const dataset = JSON.parse(readFileSync(datasetPath, 'utf-8'));

      // 3. Setup LLM client for the benchmarked model
      // We create a temporary config overrides for factory
      const benchmarkConfig = {
        ...config,
        llmProvider: provider as any,
        llmModel: model,
      };
      const benchmarkLlm = createLLMClient(benchmarkConfig);

      // Create default LLM client for dependency steps (to run prerequisites)
      const defaultLlm = createLLMClient(config);

      // Setup Retriever and Prompts Map
      const retriever = new RAGRetriever(this.pool, defaultLlm); // dummy retriever or mock retriever
      const promptsDir = join(__dirname, '..', 'prompts');
      const promptsMap = loadPrompts(promptsDir);

      // Evaluator uses default/production LLM client as the judge
      const evaluator = new Evaluator(defaultLlm, config.llmModel);

      // 4. Run cases
      for (const evalCase of dataset) {
        log.info({ runId, caseId: evalCase.id }, 'Executing evaluation case');

        const contextStore: Record<string, unknown> = {
          idea: evalCase.description,
          context: evalCase.constraints.join('\n'),
        };

        const targetDef = getAgentDefinition(agentId);
        if (!targetDef) {
          throw new Error(`Target agent ${agentId} not found in registry`);
        }

        // Run dependency chain
        await this.ensureDependencies(agentId, contextStore, defaultLlm, retriever, promptsMap);

        // Run target agent with benchmark settings
        const promptKey = `${targetDef.promptName}-${promptVersion}`;
        const targetPrompt = promptsMap.get(promptKey);
        if (!targetPrompt) {
          throw new Error(`Prompt version ${promptKey} not found in loaded prompts`);
        }

        // Setup custom prompts map for the runner where def.promptName points to targetPrompt
        const runnerPrompts = new Map(promptsMap);
        runnerPrompts.set(targetDef.promptName, targetPrompt);

        const runner = new AgentRunner(
          benchmarkLlm,
          retriever,
          runnerPrompts,
          model,
          config.llmContextWindow,
          provider,
        );

        const agentCtx = this.buildAgentContext(targetDef, contextStore);

        const startTime = Date.now();
        let runResult;
        let errorMsg: string | null = null;
        let validationSuccess = false;
        let validationErrors: string[] = [];
        let score = null;
        let criteriaScores = {};
        let judgeExplanation = null;

        try {
          runResult = await runner.run(targetDef, agentCtx);
          validationSuccess = true;
        } catch (err) {
          errorMsg = (err as Error).message;
          log.error({ err: errorMsg, caseId: evalCase.id }, 'Target agent failed during benchmark');
        }

        const latencyMs = Date.now() - startTime;
        const promptTokens = runResult?.provenance.promptTokens ?? 0;
        const completionTokens = runResult?.provenance.completionTokens ?? 0;
        const costEstimate = calculateCostEstimate(model, promptTokens, completionTokens);

        const output = runResult?.output || null;

        if (output) {
          // Run Level 1 & Level 2 evaluation
          try {
            const evalReport = await evaluator.evaluate(evalCase, agentId, output);
            validationSuccess = evalReport.validationSuccess;
            validationErrors = evalReport.validationErrors;
            score = evalReport.score;
            criteriaScores = evalReport.criteriaScores;
            judgeExplanation = evalReport.judgeExplanation;
          } catch (evalErr) {
            log.error({ err: (evalErr as Error).message }, 'Evaluation failed for case');
          }
        }

        // Save result
        await this.pool.query(
          `INSERT INTO evaluation_results (
            run_id, case_id, agent_id, provider, model, prompt_version,
            input, output, latency_ms, prompt_tokens, completion_tokens,
            cost_estimate, validation_success, validation_errors, score,
            criteria_scores, judge_model, judge_explanation, error_message
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)`,
          [
            runId,
            evalCase.id,
            agentId,
            provider,
            model,
            promptVersion,
            JSON.stringify(agentCtx.input),
            output ? JSON.stringify(output) : null,
            latencyMs,
            promptTokens,
            completionTokens,
            costEstimate,
            validationSuccess,
            JSON.stringify(validationErrors),
            score,
            JSON.stringify(criteriaScores),
            config.llmModel,
            judgeExplanation,
            errorMsg,
          ],
        );
      }

      await this.pool.query(
        `UPDATE evaluation_runs SET status = 'completed' WHERE id = $1`,
        [runId],
      );
      log.info({ runId }, 'Benchmark run completed successfully');
    } catch (err) {
      await this.pool.query(
        `UPDATE evaluation_runs SET status = 'failed' WHERE id = $1`,
        [runId],
      );
      log.error({ runId, err: (err as Error).message }, 'Benchmark run failed');
      throw err;
    }

    return runId;
  }

  private async ensureDependencies(
    targetAgentId: string,
    contextStore: Record<string, unknown>,
    llm: any,
    retriever: any,
    promptsMap: Map<string, any>,
  ): Promise<void> {
    const defaultRunner = new AgentRunner(
      llm,
      retriever,
      promptsMap,
      config.llmModel,
      config.llmContextWindow,
      config.llmProvider,
    );

    const depsOrder = ['requirements', 'agent-architecture', 'security', 'cloud-cost', 'devsecops', 'qa', 'synthesis'];
    const targetIdx = depsOrder.indexOf(targetAgentId);

    for (let i = 0; i < targetIdx; i++) {
      const depId = depsOrder[i];
      if (contextStore[depId] !== undefined) {
        continue;
      }

      // Check synthesis deps
      if (targetAgentId === 'synthesis' && !['requirements', 'agent-architecture', 'security', 'cloud-cost', 'devsecops', 'qa'].includes(depId)) {
        continue;
      }

      // If requirements is needed
      const def = getAgentDefinition(depId);
      if (!def) continue;

      log.info({ depId }, 'Running dependency agent for benchmark context');
      const agentCtx = this.buildAgentContext(def, contextStore);
      const res = await defaultRunner.run(def, agentCtx);
      contextStore[depId] = res.output;
    }
  }

  private buildAgentContext(def: any, contextStore: Record<string, unknown>): any {
    const input: Record<string, unknown> = {};
    switch (def.id) {
      case 'requirements':
        input.description = contextStore.idea;
        input.context = contextStore.context;
        break;
      case 'agent-architecture':
        input.requirements = contextStore['requirements'];
        input.projectContext = contextStore.context;
        break;
      case 'security':
        input.requirements = contextStore['requirements'];
        input.architecture = contextStore['agent-architecture'];
        break;
      case 'cloud-cost':
        input.architecture = contextStore['agent-architecture'];
        input.requirements = contextStore['requirements'];
        break;
      case 'devsecops':
        input.architecture = contextStore['agent-architecture'];
        input.security = contextStore['security'];
        break;
      case 'qa':
        input.requirements = contextStore['requirements'];
        input.architecture = contextStore['agent-architecture'];
        break;
      case 'synthesis':
        input.requirements = contextStore['requirements'];
        input.architecture = contextStore['agent-architecture'];
        input.security = contextStore['security'];
        input.cloudCost = contextStore['cloud-cost'];
        input.devsecops = contextStore['devsecops'];
        input.qa = contextStore['qa'];
        break;
    }
    return { input, projectId: '00000000-0000-0000-0000-000000000000', userId: '00000000-0000-0000-0000-000000000000' };
  }
}
