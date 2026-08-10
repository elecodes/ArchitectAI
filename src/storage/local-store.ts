import { mkdir, writeFile, readFile, unlink, readdir } from 'node:fs/promises';
import { join, dirname, resolve, relative, sep } from 'node:path';
import type { DocumentStore } from './document-store.js';
import { createChildLogger } from '../logger.js';

const log = createChildLogger('storage-local');

/**
 * Local-filesystem DocumentStore. This is the default storage backend and the
 * foundation of local-first mode: it requires no AWS configuration at all.
 */
export class LocalDocumentStore implements DocumentStore {
  constructor(private readonly baseDir: string) {}

  private resolvePath(key: string): string {
    const base = resolve(this.baseDir);
    const target = resolve(base, key);
    if (target !== base && !target.startsWith(base + sep)) {
      throw new Error(`Object key escapes the storage root: ${key}`);
    }
    return target;
  }

  async putObject(key: string, data: Buffer, contentType?: string): Promise<void> {
    const target = this.resolvePath(key);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, data);
    log.info({ key, bytes: data.length, contentType }, 'object stored');
  }

  async getObject(key: string): Promise<Buffer | null> {
    try {
      return await readFile(this.resolvePath(key));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw err;
    }
  }

  async deleteObject(key: string): Promise<void> {
    try {
      await unlink(this.resolvePath(key));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    }
  }

  async listObjects(prefix: string): Promise<string[]> {
    const base = resolve(this.baseDir);
    const results: string[] = [];

    async function walk(dir: string): Promise<void> {
      const entries = await readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
          await walk(full);
        } else {
          results.push(relative(base, full).split(sep).join('/'));
        }
      }
    }

    try {
      await walk(this.resolvePath(prefix));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw err;
    }
    return results;
  }
}
