import { describe, it, expect } from 'vitest';
import { architectureAgent } from '../../src/agents/architecture.js';
import { getAgentDefinition } from '../../src/agents/registry.js';
import type { RequirementsOutput } from '../../src/agents/schemas/requirements.js';

const validRequirements: RequirementsOutput = {
  clarifiedRequirements: 'A task management system for small teams',
  functionalRequirements: [
    { id: 'FR-1', description: 'Users can create tasks', priority: 'must' },
  ],
  nonFunctionalRequirements: [],
  assumptions: [],
  risks: [],
  acceptanceCriteria: [],
};

describe('Architecture Agent', () => {
  it('has correct id', () => {
    expect(architectureAgent.id).toBe('agent-architecture');
  });

  it('includes rag:read capability', () => {
    expect(architectureAgent.capabilities).toContain('rag:read');
  });

  it('includes artifact:read:requirements capability', () => {
    expect(architectureAgent.capabilities).toContain('artifact:read:requirements');
  });

  it('input schema accepts valid requirements', () => {
    const result = architectureAgent.inputSchema.safeParse({
      requirements: validRequirements,
    });
    expect(result.success).toBe(true);
  });

  it('input schema accepts requirements with project context', () => {
    const result = architectureAgent.inputSchema.safeParse({
      requirements: validRequirements,
      projectContext: 'Existing Node.js backend',
    });
    expect(result.success).toBe(true);
  });

  it('input schema rejects missing requirements', () => {
    const result = architectureAgent.inputSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('input schema rejects invalid requirements structure', () => {
    const result = architectureAgent.inputSchema.safeParse({
      requirements: { clarifiedRequirements: 'incomplete' },
    });
    expect(result.success).toBe(false);
  });

  it('is registered in the agent registry', () => {
    const registered = getAgentDefinition('agent-architecture');
    expect(registered).toBeDefined();
    expect(registered?.id).toBe('agent-architecture');
  });
});
