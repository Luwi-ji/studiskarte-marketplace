import {
  DeleteObjectsCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/** Where image bytes live. R2 in production; swapped in tests. */
export interface ObjectStore {
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  delete(keys: string[]): Promise<void>;
  /** A link that stops working after `ttlSeconds`. */
  signedUrl(key: string, ttlSeconds: number): Promise<string>;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

export function createR2Store(): ObjectStore {
  const bucket = requireEnv("R2_BUCKET");
  const client = new S3Client({
    region: "auto",
    endpoint: `https://${requireEnv("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: requireEnv("R2_ACCESS_KEY_ID"),
      secretAccessKey: requireEnv("R2_SECRET_ACCESS_KEY"),
    },
  });

  return {
    async put(key, body, contentType) {
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: body,
          ContentType: contentType,
          CacheControl: "private, max-age=0, no-store",
        }),
      );
    },
    async delete(keys) {
      if (keys.length === 0) return;
      await client.send(
        new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: { Objects: keys.map((Key) => ({ Key })), Quiet: true },
        }),
      );
    },
    signedUrl(key, ttlSeconds) {
      return getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: key }), {
        expiresIn: ttlSeconds,
      });
    },
  };
}

let store: ObjectStore | undefined;

export function getObjectStore(): ObjectStore {
  store ??= createR2Store();
  return store;
}
