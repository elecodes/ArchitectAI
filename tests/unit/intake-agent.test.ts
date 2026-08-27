import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IntakeOutputSchema, UserIntakeResponseSchema } from '../../src/agents/schemas/intake.js';
import { Orchestrator } from '../../src/agents/orchestrator.js';
import type { AgentDefinition } from '../../src/agents/contract.js';
import { z } from 'zod';

vi.mock('../../src/db/repositories/agent-workflow-repo.js', () => ({
  updateWorkflowStatus: vi.fn(async () => {}),
  createStep: vi.fn(async () => ({
    id: `step-${Date.now()}`,
    workflowId: 'wf-1',
    agentId: 'intake',
    agentName: 'intake',
    status: 'pending' as const,
    resultArtifactId: null,
    parentArtifactId: null,
    startTime: null,
    endTime: null,
    durationMs: null,
    retryCount: 0,
    promptVersion: null,
    model: null,
    provider: null,
    promptTokens: null,
    completionTokens: null,
    errorCode: null,
    errorMessage: null,
    output: null,
  })),
  updateStepStatus: vi.fn(async () => {}),
}));

vi.mock('../../src/agents/registry.js', () => ({
  getAgentDefinition: vi.fn(),
  registerAgent: vi.fn(),
  listAgentDefinitions: vi.fn().mockReturnValue([]),
}));

import { updateWorkflowStatus } from '../../src/db/repositories/agent-workflow-repo.js';
import { getAgentDefinition } from '../../src/agents/registry.js';

const DummySchema = z.object({ result: z.string() });

function makeAgentDef(id: string): AgentDefinition<any, any> {
  return {
    id,
    name: id,
    description: id,
    promptName: id,
    artifactType: id,
    inputSchema: DummySchema,
    outputSchema: DummySchema,
    capabilities: [],
    timeoutMs: 5000,
    maxTransientRetries: 1,
  };
}

describe('Phase 0 Intake Agent & Orchestrator Integration', () => {
  let mockRunner: any;
  let orchestrator: Orchestrator;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRunner = {
      run: vi.fn(),
    };
    orchestrator = new Orchestrator(mockRunner);

    vi.mocked(getAgentDefinition).mockImplementation((id: string) => {
      return makeAgentDef(id);
    });
  });

  describe('Intake Schemas', () => {
    it('validates a correct IntakeOutput JSON', () => {
      const validIntake = {
        isSufficient: false,
        summary: 'Prompt lacks database preference and scale expectations.',
        questions: [
          {
            id: 'db_type',
            category: 'stack',
            question: 'Which database do you prefer?',
            options: ['PostgreSQL', 'MongoDB'],
            recommendation: 'PostgreSQL',
            rationale: 'Best for relational consistency.',
          },
        ],
      };

      const parsed = IntakeOutputSchema.safeParse(validIntake);
      expect(parsed.success).toBe(true);
    });

    it('validates UserIntakeResponse JSON', () => {
      const response = {
        answers: { db_type: 'PostgreSQL' },
        skipped: false,
      };

      const parsed = UserIntakeResponseSchema.safeParse(response);
      expect(parsed.success).toBe(true);
    });
  });

  describe('Orchestrator Pause & Resume Flow', () => {
    it('pauses workflow in awaiting_input state when isSufficient is false', async () => {
      mockRunner.run.mockResolvedValueOnce({
        output: {
          isSufficient: false,
          summary: 'Vague prompt',
          questions: [{ id: 'q1', category: 'stack', question: 'Q1?', options: ['A', 'B'], recommendation: 'A', rationale: 'R1' }],
        },
        provenance: { generationDurationMs: 100 },
        retryCount: 0,
        transientRetries: 0,
        truncated: false,
        artifactId: null,
      });

      const result = await orchestrator.execute({
        workflowId: 'wf-1',
        projectId: 'p-1',
        userId: 'u-1',
        idea: 'Build a app',
      });

      expect(result.status).toBe('awaiting_input');
      expect(result.completedSteps).toEqual(['intake']);
      expect(result.intakeQuestions).toHaveLength(1);
      expect(updateWorkflowStatus).toHaveBeenCalledWith('wf-1', 'awaiting_input');
    });

    it('continues workflow when userIntakeResponse is provided on resume', async () => {
      // Mock runner for all 7 agents
      mockRunner.run.mockResolvedValue({
        output: { result: 'ok' },
        provenance: { generationDurationMs: 50 },
        retryCount: 0,
        transientRetries: 0,
        truncated: false,
        artifactId: null,
      });

      const result = await orchestrator.execute({
        workflowId: 'wf-1',
        projectId: 'p-1',
        userId: 'u-1',
        idea: 'Build a app',
        userIntakeResponse: {
          answers: { q1: 'Option A' },
          skipped: false,
        },
      });

      expect(result.status).toBe('completed');
      expect(result.completedSteps).toHaveLength(8);
      expect(updateWorkflowStatus).toHaveBeenCalledWith('wf-1', 'completed');
    });
  });
});
