import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { LocalDocumentStore } from '../../src/storage/local-store.js';

describe('LocalDocumentStore', () => {
  let dir: string;
  let store: LocalDocumentStore;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'architectai-store-'));
    store = new LocalDocumentStore(dir);
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('round-trips an object', async () => {
    await store.putObject('a/b/c.txt', Buffer.from('hello'), 'text/plain');
    expect(await store.getObject('a/b/c.txt')).toEqual(Buffer.from('hello'));
  });

  it('returns null for a missing object', async () => {
    expect(await store.getObject('nope.txt')).toBeNull();
  });

  it('lists objects under a prefix', async () => {
    await store.putObject('exports/p1/2026-08-10/package.zip', Buffer.from('x'));
    await store.putObject('exports/p2/package.zip', Buffer.from('y'));
    const keys = await store.listObjects('exports/');
    expect(keys).toContain('exports/p1/2026-08-10/package.zip');
    expect(keys).toContain('exports/p2/package.zip');
  });

  it('returns an empty list for a missing prefix', async () => {
    expect(await store.listObjects('does-not-exist/')).toEqual([]);
  });

  it('deletes an object', async () => {
    await store.putObject('x.txt', Buffer.from('a'));
    await store.deleteObject('x.txt');
    expect(await store.getObject('x.txt')).toBeNull();
  });

  it('rejects keys that escape the storage root', async () => {
    await expect(store.putObject('../escape.txt', Buffer.from('x'))).rejects.toThrow('escapes');
  });
});
