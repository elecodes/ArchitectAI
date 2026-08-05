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

    const responses = this.mockConfig.completionResponses || ['{"result": "mock response"}'];
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
