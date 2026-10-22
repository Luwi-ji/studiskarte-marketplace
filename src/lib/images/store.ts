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

/** The bucket and key to use: the photo bucket by default, or the private ID bucket (`createIdStore`). */
type R2Target = { bucket: string; accessKeyId: string; secretAccessKey: string };

export function createR2Store(target?: R2Target): ObjectStore {
  const bucket = target?.bucket ?? requireEnv("R2_BUCKET");
  const client = new S3Client({
    region: "auto",
    endpoint: `https://${requireEnv("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: target?.accessKeyId ?? requireEnv("R2_ACCESS_KEY_ID"),
      secretAccessKey: target?.secretAccessKey ?? requireEnv("R2_SECRET_ACCESS_KEY"),
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

/**
 * The private bucket for ID pictures, kept apart from listing photos. R2_ID_BUCKET names it; its own key pair
 * (R2_ID_ACCESS_KEY_ID, R2_ID_SECRET_ACCESS_KEY) is used when set, else the photo key pair must cover it.
 */
export function createIdStore(): ObjectStore {
  return createR2Store({
    bucket: requireEnv("R2_ID_BUCKET"),
    accessKeyId: process.env.R2_ID_ACCESS_KEY_ID || requireEnv("R2_ACCESS_KEY_ID"),
    secretAccessKey: process.env.R2_ID_SECRET_ACCESS_KEY || requireEnv("R2_SECRET_ACCESS_KEY"),
  });
}

let idStore: ObjectStore | undefined;

export function getIdStore(): ObjectStore {
  idStore ??= createIdStore();
  return idStore;
}

let store: ObjectStore | undefined;

export function getObjectStore(): ObjectStore {
  store ??= createR2Store();
  return store;
}
