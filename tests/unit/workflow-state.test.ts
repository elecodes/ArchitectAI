import { describe, it, expect } from 'vitest';
import {
  assertWorkflowTransition,
  assertStepTransition,
  WorkflowStateError,
} from '../../src/agents/workflow-state.js';

describe('workflow state machine', () => {
  it('allows pending -> running', () => {
    expect(() => assertWorkflowTransition('pending', 'running')).not.toThrow();
  });

  it('allows pending -> cancelled (workflow cancelled before start)', () => {
    expect(() => assertWorkflowTransition('pending', 'cancelled')).not.toThrow();
  });

  it('allows running -> completed, failed and cancelled', () => {
    expect(() => assertWorkflowTransition('running', 'completed')).not.toThrow();
    expect(() => assertWorkflowTransition('running', 'failed')).not.toThrow();
    expect(() => assertWorkflowTransition('running', 'cancelled')).not.toThrow();
  });

  it('rejects terminal -> running: completed, failed and cancelled', () => {
    expect(() => assertWorkflowTransition('completed', 'running')).toThrow(WorkflowStateError);
    expect(() => assertWorkflowTransition('failed', 'running')).toThrow(WorkflowStateError);
    expect(() => assertWorkflowTransition('cancelled', 'running')).toThrow(WorkflowStateError);
  });

  it('rejects skipping states, e.g. pending -> completed', () => {
    expect(() => assertWorkflowTransition('pending', 'completed')).toThrow(WorkflowStateError);
    expect(() => assertWorkflowTransition('pending', 'failed')).toThrow(WorkflowStateError);
  });

  it('rejects running -> skipped at workflow level', () => {
    expect(() => assertWorkflowTransition('running', 'skipped' as never)).toThrow(WorkflowStateError);
  });

  it('throws WorkflowStateError with code INVALID_STATE_TRANSITION', () => {
    let caught: unknown;
    try {
      assertWorkflowTransition('completed', 'running');
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(WorkflowStateError);
    expect((caught as WorkflowStateError).code).toBe('INVALID_STATE_TRANSITION');
  });
});

describe('step state machine', () => {
  it('allows pending -> running', () => {
    expect(() => assertStepTransition('pending', 'running')).not.toThrow();
  });

  it('allows pending -> cancelled and pending -> skipped', () => {
    expect(() => assertStepTransition('pending', 'cancelled')).not.toThrow();
    expect(() => assertStepTransition('pending', 'skipped')).not.toThrow();
  });

  it('allows running -> completed, failed, cancelled and skipped', () => {
    expect(() => assertStepTransition('running', 'completed')).not.toThrow();
    expect(() => assertStepTransition('running', 'failed')).not.toThrow();
    expect(() => assertStepTransition('running', 'cancelled')).not.toThrow();
    expect(() => assertStepTransition('running', 'skipped')).not.toThrow();
  });

  it('rejects skipped -> running', () => {
    expect(() => assertStepTransition('skipped', 'running')).toThrow(WorkflowStateError);
    expect(() => assertStepTransition('skipped', 'failed')).toThrow(WorkflowStateError);
  });

  it('rejects terminal -> pending/completed with illegal source like completed -> failed', () => {
    expect(() => assertStepTransition('completed', 'failed')).toThrow(WorkflowStateError);
    expect(() => assertStepTransition('cancelled', 'pending')).toThrow(WorkflowStateError);
  });

  it('rejects skipping intermediate states, e.g. pending -> completed', () => {
    expect(() => assertStepTransition('pending', 'completed')).toThrow(WorkflowStateError);
    expect(() => assertStepTransition('skipped', 'completed')).toThrow(WorkflowStateError);
  });
});