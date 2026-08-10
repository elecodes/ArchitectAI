export interface DocumentStore {
  putObject(key: string, data: Buffer, contentType?: string): Promise<void>;
  getObject(key: string): Promise<Buffer | null>;
  deleteObject(key: string): Promise<void>;
  listObjects(prefix: string): Promise<string[]>;
}
