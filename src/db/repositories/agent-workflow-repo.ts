import { getPool } from '../connection.js';
import { createChildLogger } from '../../logger.js';
import type { AgentStepStatus, AgentWorkflowStatus } from '../../agents/workflow-state.js';

export type { AgentStepStatus, AgentWorkflowStatus } from '../../agents/workflow-state.js';

const log = createChildLogger('agent-workflow-repo');

export interface AgentWorkflow {
  id: string;
  projectId: string;
  status: AgentWorkflowStatus;
  model: string;
  provider: string;
  createdAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  errorCode: string | null;
  errorMessage: string | null;
  totalDurationMs: number | null;
}

export interface AgentWorkflowStep {
  id: string;
  workflowId: string;
  agentId: string;
  agentName: string;
  status: AgentStepStatus;
  resultArtifactId: string | null;
  parentArtifactId: string | null;
  startTime: Date | null;
  endTime: Date | null;
  durationMs: number | null;
  retryCount: number;
  promptVersion: string | null;
  model: string | null;
  provider: string | null;
  promptTokens: number | null;
  completionTokens: number | null;
  errorCode: string | null;
  errorMessage: string | null;
  output: Record<string, unknown> | null;
}

export interface UpdateWorkflowStatusPartial {
  errorCode?: string;
  errorMessage?: string;
  completedAt?: Date;
  totalDurationMs?: number;
}

export interface UpdateStepStatusPartial {
  resultArtifactId?: string;
  durationMs?: number;
  retryCount?: number;
  promptVersion?: string;
  model?: string;
  provider?: string;
  promptTokens?: number;
  completionTokens?: number;
  errorCode?: string;
  errorMessage?: string;
  output?: Record<string, unknown>;
}

async function query(
  text: string,
  params: unknown[],
  operation: string,
): Promise<{ rows: Record<string, unknown>[] }> {
  const pool = getPool();
  try {
    return await pool.query(text, params);
  } catch (err) {
    log.error({ err: (err as Error).message }, `${operation} failed`);
    throw err;
  }
}

export async function createWorkflow(data: {
  projectId: string;
  model: string;
  provider: string;
}): Promise<AgentWorkflow> {
  const { rows } = await query(
    'INSERT INTO agent_workflows (project_id, model, provider) VALUES ($1, $2, $3) RETURNING *',
    [data.projectId, data.model, data.provider],
    'createWorkflow',
  );
  return mapWorkflowRow(rows[0]);
}

export async function getWorkflow(id: string, userId: string): Promise<AgentWorkflow | null> {
  const { rows } = await query(
    `SELECT w.* FROM agent_workflows w
     JOIN projects p ON p.id = w.project_id
     WHERE w.id = $1 AND p.owner_id = $2`,
    [id, userId],
    'getWorkflow',
  );
  return rows.length > 0 ? mapWorkflowRow(rows[0]) : null;
}

export async function listWorkflows(projectId: string, userId: string): Promise<AgentWorkflow[]> {
  const { rows } = await query(
    `SELECT w.* FROM agent_workflows w
     JOIN projects p ON p.id = w.project_id
     WHERE w.project_id = $1 AND p.owner_id = $2
     ORDER BY w.created_at DESC`,
    [projectId, userId],
    'listWorkflows',
  );
  return rows.map(mapWorkflowRow);
}

export async function updateWorkflowStatus(
  id: string,
  status: AgentWorkflowStatus,
  partial: UpdateWorkflowStatusPartial = {},
): Promise<void> {
  await query(
    `UPDATE agent_workflows SET
       status = $2,
       started_at = CASE WHEN $2 = 'running' THEN COALESCE(started_at, NOW()) ELSE started_at END,
       completed_at = CASE WHEN $2 IN ('completed', 'failed', 'cancelled') THEN COALESCE(completed_at, $3) ELSE completed_at END,
       error_code = COALESCE($4, error_code),
       error_message = COALESCE($5, error_message),
       total_duration_ms = COALESCE($6, total_duration_ms)
     WHERE id = $1`,
    [
      id,
      status,
      partial.completedAt ?? new Date(),
      partial.errorCode ?? null,
      partial.errorMessage ?? null,
      partial.totalDurationMs ?? null,
    ],
    'updateWorkflowStatus',
  );
}

export async function createStep(data: {
  workflowId: string;
  agentId: string;
  agentName: string;
}): Promise<AgentWorkflowStep> {
  const { rows } = await query(
    'INSERT INTO agent_workflow_steps (workflow_id, agent_id, agent_name) VALUES ($1, $2, $3) RETURNING *',
    [data.workflowId, data.agentId, data.agentName],
    'createStep',
  );
  return mapStepRow(rows[0]);
}

export async function getStep(id: string, userId: string): Promise<AgentWorkflowStep | null> {
  const { rows } = await query(
    `SELECT s.* FROM agent_workflow_steps s
     JOIN agent_workflows w ON w.id = s.workflow_id
     JOIN projects p ON p.id = w.project_id
     WHERE s.id = $1 AND p.owner_id = $2`,
    [id, userId],
    'getStep',
  );
  return rows.length > 0 ? mapStepRow(rows[0]) : null;
}

export async function listSteps(workflowId: string, userId: string): Promise<AgentWorkflowStep[]> {
  const { rows } = await query(
    `SELECT s.* FROM agent_workflow_steps s
     JOIN agent_workflows w ON w.id = s.workflow_id
     JOIN projects p ON p.id = w.project_id
     WHERE s.workflow_id = $1 AND p.owner_id = $2
     ORDER BY s.start_time ASC`,
    [workflowId, userId],
    'listSteps',
  );
  return rows.map(mapStepRow);
}

export async function updateStepStatus(
  stepId: string,
  status: AgentStepStatus,
  partial: UpdateStepStatusPartial = {},
): Promise<void> {
  const output = partial.output === undefined ? null : JSON.stringify(partial.output);
  await query(
    `UPDATE agent_workflow_steps SET
       status = $2,
       result_artifact_id = COALESCE($3, result_artifact_id),
       duration_ms = COALESCE($4, duration_ms),
       retry_count = COALESCE($5, retry_count),
       prompt_version = COALESCE($6, prompt_version),
       model = COALESCE($7, model),
       provider = COALESCE($8, provider),
       prompt_tokens = COALESCE($9, prompt_tokens),
       completion_tokens = COALESCE($10, completion_tokens),
       error_code = COALESCE($11, error_code),
       error_message = COALESCE($12, error_message),
       output = COALESCE($13, output),
       start_time = CASE WHEN $2 = 'running' THEN COALESCE(start_time, NOW()) ELSE start_time END,
       end_time = CASE WHEN $2 IN ('completed', 'failed', 'cancelled', 'skipped') THEN COALESCE(end_time, NOW()) ELSE end_time END
     WHERE id = $1`,
    [
      stepId,
      status,
      partial.resultArtifactId ?? null,
      partial.durationMs ?? null,
      partial.retryCount ?? null,
      partial.promptVersion ?? null,
      partial.model ?? null,
      partial.provider ?? null,
      partial.promptTokens ?? null,
      partial.completionTokens ?? null,
      partial.errorCode ?? null,
      partial.errorMessage ?? null,
      output,
    ],
    'updateStepStatus',
  );
}

function mapWorkflowRow(row: Record<string, unknown>): AgentWorkflow {
  return {
    id: row.id as string,
    projectId: row.project_id as string,
    status: row.status as AgentWorkflowStatus,
    model: row.model as string,
    provider: row.provider as string,
    createdAt: row.created_at as Date,
    startedAt: row.started_at as Date | null,
    completedAt: row.completed_at as Date | null,
    errorCode: row.error_code as string | null,
    errorMessage: row.error_message as string | null,
    totalDurationMs: row.total_duration_ms as number | null,
  };
}

function mapStepRow(row: Record<string, unknown>): AgentWorkflowStep {
  return {
    id: row.id as string,
    workflowId: row.workflow_id as string,
    agentId: row.agent_id as string,
    agentName: row.agent_name as string,
    status: row.status as AgentStepStatus,
    resultArtifactId: row.result_artifact_id as string | null,
    parentArtifactId: row.parent_artifact_id as string | null,
    startTime: row.start_time as Date | null,
    endTime: row.end_time as Date | null,
    durationMs: row.duration_ms as number | null,
    retryCount: row.retry_count as number,
    promptVersion: row.prompt_version as string | null,
    model: row.model as string | null,
    provider: row.provider as string | null,
    promptTokens: row.prompt_tokens as number | null,
    completionTokens: row.completion_tokens as number | null,
    errorCode: row.error_code as string | null,
    errorMessage: row.error_message as string | null,
    output: row.output as Record<string, unknown> | null,
  };
}