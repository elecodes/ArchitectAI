import type { LLMClient, CompletionRequest, CompletionResponse, EmbeddingResponse } from '../interface.js';

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
      await new Promise(resolve => setTimeout(resolve, this.mockConfig.latencyMs));
    }

    const DEFAULT_MOCK_RESPONSE = JSON.stringify({
      functionalRequirements: [
        { id: 'FR-1', description: 'The system shall authenticate users via email and password', priority: 'must' },
        { id: 'FR-2', description: 'The system shall issue JWT tokens upon successful authentication', priority: 'must' },
        { id: 'FR-3', description: 'The system shall validate JWT tokens on protected endpoints', priority: 'must' },
      ],
      acceptanceCriteria: [
        'WHEN a user submits valid credentials THEN the system SHALL return a JWT token',
        'WHEN a user submits invalid credentials THEN the system SHALL return 401',
        'WHEN a token expires THEN the system SHALL reject the request with 401',
      ],
      constraints: ['Passwords must be hashed with bcrypt', 'Tokens expire in 24 hours'],
      dependencies: ['PostgreSQL database', 'bcrypt library', 'jsonwebtoken library'],
    });

    const responses = this.mockConfig.completionResponses || [DEFAULT_MOCK_RESPONSE];
    const content = responses[this.completionIndex % responses.length];
    this.completionIndex++;

    return {
      content,
      durationMs: this.mockConfig.latencyMs || 10,
      tokenCount: { prompt: Math.ceil(request.prompt.length / 4), completion: Math.ceil(content.length / 4) },
    };
  }

  async embed(text: string): Promise<EmbeddingResponse> {
    this.calls.push({ type: 'embed', input: text, timestamp: Date.now() });

    if (this.mockConfig.shouldFail) {
      throw new Error(this.mockConfig.failureError || 'Mock embedding failure');
    }

    const embedding = this.mockConfig.embeddingResponse || new Array(1536).fill(0).map(() => Math.random());

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
    return type ? this.calls.filter(c => c.type === type).length : this.calls.length;
  }

  reset(): void {
    this.calls = [];
    this.completionIndex = 0;
  }
}
