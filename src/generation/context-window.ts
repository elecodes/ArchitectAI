import type { RAGChunk } from '../rag/types.js';
import { createChildLogger } from '../logger.js';

const log = createChildLogger('context-window');

export interface ContextBudget {
  modelContextWindow: number;
  systemPromptTokens: number;
  userInputTokens: number;
  reservedOutputTokens: number;
  availableForRAG: number;
  usedByRAG: number;
}

export interface FitResult {
  fittedChunks: RAGChunk[];
  budget: ContextBudget;
  truncated: boolean;
}

export class ContextWindowManager {
  constructor(private readonly modelContextWindow: number) {}

  fitToContext(params: {
    systemPrompt: string;
    userInput: string;
    ragChunks: RAGChunk[];
    reservedOutput?: number;
  }): FitResult {
    const reservedOutput = params.reservedOutput ?? 2048;
    const systemTokens = this.estimateTokens(params.systemPrompt);
    const inputTokens = this.estimateTokens(params.userInput);
    const availableForRAG = this.modelContextWindow - systemTokens - inputTokens - reservedOutput;

    if (availableForRAG <= 0) {
      log.warn({
        modelContextWindow: this.modelContextWindow,
        systemTokens,
        inputTokens,
        reservedOutput,
      }, 'No budget available for RAG context — input alone fills context window');

      return {
        fittedChunks: [],
        budget: {
          modelContextWindow: this.modelContextWindow,
          systemPromptTokens: systemTokens,
          userInputTokens: inputTokens,
          reservedOutputTokens: reservedOutput,
          availableForRAG: 0,
          usedByRAG: 0,
        },
        truncated: params.ragChunks.length > 0,
      };
    }

    // Sort by similarity descending — highest relevance first
    const sorted = [...params.ragChunks].sort((a, b) => b.similarity - a.similarity);
    const fittedChunks: RAGChunk[] = [];
    let usedTokens = 0;

    for (const chunk of sorted) {
      const chunkTokens = this.estimateTokens(chunk.content);
      if (usedTokens + chunkTokens > availableForRAG) break;
      fittedChunks.push(chunk);
      usedTokens += chunkTokens;
    }

    const truncated = fittedChunks.length < params.ragChunks.length;
    if (truncated) {
      log.info({
        original: params.ragChunks.length,
        fitted: fittedChunks.length,
        availableTokens: availableForRAG,
        usedTokens,
      }, 'RAG context truncated to fit context window');
    }

    return {
      fittedChunks,
      budget: {
        modelContextWindow: this.modelContextWindow,
        systemPromptTokens: systemTokens,
        userInputTokens: inputTokens,
        reservedOutputTokens: reservedOutput,
        availableForRAG,
        usedByRAG: usedTokens,
      },
      truncated,
    };
  }

  estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }
}
