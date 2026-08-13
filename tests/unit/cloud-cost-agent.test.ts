import { describe, it, expect } from 'vitest';
import { cloudCostAgent } from '../../src/agents/cloud-cost.js';
import { getAgentDefinition } from '../../src/agents/registry.js';
import { RequirementsSchema } from '../../src/agents/schemas/requirements.js';
import { ArchitectureSchema } from '../../src/agents/schemas/architecture.js';

const validReqs = {
  clarifiedRequirements: 'A scalable cloud application',
  functionalRequirements: [
    { id: 'FR-1', description: 'Users can access via web', priority: 'must' as const },
  ],
  nonFunctionalRequirements: [
    { category: 'scalability', description: 'Handle 10k concurrent users', metric: 'requests/sec' },
  ],
  assumptions: ['AWS account is available'],
  risks: ['Cloud cost overruns'],
  acceptanceCriteria: ['Monthly cost stays under $500'],
};

const validArch = {
  components: [
    { name: 'Load Balancer', description: 'Distributes traffic', responsibilities: ['routing', 'health checks'] },
    { name: 'Compute', description: 'Runs application logic', responsibilities: ['request handling'] },
  ],
  dataFlow: 'Client -> Load Balancer -> Compute -> Database',
  techDecisions: [
    { decision: 'AWS ECS Fargate', rationale: 'Serverless containers reduce ops overhead' },
    { decision: 'RDS PostgreSQL', rationale: 'Managed DB reduces maintenance' },
  ],
  rationale: 'Serverless-first approach to minimize operational burden',
  tradeoffs: ['Vendor lock-in vs operational simplicity'],
};

describe('Cloud Cost Agent', () => {
  it('has correct id', () => {
    expect(cloudCostAgent.id).toBe('cloud-cost');
  });

  it('includes expected capabilities', () => {
    expect(cloudCostAgent.capabilities).toContain('rag:read');
    expect(cloudCostAgent.capabilities).toContain('artifact:read:agent_architecture');
    expect(cloudCostAgent.capabilities).toContain('artifact:read:requirements');
  });

  it('input schema accepts valid architecture and requirements', () => {
    const result = cloudCostAgent.inputSchema.safeParse({
      architecture: validArch,
      requirements: validReqs,
    });
    expect(result.success).toBe(true);
  });

  it('input schema rejects missing architecture', () => {
    const result = cloudCostAgent.inputSchema.safeParse({
      requirements: validReqs,
    });
    expect(result.success).toBe(false);
  });

  it('input schema rejects missing requirements', () => {
    const result = cloudCostAgent.inputSchema.safeParse({
      architecture: validArch,
    });
    expect(result.success).toBe(false);
  });

  it('input schema rejects empty object', () => {
    const result = cloudCostAgent.inputSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('is registered in the agent registry', () => {
    const registered = getAgentDefinition('cloud-cost');
    expect(registered).toBeDefined();
    expect(registered?.id).toBe('cloud-cost');
  });
});
