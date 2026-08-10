import { describe, it, expect } from 'vitest';
import { createLLMClient, createEmbeddingClient } from '../../src/llm/factory.js';
import { BedrockClient } from '../../src/llm/providers/bedrock.js';
import { MockLLMClient } from '../../src/llm/providers/mock.js';
import type { Config } from '../../src/config/index.js';

function cfg(overrides: Partial<Config> = {}): Config {
  return {
    port: 3001,
    logLevel: 'info',
    nodeEnv: 'test',
    databaseUrl: 'postgres://localhost/test',
    jwtSecret: 'test-secret-not-placeholder',
    llmProvider: 'mock',
    llmApiKey: '',
    llmModel: 'm',
    llmContextWindow: 128000,
    embeddingProvider: 'mock',
    embeddingApiKey: '',
    embeddingModel: 'e',
    embeddingDimensions: 1536,
    ollamaUrl: 'http://localhost:11434',
    bedrockModel: 'anthropic.claude-3-5-sonnet-20240620-v1:0',
    bedrockRegion: 'us-east-1',
    bedrockTimeoutMs: 60000,
    bedrockEmbeddingModel: 'amazon.titan-embed-text-v2',
    storageProvider: 'local',
    storageLocalDir: './data/storage',
    s3Bucket: '',
    s3Region: '',
    s3Prefix: 'architectai',
    cloudwatchEnabled: false,
    cloudwatchRegion: '',
    cloudwatchNamespace: 'ArchitectAI',
    ...overrides,
  } as Config;
}

describe('LLM factory', () => {
  it('returns a BedrockClient for LLM_PROVIDER=bedrock', () => {
    const client = createLLMClient(cfg({ llmProvider: 'bedrock' }));
    expect(client).toBeInstanceOf(BedrockClient);
  });

  it('returns MockLLMClient for LLM_PROVIDER=mock without any key', () => {
    expect(createLLMClient(cfg({ llmProvider: 'mock' }))).toBeInstanceOf(MockLLMClient);
  });

  it('returns a BedrockClient for EMBEDDING_PROVIDER=bedrock', () => {
    expect(createEmbeddingClient(cfg({ embeddingProvider: 'bedrock' }))).toBeInstanceOf(
      BedrockClient,
    );
  });

  it('throws on an unknown LLM provider', () => {
    expect(() => createLLMClient(cfg({ llmProvider: 'not-a-provider' as never }))).toThrow(
      'Unknown LLM provider',
    );
  });
});
