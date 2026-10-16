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

/**
 * Links are signed as of the start of a 5-minute window, so asking again for
 * the same photo within the window gives the very same address. A page that
 * refreshes itself (a conversation) then keeps its images instead of swapping
 * every address and reloading them. The link still works for at least the
 * requested time.
 */
export const SIGNING_WINDOW_SECONDS = 5 * 60;

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
      const windowMs = SIGNING_WINDOW_SECONDS * 1000;
      return getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: key }), {
        signingDate: new Date(Math.floor(Date.now() / windowMs) * windowMs),
        expiresIn: ttlSeconds + SIGNING_WINDOW_SECONDS,
      });
    },
  };
}

let store: ObjectStore | undefined;

export function getObjectStore(): ObjectStore {
  store ??= createR2Store();
  return store;
}
