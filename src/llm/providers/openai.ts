import type { LLMClient, CompletionRequest, CompletionResponse, EmbeddingResponse } from '../interface.js';
import { createChildLogger } from '../../logger.js';

const log = createChildLogger('openai');

export interface OpenAIConfig {
  apiKey: string;
  model: string;
  embeddingModel?: string;
  embeddingDimensions?: number;
  baseUrl?: string;
  timeout?: number;
}

export class OpenAIClient implements LLMClient {
  private readonly baseUrl: string;
  private readonly timeout: number;

  constructor(private readonly config: OpenAIConfig) {
    this.baseUrl = config.baseUrl || 'https://api.openai.com/v1';
    this.timeout = config.timeout || 60000;
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const start = Date.now();

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: [
          { role: 'system', content: request.systemPrompt },
          { role: 'user', content: request.prompt },
        ],
        temperature: request.temperature ?? 0.3,
        max_tokens: request.maxTokens ?? 4096,
      }),
      signal: AbortSignal.timeout(this.timeout),
    });

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error('OpenAI rate limited. Please retry later.');
      }
      if (response.status === 401) {
        throw new Error('OpenAI authentication failed. Check your API key.');
      }
      throw new Error(`OpenAI API error (${response.status})`);
    }

    const data = await response.json() as {
      choices: [{ message: { content: string } }];
      usage?: { prompt_tokens: number; completion_tokens: number };
    };

    const content = data.choices[0]?.message?.content || '';
    const durationMs = Date.now() - start;

    log.info({ model: this.config.model, durationMs, tokens: data.usage }, 'completion finished');

    return {
      content,
      durationMs,
      tokenCount: {
        prompt: data.usage?.prompt_tokens || Math.ceil(request.prompt.length / 4),
        completion: data.usage?.completion_tokens || Math.ceil(content.length / 4),
      },
    };
  }

  async embed(text: string): Promise<EmbeddingResponse> {
    const start = Date.now();
    const embeddingModel = this.config.embeddingModel || 'text-embedding-3-small';

    const body: Record<string, unknown> = {
      model: embeddingModel,
      input: text,
    };
    if (this.config.embeddingDimensions) {
      body.dimensions = this.config.embeddingDimensions;
    }

    const response = await fetch(`${this.baseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      throw new Error(`OpenAI embedding error (${response.status})`);
    }

    const data = await response.json() as {
      data: [{ embedding: number[] }];
    };

    return {
      embedding: data.data[0].embedding,
      durationMs: Date.now() - start,
    };
  }

  async isHealthy(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        headers: { 'Authorization': `Bearer ${this.config.apiKey}` },
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}
