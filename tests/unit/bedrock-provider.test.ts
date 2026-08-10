import { describe, it, expect, vi, beforeEach } from 'vitest';

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

import { BedrockClient } from '../../src/llm/providers/bedrock.js';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function bedrockBody(body: unknown) {
  return { body: encoder.encode(JSON.stringify(body)) };
}

describe('BedrockClient', () => {
  beforeEach(() => {
    sendMock.mockReset();
    credentialsMock.mockReset().mockResolvedValue({});
  });

  it('builds a Claude Messages request and parses the response', async () => {
    sendMock.mockResolvedValue(
      bedrockBody({
        content: [{ type: 'text', text: 'hello from bedrock' }],
        usage: { input_tokens: 11, output_tokens: 4 },
      }),
    );

    const client = new BedrockClient({
      model: 'anthropic.claude-3-5-sonnet-20240620-v1:0',
      region: 'us-east-1',
    });
    const res = await client.complete({ prompt: 'hi', systemPrompt: 'sys' });

    expect(sendMock).toHaveBeenCalledTimes(1);
    const command = sendMock.mock.calls[0][0];
    expect(command.input.modelId).toBe('anthropic.claude-3-5-sonnet-20240620-v1:0');
    const body = JSON.parse(decoder.decode(command.input.body));
    expect(body.anthropic_version).toBe('bedrock-2023-05-01');
    expect(body.system).toBe('sys');
    expect(body.messages).toEqual([{ role: 'user', content: 'hi' }]);

    expect(res.content).toBe('hello from bedrock');
    expect(res.tokenCount).toEqual({ prompt: 11, completion: 4 });
  });

  it('falls back to heuristic token counts when usage is missing', async () => {
    sendMock.mockResolvedValue(bedrockBody({ content: [{ type: 'text', text: 'abc' }] }));
    const client = new BedrockClient({ model: 'm' });
    const res = await client.complete({ prompt: 'four', systemPrompt: 's' });
    expect(res.tokenCount.prompt).toBe(Math.ceil('four'.length / 4));
    expect(res.tokenCount.completion).toBe(Math.ceil(3 / 4));
  });

  it('propagates invocation errors', async () => {
    sendMock.mockRejectedValue(new Error('AccessDeniedException'));
    const client = new BedrockClient({ model: 'm' });
    await expect(client.complete({ prompt: 'hi', systemPrompt: 's' })).rejects.toThrow(
      'AccessDeniedException',
    );
  });

  it('returns an embedding vector from a Titan request', async () => {
    sendMock.mockResolvedValue(bedrockBody({ embedding: [0.1, 0.2, 0.3] }));
    const client = new BedrockClient({ model: 'm', embeddingModel: 'amazon.titan-embed-text-v2' });
    const res = await client.embed('text');

    expect(res.embedding).toEqual([0.1, 0.2, 0.3]);
    const command = sendMock.mock.calls[0][0];
    expect(command.input.modelId).toBe('amazon.titan-embed-text-v2');
    expect(JSON.parse(decoder.decode(command.input.body))).toEqual({ inputText: 'text' });
  });

  it('throws when the embedding response has no vector', async () => {
    sendMock.mockResolvedValue(bedrockBody({}));
    const client = new BedrockClient({ model: 'm' });
    await expect(client.embed('x')).rejects.toThrow('missing the embedding vector');
  });

  it('isHealthy resolves true when credentials resolve', async () => {
    const client = new BedrockClient({ model: 'm' });
    await expect(client.isHealthy()).resolves.toBe(true);
  });

  it('isHealthy resolves false when credential resolution fails', async () => {
    credentialsMock.mockRejectedValue(new Error('no credentials found'));
    const client = new BedrockClient({ model: 'm' });
    await expect(client.isHealthy()).resolves.toBe(false);
  });
});
