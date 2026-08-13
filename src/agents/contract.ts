import { z } from 'zod';
import type { RAGChunk } from '../rag/types.js';
import type { GenerationProvenance } from '../generation/spec-generator.js';

export type Capability = 'rag:read' | `artifact:read:${string}` | `artifact:write:${string}`;

export interface AgentDefinition<I = unknown, O = unknown> {
  id: string;
  name: string;
  description: string;
  promptName: string;
  artifactType: string;
  inputSchema: z.ZodType<I>;
  outputSchema: z.ZodType<O>;
  capabilities: readonly Capability[];
  timeoutMs: number;
  maxTransientRetries: number;
  buildPrompt?: (input: I, fittedChunks: RAGChunk[]) => string;
}

export interface AgentContext<I> {
  input: I;
  projectId: string;
  userId: string;
  ragQuery?: string;
  ragChunks?: RAGChunk[];
  parentArtifactId?: string;
}

export interface AgentRunResult<O> {
  output: O;
  provenance: GenerationProvenance;
  retryCount: number;
  transientRetries: number;
  truncated: boolean;
  artifactId: string | null;
}

export class AgentRunError extends Error {
  public readonly code: 'AGENT_INPUT_INVALID' | 'AGENT_TIMEOUT' | 'AGENT_TRANSIENT_FAILED';
  public readonly details: Record<string, unknown>;

  constructor(code: AgentRunError['code'], details: Record<string, unknown> = {}) {
    super(`Agent run failed: ${code}`);
    this.name = 'AgentRunError';
    this.code = code;
    this.details = details;
  }
}
