import { describe, it, expect } from 'vitest';
import { qaAgent } from '../../src/agents/qa.js';
import { getAgentDefinition } from '../../src/agents/registry.js';
import type { RequirementsOutput } from '../../src/agents/schemas/requirements.js';
import type { ArchitectureOutput } from '../../src/agents/schemas/architecture.js';

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

const validArchitecture: ArchitectureOutput = {
  components: [
    { name: 'API Gateway', description: 'Handles routing', responsibilities: ['routing', 'auth'] },
  ],
  dataFlow: 'Client -> Gateway -> Services',
  techDecisions: [
    { decision: 'Node.js', rationale: 'Team expertise' },
  ],
  rationale: 'Simple microservices for small team',
};

describe('QA Agent', () => {
  it('has correct id', () => {
    expect(qaAgent.id).toBe('qa');
  });

  it('includes rag:read capability', () => {
    expect(qaAgent.capabilities).toContain('rag:read');
  });

  it('includes artifact:read:requirements capability', () => {
    expect(qaAgent.capabilities).toContain('artifact:read:requirements');
  });

  it('includes artifact:read:agent_architecture capability', () => {
    expect(qaAgent.capabilities).toContain('artifact:read:agent_architecture');
  });

  it('input schema accepts valid requirements and architecture', () => {
    const result = qaAgent.inputSchema.safeParse({
      requirements: validRequirements,
      architecture: validArchitecture,
    });
    expect(result.success).toBe(true);
  });

  it('input schema rejects missing requirements', () => {
    const result = qaAgent.inputSchema.safeParse({
      architecture: validArchitecture,
    });
    expect(result.success).toBe(false);
  });

  it('input schema rejects missing architecture', () => {
    const result = qaAgent.inputSchema.safeParse({
      requirements: validRequirements,
    });
    expect(result.success).toBe(false);
  });

  it('input schema rejects empty object', () => {
    const result = qaAgent.inputSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('is registered in the agent registry', () => {
    const registered = getAgentDefinition('qa');
    expect(registered).toBeDefined();
    expect(registered?.id).toBe('qa');
  });
});
