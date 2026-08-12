import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/db/connection.js', () => ({
  getPool: () => poolMock,
}));

let poolMock: { query: ReturnType<typeof vi.fn> };

import {
  createWorkflow,
  getWorkflow,
  listWorkflows,
  updateWorkflowStatus,
  createStep,
  getStep,
  listSteps,
  updateStepStatus,
} from '../../src/db/repositories/agent-workflow-repo.js';

function workflowRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'wf-1',
    project_id: 'proj-1',
    status: 'pending',
    model: 'claude',
    provider: 'bedrock',
    created_at: new Date('2026-01-01T00:00:00Z'),
    started_at: null,
    completed_at: null,
    error_code: null,
    error_message: null,
    total_duration_ms: null,
    ...overrides,
  };
}

function stepRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'step-1',
    workflow_id: 'wf-1',
    agent_id: 'requirements',
    agent_name: 'Requirements Analyst',
    status: 'pending',
    result_artifact_id: null,
    parent_artifact_id: null,
    start_time: null,
    end_time: null,
    duration_ms: null,
    retry_count: 0,
    prompt_version: null,
    model: null,
    provider: null,
    prompt_tokens: null,
    completion_tokens: null,
    error_code: null,
    error_message: null,
    output: null,
    ...overrides,
  };
}

describe('agent-workflow-repo', () => {
  beforeEach(() => {
    poolMock = { query: vi.fn() };
  });

  describe('createWorkflow', () => {
    it('inserts a workflow and returns the mapped row', async () => {
      poolMock.query.mockResolvedValue({ rows: [workflowRow()] });

      const workflow = await createWorkflow({ projectId: 'proj-1', model: 'claude', provider: 'bedrock' });

      const [sql, params] = poolMock.query.mock.calls[0];
      expect(sql).toContain('INSERT INTO agent_workflows');
      expect(params).toEqual(['proj-1', 'claude', 'bedrock']);
      expect(workflow).toEqual({
        id: 'wf-1',
        projectId: 'proj-1',
        status: 'pending',
        model: 'claude',
        provider: 'bedrock',
        createdAt: new Date('2026-01-01T00:00:00Z'),
        startedAt: null,
        completedAt: null,
        errorCode: null,
        errorMessage: null,
        totalDurationMs: null,
      });
    });
  });

  describe('getWorkflow', () => {
    it('scopes the query to the workflow owner and returns null when not owned', async () => {
      poolMock.query.mockResolvedValue({ rows: [] });

      const workflow = await getWorkflow('wf-1', 'user-1');

      const [sql, params] = poolMock.query.mock.calls[0];
      expect(sql).toContain('JOIN projects p ON p.id = w.project_id');
      expect(sql).toContain('p.owner_id = $2');
      expect(params).toEqual(['wf-1', 'user-1']);
      expect(workflow).toBeNull();
    });

    it('returns the mapped workflow when owned', async () => {
      poolMock.query.mockResolvedValue({ rows: [workflowRow({ status: 'running' })] });

      const workflow = await getWorkflow('wf-1', 'user-1');

      expect(workflow).not.toBeNull();
      expect(workflow?.status).toBe('running');
    });
  });

  describe('listWorkflows', () => {
    it('scopes to the project owner and maps rows', async () => {
      poolMock.query.mockResolvedValue({ rows: [workflowRow({ id: 'wf-1' }), workflowRow({ id: 'wf-2' })] });

      const workflows = await listWorkflows('proj-1', 'user-1');

      const [sql, params] = poolMock.query.mock.calls[0];
      expect(sql).toContain('JOIN projects p ON p.id = w.project_id');
      expect(sql).toContain('p.owner_id = $2');
      expect(sql).toContain('ORDER BY w.created_at DESC');
      expect(params).toEqual(['proj-1', 'user-1']);
      expect(workflows).toHaveLength(2);
      expect(workflows[1].id).toBe('wf-2');
    });
  });

  describe('updateWorkflowStatus', () => {
    it('sets started_at when transitioning to running', async () => {
      poolMock.query.mockResolvedValue({ rows: [] });

      await updateWorkflowStatus('wf-1', 'running');

      const [sql, params] = poolMock.query.mock.calls[0];
      expect(sql).toContain("started_at = CASE WHEN $2 = 'running'");
      expect(sql).toContain("completed_at = CASE WHEN $2 IN ('completed', 'failed', 'cancelled')");
      expect(params[0]).toBe('wf-1');
      expect(params[1]).toBe('running');
    });

    it('includes partial error and duration fields', async () => {
      poolMock.query.mockResolvedValue({ rows: [] });

      await updateWorkflowStatus('wf-1', 'failed', {
        errorCode: 'LLM_TIMEOUT',
        errorMessage: 'upstream timed out',
        totalDurationMs: 45000,
      });

      const params = poolMock.query.mock.calls[0][1];
      expect(params[3]).toBe('LLM_TIMEOUT');
      expect(params[4]).toBe('upstream timed out');
      expect(params[5]).toBe(45000);
    });
  });

  describe('createStep', () => {
    it('inserts a step and returns the mapped row', async () => {
      poolMock.query.mockResolvedValue({ rows: [stepRow()] });

      const step = await createStep({ workflowId: 'wf-1', agentId: 'requirements', agentName: 'Requirements Analyst' });

      const [sql, params] = poolMock.query.mock.calls[0];
      expect(sql).toContain('INSERT INTO agent_workflow_steps');
      expect(params).toEqual(['wf-1', 'requirements', 'Requirements Analyst']);
      expect(step).toMatchObject({ workflowId: 'wf-1', agentId: 'requirements', agentName: 'Requirements Analyst' });
    });
  });

  describe('getStep', () => {
    it('scopes through workflows and project owner, returns null when not owned', async () => {
      poolMock.query.mockResolvedValue({ rows: [] });

      const step = await getStep('step-1', 'user-1');

      const [sql, params] = poolMock.query.mock.calls[0];
      expect(sql).toContain('JOIN agent_workflows w ON w.id = s.workflow_id');
      expect(sql).toContain('JOIN projects p ON p.id = w.project_id');
      expect(sql).toContain('p.owner_id = $2');
      expect(params).toEqual(['step-1', 'user-1']);
      expect(step).toBeNull();
    });
  });

  describe('listSteps', () => {
    it('scopes through workflows and project owner', async () => {
      poolMock.query.mockResolvedValue({ rows: [stepRow()] });

      const steps = await listSteps('wf-1', 'user-1');

      const [sql, params] = poolMock.query.mock.calls[0];
      expect(sql).toContain('JOIN agent_workflows w ON w.id = s.workflow_id');
      expect(sql).toContain('JOIN projects p ON p.id = w.project_id');
      expect(sql).toContain('p.owner_id = $2');
      expect(params).toEqual(['wf-1', 'user-1']);
      expect(steps).toHaveLength(1);
    });
  });

  describe('updateStepStatus', () => {
    it('includes partial fields and serializes output to JSON', async () => {
      poolMock.query.mockResolvedValue({ rows: [] });

      await updateStepStatus('step-1', 'completed', {
        resultArtifactId: 'art-9',
        durationMs: 1200,
        retryCount: 1,
        promptVersion: 'requirements-v1',
        model: 'claude',
        provider: 'bedrock',
        promptTokens: 100,
        completionTokens: 50,
        output: { summary: 'ok' },
      });

      const [sql, params] = poolMock.query.mock.calls[0];
      expect(sql).toContain('result_artifact_id = COALESCE($3');
      expect(sql).toContain('output = COALESCE($13');
      expect(sql).toContain("start_time = CASE WHEN $2 = 'running'");
      expect(sql).toContain("end_time = CASE WHEN $2 IN ('completed', 'failed', 'cancelled', 'skipped')");
      expect(params[2]).toBe('art-9');
      expect(params[4]).toBe(1);
      expect(params[8]).toBe(100);
      expect(params[12]).toBe(JSON.stringify({ summary: 'ok' }));
    });

    it('sets start_time when transitioning to running', async () => {
      poolMock.query.mockResolvedValue({ rows: [] });

      await updateStepStatus('step-1', 'running');

      const [sql, params] = poolMock.query.mock.calls[0];
      expect(sql).toContain("start_time = CASE WHEN $2 = 'running'");
      expect(params[1]).toBe('running');
    });
  });
});