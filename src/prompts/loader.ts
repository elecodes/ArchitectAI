import { readFileSync, readdirSync } from 'node:fs';
import { join, basename } from 'node:path';
import { createChildLogger } from '../logger.js';

const log = createChildLogger('prompts');

export interface LoadedPrompt {
  name: string;
  version: string;
  content: string;
  tokenEstimate: number;
}

const REQUIRED_PROMPTS = [
  'spec',
  'architecture',
  'tasks',
  'retry',
  'review-summary',
  'review-engineering',
  'review-improvements',
  'vision',
  'risk-assessment',
];

export function loadPrompts(promptsDir: string): Map<string, LoadedPrompt> {
  const prompts = new Map<string, LoadedPrompt>();

  const files = readdirSync(promptsDir).filter((f) => f.endsWith('.md'));

  for (const file of files) {
    const match = /^(.+)-v(\d+)$/.exec(basename(file, '.md'));
    if (!match) {
      log.warn({ file }, 'Skipping prompt file with invalid naming pattern (expected: name-vN.md)');
      continue;
    }

    const [, name, version] = match;
    const content = readFileSync(join(promptsDir, file), 'utf-8');
    const tokenEstimate = Math.ceil(content.length / 4);

    prompts.set(name, {
      name,
      version: `v${version}`,
      content,
      tokenEstimate,
    });

    log.info({ name, version: `v${version}`, tokens: tokenEstimate }, 'Loaded prompt');
  }

  // Validate required prompts exist
  const missing = REQUIRED_PROMPTS.filter((p) => !prompts.has(p));
  if (missing.length > 0) {
    const missingFiles = missing.map((m) => m + '-v*.md').join(', ');
    throw new Error(
      `Missing required prompt files: ${missingFiles}. ` +
        `Check the prompts directory: ${promptsDir}`,
    );
  }

  log.info({ total: prompts.size }, 'All prompts loaded successfully');
  return prompts;
}
