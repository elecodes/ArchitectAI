import type { AgentRunner } from './runner.js';
import type { AgentDefinition } from './contract.js';
import { AgentRunError } from './contract.js';
import { getAgentDefinition } from './registry.js';
import {
  updateWorkflowStatus,
  createStep,
  updateStepStatus,
} from '../db/repositories/agent-workflow-repo.js';
import type { AgentWorkflowStatus } from '../db/repositories/agent-workflow-repo.js';

export interface WorkflowInput {
  workflowId: string;
  projectId: string;
  userId: string;
  idea: string;
  context?: string;
}

export interface WorkflowResult {
  workflowId: string;
  status: AgentWorkflowStatus;
  completedSteps: string[];
  failedStep?: string;
  error?: string;
}

export class Orchestrator {
  private readonly phases: string[][] = [
    ['requirements'],
    ['agent-architecture'],
    ['security', 'cloud-cost'],
    ['devsecops'],
    ['qa'],
    ['synthesis'],
  ];

  constructor(private readonly runner: AgentRunner) {}

  async execute(input: WorkflowInput, signal?: AbortSignal): Promise<WorkflowResult> {
    const { workflowId, projectId, userId, idea, context } = input;
    const completedSteps: string[] = [];
    const contextStore: Record<string, unknown> = { idea, context };

    try {
      await updateWorkflowStatus(workflowId, 'running');

      for (const phase of this.phases) {
        if (signal?.aborted) {
          await updateWorkflowStatus(workflowId, 'cancelled');
          return { workflowId, status: 'cancelled', completedSteps };
        }

        if (phase.length === 1) {
          const agentId = phase[0];
          const stepResult = await this.runAgent(agentId, workflowId, projectId, userId, contextStore);
          completedSteps.push(agentId);

          if (!stepResult.success) {
            await updateWorkflowStatus(workflowId, 'failed', {
              errorCode: 'AGENT_FAILED',
              errorMessage: `Agent ${agentId} failed: ${stepResult.error}`,
            });
            return { workflowId, status: 'failed', completedSteps, failedStep: agentId, error: stepResult.error };
          }

          contextStore[agentId] = stepResult.output;
        } else {
          const results = await Promise.allSettled(
            phase.map(agentId =>
              this.runAgent(agentId, workflowId, projectId, userId, contextStore),
            ),
          );

          for (let i = 0; i < phase.length; i++) {
            const agentId = phase[i];
            const result = results[i];
            completedSteps.push(agentId);

            if (result.status === 'fulfilled' && result.value.success) {
              contextStore[agentId] = result.value.output;
            } else {
              contextStore[agentId] = null;
            }
          }
        }
      }

      await updateWorkflowStatus(workflowId, 'completed');
      return { workflowId, status: 'completed', completedSteps };
    } catch (err) {
      const error = err as Error;
      await updateWorkflowStatus(workflowId, 'failed', {
        errorCode: 'WORKFLOW_ERROR',
        errorMessage: error.message,
      });
      return { workflowId, status: 'failed', completedSteps, error: error.message };
    }
  }

  private async runAgent(
    agentId: string,
    workflowId: string,
    projectId: string,
    userId: string,
    contextStore: Record<string, unknown>,
  ): Promise<{ success: boolean; output?: unknown; error?: string; artifactId?: string }> {
    const step = await createStep({ workflowId, agentId, agentName: agentId });

    try {
      const def = getAgentDefinition(agentId);
      if (!def) {
        await updateStepStatus(step.id, 'failed', {
          errorCode: 'AGENT_NOT_FOUND',
          errorMessage: `Agent ${agentId} not found in registry`,
        });
        return { success: false, error: `Agent ${agentId} not found in registry` };
      }

      await updateStepStatus(step.id, 'running');

      const agentCtx = this.buildAgentContext(def, contextStore, projectId, userId);
      const result = await this.runner.run(def, agentCtx);

      await updateStepStatus(step.id, 'completed', {
        resultArtifactId: result.artifactId ?? undefined,
        durationMs: result.provenance.generationDurationMs ?? 0,
        retryCount: result.retryCount,
        promptVersion: result.provenance.promptVersion,
        model: result.provenance.model,
        promptTokens: result.provenance.promptTokens ?? 0,
        completionTokens: result.provenance.completionTokens ?? 0,
        output: result.output as Record<string, unknown>,
      });

      return { success: true, output: result.output, artifactId: result.artifactId ?? undefined };
    } catch (err) {
      const error = err as Error;
      await updateStepStatus(step.id, 'failed', {
        errorCode: error instanceof AgentRunError ? error.code : 'AGENT_ERROR',
        errorMessage: error.message,
      });
      return { success: false, error: error.message };
    }
  }

  private buildAgentContext(
    def: AgentDefinition<any, any>,
    contextStore: Record<string, unknown>,
    projectId: string,
    userId: string,
  ): any {
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

    return { input, projectId, userId };
  }
}
