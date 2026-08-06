import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { ContextWindowManager } from '../../src/generation/context-window.js';

describe('ContextWindowManager properties', () => {
  it('total tokens never exceed context window (when budget allows)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 10000, max: 200000 }), // contextWindow (large enough for base overhead)
        fc.string({ minLength: 10, maxLength: 2000 }), // systemPrompt
        fc.string({ minLength: 10, maxLength: 5000 }), // userInput
        fc.array(
          fc.record({
            content: fc.string({ minLength: 10, maxLength: 2000 }),
            filePath: fc.string(),
            similarity: fc.float({ min: 0, max: 1 }),
          }),
          { minLength: 0, maxLength: 20 },
        ), // ragChunks
        (contextWindow, systemPrompt, userInput, ragChunks) => {
          const manager = new ContextWindowManager(contextWindow);
          const result = manager.fitToContext({ systemPrompt, userInput, ragChunks });

          // Calculate actual tokens used by RAG
          const ragTokens = result.fittedChunks.reduce(
            (sum, c) => sum + manager.estimateTokens(c.content), 0
          );

          // Property: RAG tokens used must not exceed the available budget
          expect(ragTokens).toBeLessThanOrEqual(result.budget.availableForRAG);

          // Property: budget math is consistent
          const expectedAvailable = contextWindow
            - result.budget.systemPromptTokens
            - result.budget.userInputTokens
            - result.budget.reservedOutputTokens;

          if (expectedAvailable > 0) {
            expect(result.budget.availableForRAG).toBe(expectedAvailable);
          } else {
            expect(result.budget.availableForRAG).toBe(0);
          }
        },
      ),
      { numRuns: 200 },
    );
  });

  it('chunks included in similarity-descending order', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            content: fc.string({ minLength: 10, maxLength: 100 }),
            filePath: fc.string(),
            similarity: fc.float({ min: 0, max: 1, noNaN: true }),
          }),
          { minLength: 2, maxLength: 10 },
        ),
        (chunks) => {
          const manager = new ContextWindowManager(100000); // large window — all fit
          const result = manager.fitToContext({
            systemPrompt: 'test',
            userInput: 'test',
            ragChunks: chunks,
          });

          // Property: fitted chunks are sorted by similarity descending
          for (let i = 1; i < result.fittedChunks.length; i++) {
            expect(result.fittedChunks[i - 1].similarity).toBeGreaterThanOrEqual(
              result.fittedChunks[i].similarity
            );
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('returns empty chunks when input alone exceeds budget', () => {
    const manager = new ContextWindowManager(100); // tiny window
    const result = manager.fitToContext({
      systemPrompt: 'a'.repeat(500), // way over budget
      userInput: 'b'.repeat(500),
      ragChunks: [{ content: 'chunk', filePath: 'f.ts', similarity: 0.9 }],
    });
    expect(result.fittedChunks).toHaveLength(0);
    expect(result.truncated).toBe(true);
  });

  it('returns all chunks when all fit', () => {
    const manager = new ContextWindowManager(1000000);
    const chunks = [
      { content: 'chunk1', filePath: 'a.ts', similarity: 0.9 },
      { content: 'chunk2', filePath: 'b.ts', similarity: 0.8 },
    ];
    const result = manager.fitToContext({
      systemPrompt: 'sys',
      userInput: 'input',
      ragChunks: chunks,
    });
    expect(result.fittedChunks).toHaveLength(2);
    expect(result.truncated).toBe(false);
  });
});
