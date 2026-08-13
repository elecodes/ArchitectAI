import { describe, it, expect } from 'vitest';
import { synthesisAgent } from '../../src/agents/synthesis.js';
import { getAgentDefinition } from '../../src/agents/registry.js';
import type { RequirementsOutput } from '../../src/agents/schemas/requirements.js';
import type { ArchitectureOutput } from '../../src/agents/schemas/architecture.js';
import type { SecurityOutput } from '../../src/agents/schemas/security.js';
import type { CloudCostOutput } from '../../src/agents/schemas/cloud-cost.js';
import type { DevSecOpsOutput } from '../../src/agents/schemas/devsecops.js';
import type { QAOutput } from '../../src/agents/schemas/qa.js';

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

const validSecurity: SecurityOutput = {
  threats: [
    { threat: 'SQL injection', severity: 'high', mitigation: 'Use parameterized queries' },
  ],
  controls: ['WAF'],
  authentication: 'JWT',
  authorization: 'RBAC',
  recommendations: ['Enable HTTPS'],
};

const validCloudCost: CloudCostOutput = {
  deploymentArchitecture: 'Single region on AWS',
  awsRecommendations: [
    { service: 'EC2', useCase: 'Compute', estimatedMonthlyCost: '$50' },
  ],
  totalEstimatedMonthlyCost: '$100',
  freeTierAlternatives: ['Lambda for small workloads'],
  localAlternatives: ['Docker Compose for dev'],
};

const validDevSecOps: DevSecOpsOutput = {
  cicdPipeline: 'GitHub Actions based pipeline',
  stages: [
    { name: 'build', description: 'Compile and bundle', tools: ['npm', 'webpack'] },
  ],
  dockerConfig: 'Multi-stage Dockerfile',
  deploymentStrategy: 'Blue-green on ECS',
  securityAutomation: ['Snyk scanning'],
  operationalNotes: ['Monitor error rates'],
};

const validQA: QAOutput = {
  testStrategy: 'Test pyramid with heavy unit tests',
  testLevels: [
    { level: 'unit', description: 'Component tests', coverage: '80%' },
  ],
  testCases: [
    { name: 'Create task', description: 'User creates a task', priority: 'high', type: 'e2e' },
  ],
  edgeCases: ['Empty task title'],
  acceptanceCriteria: ['All must-have features work'],
  qualityRisks: [
    { risk: 'Low test coverage', severity: 'medium', mitigation: 'Add integration tests' },
  ],
};

describe('Synthesis Agent', () => {
  it('has correct id', () => {
    expect(synthesisAgent.id).toBe('synthesis');
  });

  it('includes rag:read capability', () => {
    expect(synthesisAgent.capabilities).toContain('rag:read');
  });

  it('includes artifact:read:requirements capability', () => {
    expect(synthesisAgent.capabilities).toContain('artifact:read:requirements');
  });

  it('includes artifact:read:agent_architecture capability', () => {
    expect(synthesisAgent.capabilities).toContain('artifact:read:agent_architecture');
  });

  it('includes artifact:read:security_analysis capability', () => {
    expect(synthesisAgent.capabilities).toContain('artifact:read:security_analysis');
  });

  it('includes artifact:read:cloud_cost_analysis capability', () => {
    expect(synthesisAgent.capabilities).toContain('artifact:read:cloud_cost_analysis');
  });

  it('includes artifact:read:devsecops_analysis capability', () => {
    expect(synthesisAgent.capabilities).toContain('artifact:read:devsecops_analysis');
  });

  it('includes artifact:read:test_strategy capability', () => {
    expect(synthesisAgent.capabilities).toContain('artifact:read:test_strategy');
  });

  it('input schema accepts all valid inputs', () => {
    const result = synthesisAgent.inputSchema.safeParse({
      requirements: validRequirements,
      architecture: validArchitecture,
      security: validSecurity,
      cloudCost: validCloudCost,
      devsecops: validDevSecOps,
      qa: validQA,
    });
    expect(result.success).toBe(true);
  });

  it('input schema rejects missing requirements', () => {
    const result = synthesisAgent.inputSchema.safeParse({
      architecture: validArchitecture,
      security: validSecurity,
      cloudCost: validCloudCost,
      devsecops: validDevSecOps,
      qa: validQA,
    });
    expect(result.success).toBe(false);
  });

  it('input schema rejects missing architecture', () => {
    const result = synthesisAgent.inputSchema.safeParse({
      requirements: validRequirements,
      security: validSecurity,
      cloudCost: validCloudCost,
      devsecops: validDevSecOps,
      qa: validQA,
    });
    expect(result.success).toBe(false);
  });

  it('input schema rejects missing security', () => {
    const result = synthesisAgent.inputSchema.safeParse({
      requirements: validRequirements,
      architecture: validArchitecture,
      cloudCost: validCloudCost,
      devsecops: validDevSecOps,
      qa: validQA,
    });
    expect(result.success).toBe(false);
  });

  it('input schema rejects missing cloudCost', () => {
    const result = synthesisAgent.inputSchema.safeParse({
      requirements: validRequirements,
      architecture: validArchitecture,
      security: validSecurity,
      devsecops: validDevSecOps,
      qa: validQA,
    });
    expect(result.success).toBe(false);
  });

  it('input schema rejects missing devsecops', () => {
    const result = synthesisAgent.inputSchema.safeParse({
      requirements: validRequirements,
      architecture: validArchitecture,
      security: validSecurity,
      cloudCost: validCloudCost,
      qa: validQA,
    });
    expect(result.success).toBe(false);
  });

  it('input schema rejects missing qa', () => {
    const result = synthesisAgent.inputSchema.safeParse({
      requirements: validRequirements,
      architecture: validArchitecture,
      security: validSecurity,
      cloudCost: validCloudCost,
      devsecops: validDevSecOps,
    });
    expect(result.success).toBe(false);
  });

  it('input schema rejects empty object', () => {
    const result = synthesisAgent.inputSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('is registered in the agent registry', () => {
    const registered = getAgentDefinition('synthesis');
    expect(registered).toBeDefined();
    expect(registered?.id).toBe('synthesis');
  });
});
