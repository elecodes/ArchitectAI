import { describe, it, expect } from 'vitest';
import { devsecopsAgent } from '../../src/agents/devsecops.js';
import { getAgentDefinition } from '../../src/agents/registry.js';
import type { ArchitectureOutput } from '../../src/agents/schemas/architecture.js';
import type { SecurityOutput } from '../../src/agents/schemas/security.js';

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

const validSecurity: SecurityOutput = {
  threats: [
    { threat: 'SQL injection', severity: 'high', mitigation: 'Use parameterized queries', owaspCategory: 'A03:2021' },
  ],
  controls: ['WAF', 'input validation'],
  authentication: 'JWT with refresh tokens',
  authorization: 'RBAC',
  recommendations: ['Enable HTTPS everywhere'],
};

describe('DevSecOps Agent', () => {
  it('has correct id', () => {
    expect(devsecopsAgent.id).toBe('devsecops');
  });

  it('includes rag:read capability', () => {
    expect(devsecopsAgent.capabilities).toContain('rag:read');
  });

  it('includes artifact:read:agent_architecture capability', () => {
    expect(devsecopsAgent.capabilities).toContain('artifact:read:agent_architecture');
  });

  it('includes artifact:read:security_analysis capability', () => {
    expect(devsecopsAgent.capabilities).toContain('artifact:read:security_analysis');
  });

  it('input schema accepts valid architecture and security', () => {
    const result = devsecopsAgent.inputSchema.safeParse({
      architecture: validArchitecture,
      security: validSecurity,
    });
    expect(result.success).toBe(true);
  });

  it('input schema rejects missing architecture', () => {
    const result = devsecopsAgent.inputSchema.safeParse({
      security: validSecurity,
    });
    expect(result.success).toBe(false);
  });

  it('input schema rejects missing security', () => {
    const result = devsecopsAgent.inputSchema.safeParse({
      architecture: validArchitecture,
    });
    expect(result.success).toBe(false);
  });

  it('input schema rejects empty object', () => {
    const result = devsecopsAgent.inputSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('is registered in the agent registry', () => {
    const registered = getAgentDefinition('devsecops');
    expect(registered).toBeDefined();
    expect(registered?.id).toBe('devsecops');
  });
});
