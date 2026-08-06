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

    // Detect which schema is expected based on system prompt content
    let defaultResponse = MOCK_SPEC;
    if (
      request.systemPrompt.includes('architecture') ||
      request.systemPrompt.includes('components')
    ) {
      defaultResponse = MOCK_ARCHITECTURE;
    } else if (request.systemPrompt.includes('task') || request.systemPrompt.includes('planner')) {
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
