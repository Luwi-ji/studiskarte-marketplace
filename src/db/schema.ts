import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  bigint,
  bigserial,
  boolean,
  check,
  date,
  index,
  integer,
  pgTable,
  primaryKey,
  smallint,
  text,
  time,
  timestamp,
  unique,
  uniqueIndex,
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
    // Search for people by handle or display name, tolerating misspellings (pg_trgm).
    index("student_handle_trgm_idx").using("gin", t.handle.op("gin_trgm_ops")),
    index("student_name_trgm_idx").using("gin", t.name.op("gin_trgm_ops")),
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

// Following is public. One row per pair; the database refuses a student
// following themselves.
export const follow = pgTable(
  "follow",
  {
    followerId: text("follower_id")
      .notNull()
      .references(() => student.id, { onDelete: "cascade" }),
    followeeId: text("followee_id")
      .notNull()
      .references(() => student.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.followerId, t.followeeId] }),
    check("follow_not_self", sql`${t.followerId} <> ${t.followeeId}`),
    // "Who follows this student" and their count.
    index("follow_followee_idx").on(t.followeeId),
  ],
);

// Hearts are private to the student who gave them. The post's owner sees only
// a count, never these rows. One row per (student, post).
export const heart = pgTable(
  "heart",
  {
    studentId: text("student_id")
      .notNull()
      .references(() => student.id, { onDelete: "cascade" }),
    postId: uuid("post_id")
      .notNull()
      .references(() => post.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.studentId, t.postId] }), index("heart_post_idx").on(t.postId)],
);

// A private thread between a post's owner and one responder about that post.
// The database refuses the owner as responder (trigger) and a second thread for
// the same (post, responder). Whether it accepts new messages is worked out
// from the post's state when it is read, so relisting reactivates it.
export const conversation = pgTable(
  "conversation",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    postId: uuid("post_id")
      .notNull()
      .references(() => post.id, { onDelete: "cascade" }),
    responderId: text("responder_id")
      .notNull()
      .references(() => student.id),
    // The newest message, for ordering the inbox.
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }).notNull().defaultNow(),
    // Each side has read every message up to this number (0: none yet).
    ownerReadUpTo: bigint("owner_read_up_to", { mode: "number" }).notNull().default(0),
    responderReadUpTo: bigint("responder_read_up_to", { mode: "number" }).notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("conversation_post_responder").on(t.postId, t.responderId),
    index("conversation_responder_idx").on(t.responderId, t.lastMessageAt.desc()),
  ],
);

// Text, pictures, an offer card, or any mix (a trigger refuses a message with none).
export const message = pgTable(
  "message",
  {
    // Ordered by this number; also what "read up to" counts.
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversation.id, { onDelete: "cascade" }),
    senderId: text("sender_id")
      .notNull()
      .references(() => student.id),
    body: text("body"),
    // Set when this message is an offer card (the responder's offer, with an optional note in the body).
    offerId: uuid("offer_id")
      .references((): AnyPgColumn => offer.id, { onDelete: "cascade" })
      .unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("message_body_length", sql`${t.body} is null or char_length(btrim(${t.body})) between 1 and 2000`),
    index("message_conversation_idx").on(t.conversationId, t.id),
  ],
);

// The responder's proposal inside their conversation about a post: an amount,
// or a "reserve" at the asking price. One pending offer per conversation, so
// one per responder per post. The status is the offer's whole lifecycle.
export const offer = pgTable(
  "offer",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversation.id, { onDelete: "cascade" }),
    // Whole pesos. A reserve of a free post is 0.
    amount: integer("amount").notNull(),
    isReserve: boolean("is_reserve").notNull().default(false),
    status: text("status").notNull().default("pending"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("offer_status", sql`${t.status} in ('pending', 'accepted', 'declined', 'withdrawn', 'expired')`),
    check(
      "offer_amount",
      sql`(${t.isReserve} and ${t.amount} between 0 and 1000000) or (not ${t.isReserve} and ${t.amount} between 1 and 1000000)`,
    ),
    check("offer_decided", sql`(${t.status} = 'pending') = (${t.decidedAt} is null)`),
    uniqueIndex("offer_one_pending_idx").on(t.conversationId).where(sql`${t.status} = 'pending'`),
    index("offer_conversation_idx").on(t.conversationId, t.createdAt),
  ],
);

// Created when the owner accepts an offer. The handover (method, time, place)
// is agreed in the next phase. At most one active deal per post (the index).
export const deal = pgTable(
  "deal",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    postId: uuid("post_id")
      .notNull()
      .references(() => post.id, { onDelete: "cascade" }),
    offerId: uuid("offer_id")
      .notNull()
      .unique()
      .references(() => offer.id, { onDelete: "cascade" }),
    ownerId: text("owner_id")
      .notNull()
      .references(() => student.id),
    responderId: text("responder_id")
      .notNull()
      .references(() => student.id),
    amount: integer("amount").notNull(),
    status: text("status").notNull().default("agreed"),
    handoverMethod: text("handover_method"),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
    place: text("place"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("deal_status", sql`${t.status} in ('agreed', 'scheduled', 'completed', 'cancelled')`),
    check("deal_handover", sql`${t.handoverMethod} is null or ${t.handoverMethod} in ('meetup', 'delivery')`),
    check("deal_distinct_people", sql`${t.ownerId} <> ${t.responderId}`),
    uniqueIndex("deal_one_active_idx").on(t.postId).where(sql`${t.status} in ('agreed', 'scheduled')`),
    index("deal_owner_idx").on(t.ownerId),
    index("deal_responder_idx").on(t.responderId),
  ],
);

export const messageImage = pgTable(
  "message_image",
  {
    messageId: bigint("message_id", { mode: "number" })
      .notNull()
      .references(() => message.id, { onDelete: "cascade" }),
    imageId: uuid("image_id")
      .notNull()
      .references(() => image.id)
      .unique(),
    position: smallint("position").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.messageId, t.imageId] }),
    unique("message_image_position").on(t.messageId, t.position),
    check("message_image_position_range", sql`${t.position} between 0 and 3`),
  ],
);

// An entry in a student's in-app list. Repeated events fold into one unread row
// (a conversation's new messages, a post's hearts) so the list stays readable;
// once_key makes a one-time event (an expiry warning) happen once per listing.
// The text is worked out from the post when shown, so it never holds message
// text or the name of who hearted.
export const notification = pgTable(
  "notification",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    recipientId: text("recipient_id")
      .notNull()
      .references(() => student.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    postId: uuid("post_id").references(() => post.id, { onDelete: "cascade" }),
    conversationId: uuid("conversation_id").references(() => conversation.id, { onDelete: "cascade" }),
    // How many events this row stands for.
    count: integer("count").notNull().default(1),
    readAt: timestamp("read_at", { withTimezone: true }),
    // Time of the latest event folded in.
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    // While unread, one row per (recipient, type, fold_key).
    foldKey: text("fold_key"),
    // Once ever per (recipient, once_key).
    onceKey: text("once_key"),
  },
  (t) => [
    check("notification_type", sql`${t.type} in ('message', 'heart', 'post_expiring', 'post_expired', 'offer_received', 'offer_accepted', 'offer_declined', 'offer_expired')`),
    check("notification_count", sql`${t.count} >= 1`),
    uniqueIndex("notification_fold_idx").on(t.recipientId, t.type, t.foldKey).where(sql`${t.readAt} is null and ${t.foldKey} is not null`),
    uniqueIndex("notification_once_idx").on(t.recipientId, t.onceKey).where(sql`${t.onceKey} is not null`),
    index("notification_list_idx").on(t.recipientId, t.createdAt.desc()),
  ],
);

// A device the student allowed alerts on. One row per browser push address.
export const pushSubscription = pgTable(
  "push_subscription",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: text("student_id")
      .notNull()
      .references(() => student.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull().unique(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("push_subscription_student_idx").on(t.studentId)],
);

// One row per (post, viewer, Manila day). Views are counted from these rows,
// never stored as a counter. The owner's own opens are never inserted.
export const postView = pgTable(
  "post_view",
  {
    postId: uuid("post_id")
      .notNull()
      .references(() => post.id, { onDelete: "cascade" }),
    viewerId: text("viewer_id")
      .notNull()
      .references(() => student.id, { onDelete: "cascade" }),
    day: date("day", { mode: "string" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.postId, t.viewerId, t.day] })],
);

// When each scheduled job last ran; lets us notice a scheduler that stopped.
export const jobRun = pgTable("job_run", {
  name: text("name").primaryKey(),
  lastStartedAt: timestamp("last_started_at", { withTimezone: true }).notNull(),
  lastFinishedAt: timestamp("last_finished_at", { withTimezone: true }),
  // "ok" or "failed"; detail is a short human-readable result or error.
  lastStatus: text("last_status").notNull(),
  lastDetail: text("last_detail"),
});

// One level (owner, 2026-10-16: no subcategories). Seeded by migration.
export const category = pgTable(
  "category",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    // Whether posts in this category must state a condition.
    requiresCondition: boolean("requires_condition").notNull().default(false),
    position: integer("position").notNull(),
  },
  (t) => [unique("category_position").on(t.position)],
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
    description: text("description").notNull(),
    categoryId: text("category_id")
      .notNull()
      .references(() => category.id),
    condition: text("condition"),
    // "amount" (whole pesos in price_amount), "free" or "negotiable".
    priceKind: text("price_kind").notNull(),
    priceAmount: integer("price_amount"),
    exchangeMeetup: boolean("exchange_meetup").notNull(),
    exchangeDelivery: boolean("exchange_delivery").notNull(),
    meetupLocation: text("meetup_location"),
    deliveryArea: text("delivery_area"),
    status: text("status").notNull().default("open"),
    listedAt: timestamp("listed_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true })
      .notNull()
      .default(sql`now() + interval '30 days'`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("post_kind", sql`${t.kind} in ('showcase', 'wishlist')`),
    check(
      "post_status",
      sql`${t.status} in ('open', 'reserved', 'fulfilled', 'withdrawn', 'expired', 'hidden', 'removed')`,
    ),
    check("post_title_length", sql`char_length(btrim(${t.title})) between 1 and 120`),
    check("post_description_length", sql`char_length(btrim(${t.description})) between 1 and 2000`),
    check(
      "post_condition_value",
      sql`${t.condition} is null or ${t.condition} in ('new', 'used_like_new', 'used_good', 'used_fair')`,
    ),
    // Whole pesos, ₱1 to ₱1,000,000. "free" is its own kind, not zero.
    check(
      "post_price",
      // coalesce: a CHECK that evaluates to NULL passes, so a missing amount must become false.
      sql`(${t.priceKind} = 'amount' and coalesce(${t.priceAmount}, 0) between 1 and 1000000)
        or (${t.priceKind} in ('free', 'negotiable') and ${t.priceAmount} is null)`,
    ),
    check("post_exchange_any", sql`${t.exchangeMeetup} or ${t.exchangeDelivery}`),
    // A place exactly when its exchange option is chosen.
    check(
      "post_meetup_location",
      sql`case when ${t.exchangeMeetup}
        then char_length(btrim(coalesce(${t.meetupLocation}, ''))) between 1 and 120
        else ${t.meetupLocation} is null end`,
    ),
    check(
      "post_delivery_area",
      sql`case when ${t.exchangeDelivery}
        then char_length(btrim(coalesce(${t.deliveryArea}, ''))) between 1 and 120
        else ${t.deliveryArea} is null end`,
    ),
    check(
      "post_open_expiry",
      sql`${t.status} <> 'open' or ${t.expiresAt} > ${t.listedAt}`,
    ),
    index("post_owner_idx").on(t.ownerId, t.status),
    index("post_feed_idx").on(t.status, t.listedAt.desc()),
    // The expiry job looks for open posts whose time has passed.
    index("post_expiry_idx").on(t.status, t.expiresAt),
    // Search: partial words and misspellings (pg_trgm), in titles and descriptions.
    index("post_title_trgm_idx").using("gin", t.title.op("gin_trgm_ops")),
    index("post_description_trgm_idx").using("gin", t.description.op("gin_trgm_ops")),
    // The same post twice while open is refused (business logic edge case).
    uniqueIndex("post_open_duplicate")
      .on(t.ownerId, t.kind, sql`lower(btrim(${t.title}))`, sql`md5(btrim(${t.description}))`)
      .where(sql`${t.status} = 'open'`),
  ],
);

// When the owner is available to hand over: either a day of the week (every
// week while the post is listed) or a specific date, each with a time range
// in Philippine time. A live post has at least one (trigger in migration 0006).
export const availabilityWindow = pgTable(
  "availability_window",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    postId: uuid("post_id")
      .notNull()
      .references(() => post.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    // 0 = Sunday … 6 = Saturday, set when kind = 'weekly'.
    weekday: smallint("weekday"),
    // Set when kind = 'date'.
    onDate: date("on_date", { mode: "string" }),
    startTime: time("start_time").notNull(),
    endTime: time("end_time").notNull(),
  },
  (t) => [
    check(
      "availability_window_kind",
      sql`(${t.kind} = 'weekly' and coalesce(${t.weekday}, -1) between 0 and 6 and ${t.onDate} is null)
        or (${t.kind} = 'date' and ${t.onDate} is not null and ${t.weekday} is null)`,
    ),
    check("availability_window_order", sql`${t.endTime} > ${t.startTime}`),
    // One time range per day or date (NULLs do not collide).
    unique("availability_window_weekday").on(t.postId, t.weekday),
    unique("availability_window_date").on(t.postId, t.onDate),
    index("availability_window_post_idx").on(t.postId),
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
  (t) => [check("image_purpose", sql`${t.purpose} in ('post_photo', 'avatar', 'message_photo')`)],
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
    // Optional description of this photo, shown under it (owner, 2026-10-16).
    caption: text("caption"),
  },
  (t) => [
    primaryKey({ columns: [t.postId, t.imageId] }),
    unique("post_photo_position").on(t.postId, t.position),
    // A photo belongs to one post only.
    unique("post_photo_image").on(t.imageId),
    // Positions 0–9: at most 10 photos per post.
    check("post_photo_position_range", sql`${t.position} between 0 and 9`),
    check("post_photo_caption_length", sql`${t.caption} is null or char_length(btrim(${t.caption})) between 1 and 300`),
  ],
);
