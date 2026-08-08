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
        {
          id: 'RISK-002',
          description: 'Context window overflow',
          category: 'ai_llm',
          probability: 'medium',
          impact: 'medium',
          severity: 'medium',
          mitigation: 'Progressive RAG truncation',
          status: 'mitigated',
        },
        {
          id: 'RISK-003',
          description: 'Prompt injection via RAG',
          category: 'security',
          probability: 'low',
          impact: 'medium',
          severity: 'low',
          mitigation: 'Delimiter isolation',
          status: 'monitoring',
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
        {
          id: 'FR-2',
          description: 'The system shall issue JWT tokens upon successful authentication',
          priority: 'must',
        },
        {
          id: 'FR-3',
          description: 'The system shall validate JWT tokens on protected endpoints',
          priority: 'must',
        },
      ],
      acceptanceCriteria: [
        'WHEN a user submits valid credentials THEN the system SHALL return a JWT token',
        'WHEN a user submits invalid credentials THEN the system SHALL return 401',
        'WHEN a token expires THEN the system SHALL reject the request with 401',
      ],
      constraints: ['Passwords must be hashed with bcrypt', 'Tokens expire in 24 hours'],
      dependencies: ['PostgreSQL database', 'bcrypt library', 'jsonwebtoken library'],
    });

    const MOCK_ARCHITECTURE = JSON.stringify({
      components: [
        {
          name: 'AuthService',
          layer: 'application',
          responsibilities: ['Authenticate users', 'Issue tokens'],
          dependencies: ['UserRepository'],
        },
        {
          name: 'UserRepository',
          layer: 'infrastructure',
          responsibilities: ['Persist user data', 'Query users'],
          dependencies: [],
        },
        {
          name: 'AuthController',
          layer: 'interface',
          responsibilities: ['Handle HTTP requests', 'Validate input'],
          dependencies: ['AuthService'],
        },
      ],
      dependencyGraph: [
        { from: 'AuthController', to: 'AuthService' },
        { from: 'AuthService', to: 'UserRepository' },
      ],
      boundedContexts: [
        {
          name: 'Identity',
          aggregates: ['User', 'Session'],
          responsibilities: ['User authentication', 'Token management'],
        },
      ],
      solidNotes: [
        'AuthService depends on UserRepository interface (DIP)',
        'Each component has single responsibility (SRP)',
      ],
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
        {
          id: 'T-2',
          title: 'Implement AuthService',
          description: 'Login and token issuance logic',
          complexity: 3,
          acceptanceCriteria: [
            {
              action: 'Call login with valid credentials',
              expectedResult: 'JWT token returned',
              passFailCondition: 'Token contains user ID and expiry',
            },
          ],
          dependsOn: ['T-1'],
        },
        {
          id: 'T-3',
          title: 'Create login endpoint',
          description: 'POST /auth/login route handler',
          complexity: 2,
          acceptanceCriteria: [
            {
              action: 'POST valid credentials',
              expectedResult: '200 with token',
              passFailCondition: 'Invalid credentials return 401',
            },
          ],
          dependsOn: ['T-2'],
        },
      ],
      dependencyOrder: [['T-1'], ['T-2'], ['T-3']],
      traceabilityCoverage: 95,
    });

    const MOCK_REVIEW_SUMMARY = JSON.stringify({
      projectSummary: 'A modular Node.js backend application with Express and PostgreSQL',
      architectureOverview:
        'Layered architecture with clear separation between API, business logic, and data access',
      folderResponsibilities: [
        { folder: 'src/api', responsibility: 'HTTP routes and middleware' },
        { folder: 'src/db', responsibility: 'Database connection and migrations' },
      ],
      detectedPatterns: ['Repository Pattern', 'Middleware Chain', 'Factory Pattern'],
      potentialProblems: ['No dependency injection container', 'Some modules have high coupling'],
      technicalDebt: ['Token estimation uses heuristic instead of proper tokenizer'],
      entryPoints: ['src/index.ts'],
      criticalComponents: ['src/generation/pipeline.ts — orchestrates all generation'],
    });

    const MOCK_REVIEW_ENGINEERING = JSON.stringify({
      codeQuality: { score: 7, observations: ['Consistent naming', 'Good error handling'] },
      architectureQuality: { score: 8, observations: ['Clean module boundaries'] },
      solidAdherence: { score: 7, violations: ['Some classes have multiple responsibilities'] },
      cleanArchitecture: { score: 7, violations: ['Minor dependency direction issue'] },
      security: { score: 6, observations: ['Basic JWT auth', 'Rate limiting present'] },
      maintainability: { score: 8, observations: ['Well-organized modules'] },
      scalability: { score: 6, observations: ['Monolith, but well-structured for extraction'] },
      readability: { score: 8, observations: ['Clear naming conventions'] },
      documentation: { score: 5, observations: ['README exists but could be more detailed'] },
      testQuality: {
        score: 6,
        observations: ['Property tests present, integration tests minimal'],
      },
      overallMaturity: {
        score: 7,
        summary: 'Solid engineering foundation with room for improvement',
      },
    });

    const MOCK_REVIEW_IMPROVEMENTS = JSON.stringify({
      recommendations: [
        {
          priority: 'high',
          problem: 'Limited test coverage',
          reason: 'Makes refactoring risky',
          suggestion: 'Add integration tests for API endpoints',
          effort: 'medium',
        },
        {
          priority: 'medium',
          problem: 'No proper tokenizer',
          reason: 'Token estimation is imprecise',
          suggestion: 'Replace chars/4 heuristic with tiktoken',
          effort: 'small',
        },
        {
          priority: 'low',
          problem: 'No streaming',
          reason: 'Users wait 30-60s with no feedback',
          suggestion: 'Implement SSE for generation progress',
          effort: 'large',
        },
      ],
    });

    // Detect which schema is expected based on system prompt content
    // Check review prompts FIRST (most specific), then vision/risk, then tasks, then architecture
    let defaultResponse = MOCK_SPEC;
    if (
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
      request.systemPrompt.includes('project understanding summary') ||
      request.systemPrompt.includes('reviewing a codebase')
    ) {
      defaultResponse = MOCK_REVIEW_SUMMARY;
    } else if (
      request.systemPrompt.includes('formal engineering review') ||
      request.systemPrompt.includes('engineering review')
    ) {
      defaultResponse = MOCK_REVIEW_ENGINEERING;
    } else if (
      request.systemPrompt.includes('improvement recommendations') ||
      request.systemPrompt.includes('actionable improvement')
    ) {
      defaultResponse = MOCK_REVIEW_IMPROVEMENTS;
    } else if (
      request.systemPrompt.includes('planner') ||
      request.systemPrompt.includes('break it into')
    ) {
      defaultResponse = MOCK_TASKS;
    } else if (
      request.systemPrompt.includes('architecture') ||
      request.systemPrompt.includes('components')
    ) {
      defaultResponse = MOCK_ARCHITECTURE;
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
