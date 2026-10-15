import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  bigserial,
  boolean,
  check,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

// One row per school email domain. Created at a student's first sign-in; the
// owner gives it a readable name later. Until then the domain is shown.
export const school = pgTable(
  "school",
  {
    domain: text("domain").primaryKey(),
    name: text("name"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("school_domain_shape", sql`${t.domain} ~ '^([a-z0-9-]+\\.)+edu\\.ph$'`),
    check("school_name_length", sql`${t.name} is null or char_length(btrim(${t.name})) between 1 and 120`),
  ],
);

// Better Auth owns the shape of `student`, `session` and `verification`.
// Property names below are the names Better Auth reads; column names are ours.
export const student = pgTable(
  "student",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull().default(""),
    email: text("email").notNull().unique(),
    emailVerified: boolean("email_verified").notNull().default(false),
    image: text("image"),
    schoolDomain: text("school_domain")
      .notNull()
      .references(() => school.domain),
    // Null until the student finishes sign-up (chooses a handle).
    handle: text("handle").unique(),
    // Last change after sign-up; null means the student has never changed it.
    handleChangedAt: timestamp("handle_changed_at", { withTimezone: true }),
    avatarImageId: uuid("avatar_image_id").references((): AnyPgColumn => image.id, {
      onDelete: "set null",
    }),
    accountStatus: text("account_status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // The suffix rule lives in school-email.ts; the database refuses anything
    // that is not at least shaped like a school address, even if code is bypassed.
    check("student_email_school", sql`${t.email} ~ '^[^@]+@([a-z0-9-]+\\.)+edu\\.ph$'`),
    check("student_email_lower", sql`${t.email} = lower(${t.email})`),
    check(
      "student_account_status",
      sql`${t.accountStatus} in ('active', 'suspended', 'deleted')`,
    ),
    // Mirrors src/lib/identity/names.ts: 3–20 of a–z 0–9 . _, lowercase,
    // no leading, trailing or doubled dots.
    check(
      "student_handle_format",
      sql`${t.handle} is null or (char_length(${t.handle}) between 3 and 20 and ${t.handle} ~ '^[a-z0-9_]+(\\.[a-z0-9_]+)*$')`,
    ),
    // names.ts limits what people see (40 graphemes; one emoji can be several
    // code points). This is only an outer bound against oversized rows.
    check(
      "student_name_length",
      sql`char_length(${t.name}) <= 200 and ${t.name} !~ '[\\r\\n]'`,
    ),
  ],
);

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    userId: text("student_id")
      .notNull()
      .references(() => student.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("session_student_idx").on(t.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)],
);

// Required by Better Auth's schema check. We use no passwords and no social
// sign-in, so no row is written today; keep it to what the library reads.
export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("student_id")
      .notNull()
      .references(() => student.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("account_student_idx").on(t.userId)],
);

// Every limited action (code requests, sign-in attempts, uploads, sent mail)
// writes one row. Limits are counts over a window; see src/lib/rate-limit.ts.
export const rateLimitEvent = pgTable(
  "rate_limit_event",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    action: text("action").notNull(),
    key: text("key").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("rate_limit_event_lookup_idx").on(t.action, t.key, t.createdAt)],
);

export const post = pgTable(
  "post",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => student.id),
    kind: text("kind").notNull(),
    title: text("title").notNull(),
    status: text("status").notNull().default("open"),
    listedAt: timestamp("listed_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true })
      .notNull()
      .default(sql`now() + interval '30 days'`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("post_kind", sql`${t.kind} in ('showcase', 'wishlist')`),
    check(
      "post_status",
      sql`${t.status} in ('open', 'reserved', 'fulfilled', 'withdrawn', 'expired', 'hidden', 'removed')`,
    ),
    check("post_title_length", sql`char_length(btrim(${t.title})) between 1 and 120`),
    check(
      "post_open_expiry",
      sql`${t.status} <> 'open' or ${t.expiresAt} > ${t.listedAt}`,
    ),
    index("post_owner_idx").on(t.ownerId),
    index("post_feed_idx").on(t.status, t.listedAt.desc()),
  ],
);

// `image` rows hold object-storage keys only. The bytes live in R2.
export const image = pgTable(
  "image",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => student.id),
    purpose: text("purpose").notNull(),
    key: text("key").notNull().unique(),
    thumbKey: text("thumb_key").notNull().unique(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    bytes: integer("bytes").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [check("image_purpose", sql`${t.purpose} in ('post_photo', 'avatar')`)],
);

export const postPhoto = pgTable(
  "post_photo",
  {
    postId: uuid("post_id")
      .notNull()
      .references(() => post.id, { onDelete: "cascade" }),
    imageId: uuid("image_id")
      .notNull()
      .references(() => image.id),
    position: integer("position").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.postId, t.imageId] }),
    unique("post_photo_position").on(t.postId, t.position),
    check("post_photo_position_nonneg", sql`${t.position} >= 0`),
  ],
);
