import { isAbsolute, relative, resolve } from 'node:path';
import { config } from '../config/index.js';

export class PathContainmentError extends Error {
  constructor(path: string) {
    super(`Path is outside the allowed root: ${path}`);
    this.name = 'PathContainmentError';
  }
}

export function resolveContainedPath(requested: string, roots: string[]): string {
  for (const root of roots) {
    const rootResolved = resolve(root);
    const candidate = isAbsolute(requested) ? resolve(requested) : resolve(rootResolved, requested);
    const rel = relative(rootResolved, candidate);
    if (rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))) {
      return candidate;
    }
  }
  throw new PathContainmentError(requested);
}

export function resolveFsPath(requested: string): string {
  const enforce = config.allowedFsRoots.length > 0 || config.nodeEnv === 'production';
  if (!enforce) {
    return isAbsolute(requested) ? resolve(requested) : resolve(process.cwd(), requested);
  }
  const roots = config.allowedFsRoots.length > 0 ? config.allowedFsRoots : [process.cwd()];
  return resolveContainedPath(requested, roots);
}
