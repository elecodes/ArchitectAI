import type { LLMClient, CompletionRequest, CompletionResponse, EmbeddingResponse } from '../interface.js';
import { OpenAIClient } from './openai.js';
import { createChildLogger } from '../../logger.js';

const log = createChildLogger('groq');

export interface GroqConfig {
  apiKey: string;
  model: string;
}

export class GroqClient implements LLMClient {
  constructor(private readonly config: GroqConfig) {}

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const modelsToTry = [this.config.model, 'llama-3.1-8b-instant', 'llama-3.3-70b-versatile'];
    let lastError: any = null;

    for (const model of modelsToTry) {
      try {
        log.info({ model }, 'Initiating Groq completion request');
        const client = new OpenAIClient({
          apiKey: this.config.apiKey,
          model,
          baseUrl: 'https://api.groq.com/openai/v1',
        });
        return await client.complete(request);
      } catch (err: any) {
        log.warn({ model, err: err.message }, 'Groq model attempt failed, trying fallback...');
        lastError = err;
        if (err.message.includes('rate limited')) {
          // Sleep for 2 seconds to let the rate limit window clear
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      }
    }
    throw lastError;
  }

  async embed(text: string): Promise<EmbeddingResponse> {
    throw new Error('Groq does not support embeddings. Use a different EMBEDDING_PROVIDER.');
  }

  async isHealthy(): Promise<boolean> {
    try {
      const client = new OpenAIClient({
        apiKey: this.config.apiKey,
        model: this.config.model,
        baseUrl: 'https://api.groq.com/openai/v1',
      });
      return await client.isHealthy();
    } catch {
      return false;
    }
  }
}
