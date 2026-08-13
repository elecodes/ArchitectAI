import { describe, it, expect } from 'vitest';
import { RequirementsSchema } from '../../src/agents/schemas/requirements.js';
import { ArchitectureSchema } from '../../src/agents/schemas/architecture.js';
import { SecuritySchema } from '../../src/agents/schemas/security.js';
import { CloudCostSchema } from '../../src/agents/schemas/cloud-cost.js';
import { DevSecOpsSchema } from '../../src/agents/schemas/devsecops.js';
import { QASchema } from '../../src/agents/schemas/qa.js';
import { SynthesisSchema } from '../../src/agents/schemas/synthesis.js';

describe('RequirementsSchema', () => {
  it('passes valid input', () => {
    const result = RequirementsSchema.safeParse({
      clarifiedRequirements: 'Summary',
      functionalRequirements: [{ id: 'FR-1', description: 'Login', priority: 'must' }],
      nonFunctionalRequirements: [{ category: 'performance', description: 'Fast', metric: '<200ms' }],
      assumptions: ['Users have accounts'],
      risks: ['API rate limits'],
      acceptanceCriteria: ['WHEN user logs in THEN dashboard loads'],
    });
    expect(result.success).toBe(true);
  });

  it('fails when functionalRequirements is empty', () => {
    const result = RequirementsSchema.safeParse({
      clarifiedRequirements: 'Summary',
      functionalRequirements: [],
      nonFunctionalRequirements: [],
      assumptions: [],
      risks: [],
      acceptanceCriteria: [],
    });
    expect(result.success).toBe(false);
  });
});

describe('ArchitectureSchema', () => {
  it('passes valid input', () => {
    const result = ArchitectureSchema.safeParse({
      components: [{ name: 'API', description: 'REST API', responsibilities: ['Handle requests'] }],
      dataFlow: 'Client → API → DB',
      techDecisions: [{ decision: 'Use PostgreSQL', rationale: 'ACID compliance' }],
      rationale: 'Scalable design',
    });
    expect(result.success).toBe(true);
  });

  it('fails when components is empty', () => {
    const result = ArchitectureSchema.safeParse({
      components: [],
      dataFlow: '...',
      techDecisions: [{ decision: 'x', rationale: 'y' }],
      rationale: '...',
    });
    expect(result.success).toBe(false);
  });
});

describe('SecuritySchema', () => {
  it('passes valid input', () => {
    const result = SecuritySchema.safeParse({
      threats: [{ threat: 'SQL Injection', severity: 'high', mitigation: 'Parameterized queries', owaspCategory: 'A03:2021' }],
      controls: ['Input validation'],
      authentication: 'JWT tokens',
      authorization: 'RBAC',
      recommendations: ['Enable HTTPS'],
    });
    expect(result.success).toBe(true);
  });

  it('fails on invalid severity', () => {
    const result = SecuritySchema.safeParse({
      threats: [{ threat: 'XSS', severity: 'ultra', mitigation: 'Sanitize' }],
      controls: [],
      authentication: 'OAuth',
      authorization: 'ABAC',
      recommendations: [],
    });
    expect(result.success).toBe(false);
  });
});

describe('CloudCostSchema', () => {
  it('passes valid input', () => {
    const result = CloudCostSchema.safeParse({
      deploymentArchitecture: 'Serverless on AWS',
      awsRecommendations: [{ service: 'Lambda', useCase: 'API', estimatedMonthlyCost: '$5.00' }],
      totalEstimatedMonthlyCost: '$50.00',
      freeTierAlternatives: ['Lambda free tier'],
      localAlternatives: ['Docker Compose'],
    });
    expect(result.success).toBe(true);
  });

  it('fails when required string fields are missing', () => {
    const result = CloudCostSchema.safeParse({
      awsRecommendations: [],
      totalEstimatedMonthlyCost: '$0',
      freeTierAlternatives: [],
      localAlternatives: [],
    });
    expect(result.success).toBe(false);
  });
});

describe('DevSecOpsSchema', () => {
  it('passes valid input', () => {
    const result = DevSecOpsSchema.safeParse({
      cicdPipeline: 'GitHub Actions pipeline',
      stages: [{ name: 'build', description: 'Compile', tools: ['tsc'] }],
      dockerConfig: 'Multi-stage build',
      deploymentStrategy: 'Canary',
      securityAutomation: ['SAST scanning'],
      operationalNotes: ['Monitor logs'],
    });
    expect(result.success).toBe(true);
  });

  it('fails when required string fields are missing', () => {
    const result = DevSecOpsSchema.safeParse({
      stages: [],
      dockerConfig: '...',
      deploymentStrategy: 'Rolling',
      securityAutomation: [],
      operationalNotes: [],
    });
    expect(result.success).toBe(false);
  });
});

describe('QASchema', () => {
  it('passes valid input', () => {
    const result = QASchema.safeParse({
      testStrategy: 'Test pyramid approach',
      testLevels: [{ level: 'unit', description: 'Component tests', coverage: '80%' }],
      testCases: [{ name: 'Login test', description: 'Valid credentials', priority: 'high', type: 'unit' }],
      edgeCases: ['Empty password'],
      acceptanceCriteria: ['WHEN login succeeds THEN redirect to dashboard'],
      qualityRisks: [{ risk: 'Flaky tests', severity: 'medium', mitigation: 'Retry logic' }],
    });
    expect(result.success).toBe(true);
  });

  it('fails on invalid test level', () => {
    const result = QASchema.safeParse({
      testStrategy: '...',
      testLevels: [{ level: 'smoke', description: '...', coverage: '...' }],
      testCases: [],
      edgeCases: [],
      acceptanceCriteria: [],
      qualityRisks: [],
    });
    expect(result.success).toBe(false);
  });
});

describe('SynthesisSchema', () => {
  it('passes valid input', () => {
    const result = SynthesisSchema.safeParse({
      executiveSummary: 'Project overview',
      coherentPlan: {
        requirements: 'Req summary',
        architecture: 'Arch summary',
        security: 'Sec summary',
        cloudCost: 'Cost summary',
        devsecops: 'DevSecOps summary',
        testStrategy: 'QA summary',
      },
      risks: ['Risk 1'],
      assumptions: ['Assumption 1'],
      decisions: ['Decision 1'],
      prioritizedTasks: [{ task: 'Task 1', priority: 'high', dependencies: [] }],
    });
    expect(result.success).toBe(true);
  });

  it('fails when coherentPlan has missing field', () => {
    const result = SynthesisSchema.safeParse({
      executiveSummary: '...',
      coherentPlan: {
        requirements: '...',
      },
      risks: [],
      assumptions: [],
      decisions: [],
      prioritizedTasks: [],
    });
    expect(result.success).toBe(false);
  });
});
