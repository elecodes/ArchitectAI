import { describe, it, expect, vi } from 'vitest';

const { sendMock } = vi.hoisted(() => ({ sendMock: vi.fn() }));

vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn().mockImplementation(() => ({ send: sendMock })),
  PutObjectCommand: vi.fn().mockImplementation((input: unknown) => ({ input })),
  GetObjectCommand: vi.fn().mockImplementation((input: unknown) => ({ input })),
  DeleteObjectCommand: vi.fn().mockImplementation((input: unknown) => ({ input })),
  ListObjectsV2Command: vi.fn().mockImplementation((input: unknown) => ({ input })),
}));

import { S3DocumentStore } from '../../src/storage/s3-store.js';
import { S3Client } from '@aws-sdk/client-s3';

describe('S3DocumentStore', () => {
  const store = new S3DocumentStore({
    bucket: 'my-bucket',
    region: 'us-east-1',
    prefix: 'architectai',
  });

  it('prefixes keys and sets SSE for put', async () => {
    sendMock.mockReset().mockResolvedValue({});
    await store.putObject('exports/p1/package.zip', Buffer.from('x'), 'application/zip');

    const cmd = sendMock.mock.calls[0][0];
    expect(cmd.input.Bucket).toBe('my-bucket');
    expect(cmd.input.Key).toBe('architectai/exports/p1/package.zip');
    expect(cmd.input.ServerSideEncryption).toBe('AES256');
    expect(cmd.input.ContentType).toBe('application/zip');
  });

  it('gets an object and converts the body to a Buffer', async () => {
    sendMock.mockReset().mockResolvedValue({
      Body: { transformToByteArray: async () => new Uint8Array([1, 2, 3]) },
    });
    const data = await store.getObject('k.txt');
    expect(data).toEqual(Buffer.from([1, 2, 3]));
    expect(sendMock.mock.calls[0][0].input.Key).toBe('architectai/k.txt');
  });

  it('returns null for NoSuchKey', async () => {
    sendMock.mockReset().mockRejectedValue({ name: 'NoSuchKey' });
    expect(await store.getObject('missing')).toBeNull();
  });

  it('deletes with a prefixed key', async () => {
    sendMock.mockReset().mockResolvedValue({});
    await store.deleteObject('k.txt');
    expect(sendMock.mock.calls[0][0].input.Key).toBe('architectai/k.txt');
  });

  it('paginates through listing results and strips the store prefix from keys', async () => {
    sendMock
      .mockReset()
      .mockResolvedValueOnce({
        Contents: [{ Key: 'architectai/exports/p1/package.zip' }],
        NextContinuationToken: 'token',
      })
      .mockResolvedValueOnce({ Contents: [{ Key: 'architectai/exports/p2/package.zip' }] });

    const keys = await store.listObjects('exports/');
    expect(keys).toEqual(['exports/p1/package.zip', 'exports/p2/package.zip']);
    expect(sendMock).toHaveBeenCalledTimes(2);
    expect(sendMock.mock.calls[0][0].input.Prefix).toBe('architectai/exports/');
  });

  it('returns keys as-is when no prefix is configured', async () => {
    const noPrefixStore = new S3DocumentStore({ bucket: 'my-bucket', region: 'us-east-1' });
    sendMock.mockReset().mockResolvedValue({
      Contents: [{ Key: 'exports/p1/package.zip' }],
    });

    const keys = await noPrefixStore.listObjects('exports/');
    expect(keys).toEqual(['exports/p1/package.zip']);
    expect(sendMock.mock.calls[0][0].input.Prefix).toBe('exports/');
  });

  it('passes forcePathStyle through to S3Client when set', () => {
    const clientMock = vi.mocked(S3Client);
    clientMock.mockClear();
    new S3DocumentStore({ bucket: 'b', forcePathStyle: true });
    expect(clientMock).toHaveBeenCalledWith(
      expect.objectContaining({ forcePathStyle: true }),
    );
  });

  it('omits forcePathStyle when not configured', () => {
    const clientMock = vi.mocked(S3Client);
    clientMock.mockClear();
    new S3DocumentStore({ bucket: 'b' });
    const args = clientMock.mock.calls[0][0] as Record<string, unknown>;
    expect(args.forcePathStyle).toBeUndefined();
  });
});
