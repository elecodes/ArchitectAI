import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, extname, relative } from 'node:path';
import { createChildLogger } from '../logger.js';
import { DEFAULT_IGNORE_PATTERNS, matchesPattern, matchesIgnore } from '../rag/file-parser.js';

const log = createChildLogger('repository');

const DEFAULT_IGNORE_DIRS = new Set([
  'node_modules',
  'dist',
  'build',
  '.git',
  'coverage',
  'vendor',
  '__pycache__',
  '.next',
  '.nuxt',
  'target',
  '.gradle',
  'bin',
  'obj',
]);

const BINARY_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.ico',
  '.svg',
  '.woff',
  '.woff2',
  '.ttf',
  '.eot',
  '.mp3',
  '.mp4',
  '.zip',
  '.tar',
  '.gz',
  '.pdf',
  '.exe',
  '.dll',
  '.so',
  '.dylib',
  '.class',
  '.jar',
]);

const MAX_FILE_SIZE = 500 * 1024; // 500KB for review (smaller than RAG's 1MB — we need more files but less content per file)

export interface RepositoryFile {
  path: string;
  content: string;
  extension: string;
  sizeBytes: number;
  lines: number;
}

export interface RepositoryImport {
  rootPath: string;
  files: RepositoryFile[];
  skipped: { path: string; reason: string }[];
  totalFiles: number;
  totalLines: number;
  totalSizeBytes: number;
  extensions: Record<string, number>; // extension → count
}

export function importRepository(rootDir: string, customIgnore: string[] = []): RepositoryImport {
  const files: RepositoryFile[] = [];
  const skipped: { path: string; reason: string }[] = [];
  const extensions: Record<string, number> = {};

  // Load .architectai-ignore if exists
  const ignoreFile = join(rootDir, '.architectai-ignore');
  const ignorePatterns = [...customIgnore];
  if (existsSync(ignoreFile)) {
    const content = readFileSync(ignoreFile, 'utf-8');
    ignorePatterns.push(...content.split('\n').filter((l) => l.trim() && !l.startsWith('#')));
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

      // Skip ignored directories
      if (DEFAULT_IGNORE_DIRS.has(entry)) continue;

      // Check default security patterns FIRST
      if (DEFAULT_IGNORE_PATTERNS.some((p) => matchesPattern(relativePath, p))) {
        skipped.push({ path: relativePath, reason: 'security: matches default sensitive pattern' });
        continue;
      }

      if (ignorePatterns.some((p) => matchesIgnore(relativePath, p))) {
        skipped.push({ path: relativePath, reason: 'ignored' });
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

      const ext = extname(entry).toLowerCase();

      // Skip binary files
      if (BINARY_EXTENSIONS.has(ext)) {
        skipped.push({ path: relativePath, reason: 'binary' });
        continue;
      }

      // Skip oversized files
      if (stat.size > MAX_FILE_SIZE) {
        skipped.push({
          path: relativePath,
          reason: `too large (${Math.round(stat.size / 1024)}KB)`,
        });
        continue;
      }

      // Skip files without extension (except common ones)
      if (!ext && !['Makefile', 'Dockerfile', 'Procfile', 'Gemfile', 'Rakefile'].includes(entry)) {
        skipped.push({ path: relativePath, reason: 'no extension' });
        continue;
      }

      try {
        const content = readFileSync(fullPath, 'utf-8');
        const lines = content.split('\n').length;
        extensions[ext] = (extensions[ext] || 0) + 1;
        files.push({ path: relativePath, content, extension: ext, sizeBytes: stat.size, lines });
      } catch (err) {
        skipped.push({ path: relativePath, reason: `read error: ${(err as Error).message}` });
      }
    }
  }

  walk(rootDir);

  const totalLines = files.reduce((sum, f) => sum + f.lines, 0);
  const totalSizeBytes = files.reduce((sum, f) => sum + f.sizeBytes, 0);

  log.info(
    {
      files: files.length,
      skipped: skipped.length,
      totalLines,
      extensions: Object.keys(extensions).length,
    },
    'Repository imported',
  );

  return {
    rootPath: rootDir,
    files,
    skipped,
    totalFiles: files.length,
    totalLines,
    totalSizeBytes,
    extensions,
  };
}
