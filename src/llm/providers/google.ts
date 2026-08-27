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
 * passed as a query parameter — NOT a header. Includes fallback and 429 rate limit retry.
 */
export class GoogleClient implements LLMClient {
  private readonly baseUrl = 'https://generativelanguage.googleapis.com/v1beta';
  private readonly timeout: number;

  constructor(private readonly config: GoogleConfig) {
    this.timeout = config.timeout || 60000;
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const start = Date.now();

    const candidateModels: string[] = [
      this.config.model || 'gemini-3.6-flash',
      'gemini-3.6-flash',
      'gemini-3.5-flash',
      'gemini-3.5-flash-lite',
      'gemini-flash-latest',
      'gemini-pro-latest',
    ];

    const modelsToTry = candidateModels.filter((m, idx, self) => Boolean(m) && self.indexOf(m) === idx);

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

    let lastError: Error | null = null;

    for (const model of modelsToTry) {
      try {
        const url = `${this.baseUrl}/models/${model}:generateContent?key=${this.config.apiKey}`;
        let response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(this.timeout),
        });

        if (!response.ok && response.status === 429) {
          log.warn({ model }, 'Gemini rate limited (HTTP 429), waiting 2.5s before retry...');
          await new Promise((resolve) => setTimeout(resolve, 2500));
          response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(this.timeout),
          });
        }

        if (!response.ok) {
          const errText = await response.text().catch(() => '');
          if (response.status === 403 || errText.includes('API_KEY_INVALID')) {
            throw new Error('Google Gemini authentication failed. Check your API key.');
          }

          log.warn({ model, status: response.status, errText }, 'Gemini model call failed, trying next fallback model');
          lastError = new Error(`Google Gemini API error (${response.status}) on model ${model}: ${errText}`);
          continue;
        }

        const data = (await response.json()) as GoogleGenerateResponse;
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
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (
          lastError.message.includes('authentication failed')
        ) {
          throw lastError;
        }
      }
    }

    throw lastError || new Error('All Google Gemini models failed');
  }

  async embed(text: string): Promise<EmbeddingResponse> {
    const start = Date.now();
    const embeddingModel = this.config.embeddingModel || 'gemini-embedding-001';

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

    const data = (await response.json()) as GoogleEmbedResponse;
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
