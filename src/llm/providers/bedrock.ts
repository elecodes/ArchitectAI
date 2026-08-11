import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import type { LLMClient, CompletionRequest, CompletionResponse, EmbeddingResponse } from '../interface.js';
import { createChildLogger } from '../../logger.js';

const log = createChildLogger('bedrock');

export interface BedrockConfig {
  model: string;
  region?: string;
  timeoutMs?: number;
  embeddingModel?: string;
  embeddingDimensions?: number;
}

interface BedrockClaudeResponse {
  content?: { type?: string; text?: string }[];
  usage?: { input_tokens?: number; output_tokens?: number };
}

/**
 * AWS Bedrock LLM provider.
 *
 * Credentials are NEVER hardcoded or read from env by this class — the AWS SDK
 * default credential provider chain resolves them at runtime (env vars, shared
 * config, ECS/EC2/IMDS roles, etc.).
 *
 * Generation uses the Anthropic Claude Messages API shape (most commonly
 * enabled Bedrock models). Embeddings use Amazon Titan. Both model ids are
 * configurable via BEDROCK_MODEL / BEDROCK_EMBEDDING_MODEL.
 */
export class BedrockClient implements LLMClient {
  private readonly client: BedrockRuntimeClient;
  private readonly timeout: number;

  constructor(private readonly config: BedrockConfig) {
    this.client = new BedrockRuntimeClient({ region: config.region || 'us-east-1' });
    this.timeout = config.timeoutMs || 60000;
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const start = Date.now();

    const body = {
      anthropic_version: 'bedrock-2023-05-01',
      max_tokens: request.maxTokens ?? 4096,
      temperature: request.temperature ?? 0.3,
      system: request.systemPrompt,
      messages: [{ role: 'user', content: request.prompt }],
    };

    const command = new InvokeModelCommand({
      modelId: this.config.model,
      contentType: 'application/json',
      accept: 'application/json',
      body: new TextEncoder().encode(JSON.stringify(body)),
    });

    const response = await this.client.send(command, {
      abortSignal: AbortSignal.timeout(this.timeout),
    });

    const data = JSON.parse(new TextDecoder().decode(response.body)) as BedrockClaudeResponse;
    const content =
      data.content
        ?.filter((c) => c.type === 'text')
        .map((c) => c.text ?? '')
        .join('') ?? '';

    const durationMs = Date.now() - start;

    log.info({ model: this.config.model, durationMs, tokens: data.usage }, 'completion finished');

    return {
      content,
      durationMs,
      tokenCount: {
        prompt: data.usage?.input_tokens || Math.ceil(request.prompt.length / 4),
        completion: data.usage?.output_tokens || Math.ceil(content.length / 4),
      },
    };
  }

  async embed(text: string): Promise<EmbeddingResponse> {
    const start = Date.now();

    const body: Record<string, unknown> = { inputText: text };
    if (this.config.embeddingDimensions) {
      body.dimensions = this.config.embeddingDimensions;
    }

    const command = new InvokeModelCommand({
      modelId: this.config.embeddingModel || 'amazon.titan-embed-text-v2',
      contentType: 'application/json',
      accept: 'application/json',
      body: new TextEncoder().encode(JSON.stringify(body)),
    });

    const response = await this.client.send(command, {
      abortSignal: AbortSignal.timeout(10000),
    });

    const data = JSON.parse(new TextDecoder().decode(response.body)) as { embedding?: number[] };
    if (!data.embedding) {
      throw new Error('Bedrock embedding response is missing the embedding vector');
    }

    return { embedding: data.embedding, durationMs: Date.now() - start };
  }

  /**
   * Resolves credentials via the AWS default credential provider chain. This is
   * intentionally cost-free (no API call): it verifies the chain can authenticate
   * without incurring any model-invocation or list charges.
   */
  async isHealthy(): Promise<boolean> {
    try {
      await this.client.config.credentials();
      return true;
    } catch {
      return false;
    }
  }
}
