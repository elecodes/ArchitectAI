import { describe, it, expect } from 'vitest';
import { requirementsAgent } from '../../src/agents/requirements.js';
import { getAgentDefinition } from '../../src/agents/registry.js';

describe('Requirements Agent', () => {
  it('has correct id', () => {
    expect(requirementsAgent.id).toBe('requirements');
  });

  it('includes rag:read capability', () => {
    expect(requirementsAgent.capabilities).toContain('rag:read');
  });

  it('input schema accepts valid description', () => {
    const result = requirementsAgent.inputSchema.safeParse({
      description: 'A web application for task management',
    });
    expect(result.success).toBe(true);
  });

  it('input schema accepts description with context', () => {
    const result = requirementsAgent.inputSchema.safeParse({
      description: 'A web application for task management',
      context: 'Built with React and Node.js',
    });
    expect(result.success).toBe(true);
  });

  it('input schema rejects empty description', () => {
    const result = requirementsAgent.inputSchema.safeParse({
      description: '',
    });
    expect(result.success).toBe(false);
  });

  it('input schema rejects short description', () => {
    const result = requirementsAgent.inputSchema.safeParse({
      description: 'short',
    });
    expect(result.success).toBe(false);
  });

  it('input schema rejects missing description', () => {
    const result = requirementsAgent.inputSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('is registered in the agent registry', () => {
    const registered = getAgentDefinition('requirements');
    expect(registered).toBeDefined();
    expect(registered?.id).toBe('requirements');
  });
});
