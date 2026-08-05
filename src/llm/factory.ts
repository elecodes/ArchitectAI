import type { LLMClient } from './interface.js';
import { MockLLMClient } from './providers/mock.js';
import type { Config } from '../config/index.js';

export function createLLMClient(config: Config): LLMClient {
  switch (config.llmProvider) {
    case 'mock':
      return new MockLLMClient();
    case 'openrouter':
      // Will be implemented in Sprint 2
      throw new Error(`LLM provider "openrouter" not yet implemented. Use "mock" for development.`);
    case 'openai':
      throw new Error(`LLM provider "openai" not yet implemented. Use "mock" for development.`);
    case 'ollama':
      throw new Error(`LLM provider "ollama" not yet implemented. Use "mock" for development.`);
    default:
      throw new Error(`Unknown LLM provider: "${config.llmProvider}". Supported: openrouter, openai, ollama, mock`);
  }
}

export function createEmbeddingClient(config: Config): LLMClient {
  switch (config.embeddingProvider) {
    case 'mock':
      return new MockLLMClient();
    case 'openai':
      throw new Error(`Embedding provider "openai" not yet implemented. Use "mock" for development.`);
    case 'openrouter':
      throw new Error(`Embedding provider "openrouter" not yet implemented. Use "mock" for development.`);
    case 'ollama':
      throw new Error(`Embedding provider "ollama" not yet implemented. Use "mock" for development.`);
    default:
      throw new Error(`Unknown embedding provider: "${config.embeddingProvider}". Supported: openai, openrouter, ollama, mock`);
  }
}
