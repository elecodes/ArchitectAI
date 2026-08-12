import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, extname, relative, basename } from 'node:path';
import { createChildLogger } from '../logger.js';

const log = createChildLogger('file-parser');

const SUPPORTED_EXTENSIONS = new Set([
  '.ts', '.js', '.md', '.json', '.yaml', '.yml', '.txt', '.py', '.java', '.go',
  '.tsx', '.jsx', '.css', '.html', '.sql', '.sh', '.toml', '.env',
]);

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'coverage', '.next', '__pycache__']);
const MAX_FILE_SIZE = 1 * 1024 * 1024; // 1MB

export const DEFAULT_IGNORE_PATTERNS = [
  '.env',
  '.env.*',
  '*.key',
  '*.pem',
  '*.p12',
  '*.pfx',
  'id_rsa',
  'id_ed25519',
  'secrets.*',
  '*.secret',
  'credentials.*',
  '.aws/',
  '.ssh/',
];

export interface ParsedFile {
  filePath: string;
  content: string;
  sizeBytes: number;
}

export interface ParseResult {
  files: ParsedFile[];
  skipped: { path: string; reason: string }[];
}

/**
 * Check if a file path matches a simple glob pattern.
 * Supports: *.ext, prefix.*, exact match, directory/ prefix.
 */
export function matchesPattern(relativePath: string, pattern: string): boolean {
  const fileName = basename(relativePath);

  // Directory pattern (e.g., '.aws/')
  if (pattern.endsWith('/')) {
    const dirName = pattern.slice(0, -1);
    return relativePath.startsWith(dirName + '/') || relativePath.includes('/' + dirName + '/') || fileName === dirName;
  }

  // Wildcard patterns
  if (pattern.startsWith('*.')) {
    // *.ext — match by extension
    const ext = pattern.slice(1); // e.g., '.key'
    return fileName.endsWith(ext);
  }

  if (pattern.includes('.*')) {
    // prefix.* — match files starting with prefix followed by dot
    const prefix = pattern.split('.*')[0];
    return fileName.startsWith(prefix + '.') || fileName === prefix;
  }

  // Exact filename match
  return fileName === pattern;
}

/**
 * User-supplied ignore pattern matcher. Glob-aware via matchesPattern, with a
 * fallback so a plain directory name (e.g. "build") also matches any path
 * segment instead of only files named exactly "build".
 */
export function matchesIgnore(relativePath: string, pattern: string): boolean {
  if (matchesPattern(relativePath, pattern)) return true;
  const normalized = pattern.replace(/\/+$/, '');
  return normalized.split('/').length === 1 && relativePath.split('/').includes(normalized);
}

export function parseProjectFiles(
  rootDir: string,
  ignorePatterns: string[] = [],
  maxFiles: number = 500,
): ParseResult {
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
      if (files.length >= maxFiles) return;
      const fullPath = join(dir, entry);
      const relativePath = relative(rootDir, fullPath);

      // Skip directories
      if (SKIP_DIRS.has(entry)) continue;

      // Check default security patterns FIRST
      if (DEFAULT_IGNORE_PATTERNS.some(p => matchesPattern(relativePath, p))) {
        log.info({ path: relativePath }, 'security: matches default sensitive pattern');
        skipped.push({ path: relativePath, reason: 'security: matches default sensitive pattern' });
        continue;
      }

      // Check user-provided ignore patterns
      if (ignorePatterns.some(p => matchesIgnore(relativePath, p))) {
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
