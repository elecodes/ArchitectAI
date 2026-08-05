import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, extname, relative } from 'node:path';
import { createChildLogger } from '../logger.js';

const log = createChildLogger('file-parser');

const SUPPORTED_EXTENSIONS = new Set([
  '.ts', '.js', '.md', '.json', '.yaml', '.yml', '.txt', '.py', '.java', '.go',
  '.tsx', '.jsx', '.css', '.html', '.sql', '.sh', '.toml', '.env',
]);

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'coverage', '.next', '__pycache__']);
const MAX_FILE_SIZE = 1 * 1024 * 1024; // 1MB

export interface ParsedFile {
  filePath: string;
  content: string;
  sizeBytes: number;
}

export interface ParseResult {
  files: ParsedFile[];
  skipped: { path: string; reason: string }[];
}

export function parseProjectFiles(rootDir: string, ignorePatterns: string[] = []): ParseResult {
  const files: ParsedFile[] = [];
  const skipped: { path: string; reason: string }[] = [];

  // Load .architectai-ignore if exists
  const ignoreFile = join(rootDir, '.architectai-ignore');
  if (existsSync(ignoreFile)) {
    const ignoreContent = readFileSync(ignoreFile, 'utf-8');
    const patterns = ignoreContent.split('\n').filter(l => l.trim() && !l.startsWith('#'));
    ignorePatterns.push(...patterns);
  }

  function walk(dir: string): void {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const relativePath = relative(rootDir, fullPath);

      // Skip directories
      if (SKIP_DIRS.has(entry)) continue;

      // Check ignore patterns (simple glob-free matching)
      if (ignorePatterns.some(p => relativePath.includes(p))) {
        skipped.push({ path: relativePath, reason: 'matched ignore pattern' });
        continue;
      }

      let stat;
      try {
        stat = statSync(fullPath);
      } catch {
        continue;
      }

      if (stat.isDirectory()) {
        walk(fullPath);
        continue;
      }

      // Check extension
      const ext = extname(entry).toLowerCase();
      if (!SUPPORTED_EXTENSIONS.has(ext)) {
        skipped.push({ path: relativePath, reason: `unsupported extension: ${ext}` });
        continue;
      }

      // Check size
      if (stat.size > MAX_FILE_SIZE) {
        skipped.push({ path: relativePath, reason: `exceeds 1MB (${stat.size} bytes)` });
        continue;
      }

      // Read file
      try {
        const content = readFileSync(fullPath, 'utf-8');
        files.push({ filePath: relativePath, content, sizeBytes: stat.size });
      } catch (err) {
        skipped.push({ path: relativePath, reason: `read error: ${(err as Error).message}` });
      }
    }
  }

  walk(rootDir);
  log.info({ indexed: files.length, skipped: skipped.length }, 'Project files parsed');
  return { files, skipped };
}
