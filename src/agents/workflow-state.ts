export type AgentWorkflowStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
export type AgentStepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'skipped';

export const WORKFLOW_TRANSITIONS: Record<AgentWorkflowStatus, AgentWorkflowStatus[]> = {
  pending: ['running', 'cancelled'],
  running: ['completed', 'failed', 'cancelled'],
  completed: [],
  failed: [],
  cancelled: [],
};

export const STEP_TRANSITIONS: Record<AgentStepStatus, AgentStepStatus[]> = {
  pending: ['running', 'cancelled', 'skipped'],
  running: ['completed', 'failed', 'cancelled', 'skipped'],
  completed: [],
  failed: [],
  cancelled: [],
  skipped: [],
};

export class WorkflowStateError extends Error {
  readonly code = 'INVALID_STATE_TRANSITION' as const;

  constructor(from: string, to: string, scope: 'workflow' | 'step') {
    super(`Invalid ${scope} state transition: ${from} -> ${to}`);
    this.name = 'WorkflowStateError';
  }
}

export function assertWorkflowTransition(from: AgentWorkflowStatus, to: AgentWorkflowStatus): void {
  assertTransition(from, to, WORKFLOW_TRANSITIONS, 'workflow');
}

export function assertStepTransition(from: AgentStepStatus, to: AgentStepStatus): void {
  assertTransition(from, to, STEP_TRANSITIONS, 'step');
}

function assertTransition<Status extends string>(
  from: Status,
  to: Status,
  transitions: Record<Status, Status[]>,
  scope: 'workflow' | 'step',
): void {
  if (!transitions[from].includes(to)) {
    throw new WorkflowStateError(from, to, scope);
  }
}