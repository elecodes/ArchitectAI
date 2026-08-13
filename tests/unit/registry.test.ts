import { describe, it, expect, beforeEach } from 'vitest';
import { registerAgent, getAgentDefinition, listAgentDefinitions } from '../../src/agents/registry.js';
import type { AgentDefinition } from '../../src/agents/contract.js';
import { z } from 'zod';

const mockAgent: AgentDefinition<{ query: string }, { result: string }> = {
  id: 'test-agent',
  name: 'Test Agent',
  description: 'A test agent',
  promptName: 'test-prompt',
  artifactType: 'specification',
  inputSchema: z.object({ query: z.string() }),
  outputSchema: z.object({ result: z.string() }),
  capabilities: ['rag:read'] as const,
  timeoutMs: 5000,
  maxTransientRetries: 3,
};

const mockAgent2: AgentDefinition<{ input: string }, { output: string }> = {
  id: 'test-agent-2',
  name: 'Test Agent 2',
  description: 'Another test agent',
  promptName: 'test-prompt-2',
  artifactType: 'analysis',
  inputSchema: z.object({ input: z.string() }),
  outputSchema: z.object({ output: z.string() }),
  capabilities: ['rag:read'] as const,
  timeoutMs: 5000,
  maxTransientRetries: 3,
};

describe('Agent Registry', () => {
  beforeEach(() => {
    const list = listAgentDefinitions();
    for (const agent of list) {
      getAgentDefinition(agent.id);
    }
  });

  it('returns registered agent by id', () => {
    registerAgent(mockAgent);
    const result = getAgentDefinition('test-agent');
    expect(result).toBe(mockAgent);
    expect(result?.id).toBe('test-agent');
  });

  it('returns undefined for unknown id', () => {
    const result = getAgentDefinition('nonexistent-id');
    expect(result).toBeUndefined();
  });

  it('returns all registered agents', () => {
    registerAgent(mockAgent);
    registerAgent(mockAgent2);
    const all = listAgentDefinitions();
    expect(all).toContain(mockAgent);
    expect(all).toContain(mockAgent2);
    expect(all.length).toBeGreaterThanOrEqual(2);
  });

  it('returns correct agent when multiple are registered', () => {
    registerAgent(mockAgent);
    registerAgent(mockAgent2);
    const result1 = getAgentDefinition('test-agent');
    const result2 = getAgentDefinition('test-agent-2');
    expect(result1?.id).toBe('test-agent');
    expect(result2?.id).toBe('test-agent-2');
  });
});
