import { z } from 'zod';
import { getAgentDefinition } from '../agents/index.js';
import type { LLMClient } from './interface.js';
import { OutputValidator } from '../generation/output-validator.js';

export const AGENT_CRITERIA: Record<string, string[]> = {
  'requirements': ['correctness', 'completeness', 'relevance', 'consistency', 'groundedness', 'schema_validity'],
  'agent-architecture': ['requirements_traceability', 'appropriate_architecture', 'scalability', 'security', 'technology_justification', 'operational_feasibility'],
  'security': ['threat_coverage', 'owasp_awareness', 'authentication_authorization', 'data_protection', 'realistic_mitigations'],
  'cloud-cost': ['accuracy', 'cost_efficiency', 'resource_optimization', 'metric_clarity'],
  'devsecops': ['cicd_completeness', 'container_security', 'secrets_management', 'testing', 'deployment_safety'],
  'qa': ['test_coverage', 'edge_cases', 'acceptance_criteria', 'negative_scenarios'],
  'synthesis': ['coherence', 'completeness', 'integration_depth', 'clarity'],
};

export const JudgeOutputSchema = z.object({
  score: z.number().min(1).max(10),
  criteriaScores: z.record(z.string(), z.number().min(1).max(10)),
  explanation: z.string(),
});

export type JudgeOutput = z.infer<typeof JudgeOutputSchema>;

export interface EvaluationCase {
  id: string;
  name: string;
  domain: string;
  complexity: 'low' | 'medium' | 'high';
  description: string;
  constraints: string[];
  expectedCharacteristics: {
    requirements: string[];
    architecture: string[];
    security: string[];
    devsecops: string[];
    qa: string[];
  };
}

export interface EvaluationResult {
  validationSuccess: boolean;
  validationErrors: string[];
  score: number | null;
  criteriaScores: Record<string, number>;
  judgeExplanation: string | null;
  judgeModel: string | null;
}

export class Evaluator {
  private readonly validator = new OutputValidator();

  constructor(private readonly judgeLlm: LLMClient, private readonly judgeModel: string) {}

  /**
   * Run Level 1 (deterministic) evaluation.
   */
  evaluateDeterministic(agentId: string, output: unknown): { success: boolean; errors: string[] } {
    const def = getAgentDefinition(agentId);
    if (!def) {
      return { success: false, errors: [`Agent ${agentId} not found in registry`] };
    }

    let rawString = '';
    if (typeof output === 'string') {
      rawString = output;
    } else {
      rawString = JSON.stringify(output);
    }

    const valResult = this.validator.validate(rawString, def.outputSchema);
    if (!valResult.success) {
      const errs: string[] = [];
      if (valResult.error?.parseError) {
        errs.push(`JSON Parse Error: ${valResult.error.parseError}`);
      }
      if (valResult.error?.zodError) {
        errs.push(`Zod Schema Validation Error: ${valResult.error.zodError}`);
      }
      return { success: false, errors: errs.length > 0 ? errs : ['Unknown schema validation failure'] };
    }

    return { success: true, errors: [] };
  }

  /**
   * Run Level 2 (semantic) evaluation using the LLM judge.
   */
  async evaluateSemantic(
    evalCase: EvaluationCase,
    agentId: string,
    output: unknown,
    deterministicSuccess: boolean,
  ): Promise<{ score: number; criteriaScores: Record<string, number>; explanation: string }> {
    // If output is not text, stringify it
    const outputString = typeof output === 'string' ? output : JSON.stringify(output, null, 2);

    const criteria = AGENT_CRITERIA[agentId] || ['correctness', 'completeness', 'relevance'];
    const criteriaList = criteria.map(c => `- ${c}`).join('\n');

    const systemPrompt = `You are an expert AI software engineering quality evaluator playing the role of an LLM-as-Judge.
Evaluate the generated output from the "${agentId}" agent for the project described.
You must assess the output based on the provided expected characteristics and constraints.
Be rigorous, objective, and realistic. Note that LLM-as-judge is an imperfect measurement, so pay attention to details and trace expected characteristics.

Return your evaluation ONLY as a valid JSON object matching this schema:
{
  "score": <overall_score_1_to_10_decimal>,
  "criteriaScores": {
    ${criteria.map(c => `"${c}": <score_1_to_10_decimal>`).join(',\n    ')}
  },
  "explanation": "<detailed_rationale_citing_evidence>"
}
Ensure your output is valid JSON enclosed in a \`\`\`json code block.`;

    const prompt = `### Evaluation Case
ID: ${evalCase.id}
Name: ${evalCase.name}
Description: ${evalCase.description}
Constraints:
${evalCase.constraints.map(c => `- ${c}`).join('\n')}

### Expected Agent Characteristics for this Case:
${JSON.stringify(evalCase.expectedCharacteristics, null, 2)}

### Evaluated Agent: ${agentId}
Deterministic Schema Validation Status: ${deterministicSuccess ? 'PASSED' : 'FAILED'}

### Agent Output to Evaluate:
${outputString}

### Criteria to Evaluate:
${criteriaList}

Provide your structured evaluation now.`;

    try {
      const response = await this.judgeLlm.complete({
        systemPrompt,
        prompt,
        temperature: 0.1,
      });

      const validation = this.validator.validate(response.content, JudgeOutputSchema);
      if (!validation.success) {
        throw new Error(`Judge returned invalid schema: ${validation.error?.zodError || validation.error?.parseError}`);
      }

      return validation.data!;
    } catch (err) {
      // Fallback in case judge fails or rate-limits
      const defaultScores: Record<string, number> = {};
      for (const c of criteria) {
        defaultScores[c] = deterministicSuccess ? 5.0 : 1.0;
      }
      return {
        score: deterministicSuccess ? 5.0 : 1.0,
        criteriaScores: defaultScores,
        explanation: `Failed to execute LLM Judge: ${(err as Error).message}`,
      };
    }
  }

  /**
   * Run full evaluation (Level 1 + Level 2)
   */
  async evaluate(evalCase: EvaluationCase, agentId: string, output: unknown): Promise<EvaluationResult> {
    const deterministic = this.evaluateDeterministic(agentId, output);
    const semantic = await this.evaluateSemantic(evalCase, agentId, output, deterministic.success);

    return {
      validationSuccess: deterministic.success,
      validationErrors: deterministic.errors,
      score: semantic.score,
      criteriaScores: semantic.criteriaScores,
      judgeExplanation: semantic.explanation,
      judgeModel: this.judgeModel,
    };
  }
}
