import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createLLMClient, createEmbeddingClient } from '../../src/llm/factory.js';
import { BedrockClient } from '../../src/llm/providers/bedrock.js';
import { MockLLMClient } from '../../src/llm/providers/mock.js';
import type { Config } from '../../src/config/index.js';

const { sendMock, credentialsMock } = vi.hoisted(() => ({
  sendMock: vi.fn(),
  credentialsMock: vi.fn(),
}));

vi.mock('@aws-sdk/client-bedrock-runtime', () => ({
  BedrockRuntimeClient: vi.fn().mockImplementation(() => ({
    send: sendMock,
    config: { credentials: credentialsMock },
  })),
  InvokeModelCommand: vi.fn().mockImplementation((input: unknown) => ({ input })),
}));

const encoder = new TextEncoder();
const decoder = new TextDecoder();

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
    bedrockEmbeddingModel: 'amazon.titan-embed-text-v1',
    bedrockEmbeddingDimensions: 1536,
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
  beforeEach(() => {
    sendMock.mockReset();
  });

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

  it('passes BEDROCK_EMBEDDING_DIMENSIONS into a Titan v2 embed request', async () => {
    sendMock.mockResolvedValue({ body: encoder.encode(JSON.stringify({ embedding: [0.1] })) });
    const client = createEmbeddingClient(
      cfg({
        embeddingProvider: 'bedrock',
        bedrockEmbeddingModel: 'amazon.titan-embed-text-v2:0',
        bedrockEmbeddingDimensions: 1024,
      }),
    );
    await client.embed('text');

    const command = sendMock.mock.calls[0][0];
    expect(JSON.parse(decoder.decode(command.input.body))).toEqual({
      inputText: 'text',
      dimensions: 1024,
    });
  });

  it('sends no dimensions for the default Titan v1 embed model', async () => {
    sendMock.mockResolvedValue({ body: encoder.encode(JSON.stringify({ embedding: [0.1] })) });
    const client = createEmbeddingClient(cfg({ embeddingProvider: 'bedrock' }));
    await client.embed('text');

    const command = sendMock.mock.calls[0][0];
    expect(JSON.parse(decoder.decode(command.input.body))).toEqual({ inputText: 'text' });
  });

  it('throws on an unknown LLM provider', () => {
    expect(() => createLLMClient(cfg({ llmProvider: 'not-a-provider' as never }))).toThrow(
      'Unknown LLM provider',
    );
  });
});
