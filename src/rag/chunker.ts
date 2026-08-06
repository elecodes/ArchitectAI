export interface TextChunk {
  content: string;
  tokenCount: number;
  index: number;
}

export function chunkText(content: string, maxTokens: number = 512): TextChunk[] {
  if (!content.trim()) return []; // Handle empty/whitespace-only input

  const chunks: TextChunk[] = [];
  const paragraphs = content.split('\n\n');
  let current = '';
  let index = 0;

  for (const paragraph of paragraphs) {
    const combined = current ? current + '\n\n' + paragraph : paragraph;
    const combinedTokens = estimateTokens(combined);

    if (combinedTokens > maxTokens && current) {
      // Push current chunk and start new one
      chunks.push({
        content: current,
        tokenCount: estimateTokens(current),
        index: index++,
      });
      current = paragraph;
    } else {
      current = combined;
    }
  }

  // Push final chunk
  if (current) {
    chunks.push({
      content: current,
      tokenCount: estimateTokens(current),
      index: index,
    });
  }

  return chunks;
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
