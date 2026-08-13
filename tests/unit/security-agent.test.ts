import { describe, it, expect } from 'vitest';
import { securityAgent } from '../../src/agents/security.js';
import { getAgentDefinition } from '../../src/agents/registry.js';
import { RequirementsSchema } from '../../src/agents/schemas/requirements.js';
import { ArchitectureSchema } from '../../src/agents/schemas/architecture.js';

const validReqs = {
  clarifiedRequirements: 'A secure task management system',
  functionalRequirements: [
    { id: 'FR-1', description: 'Users can create tasks', priority: 'must' as const },
  ],
  nonFunctionalRequirements: [
    { category: 'security', description: 'All data encrypted at rest', metric: 'AES-256' },
  ],
  assumptions: ['Users have valid credentials'],
  risks: ['Unauthorized access attempts'],
  acceptanceCriteria: ['Login requires MFA'],
};

const validArch = {
  components: [
    { name: 'API Gateway', description: 'Routes requests', responsibilities: ['rate limiting', 'auth'] },
  ],
  dataFlow: 'Client -> API Gateway -> Backend -> Database',
  techDecisions: [
    { decision: 'PostgreSQL', rationale: 'ACID compliance for financial data' },
  ],
  rationale: 'Layered architecture for separation of concerns',
};

describe('Security Agent', () => {
  it('has correct id', () => {
    expect(securityAgent.id).toBe('security');
  });

  it('includes expected capabilities', () => {
    expect(securityAgent.capabilities).toContain('rag:read');
    expect(securityAgent.capabilities).toContain('artifact:read:requirements');
    expect(securityAgent.capabilities).toContain('artifact:read:agent_architecture');
  });

  it('input schema accepts valid requirements and architecture', () => {
    const result = securityAgent.inputSchema.safeParse({
      requirements: validReqs,
      architecture: validArch,
    });
    expect(result.success).toBe(true);
  });

  it('input schema rejects missing requirements', () => {
    const result = securityAgent.inputSchema.safeParse({
      architecture: validArch,
    });
    expect(result.success).toBe(false);
  });

  it('input schema rejects missing architecture', () => {
    const result = securityAgent.inputSchema.safeParse({
      requirements: validReqs,
    });
    expect(result.success).toBe(false);
  });

  it('input schema rejects empty object', () => {
    const result = securityAgent.inputSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('is registered in the agent registry', () => {
    const registered = getAgentDefinition('security');
    expect(registered).toBeDefined();
    expect(registered?.id).toBe('security');
  });
});
