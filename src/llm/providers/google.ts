import type { LLMClient, CompletionRequest, CompletionResponse, EmbeddingResponse } from '../interface.js';
import { createChildLogger } from '../../logger.js';

const log = createChildLogger('google');

export interface GoogleConfig {
  apiKey: string;
  model: string;
  embeddingModel?: string;
  timeout?: number;
}

interface GoogleGenerateResponse {
  candidates?: [{ content?: { parts?: [{ text?: string }] }; finishReason?: string }];
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number };
}

interface GoogleEmbedResponse {
  embedding?: { values?: number[] };
}

/**
 * Google Gemini LLM provider.
 *
 * Uses the native REST API (no SDK dependency). Authentication is via API key
 * passed as a query parameter — NOT a header.
 */
export class GoogleClient implements LLMClient {
  private readonly baseUrl = 'https://generativelanguage.googleapis.com/v1beta';
  private readonly timeout: number;

  constructor(private readonly config: GoogleConfig) {
    this.timeout = config.timeout || 60000;
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const start = Date.now();
    const model = this.config.model;

    const body: Record<string, unknown> = {
      contents: [{ role: 'user', parts: [{ text: request.prompt }] }],
      generationConfig: {
        temperature: request.temperature ?? 0.3,
        maxOutputTokens: request.maxTokens ?? 4096,
      },
    };

    if (request.systemPrompt) {
      body.systemInstruction = { parts: [{ text: request.systemPrompt }] };
    }

    const url = `${this.baseUrl}/models/${model}:generateContent?key=${this.config.apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.timeout),
    });

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error('Google Gemini rate limited. Please retry later.');
      }
      if (response.status === 400 || response.status === 403) {
        throw new Error('Google Gemini authentication failed. Check your API key.');
      }
      throw new Error(`Google Gemini API error (${response.status})`);
    }

    const data = await response.json() as GoogleGenerateResponse;
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const durationMs = Date.now() - start;

    log.info({ model, durationMs, tokens: data.usageMetadata }, 'completion finished');

    return {
      content,
      durationMs,
      tokenCount: {
        prompt: data.usageMetadata?.promptTokenCount || Math.ceil(request.prompt.length / 4),
        completion: data.usageMetadata?.candidatesTokenCount || Math.ceil(content.length / 4),
      },
    };
  }

  async embed(text: string): Promise<EmbeddingResponse> {
    const start = Date.now();
    const embeddingModel = this.config.embeddingModel || 'text-embedding-004';

    const url = `${this.baseUrl}/models/${embeddingModel}:embedContent?key=${this.config.apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: { parts: [{ text }] },
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      throw new Error(`Google Gemini embedding error (${response.status})`);
    }

    const data = await response.json() as GoogleEmbedResponse;
    const embedding = data.embedding?.values;
    if (!embedding) {
      throw new Error('Google Gemini embedding response is missing the embedding vector');
    }

    return { embedding, durationMs: Date.now() - start };
  }

  async isHealthy(): Promise<boolean> {
    try {
      const url = `${this.baseUrl}/models/${this.config.model}?key=${this.config.apiKey}`;
      const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
      return response.ok;
    } catch {
      return false;
    }
  }
}
