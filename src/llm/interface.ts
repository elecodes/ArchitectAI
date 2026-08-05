export interface CompletionRequest {
  prompt: string;
  systemPrompt: string;
  temperature?: number;
  maxTokens?: number;
}

export interface CompletionResponse {
  content: string;
  durationMs: number;
  tokenCount: {
    prompt: number;
    completion: number;
  };
}

export interface EmbeddingResponse {
  embedding: number[];
  durationMs: number;
}

export interface LLMClient {
  complete(request: CompletionRequest): Promise<CompletionResponse>;
  embed(text: string): Promise<EmbeddingResponse>;
  isHealthy(): Promise<boolean>;
}
