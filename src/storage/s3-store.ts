import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import type { DocumentStore } from './document-store.js';
import { createChildLogger } from '../logger.js';

const log = createChildLogger('storage-s3');

export interface S3StoreConfig {
  bucket: string;
  region?: string;
  prefix?: string;
  forcePathStyle?: boolean;
}

/**
 * Amazon S3 DocumentStore. Credentials are resolved via the AWS SDK default
 * credential provider chain — never read from config by this class.
 * Objects are stored with SSE-S3 (AES256) encryption at rest.
 */
export class S3DocumentStore implements DocumentStore {
  private readonly client: S3Client;
  private readonly prefix: string;

  constructor(private readonly config: S3StoreConfig) {
    this.client = new S3Client({
      region: config.region || undefined,
      forcePathStyle: config.forcePathStyle,
    });
    this.prefix = (config.prefix || '').replace(/^\/+|\/+$/g, '');
  }

  private keyWithPrefix(key: string): string {
    return this.prefix ? `${this.prefix}/${key}` : key;
  }

  async putObject(key: string, data: Buffer, contentType?: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: this.keyWithPrefix(key),
        Body: data,
        ContentType: contentType,
        ServerSideEncryption: 'AES256',
      }),
    );
    log.info({ key, bucket: this.config.bucket, bytes: data.length }, 'object stored');
  }

  async getObject(key: string): Promise<Buffer | null> {
    try {
      const res = await this.client.send(
        new GetObjectCommand({ Bucket: this.config.bucket, Key: this.keyWithPrefix(key) }),
      );
      const body = res.Body;
      if (!body) return null;
      if (body instanceof Uint8Array) return Buffer.from(body);
      const stream = body as { transformToByteArray?: () => Promise<Uint8Array> };
      if (typeof stream.transformToByteArray === 'function') {
        return Buffer.from(await stream.transformToByteArray());
      }
      if (typeof (body as Blob).arrayBuffer === 'function') {
        return Buffer.from(await (body as Blob).arrayBuffer());
      }
      return null;
    } catch (err) {
      const name = (err as { name?: string }).name;
      if (name === 'NoSuchKey' || name === 'NotFound') return null;
      throw err;
    }
  }

  async deleteObject(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.config.bucket, Key: this.keyWithPrefix(key) }),
    );
  }

  async listObjects(prefix: string): Promise<string[]> {
    const keys: string[] = [];
    let token: string | undefined;
    do {
      const res = await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.config.bucket,
          Prefix: this.keyWithPrefix(prefix),
          ContinuationToken: token,
        }),
      );
      for (const c of res.Contents || []) {
        const key = c.Key || '';
        if (this.prefix && key.startsWith(`${this.prefix}/`)) {
          keys.push(key.slice(this.prefix.length + 1));
        } else {
          keys.push(key);
        }
      }
      token = res.NextContinuationToken;
    } while (token);
    return keys;
  }
}
