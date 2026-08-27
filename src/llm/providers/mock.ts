import type {
  LLMClient,
  CompletionRequest,
  CompletionResponse,
  EmbeddingResponse,
} from '../interface.js';

export interface MockCall {
  type: 'complete' | 'embed' | 'isHealthy';
  input?: CompletionRequest | string;
  timestamp: number;
}

export interface MockConfig {
  completionResponses?: string[];
  embeddingResponse?: number[];
  shouldFail?: boolean;
  failureError?: string;
  healthy?: boolean;
  latencyMs?: number;
}

export class MockLLMClient implements LLMClient {
  private calls: MockCall[] = [];
  private completionIndex = 0;

  constructor(private mockConfig: MockConfig = {}) {}

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    this.calls.push({ type: 'complete', input: request, timestamp: Date.now() });

    if (this.mockConfig.shouldFail) {
      throw new Error(this.mockConfig.failureError || 'Mock LLM failure');
    }

    if (this.mockConfig.latencyMs) {
      await new Promise((resolve) => setTimeout(resolve, this.mockConfig.latencyMs));
    }

    const MOCK_INTAKE = JSON.stringify({
      isSufficient: false,
      summary: 'The concept is high-level and requires key architectural decisions.',
      questions: [
        {
          id: 'frontend_platform',
          category: 'stack',
          question: 'Which client platforms will the app support?',
          options: ['Web (React)', 'Mobile iOS (Swift)', 'Mobile Android (Kotlin)', 'Cross-platform (Flutter)'],
          recommendation: 'Web (React)',
          rationale: 'Fastest MVP development cycle.',
        },
        {
          id: 'backend_language',
          category: 'stack',
          question: 'Which backend technology stack do you prefer?',
          options: ['Node.js (Express)', 'Python (FastAPI)', 'Go (Gin)', 'Java (Spring Boot)'],
          recommendation: 'Node.js (Express)',
          rationale: 'High concurrency, large ecosystem.',
        },
        {
          id: 'message_transport',
          category: 'stack',
          question: 'What protocol will you use for real-time delivery?',
          options: ['WebSockets', 'Server-Sent Events (SSE)', 'gRPC streaming'],
          recommendation: 'WebSockets',
          rationale: 'Bidirectional low-latency communication.',
        },
        {
          id: 'scale_expectation',
          category: 'scale',
          question: 'What peak concurrent user count do you anticipate?',
          options: ['<10k', '10k-100k', '100k-1M', '>1M'],
          recommendation: '10k-100k',
          rationale: 'Guides database sizing and load balancing.',
        },
        {
          id: 'compliance_requirements',
          category: 'compliance',
          question: 'Do you need to meet any data protection regulations?',
          options: ['GDPR (EU)', 'CCPA (California)', 'HIPAA (Healthcare)', 'None'],
          recommendation: 'GDPR (EU)',
          rationale: 'Ensures user privacy compliance.',
        },
      ],
    });

    const MOCK_REQUIREMENTS = JSON.stringify({
      clarifiedRequirements: 'Real-time application with high concurrency, WebSocket messaging, and GDPR compliance.',
      functionalRequirements: [
        { id: 'FR-1', description: 'User authentication and profile management', priority: 'must' },
        { id: 'FR-2', description: 'Real-time WebSocket message dispatch', priority: 'must' },
        { id: 'FR-3', description: 'Data encryption and privacy compliance', priority: 'must' },
      ],
      nonFunctionalRequirements: [
        { category: 'performance', description: 'Sub-100ms latency for message delivery', metric: '<100ms' },
        { category: 'scalability', description: 'Support up to 100k peak concurrent users', metric: '100k TPS' },
      ],
      assumptions: ['Cloud hosting environment with WebSocket gateway support'],
      risks: ['High memory footprint under peak WebSocket connection bursts'],
      acceptanceCriteria: [
        'WHEN a user sends a message THEN it SHALL be delivered to connected clients within 100ms',
      ],
    });

    const MOCK_ARCHITECTURE = JSON.stringify({
      components: [
        {
          name: 'AuthGateway',
          description: 'Handles client authentication and JWT validation',
          responsibilities: ['Validate JWT', 'Rate limit incoming requests'],
          interfaces: ['REST API', 'WebSocket Gateway'],
        },
        {
          name: 'MessageEngine',
          description: 'Manages real-time WebSocket connections and message routing',
          responsibilities: ['Publish messages to channels', 'Maintain connection state'],
          interfaces: ['WebSocket Server', 'Redis PubSub'],
        },
      ],
      dataFlow: 'Client connects to AuthGateway, authenticates via JWT, and upgrades to WebSocket connection managed by MessageEngine.',
      techDecisions: [
        {
          decision: 'Node.js with WebSockets',
          rationale: 'High event loop performance for concurrent persistent connections',
          alternatives: ['Go (Gin)', 'Python (FastAPI)'],
        },
      ],
      rationale: 'Clean layered architecture isolating real-time transport from authentication and data persistence.',
      tradeoffs: ['Stateful WebSocket connections require Redis PubSub for multi-node scaling.'],
    });

    const MOCK_SECURITY = JSON.stringify({
      threats: [
        { threat: 'Man-in-the-Middle Attack', severity: 'high', mitigation: 'TLS 1.3 encryption on all endpoints', owaspCategory: 'A02:2021-Cryptographic Failures' },
      ],
      controls: ['TLS 1.3', 'JWT with Short Expiration', 'Rate Limiting'],
      authentication: 'JWT-based Bearer Token Auth',
      authorization: 'Role-Based Access Control (RBAC)',
      dataProtection: ['TLS 1.3 in transit', 'AES-256 at rest'],
      recommendations: ['Enforce strict Content Security Policy', 'Rotate JWT signing keys periodically'],
    });

    const MOCK_CLOUD_COST = JSON.stringify({
      deploymentArchitecture: 'AWS ECS Fargate with ElastiCache Redis',
      awsRecommendations: [
        { service: 'AWS Fargate', useCase: 'Containerized API & Gateway', estimatedMonthlyCost: '$40.00', freeTierEligible: false },
        { service: 'Amazon ElastiCache Redis', useCase: 'PubSub & State Store', estimatedMonthlyCost: '$30.00', freeTierEligible: false },
      ],
      totalEstimatedMonthlyCost: '$70.00',
      freeTierAlternatives: ['Self-hosted Docker on EC2 t4g.small'],
      localAlternatives: ['Docker Compose with local Redis & PostgreSQL'],
      optimizationTips: ['Use Fargate Spot for non-critical workloads'],
    });

    const MOCK_DEVSECOPS = JSON.stringify({
      cicdPipeline: 'GitHub Actions workflow with SAST and automated Docker build',
      stages: [
        { name: 'Build & Test', description: 'Run unit tests and linter', tools: ['Vitest', 'ESLint'] },
        { name: 'Security Scan', description: 'Run dependency vulnerability scan', tools: ['Trivy', 'npm audit'] },
      ],
      dockerConfig: 'Multi-stage Dockerfile based on node:20-slim',
      deploymentStrategy: 'Rolling update with health check probes',
      securityAutomation: ['Dependabot', 'Container Scanning'],
      monitoring: ['CloudWatch Logs', 'Prometheus Metrics'],
      operationalNotes: ['Set up automated rollbacks on failing health checks'],
    });

    const MOCK_QA = JSON.stringify({
      testStrategy: 'Comprehensive multi-level testing including unit, integration, and WebSocket load testing',
      testLevels: [
        { level: 'unit', description: 'Unit testing for business logic', coverage: '85%' },
        { level: 'integration', description: 'API endpoint integration testing', coverage: '75%' },
      ],
      testCases: [
        { name: 'JWT Auth Test', description: 'Verify 401 on invalid token', priority: 'high', type: 'integration' },
      ],
      edgeCases: ['WebSocket abrupt disconnect', 'Concurrent authentication attempts'],
      acceptanceCriteria: ['Pass 100% of P0 critical user journeys'],
      qualityRisks: [
        { risk: 'High concurrency connection drop', severity: 'medium', mitigation: 'K6 WebSocket load test in CI' },
      ],
    });

    const MOCK_SYNTHESIS = JSON.stringify({
      executiveSummary: 'Production-ready engineering package for real-time application featuring Phase 0 Intake constraints.',
      coherentPlan: {
        requirements: 'Clear functional and compliance requirements validated.',
        architecture: 'Modular 2-tier service architecture with WebSocket pub/sub.',
        security: 'OWASP-compliant auth and transport security.',
        cloudCost: 'Optimized $70/mo Fargate deployment.',
        devsecops: 'Automated GitHub Actions CI/CD with security scanning.',
        testStrategy: 'Unit, integration, and WebSocket performance test coverage.',
      },
      risks: ['Scalability limits on single-region deployment'],
      assumptions: ['Production deployment targets AWS cloud infrastructure'],
      decisions: ['Node.js + WebSockets for real-time messaging', 'PostgreSQL for data persistence'],
      prioritizedTasks: [
        { task: 'Set up database schema & migrations', priority: 'high', dependencies: [] },
        { task: 'Implement AuthGateway & WebSocket engine', priority: 'high', dependencies: ['Set up database schema & migrations'] },
      ],
      openQuestions: [],
    });

    const MOCK_VISION = JSON.stringify({
      vision: 'An AI-powered platform for automated software architecture generation',
      problem: 'Software teams spend weeks on architecture before writing code',
      targetUsers: ['Software Architects', 'Tech Leads', 'Senior Engineers'],
      businessGoals: ['Reduce architecture time by 60%', 'Ensure consistent quality'],
      coreCapabilities: ['Spec generation', 'Architecture design', 'Task breakdown'],
      successMetrics: ['Time to architecture < 5 minutes', 'User satisfaction > 4/5'],
      mvpBoundaries: {
        included: ['Spec', 'Architecture', 'Tasks'],
        excluded: ['Diagrams', 'Deployment'],
      },
    });

    const MOCK_RISK_ASSESSMENT = JSON.stringify({
      risks: [
        {
          id: 'RISK-001',
          description: 'LLM output quality varies',
          category: 'ai_llm',
          probability: 'medium',
          impact: 'high',
          severity: 'high',
          mitigation: 'Output validation with retry',
          status: 'mitigated',
        },
      ],
    });

    const MOCK_SPEC = JSON.stringify({
      functionalRequirements: [
        {
          id: 'FR-1',
          description: 'The system shall authenticate users via email and password',
          priority: 'must',
        },
      ],
      acceptanceCriteria: ['WHEN a user submits valid credentials THEN the system SHALL return a JWT token'],
      constraints: ['Passwords must be hashed with bcrypt'],
      dependencies: ['PostgreSQL database'],
    });

    const MOCK_TASKS = JSON.stringify({
      tasks: [
        {
          id: 'T-1',
          title: 'Create User model',
          description: 'Define User entity with email and password hash',
          complexity: 2,
          acceptanceCriteria: [
            {
              action: 'Create user',
              expectedResult: 'User persisted to database',
              passFailCondition: 'User can be retrieved by email',
            },
          ],
          dependsOn: [],
        },
      ],
      dependencyOrder: [['T-1']],
      traceabilityCoverage: 95,
    });

    let defaultResponse = MOCK_SPEC;
    if (
      request.systemPrompt.includes('intake') ||
      request.systemPrompt.includes('ambiguity audit')
    ) {
      defaultResponse = MOCK_INTAKE;
    } else if (
      request.systemPrompt.includes('technical lead synthesizing') ||
      request.systemPrompt.includes('synthesizing')
    ) {
      defaultResponse = MOCK_SYNTHESIS;
    } else if (
      request.systemPrompt.includes('requirements analyst') ||
      request.systemPrompt.includes('clarified requirements')
    ) {
      defaultResponse = MOCK_REQUIREMENTS;
    } else if (
      request.systemPrompt.includes('agent-architecture') ||
      request.systemPrompt.includes('produce a structured architecture') ||
      request.systemPrompt.includes('software architect') ||
      request.systemPrompt.includes('components')
    ) {
      defaultResponse = MOCK_ARCHITECTURE;
    } else if (
      request.systemPrompt.includes('security auditor') ||
      request.systemPrompt.includes('OWASP')
    ) {
      defaultResponse = MOCK_SECURITY;
    } else if (
      request.systemPrompt.includes('cloud cost analyst') ||
      request.systemPrompt.includes('cloud financial architect') ||
      request.systemPrompt.includes('CloudCost')
    ) {
      defaultResponse = MOCK_CLOUD_COST;
    } else if (
      request.systemPrompt.includes('DevSecOps engineer') ||
      request.systemPrompt.includes('devsecops') ||
      request.systemPrompt.includes('CI/CD')
    ) {
      defaultResponse = MOCK_DEVSECOPS;
    } else if (
      request.systemPrompt.includes('quality assurance engineer') ||
      request.systemPrompt.includes('test strategy')
    ) {
      defaultResponse = MOCK_QA;
    } else if (
      request.systemPrompt.includes('synthesizing') ||
      request.systemPrompt.includes('synthesis') ||
      request.systemPrompt.includes('executive summary')
    ) {
      defaultResponse = MOCK_SYNTHESIS;
    } else if (
      request.systemPrompt.includes('product vision') ||
      request.systemPrompt.includes('product strategist')
    ) {
      defaultResponse = MOCK_VISION;
    } else if (
      request.systemPrompt.includes('risk analyst') ||
      request.systemPrompt.includes('risk assessment')
    ) {
      defaultResponse = MOCK_RISK_ASSESSMENT;
    } else if (
      request.systemPrompt.includes('planner') ||
      request.systemPrompt.includes('break it into')
    ) {
      defaultResponse = MOCK_TASKS;
    }

    const responses = this.mockConfig.completionResponses || [defaultResponse];
    const content = responses[this.completionIndex % responses.length];
    this.completionIndex++;

    return {
      content,
      durationMs: this.mockConfig.latencyMs || 10,
      tokenCount: {
        prompt: Math.ceil(request.prompt.length / 4),
        completion: Math.ceil(content.length / 4),
      },
    };
  }

  async embed(text: string): Promise<EmbeddingResponse> {
    this.calls.push({ type: 'embed', input: text, timestamp: Date.now() });

    if (this.mockConfig.shouldFail) {
      throw new Error(this.mockConfig.failureError || 'Mock embedding failure');
    }

    const embedding =
      this.mockConfig.embeddingResponse || new Array(1536).fill(0).map(() => Math.random());

    return { embedding, durationMs: this.mockConfig.latencyMs || 5 };
  }

  async isHealthy(): Promise<boolean> {
    this.calls.push({ type: 'isHealthy', timestamp: Date.now() });
    return this.mockConfig.healthy ?? true;
  }

  getCalls(): MockCall[] {
    return [...this.calls];
  }

  getCallCount(type?: MockCall['type']): number {
    return type ? this.calls.filter((c) => c.type === type).length : this.calls.length;
  }

  reset(): void {
    this.calls = [];
    this.completionIndex = 0;
  }
}
