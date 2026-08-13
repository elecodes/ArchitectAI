import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Orchestrator } from '../../src/agents/orchestrator.js';
import type { AgentDefinition } from '../../src/agents/contract.js';
import { AgentRunError } from '../../src/agents/contract.js';
import { z } from 'zod';

vi.mock('../../src/db/repositories/agent-workflow-repo.js', () => ({
  updateWorkflowStatus: vi.fn(async () => {}),
  createStep: vi.fn(async () => ({
    id: `step-${Date.now()}`,
    workflowId: '',
    agentId: '',
    agentName: '',
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
}));

import {
  updateWorkflowStatus,
  createStep,
  updateStepStatus,
} from '../../src/db/repositories/agent-workflow-repo.js';
import { getAgentDefinition } from '../../src/agents/registry.js';

const OutputSchema = z.object({ result: z.string() });

const AGENT_IDS = [
  'requirements',
  'agent-architecture',
  'security',
  'cloud-cost',
  'devsecops',
  'qa',
  'synthesis',
];

function makeAgentDef(id: string): AgentDefinition<any, any> {
  return {
    id,
    name: `${id} Agent`,
    description: `${id} agent`,
    promptName: `${id}-prompt`,
    artifactType: 'specification',
    inputSchema: z.any(),
    outputSchema: OutputSchema,
    capabilities: [] as const,
    timeoutMs: 5000,
    maxTransientRetries: 0,
  };
}

let stepCounter = 0;

function mockRunner(runFn?: (def: AgentDefinition<any, any>, ctx: any) => any) {
  return {
    run: async (def: AgentDefinition<any, any>, ctx: any) => {
      if (runFn) return runFn(def, ctx);
      return {
        output: { result: `mock-${def.id}-output` },
        provenance: {
          model: 'mock',
          promptVersion: 'v1',
          generatedAt: new Date().toISOString(),
          contextWindowUsed: 0,
          ragChunksUsed: 0,
          retryCount: 0,
          truncated: false,
          generationDurationMs: 100,
          promptTokens: 50,
          completionTokens: 50,
        },
        retryCount: 0,
        transientRetries: 0,
        truncated: false,
        artifactId: `artifact-${def.id}`,
      };
    },
  } as any;
}

const defaultInput = {
  workflowId: 'wf-1',
  projectId: 'proj-1',
  userId: 'user-1',
  idea: 'Build a REST API for task management',
};

beforeEach(() => {
  vi.clearAllMocks();
  stepCounter = 0;
  (createStep as any).mockImplementation(async (data: any) => ({
    id: `step-${++stepCounter}`,
    workflowId: data.workflowId,
    agentId: data.agentId,
    agentName: data.agentName,
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
  }));
  for (const id of AGENT_IDS) {
    (getAgentDefinition as any).mockImplementation((agentId: string) => {
      return makeAgentDef(agentId);
    });
  }
});

describe('Orchestrator', () => {
  it('happy path: all agents succeed, workflow completed, context flows correctly', async () => {
    const callOrder: string[] = [];
    const runner = mockRunner((def, ctx) => {
      callOrder.push(def.id);
      return {
        output: { result: `${def.id}-done` },
        provenance: {
          model: 'mock',
          promptVersion: 'v1',
          generatedAt: new Date().toISOString(),
          contextWindowUsed: 0,
          ragChunksUsed: 0,
          retryCount: 0,
          truncated: false,
          generationDurationMs: 100,
          promptTokens: 50,
          completionTokens: 50,
        },
        retryCount: 0,
        transientRetries: 0,
        truncated: false,
        artifactId: `artifact-${def.id}`,
      };
    });

    const orch = new Orchestrator(runner);
    const result = await orch.execute(defaultInput);

    expect(result.status).toBe('completed');
    expect(result.completedSteps).toEqual([
      'requirements',
      'agent-architecture',
      'security',
      'cloud-cost',
      'devsecops',
      'qa',
      'synthesis',
    ]);
    expect(result.failedStep).toBeUndefined();
    expect(result.error).toBeUndefined();

    expect(updateWorkflowStatus).toHaveBeenCalledWith('wf-1', 'running');
    expect(updateWorkflowStatus).toHaveBeenCalledWith('wf-1', 'completed');

    expect(updateStepStatus).toHaveBeenCalledTimes(14);
    const runningCalls = (updateStepStatus as any).mock.calls.filter(
      (c: any[]) => c[1] === 'running',
    );
    expect(runningCalls).toHaveLength(7);
    const completedCalls = (updateStepStatus as any).mock.calls.filter(
      (c: any[]) => c[1] === 'completed',
    );
    expect(completedCalls).toHaveLength(7);

    expect(callOrder).toEqual([
      'requirements',
      'agent-architecture',
      'security',
      'cloud-cost',
      'devsecops',
      'qa',
      'synthesis',
    ]);
  });

  it('single agent failure: architecture fails, workflow failed, later steps not started', async () => {
    const runner = mockRunner((def) => {
      if (def.id === 'agent-architecture') {
        throw new Error('Architecture generation failed');
      }
      return {
        output: { result: `${def.id}-done` },
        provenance: {
          model: 'mock',
          promptVersion: 'v1',
          generatedAt: new Date().toISOString(),
          contextWindowUsed: 0,
          ragChunksUsed: 0,
          retryCount: 0,
          truncated: false,
          generationDurationMs: 100,
          promptTokens: 50,
          completionTokens: 50,
        },
        retryCount: 0,
        transientRetries: 0,
        truncated: false,
        artifactId: `artifact-${def.id}`,
      };
    });

    const orch = new Orchestrator(runner);
    const result = await orch.execute(defaultInput);

    expect(result.status).toBe('failed');
    expect(result.failedStep).toBe('agent-architecture');
    expect(result.error).toBe('Architecture generation failed');
    expect(result.completedSteps).toEqual(['requirements', 'agent-architecture']);

    expect(updateWorkflowStatus).toHaveBeenCalledWith('wf-1', 'failed', {
      errorCode: 'AGENT_FAILED',
      errorMessage: 'Agent agent-architecture failed: Architecture generation failed',
    });

    const failedStepCalls = (updateStepStatus as any).mock.calls.filter(
      (c: any[]) => c[1] === 'failed',
    );
    expect(failedStepCalls).toHaveLength(1);
    expect(failedStepCalls[0][2]).toMatchObject({
      errorCode: 'AGENT_ERROR',
      errorMessage: 'Architecture generation failed',
    });

    const agentIds = (createStep as any).mock.calls.map((c: any[]) => c[0].agentId);
    expect(agentIds).toEqual(['requirements', 'agent-architecture']);
  });

  it('safe-stop: signal aborted before Phase 3, workflow cancelled', async () => {
    const runner = mockRunner();
    const controller = new AbortController();
    const orch = new Orchestrator(runner);

    const executedAgents: string[] = [];
    const realRun = runner.run;
    runner.run = async (def: any, ctx: any) => {
      executedAgents.push(def.id);
      if (def.id === 'agent-architecture') {
        controller.abort();
      }
      return realRun(def, ctx);
    };

    const result = await orch.execute(defaultInput, controller.signal);

    expect(result.status).toBe('cancelled');
    expect(result.completedSteps).toEqual(['requirements', 'agent-architecture']);

    expect(updateWorkflowStatus).toHaveBeenCalledWith('wf-1', 'cancelled');
  });

  it('parallel fork/join: both security and cloud-cost succeed, outputs stored', async () => {
    const contextSnapshots: Record<string, unknown>[] = [];
    const runner = mockRunner((def, ctx) => {
      contextSnapshots.push({ agentId: def.id, inputKeys: Object.keys(ctx.input) });
      return {
        output: { result: `${def.id}-done` },
        provenance: {
          model: 'mock',
          promptVersion: 'v1',
          generatedAt: new Date().toISOString(),
          contextWindowUsed: 0,
          ragChunksUsed: 0,
          retryCount: 0,
          truncated: false,
          generationDurationMs: 100,
          promptTokens: 50,
          completionTokens: 50,
        },
        retryCount: 0,
        transientRetries: 0,
        truncated: false,
        artifactId: `artifact-${def.id}`,
      };
    });

    const orch = new Orchestrator(runner);
    const result = await orch.execute(defaultInput);

    expect(result.status).toBe('completed');

    const devsecopsCtx = contextSnapshots.find(s => s.agentId === 'devsecops');
    expect(devsecopsCtx).toBeDefined();
    expect(devsecopsCtx!.inputKeys).toContain('security');
    expect(devsecopsCtx!.inputKeys).toContain('architecture');

    const securityCall = (updateStepStatus as any).mock.calls.find(
      (c: any[]) => c[0] === 'step-3' && c[1] === 'completed',
    );
    const cloudCostCall = (updateStepStatus as any).mock.calls.find(
      (c: any[]) => c[0] === 'step-4' && c[1] === 'completed',
    );
    expect(securityCall).toBeDefined();
    expect(cloudCostCall).toBeDefined();
  });

  it('parallel partial failure: security fails, cloud-cost succeeds, devsecops runs with null security', async () => {
    const contextSnapshots: Record<string, unknown>[] = [];
    const runner = mockRunner((def, ctx) => {
      contextSnapshots.push({ agentId: def.id, input: ctx.input });
      if (def.id === 'security') {
        throw new Error('Security analysis failed');
      }
      return {
        output: { result: `${def.id}-done` },
        provenance: {
          model: 'mock',
          promptVersion: 'v1',
          generatedAt: new Date().toISOString(),
          contextWindowUsed: 0,
          ragChunksUsed: 0,
          retryCount: 0,
          truncated: false,
          generationDurationMs: 100,
          promptTokens: 50,
          completionTokens: 50,
        },
        retryCount: 0,
        transientRetries: 0,
        truncated: false,
        artifactId: `artifact-${def.id}`,
      };
    });

    const orch = new Orchestrator(runner);
    const result = await orch.execute(defaultInput);

    expect(result.status).toBe('completed');

    const devsecopsCtx = contextSnapshots.find(s => s.agentId === 'devsecops');
    expect(devsecopsCtx).toBeDefined();
    expect(devsecopsCtx!.input.security).toBeNull();

    const failedStepCalls = (updateStepStatus as any).mock.calls.filter(
      (c: any[]) => c[1] === 'failed',
    );
    expect(failedStepCalls).toHaveLength(1);

    const completedSteps = (updateStepStatus as any).mock.calls.filter(
      (c: any[]) => c[1] === 'completed',
    );
    expect(completedSteps).toHaveLength(6);
  });

  it('agent not found: unknown agentId, step failed, workflow failed', async () => {
    (getAgentDefinition as any).mockImplementation((id: string) => {
      if (id === 'unknown-agent') return undefined;
      return makeAgentDef(id);
    });

    const originalPhases = (Orchestrator as any).prototype;
    const orch = new Orchestrator(mockRunner());

    const input = {
      ...defaultInput,
      workflowId: 'wf-unknown',
    };

    const phases = [
      ['requirements'],
      ['unknown-agent'],
    ];

    Object.defineProperty(orch, 'phases', { value: phases, writable: false });

    const result = await orch.execute(input);

    expect(result.status).toBe('failed');
    expect(result.failedStep).toBe('unknown-agent');
    expect(result.error).toContain('not found in registry');
    expect(result.completedSteps).toContain('requirements');
    expect(result.completedSteps).toContain('unknown-agent');

    const failedStepCalls = (updateStepStatus as any).mock.calls.filter(
      (c: any[]) => c[1] === 'failed',
    );
    expect(failedStepCalls).toHaveLength(1);
    expect(failedStepCalls[0][2]).toMatchObject({
      errorCode: 'AGENT_NOT_FOUND',
    });

    expect(updateWorkflowStatus).toHaveBeenCalledWith('wf-unknown', 'failed', {
      errorCode: 'AGENT_FAILED',
      errorMessage: expect.stringContaining('not found in registry'),
    });
  });

  it('runner throws transient error: step failed with error message, workflow failed', async () => {
    const runner = mockRunner((def) => {
      if (def.id === 'requirements') {
        throw new AgentRunError('AGENT_TRANSIENT_FAILED', { attempts: 4 });
      }
      return {
        output: { result: `${def.id}-done` },
        provenance: {
          model: 'mock',
          promptVersion: 'v1',
          generatedAt: new Date().toISOString(),
          contextWindowUsed: 0,
          ragChunksUsed: 0,
          retryCount: 0,
          truncated: false,
          generationDurationMs: 100,
          promptTokens: 50,
          completionTokens: 50,
        },
        retryCount: 0,
        transientRetries: 0,
        truncated: false,
        artifactId: `artifact-${def.id}`,
      };
    });

    const orch = new Orchestrator(runner);
    const result = await orch.execute(defaultInput);

    expect(result.status).toBe('failed');
    expect(result.failedStep).toBe('requirements');
    expect(result.error).toContain('AGENT_TRANSIENT_FAILED');

    const failedStepCalls = (updateStepStatus as any).mock.calls.filter(
      (c: any[]) => c[1] === 'failed',
    );
    expect(failedStepCalls).toHaveLength(1);
    expect(failedStepCalls[0][2]).toMatchObject({
      errorCode: 'AGENT_TRANSIENT_FAILED',
      errorMessage: expect.stringContaining('AGENT_TRANSIENT_FAILED'),
    });
  });

  it('empty context: no idea provided, requirements validation fails, workflow failed', async () => {
    const runner = mockRunner((def) => {
      if (def.id === 'requirements') {
        throw new AgentRunError('AGENT_INPUT_INVALID', { issues: 'description: Required' });
      }
      return {
        output: { result: `${def.id}-done` },
        provenance: {
          model: 'mock',
          promptVersion: 'v1',
          generatedAt: new Date().toISOString(),
          contextWindowUsed: 0,
          ragChunksUsed: 0,
          retryCount: 0,
          truncated: false,
          generationDurationMs: 100,
          promptTokens: 50,
          completionTokens: 50,
        },
        retryCount: 0,
        transientRetries: 0,
        truncated: false,
        artifactId: `artifact-${def.id}`,
      };
    });

    const orch = new Orchestrator(runner);
    const result = await orch.execute({
      ...defaultInput,
      idea: '',
    });

    expect(result.status).toBe('failed');
    expect(result.failedStep).toBe('requirements');
    expect(result.error).toContain('AGENT_INPUT_INVALID');

    const failedStepCalls = (updateStepStatus as any).mock.calls.filter(
      (c: any[]) => c[1] === 'failed',
    );
    expect(failedStepCalls).toHaveLength(1);
    expect(failedStepCalls[0][2]).toMatchObject({
      errorCode: 'AGENT_INPUT_INVALID',
    });
  });
});
