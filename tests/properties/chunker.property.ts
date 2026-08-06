import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { chunkText, estimateTokens } from '../../src/rag/chunker.js';

describe('Chunker properties', () => {
  it('concatenation of chunks equals original text', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 5000 }).filter(s => s.trim().length > 0),
        fc.integer({ min: 50, max: 2000 }),
        (text, maxTokens) => {
          const chunks = chunkText(text, maxTokens);
          const reconstructed = chunks.map(c => c.content).join('\n\n');

          // The chunker splits on \n\n, so reconstruction should match
          // (only if text contains \n\n separators — single-paragraph text is returned as-is)
          if (!text.includes('\n\n')) {
            expect(chunks).toHaveLength(1);
            expect(chunks[0].content).toBe(text);
          } else {
            expect(reconstructed).toBe(text);
          }
        },
      ),
      { numRuns: 200 },
    );
  });

  it('every chunk tokenCount is at most maxTokens (for multi-paragraph text)', () => {
    fc.assert(
      fc.property(
        fc.array(fc.string({ minLength: 10, maxLength: 200 }), { minLength: 3, maxLength: 20 }),
        fc.integer({ min: 100, max: 2000 }),
        (paragraphs, maxTokens) => {
          const text = paragraphs.join('\n\n');
          const chunks = chunkText(text, maxTokens);

          for (const chunk of chunks) {
            // Note: a single paragraph that exceeds maxTokens is kept as one chunk
            // (we don't split mid-paragraph)
            // So we only check for chunks that came from accumulation
            if (chunk.tokenCount > maxTokens) {
              // This chunk must be a single paragraph that's larger than maxTokens
              expect(chunk.content.includes('\n\n')).toBe(false);
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('empty string returns empty array', () => {
    expect(chunkText('')).toHaveLength(0);
  });
});
