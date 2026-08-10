import type { Config } from '../config/index.js';
import type { DocumentStore } from './document-store.js';
import { LocalDocumentStore } from './local-store.js';
import { S3DocumentStore } from './s3-store.js';

export function createDocumentStore(config: Config): DocumentStore {
  switch (config.storageProvider) {
    case 'local':
      return new LocalDocumentStore(config.storageLocalDir);
    case 's3':
      if (!config.s3Bucket) {
        throw new Error('S3_BUCKET is required when STORAGE_PROVIDER=s3');
      }
      return new S3DocumentStore({
        bucket: config.s3Bucket,
        region: config.s3Region || undefined,
        prefix: config.s3Prefix,
      });
    default:
      throw new Error(`Unknown storage provider: "${config.storageProvider}"`);
  }
}
