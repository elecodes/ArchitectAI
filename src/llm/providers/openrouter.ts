import type { LLMClient, CompletionRequest, CompletionResponse, EmbeddingResponse } from '../interface.js';
import { createChildLogger } from '../../logger.js';

const log = createChildLogger('openrouter');

export interface OpenRouterConfig {
  apiKey: string;
  model: string;
  baseUrl?: string;
  timeout?: number;
}

export class OpenRouterClient implements LLMClient {
  private readonly baseUrl: string;
  private readonly timeout: number;

  constructor(private readonly config: OpenRouterConfig) {
    this.baseUrl = config.baseUrl || 'https://openrouter.ai/api/v1';
    this.timeout = config.timeout || 60000;
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const start = Date.now();

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://architectai.dev',
        'X-Title': 'ArchitectAI',
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
      const errorBody = await response.text();
      if (response.status === 429) {
        throw new Error(`OpenRouter rate limited. Retry after cooldown. Response: ${errorBody}`);
      }
      throw new Error(`OpenRouter API error (${response.status}): ${errorBody}`);
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

    const response = await fetch(`${this.baseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai/text-embedding-3-small',
        input: text,
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`OpenRouter embedding error (${response.status}): ${errorBody}`);
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
