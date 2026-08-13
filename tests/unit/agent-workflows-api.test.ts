import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  createWorkflow: vi.fn(),
  getWorkflow: vi.fn(),
  listWorkflows: vi.fn(),
  listSteps: vi.fn(),
  listAgentDefinitions: vi.fn(),
  orchestratorExecute: vi.fn(),
  authVerify: vi.fn(),
}));

vi.mock('../../src/db/connection.js', () => ({
  getPool: () => ({ query: vi.fn() }),
}));

vi.mock('../../src/db/repositories/agent-workflow-repo.js', () => ({
  createWorkflow: (...args: unknown[]) => mocks.createWorkflow(...args),
  getWorkflow: (...args: unknown[]) => mocks.getWorkflow(...args),
  listWorkflows: (...args: unknown[]) => mocks.listWorkflows(...args),
  listSteps: (...args: unknown[]) => mocks.listSteps(...args),
}));

vi.mock('../../src/agents/registry.js', () => ({
  listAgentDefinitions: () => mocks.listAgentDefinitions(),
}));

vi.mock('../../src/agents/orchestrator.js', () => ({
  Orchestrator: vi.fn().mockImplementation(() => ({
    execute: (...args: unknown[]) => mocks.orchestratorExecute(...args),
  })),
}));

vi.mock('../../src/agents/runner.js', () => ({
  AgentRunner: vi.fn(),
}));

vi.mock('../../src/llm/factory.js', () => ({
  createLLMClient: () => ({ generate: vi.fn() }),
  createEmbeddingClient: () => ({ generate: vi.fn() }),
}));

vi.mock('../../src/rag/retriever.js', () => ({
  RAGRetriever: vi.fn(),
}));

vi.mock('../../src/prompts/loader.js', () => ({
  loadPrompts: () => new Map(),
}));

vi.mock('../../src/config/index.js', () => ({
  config: {
    llmModel: 'test-model',
    llmContextWindow: 128000,
    llmProvider: 'test-provider',
  },
}));

vi.mock('../../src/logger.js', () => ({
  createChildLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn() }),
}));

vi.mock('jsonwebtoken', () => ({
  default: {
    verify: (...args: unknown[]) => mocks.authVerify(...args),
  },
}));

import { agentWorkflowsRouter } from '../../src/api/routes/agent-workflows.js';
import { agentsRouter } from '../../src/api/routes/agents.js';

type Handler = (req: any, res: any) => Promise<void>;

function extractHandler(router: any, method: string, path: string): Handler {
  const layer = router.stack.find(
    (l: any) => l.route?.path === path && l.route?.methods?.[method],
  );
  if (!layer) throw new Error(`No handler for ${method.toUpperCase()} ${path}`);
  return layer.route.stack[layer.route.stack.length - 1].handle;
}

function makeReq(overrides: Record<string, unknown> = {}) {
  return {
    headers: { authorization: 'Bearer valid-token' },
    body: {},
    query: {},
    params: {},
    userId: 'user-1',
    ...overrides,
  };
}

function makeRes() {
  return { status: vi.fn().mockReturnThis(), json: vi.fn() };
}

beforeEach(() => {
  mocks.createWorkflow.mockReset();
  mocks.getWorkflow.mockReset();
  mocks.listWorkflows.mockReset();
  mocks.listSteps.mockReset();
  mocks.listAgentDefinitions.mockReset();
  mocks.orchestratorExecute.mockReset();
  mocks.authVerify.mockReset();
  mocks.authVerify.mockReturnValue({ sub: 'user-1' });
});

describe('POST /api/agent-workflows', () => {
  const handler = extractHandler(agentWorkflowsRouter, 'post', '/');

  it('returns 201 with workflow on valid input', async () => {
    const fakeWorkflow = { id: 'wf-1', status: 'pending', model: 'test-model', provider: 'test-provider' };
    mocks.createWorkflow.mockResolvedValue(fakeWorkflow);
    mocks.orchestratorExecute.mockResolvedValue({ status: 'completed' });

    const req = makeReq({ body: { projectId: '550e8400-e29b-41d4-a716-446655440000', idea: 'Build a todo app with real-time sync and offline support' } });
    const res = makeRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ workflow: fakeWorkflow });
    expect(mocks.createWorkflow).toHaveBeenCalledWith({
      projectId: '550e8400-e29b-41d4-a716-446655440000',
      model: 'test-model',
      provider: 'test-provider',
    });
    expect(mocks.orchestratorExecute).toHaveBeenCalled();
  });

  it('returns 400 on invalid input', async () => {
    const req = makeReq({ body: { projectId: 'not-a-uuid', idea: 'short' } });
    const res = makeRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.objectContaining({ code: 'VALIDATION_ERROR' }) }),
    );
    expect(mocks.createWorkflow).not.toHaveBeenCalled();
  });

  it('returns 500 when createWorkflow throws', async () => {
    mocks.createWorkflow.mockRejectedValue(new Error('db down'));

    const req = makeReq({ body: { projectId: '550e8400-e29b-41d4-a716-446655440000', idea: 'Build a todo app with real-time sync and offline support' } });
    const res = makeRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.objectContaining({ code: 'WORKFLOW_CREATE_FAILED' }) }),
    );
  });
});

describe('GET /api/agent-workflows', () => {
  const handler = extractHandler(agentWorkflowsRouter, 'get', '/');

  it('returns list of workflows', async () => {
    const fakeWorkflows = [{ id: 'wf-1' }, { id: 'wf-2' }];
    mocks.listWorkflows.mockResolvedValue(fakeWorkflows);

    const req = makeReq({ query: { projectId: '550e8400-e29b-41d4-a716-446655440000' } });
    const res = makeRes();
    await handler(req, res);

    expect(res.json).toHaveBeenCalledWith({ workflows: fakeWorkflows });
  });

  it('returns 400 when projectId is missing', async () => {
    const req = makeReq({ query: {} });
    const res = makeRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.objectContaining({ code: 'VALIDATION_ERROR' }) }),
    );
  });
});

describe('GET /api/agent-workflows/:id/status', () => {
  const handler = extractHandler(agentWorkflowsRouter, 'get', '/:id/status');

  it('returns workflow and steps', async () => {
    const fakeWorkflow = { id: 'wf-1', status: 'running' };
    const fakeSteps = [{ id: 'step-1', agentId: 'requirements' }];
    mocks.getWorkflow.mockResolvedValue(fakeWorkflow);
    mocks.listSteps.mockResolvedValue(fakeSteps);

    const req = makeReq({ params: { id: 'wf-1' } });
    const res = makeRes();
    await handler(req, res);

    expect(res.json).toHaveBeenCalledWith({ workflow: fakeWorkflow, steps: fakeSteps });
  });

  it('returns 404 when workflow not found', async () => {
    mocks.getWorkflow.mockResolvedValue(null);

    const req = makeReq({ params: { id: 'wf-999' } });
    const res = makeRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.objectContaining({ code: 'NOT_FOUND' }) }),
    );
  });
});

describe('GET /api/agents', () => {
  const handler = extractHandler(agentsRouter, 'get', '/');

  it('returns agent list with expected fields', async () => {
    mocks.listAgentDefinitions.mockReturnValue([
      {
        id: 'requirements',
        name: 'Requirements Analyst',
        description: 'Analyzes requirements',
        capabilities: ['rag:read'],
        timeoutMs: 30000,
        promptName: 'requirements',
        artifactType: 'requirements',
        inputSchema: {},
        outputSchema: {},
        maxTransientRetries: 2,
      },
    ]);

    const req = makeReq();
    const res = makeRes();
    await handler(req, res);

    expect(res.json).toHaveBeenCalledWith({
      agents: [
        {
          id: 'requirements',
          name: 'Requirements Analyst',
          description: 'Analyzes requirements',
          capabilities: ['rag:read'],
          timeoutMs: 30000,
        },
      ],
    });
  });

  it('returns empty list when no agents registered', async () => {
    mocks.listAgentDefinitions.mockReturnValue([]);

    const req = makeReq();
    const res = makeRes();
    await handler(req, res);

    expect(res.json).toHaveBeenCalledWith({ agents: [] });
  });
});
