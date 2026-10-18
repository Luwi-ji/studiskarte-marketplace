import { sql } from "drizzle-orm";
import { image } from "@/db/schema";
import { getDb } from "@/lib/db";
import {
  countEvents,
  MAIL_QUOTA_ACTION,
  MAIL_QUOTA_KEY,
  MAIL_QUOTA_STOP_AT,
  MAIL_QUOTA_WINDOW_SECONDS,
} from "@/lib/rate-limit";

// Free-tier limits (blueprint 02-tech-stack.md). Byte limits use decimal units,
// which are the smaller reading of "GB", so the warning errs early.

/** Gmail: 500 recipients per rolling 24 hours for a personal account (Nodemailer docs). */
export const GMAIL_DAILY_LIMIT = 500;
/** Cloudflare R2 free tier: 10 GB of storage (Cloudflare docs). */
export const R2_FREE_TIER_BYTES = 10 * 1000 ** 3;
/** Neon Free: 0.5 GB per project (Neon docs; the stack doc notes some pages say 1 GB, so we use the lower). */
export const NEON_FREE_TIER_BYTES = 500 * 1000 ** 2;
/** Warn once usage reaches this share of a limit, leaving time to act. */
export const WARN_AT_PERCENT = 80;

/**
 * `image.bytes` is the size of the main picture only; the thumbnail is not
 * recorded. A thumbnail has 1/16 of the pixels (400 px vs 1600 px, 128 px vs
 * 512 px), so about 6% of the bytes; we count 15% to cover fixed overhead and
 * lossier-per-pixel small files, so the estimate is never low.
 */
export const THUMBNAIL_OVERHEAD = 0.15;

export type HealthMeasurements = {
  /** Mail sent in the last 24 hours. */
  emailsSent24h: number;
  /** Bytes held in R2: main pictures plus thumbnails. */
  r2Bytes: number;
  /** pg_database_size of the current database. */
  databaseBytes: number;
};

function reached(used: number, limit: number): boolean {
  return used * 100 >= limit * WARN_AT_PERCENT;
}

function percent(used: number, limit: number): number {
  return Math.round((used * 100) / limit);
}

function formatBytes(bytes: number): string {
  if (bytes >= 1000 ** 3) return `${(bytes / 1000 ** 3).toFixed(2)} GB`;
  return `${(bytes / 1000 ** 2).toFixed(0)} MB`;
}

/** Turns measurements into owner-facing warnings. Empty means nothing is near a limit. */
export function healthWarnings(m: HealthMeasurements): string[] {
  const warnings: string[] = [];
  if (reached(m.emailsSent24h, GMAIL_DAILY_LIMIT)) {
    warnings.push(
      `Gmail quota: ${m.emailsSent24h} of ${GMAIL_DAILY_LIMIT} emails sent in the last 24 hours (${percent(m.emailsSent24h, GMAIL_DAILY_LIMIT)}%). Sending stops at ${MAIL_QUOTA_STOP_AT}.`,
    );
  }
  if (reached(m.r2Bytes, R2_FREE_TIER_BYTES)) {
    warnings.push(
      `Photo storage: ${formatBytes(m.r2Bytes)} of ${formatBytes(R2_FREE_TIER_BYTES)} used in R2 (${percent(m.r2Bytes, R2_FREE_TIER_BYTES)}%).`,
    );
  }
  if (reached(m.databaseBytes, NEON_FREE_TIER_BYTES)) {
    warnings.push(
      `Database size: ${formatBytes(m.databaseBytes)} of ${formatBytes(NEON_FREE_TIER_BYTES)} used in Neon (${percent(m.databaseBytes, NEON_FREE_TIER_BYTES)}%).`,
    );
  }
  return warnings;
}

/** Emails sent in the last 24 hours, counted the same way sendMail enforces its quota. */
export function countEmailsSentLast24h(): Promise<number> {
  return countEvents(MAIL_QUOTA_ACTION, MAIL_QUOTA_KEY, MAIL_QUOTA_WINDOW_SECONDS);
}

async function measureStorage(): Promise<{ r2Bytes: number; databaseBytes: number }> {
  const db = getDb();
  const [photos] = await db.select({ main: sql<string>`coalesce(sum(${image.bytes}), 0)::text` }).from(image);
  const sizeResult = await db.execute<{ size: string }>(sql`select pg_database_size(current_database())::text as size`);
  return {
    r2Bytes: Math.ceil(Number(photos.main) * (1 + THUMBNAIL_OVERHEAD)),
    databaseBytes: Number(sizeResult.rows[0].size),
  };
}

export async function measureHealth(): Promise<HealthMeasurements> {
  const [emailsSent24h, storage] = await Promise.all([countEmailsSentLast24h(), measureStorage()]);
  return { emailsSent24h, ...storage };
}
