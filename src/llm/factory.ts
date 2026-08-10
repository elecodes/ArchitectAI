import type { LLMClient } from './interface.js';
import { MockLLMClient } from './providers/mock.js';
import { OpenRouterClient } from './providers/openrouter.js';
import { OpenAIClient } from './providers/openai.js';
import { BedrockClient } from './providers/bedrock.js';
import type { Config } from '../config/index.js';

export function createLLMClient(config: Config): LLMClient {
  switch (config.llmProvider) {
    case 'mock':
      return new MockLLMClient();
    case 'openrouter':
      if (!config.llmApiKey) {
        throw new Error('LLM_API_KEY is required when LLM_PROVIDER=openrouter');
      }
      return new OpenRouterClient({
        apiKey: config.llmApiKey,
        model: config.llmModel,
      });
    case 'openai':
      if (!config.llmApiKey) {
        throw new Error('LLM_API_KEY is required when LLM_PROVIDER=openai');
      }
      return new OpenAIClient({
        apiKey: config.llmApiKey,
        model: config.llmModel,
      });
    case 'ollama':
      // Ollama reuses OpenAI-compatible format — use OpenAI client with Ollama base URL
      return new OpenAIClient({
        apiKey: 'ollama', // Ollama doesn't need a real key
        model: config.llmModel,
        baseUrl: config.ollamaUrl + '/v1',
        embeddingModel: config.embeddingModel,
      });
    case 'bedrock':
      return new BedrockClient({
        model: config.bedrockModel,
        region: config.bedrockRegion,
        timeoutMs: config.bedrockTimeoutMs,
        embeddingModel: config.bedrockEmbeddingModel,
      });
    default:
      throw new Error(`Unknown LLM provider: "${config.llmProvider}"`);
  }
}

export function createEmbeddingClient(config: Config): LLMClient {
  switch (config.embeddingProvider) {
    case 'mock':
      return new MockLLMClient();
    case 'openai':
      if (!config.embeddingApiKey) {
        throw new Error('EMBEDDING_API_KEY is required when EMBEDDING_PROVIDER=openai');
      }
      return new OpenAIClient({
        apiKey: config.embeddingApiKey,
        model: config.llmModel, // not used for embeddings
        embeddingModel: config.embeddingModel,
        embeddingDimensions: config.embeddingDimensions,
      });
    case 'openrouter':
      if (!config.embeddingApiKey) {
        throw new Error('EMBEDDING_API_KEY is required when EMBEDDING_PROVIDER=openrouter');
      }
      return new OpenRouterClient({
        apiKey: config.embeddingApiKey,
        model: config.embeddingModel,
      });
    case 'ollama':
      return new OpenAIClient({
        apiKey: 'ollama',
        model: config.embeddingModel,
        baseUrl: config.ollamaUrl + '/v1',
        embeddingModel: config.embeddingModel,
      });
    case 'bedrock':
      return new BedrockClient({
        model: config.bedrockModel,
        region: config.bedrockRegion,
        timeoutMs: config.bedrockTimeoutMs,
        embeddingModel: config.bedrockEmbeddingModel,
      });
    default:
      throw new Error(`Unknown embedding provider: "${config.embeddingProvider}"`);
  }
}
