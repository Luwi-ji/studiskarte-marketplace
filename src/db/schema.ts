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
    /** What cards show instead of the full name ("TUP-M"); an admin sets it. */
    shortName: text("short_name"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("school_short_name_length", sql`${t.shortName} is null or char_length(btrim(${t.shortName})) between 1 and 12`),
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
    // The sign-in address. A school address for people who signed up with one, a personal
    // address for visitors. Always verified by an emailed code (or by Google).
    email: text("email").notNull().unique(),
    emailVerified: boolean("email_verified").notNull().default(false),
    image: text("image"),
    // Set only while a verified school email is attached; the school is read from it.
    schoolDomain: text("school_domain").references(() => school.domain),
    // Verified by an emailed code. Unique: one account per school email.
    schoolEmail: text("school_email").unique(),
    // student, faculty, staff, alumni (each needs a school email) or visitor (none).
    role: text("role").notNull().default("student"),
    // Null until the student finishes sign-up (chooses a handle).
    handle: text("handle").unique(),
    // Last change after sign-up; null means the student has never changed it.
    handleChangedAt: timestamp("handle_changed_at", { withTimezone: true }),
    avatarImageId: uuid("avatar_image_id").references((): AnyPgColumn => image.id, {
      onDelete: "set null",
    }),
    // SHA-256 (hex) of the private calendar link's token; null when there is no
    // link. The token itself is never stored.
    calendarTokenHash: text("calendar_token_hash"),
    // A short line about the student on their profile (src/lib/identity/bio.ts); null when empty.
    bio: text("bio"),
    accountStatus: text("account_status").notNull().default("active"),
    // Set by the owner directly in the database (scripts/make-admin.mjs); never by the app.
    isAdmin: boolean("is_admin").notNull().default(false),
    // The version of the legal documents (content/legal/VERSION) this student accepted, and when.
    // Both null until they accept; a newer version asks again (src/lib/legal/documents.ts).
    termsVersion: text("terms_version"),
    termsAcceptedAt: timestamp("terms_accepted_at", { withTimezone: true }),
    // When the person confirmed they meet the minimum age (src/lib/identity/age.ts; asked together with the terms; null until they do).
    ageConfirmedAt: timestamp("age_confirmed_at", { withTimezone: true }),
    // The owner looked at a school ID and a photo of the person and approved (src/lib/verification). Both null until then;
    // cleared on withdrawal. The check lapses at id_check_expires_at.
    idCheckedAt: timestamp("id_checked_at", { withTimezone: true }),
    idCheckExpiresAt: timestamp("id_check_expires_at", { withTimezone: true }),
    // The owner holds this account's records (a child safety case or a lawful order): it cannot be deleted by the person.
    // See src/lib/safety/hold.ts: a child safety report on the person or their listings holds it too.
    legalHoldAt: timestamp("legal_hold_at", { withTimezone: true }),
    // First-touch campaign tags captured at sign-up (src/lib/funnel/utm.ts).
    utmSource: text("utm_source"),
    utmMedium: text("utm_medium"),
    utmCampaign: text("utm_campaign"),
    // One of the first students to join; see src/lib/founding/config.ts.
    foundingSellerAt: timestamp("founding_seller_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Search for people by handle or display name, tolerating misspellings (pg_trgm).
    index("student_handle_trgm_idx").using("gin", t.handle.op("gin_trgm_ops")),
    index("student_name_trgm_idx").using("gin", t.name.op("gin_trgm_ops")),
    // The school-address rule lives in school-email.ts; the database refuses anything
    // that is not at least shaped like an address, and any school email that is not
    // shaped like a school address, even if code is bypassed.
    check("student_email_shape", sql`${t.email} ~ '^[^@\\s]+@[^@\\s]+$'`),
    check("student_email_lower", sql`${t.email} = lower(${t.email})`),
    check(
      "student_school_email_shape",
      sql`${t.schoolEmail} is null or (${t.schoolEmail} = lower(${t.schoolEmail}) and ${t.schoolEmail} ~ '^[^@]+@([a-z0-9-]+\\.)+edu\\.ph$' and split_part(${t.schoolEmail}, '@', 2) = ${t.schoolDomain})`,
    ),
    check("student_school_pair", sql`(${t.schoolEmail} is null) = (${t.schoolDomain} is null)`),
    check("student_role_values", sql`${t.role} in ('student', 'faculty', 'staff', 'alumni', 'visitor')`),
    check("student_role_school", sql`(${t.role} = 'visitor') = (${t.schoolEmail} is null)`),
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
    check("student_bio_length", sql`${t.bio} is null or (char_length(${t.bio}) between 1 and 160 and ${t.bio} !~ '[\\r\\n]')`),
    check(
      "student_calendar_token_format",
      sql`${t.calendarTokenHash} is null or ${t.calendarTokenHash} ~ '^[0-9a-f]{64}$'`,
    ),
    check("student_terms_pair", sql`(${t.termsVersion} is null) = (${t.termsAcceptedAt} is null)`),
    check(
      "student_utm_length",
      sql`char_length(coalesce(${t.utmSource}, '')) <= 64 and char_length(coalesce(${t.utmMedium}, '')) <= 64 and char_length(coalesce(${t.utmCampaign}, '')) <= 64`,
    ),
    unique("student_calendar_token_hash").on(t.calendarTokenHash),
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

// Better Auth's account table: one `credential` row holds the password hash, one
// row per linked Google login. Passwords are scrypt hashes written by Better Auth.
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

// One private thread per pair of students, however many listings they deal
// about (owner, 2026-10-17). The two are stored in a fixed order (a before b,
// by id), so there is exactly one row per pair. Each side has its own read
// pointer. The listings the two have dealt about are in conversation_listing.
export const conversation = pgTable(
  "conversation",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    participantA: text("participant_a")
      .notNull()
      .references(() => student.id),
    participantB: text("participant_b")
      .notNull()
      .references(() => student.id),
    // The newest message, for ordering the inbox.
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }).notNull().defaultNow(),
    // Each side has read every message up to this number (0: none yet).
    aReadUpTo: bigint("a_read_up_to", { mode: "number" }).notNull().default(0),
    bReadUpTo: bigint("b_read_up_to", { mode: "number" }).notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("conversation_ordered_pair", sql`${t.participantA} < ${t.participantB} collate "C"`),
    unique("conversation_pair").on(t.participantA, t.participantB),
    index("conversation_a_idx").on(t.participantA, t.lastMessageAt.desc()),
    index("conversation_b_idx").on(t.participantB, t.lastMessageAt.desc()),
  ],
);

// The listings a thread is about: its "transactions". A listing joins when
// someone messages about it or makes an offer on it. The listing's owner is
// one of the thread's two people (a trigger).
export const conversationListing = pgTable(
  "conversation_listing",
  {
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversation.id, { onDelete: "cascade" }),
    postId: uuid("post_id")
      .notNull()
      .references(() => post.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.conversationId, t.postId] }), index("conversation_listing_post_idx").on(t.postId)],
);

// Text, pictures, a listing card, an offer card, or any mix (a trigger refuses a message with none).
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
    // The listing this message pertains to: set on a listing card (sent when someone
    // messages about a listing) and on an offer card.
    postId: uuid("post_id").references(() => post.id, { onDelete: "cascade" }),
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

// The responder's proposal on a post: an amount, or a "reserve" at the asking
// price. It appears as a card in the thread between the two. One pending offer
// per responder per post (the index). The status is the offer's whole lifecycle.
export const offer = pgTable(
  "offer",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversation.id, { onDelete: "cascade" }),
    postId: uuid("post_id")
      .notNull()
      .references(() => post.id, { onDelete: "cascade" }),
    // The one making the offer: never the post's owner (a trigger).
    responderId: text("responder_id")
      .notNull()
      .references(() => student.id),
    // Whole pesos. A reserve of a free post is 0.
    amount: integer("amount").notNull(),
    isReserve: boolean("is_reserve").notNull().default(false),
    // How many units the responder asks for. The amount is per unit.
    quantity: integer("quantity").notNull().default(1),
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
    check("offer_quantity", sql`${t.quantity} between 1 and 1000`),
    check("offer_decided", sql`(${t.status} = 'pending') = (${t.decidedAt} is null)`),
    uniqueIndex("offer_one_pending_idx").on(t.postId, t.responderId).where(sql`${t.status} = 'pending'`),
    index("offer_conversation_idx").on(t.conversationId, t.createdAt),
    index("offer_post_idx").on(t.postId, t.status),
  ],
);

// Created when the owner accepts an offer. The handover (method, time, place)
// is agreed in the next phase. One active deal per post and buyer (the index);
// together the active and completed deals of a post never use more units than
// the post has (a trigger).
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
    // Per unit, as agreed in the offer.
    amount: integer("amount").notNull(),
    quantity: integer("quantity").notNull().default(1),
    status: text("status").notNull().default("agreed"),
    handoverMethod: text("handover_method"),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
    place: text("place"),
    // A time and place one of the two has proposed and the other has not yet answered.
    // Agreeing copies it to the three columns above and the deal becomes scheduled.
    proposedBy: text("proposed_by").references(() => student.id),
    proposedMethod: text("proposed_method"),
    proposedAt: timestamp("proposed_at", { withTimezone: true }),
    proposedPlace: text("proposed_place"),
    // How it was paid: the payer says so (and how), then the payee confirms receiving it. A free deal needs neither.
    // The slot is secured once the payer says they paid, or the payee agrees to cash in person; after that nobody can cancel.
    // The payee asks the payer to pay (online or others) once a time and place are agreed.
    paymentAskedAt: timestamp("payment_asked_at", { withTimezone: true }),
    paymentAskMethod: text("payment_ask_method"),
    // The payer asks to pay cash at the handover; the payee agrees.
    cashRequestedAt: timestamp("cash_requested_at", { withTimezone: true }),
    cashAgreedAt: timestamp("cash_agreed_at", { withTimezone: true }),
    paymentMethod: text("payment_method"),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    paymentConfirmedAt: timestamp("payment_confirmed_at", { withTimezone: true }),
    // Cash in person: the payer says they gave it, the payee says they received it.
    cashGivenAt: timestamp("cash_given_at", { withTimezone: true }),
    cashReceivedAt: timestamp("cash_received_at", { withTimezone: true }),
    // Each side says the handover happened. Both set: the deal is completed.
    ownerConfirmedAt: timestamp("owner_confirmed_at", { withTimezone: true }),
    responderConfirmedAt: timestamp("responder_confirmed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    // The last thing that happened on this deal (a step, a reminder). The thread shows the busiest deals at the bottom.
    activityAt: timestamp("activity_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("deal_status", sql`${t.status} in ('agreed', 'scheduled', 'completed', 'cancelled', 'disputed')`),
    check("deal_ask_method", sql`(${t.paymentAskedAt} is null) = (${t.paymentAskMethod} is null) and (${t.paymentAskMethod} is null or ${t.paymentAskMethod} in ('online', 'other'))`),
    check("deal_cash_order", sql`${t.cashAgreedAt} is null or ${t.cashRequestedAt} is not null`),
    // Cash in person is a handshake too: the payer says the cash was given, then the payee says it was received.
    check("deal_cash_given_order", sql`${t.cashGivenAt} is null or ${t.cashAgreedAt} is not null`),
    check("deal_cash_received_order", sql`${t.cashReceivedAt} is null or ${t.cashGivenAt} is not null`),
    check("deal_handover", sql`${t.handoverMethod} is null or ${t.handoverMethod} in ('meetup', 'delivery')`),
    check("deal_distinct_people", sql`${t.ownerId} <> ${t.responderId}`),
    check("deal_quantity", sql`${t.quantity} between 1 and 1000`),
    check("deal_place_length", sql`${t.place} is null or char_length(btrim(${t.place})) between 1 and 200`),
    check(
      "deal_proposal",
      sql`(${t.proposedBy} is null and ${t.proposedMethod} is null and ${t.proposedAt} is null and ${t.proposedPlace} is null)
        or (${t.proposedBy} is not null and ${t.proposedMethod} in ('meetup', 'delivery') and ${t.proposedAt} is not null and char_length(btrim(${t.proposedPlace})) between 1 and 200)`,
    ),
    // Scheduled and completed deals have a method, a time and a place.
    check(
      "deal_scheduled_fields",
      sql`${t.status} not in ('scheduled', 'completed') or (${t.handoverMethod} is not null and ${t.scheduledAt} is not null and ${t.place} is not null)`,
    ),
    // The only way to completed is both confirmations; confirming needs a schedule.
    check("deal_completed_confirmed", sql`${t.status} <> 'completed' or (${t.ownerConfirmedAt} is not null and ${t.responderConfirmedAt} is not null)`),
    check("deal_payment_method", sql`(${t.paidAt} is null) = (${t.paymentMethod} is null) and (${t.paymentMethod} is null or ${t.paymentMethod} in ('cash', 'online', 'other'))`),
    check("deal_payment_order", sql`${t.paymentConfirmedAt} is null or ${t.paidAt} is not null`),
    // Completed needs the payment confirmed, unless there was nothing to pay.
    check("deal_completed_paid", sql`${t.status} <> 'completed' or ${t.amount} = 0 or ${t.paymentConfirmedAt} is not null or ${t.cashReceivedAt} is not null`),
    check(
      "deal_confirm_after_schedule",
      sql`(${t.ownerConfirmedAt} is null and ${t.responderConfirmedAt} is null) or ${t.scheduledAt} is not null`,
    ),
    // One active deal per post and buyer: each buyer's deal is separate from the others.
    uniqueIndex("deal_one_active_idx").on(t.postId, t.responderId).where(sql`${t.status} in ('agreed', 'scheduled')`),
    index("deal_owner_idx").on(t.ownerId),
    index("deal_responder_idx").on(t.responderId),
  ],
);

// What went wrong with a secured reservation, from either side. The first report
// makes the deal "disputed"; the other person can add their own. One per person.
export const dealReport = pgTable(
  "deal_report",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    dealId: uuid("deal_id")
      .notNull()
      .references(() => deal.id, { onDelete: "cascade" }),
    reporterId: text("reporter_id")
      .notNull()
      .references(() => student.id),
    // Whose end the problem was on (one of the two), or null when the reporter is not sure.
    faultPartyId: text("fault_party_id").references(() => student.id),
    reason: text("reason").notNull(),
    details: text("details"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("deal_report_reason", sql`${t.reason} in ('no_show', 'not_as_described', 'payment_problem', 'unresponsive', 'other')`),
    check("deal_report_details", sql`${t.details} is null or char_length(btrim(${t.details})) between 1 and 500`),
    unique("deal_report_one_each").on(t.dealId, t.reporterId),
    index("deal_report_deal_idx").on(t.dealId),
  ],
);

// One person's review of the other after a completed deal: 1-5 stars and an
// optional note. One each per deal; never edited (triggers in migration 0025).
export const review = pgTable(
  "review",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    dealId: uuid("deal_id")
      .notNull()
      .references(() => deal.id, { onDelete: "cascade" }),
    reviewerId: text("reviewer_id")
      .notNull()
      .references(() => student.id),
    revieweeId: text("reviewee_id")
      .notNull()
      .references(() => student.id),
    rating: smallint("rating").notNull(),
    text: text("text"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("review_rating", sql`${t.rating} between 1 and 5`),
    check("review_text", sql`${t.text} is null or char_length(btrim(${t.text})) between 1 and 500`),
    check("review_distinct_people", sql`${t.reviewerId} <> ${t.revieweeId}`),
    unique("review_one_each").on(t.dealId, t.reviewerId),
    index("review_reviewee_idx").on(t.revieweeId, t.createdAt.desc()),
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
    // Short extra line for a deal notice: the agreed time and place. Null for the rest.
    detail: text("detail"),
  },
  (t) => [
    check("notification_type", sql`${t.type} in ('message', 'heart', 'post_expiring', 'post_expired', 'post_hidden', 'post_restored', 'post_removed', 'offer_received', 'offer_accepted', 'offer_declined', 'offer_expired', 'deal_cancelled', 'deal_proposed', 'deal_scheduled', 'deal_confirmed', 'deal_handover_rejected', 'deal_review_reminder', 'deal_proposal_declined', 'deal_completed', 'deal_reminder', 'deal_confirm_reminder', 'deal_expired', 'deal_paid', 'deal_payment_confirmed', 'deal_payment_requested', 'deal_cash_requested', 'deal_cash_answered', 'deal_cash_given', 'deal_cash_received', 'deal_payment_rejected', 'deal_reported', 'deal_disputed', 'id_check_approved', 'id_check_rejected')`),
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
    // How payment is made: cash, online payment, others (at least one unless the post is free).
    paymentCash: boolean("payment_cash").notNull().default(false),
    paymentOnline: boolean("payment_online").notNull().default(false),
    paymentOther: boolean("payment_other").notNull().default(false),
    // Where to pay online, or what "others" means (e.g. "GCash 09xx"); shown only to a student with a reservation.
    paymentNote: text("payment_note"),
    // A showcase only students may message, offer on or reserve, unless the seller allows others (faculty, staff, alumni, visitors). Ignored on a Wishlist.
    allowNonStudents: boolean("allow_non_students").notNull().default(false),
    // How many are available (or needed, for a Wishlist). Null means ongoing: no limit.
    quantity: integer("quantity").default(1),
    status: text("status").notNull().default("open"),
    listedAt: timestamp("listed_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true })
      .notNull()
      .default(sql`now() + interval '30 days'`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    // The owner deleted it (or an old withdrawn or expired post was cleared out): gone from My posts. Deals and their history stay.
    ownerDeletedAt: timestamp("owner_deleted_at", { withTimezone: true }),
    // The status a post had when it was hidden by reports, so the admin can restore it exactly. Null otherwise.
    statusBeforeHidden: text("status_before_hidden"),
  },
  (t) => [
    check("post_kind", sql`${t.kind} in ('showcase', 'wishlist')`),
    check(
      "post_status",
      sql`${t.status} in ('open', 'reserved', 'fulfilled', 'withdrawn', 'expired', 'hidden', 'removed')`,
    ),
    check("post_quantity_range", sql`${t.quantity} is null or ${t.quantity} between 1 and 1000`),
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
    // A free post has no payment; any other has at least one mode, and a note only goes with online or others.
    check("post_payment_modes", sql`(${t.priceKind} = 'free') = (not (${t.paymentCash} or ${t.paymentOnline} or ${t.paymentOther}))`),
    check(
      "post_payment_note",
      sql`${t.paymentNote} is null or ((${t.paymentOnline} or ${t.paymentOther}) and char_length(btrim(${t.paymentNote})) between 1 and 100)`,
    ),
    // A place exactly when its exchange option is chosen.
    check(
      "post_meetup_location",
      sql`case when ${t.exchangeMeetup}
        then char_length(btrim(coalesce(${t.meetupLocation}, ''))) between 1 and 120
        else ${t.meetupLocation} is null end`,
    ),
    check(
      "post_open_expiry",
      sql`${t.status} <> 'open' or ${t.expiresAt} > ${t.listedAt}`,
    ),
    check("post_status_before_hidden", sql`${t.statusBeforeHidden} is null or ${t.statusBeforeHidden} in ('open', 'reserved')`),
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

// A business near campus that gives students a discount (docs/perks-plan.md).
// The owner adds partners by hand; they have no accounts.
export const partner = pgTable(
  "partner",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    // food, clothes, printing, services or other (see src/lib/perks/kinds.ts).
    kind: text("kind").notNull(),
    // Free text, like a post's meet-up place: "Near TUP Manila gate".
    area: text("area").notNull(),
    // Email domains of the schools it serves; null means every school.
    schoolDomains: text("school_domains").array(),
    status: text("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("partner_name_length", sql`char_length(btrim(${t.name})) between 1 and 120`),
    check("partner_area_length", sql`char_length(btrim(${t.area})) between 1 and 120`),
    check("partner_kind", sql`${t.kind} in ('food', 'clothes', 'printing', 'services', 'other')`),
    check("partner_status", sql`${t.status} in ('pending', 'active', 'paused', 'ended')`),
    check("partner_school_domains_not_empty", sql`${t.schoolDomains} is null or cardinality(${t.schoolDomains}) > 0`),
  ],
);

// One discount a partner gives verified students.
export const perk = pgTable(
  "perk",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    partnerId: uuid("partner_id")
      .notNull()
      .references(() => partner.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    terms: text("terms").notNull(),
    // How often one student may use it ("1 a day"); both null means no limit.
    limitPerStudent: integer("limit_per_student"),
    limitPeriod: text("limit_period"),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull().defaultNow(),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    status: text("status").notNull().default("draft"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("perk_partner_idx").on(t.partnerId),
    check("perk_title_length", sql`char_length(btrim(${t.title})) between 1 and 120`),
    check("perk_terms_length", sql`char_length(btrim(${t.terms})) between 1 and 500`),
    check("perk_status", sql`${t.status} in ('draft', 'live', 'paused', 'ended')`),
    check(
      "perk_limit",
      sql`(${t.limitPerStudent} is null and ${t.limitPeriod} is null) or (${t.limitPerStudent} > 0 and ${t.limitPeriod} in ('day', 'week', 'month', 'ever'))`,
    ),
    check("perk_dates", sql`${t.endsAt} is null or ${t.endsAt} > ${t.startsAt}`),
  ],
);

// A student's report of a post or of another student. Three different students reporting
// one post hide it at once (src/lib/safety/report.ts); the admin decides the rest.
// A student can have one open report per target; after the admin decides, they may report again.
export const report = pgTable(
  "report",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reporterId: text("reporter_id")
      .notNull()
      .references(() => student.id),
    // Exactly one of these is set.
    postId: uuid("post_id").references(() => post.id, { onDelete: "cascade" }),
    studentId: text("student_id").references(() => student.id),
    reason: text("reason").notNull(),
    details: text("details"),
    // open, then dismissed (nothing to do) or actioned (the admin acted on it).
    status: text("status").notNull().default("open"),
    handledBy: text("handled_by").references(() => student.id),
    handledAt: timestamp("handled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("report_one_target", sql`(${t.postId} is not null) <> (${t.studentId} is not null)`),
    check("report_not_self", sql`${t.studentId} is null or ${t.studentId} <> ${t.reporterId}`),
    check("report_reason", sql`${t.reason} in ('spam', 'scam', 'prohibited', 'offensive', 'harassment', 'impersonation', 'child_safety', 'other')`),
    check("report_details_length", sql`${t.details} is null or char_length(btrim(${t.details})) between 1 and 500`),
    check("report_status", sql`${t.status} in ('open', 'dismissed', 'actioned')`),
    check("report_handled", sql`(${t.status} = 'open') = (${t.handledAt} is null)`),
    uniqueIndex("report_open_post").on(t.reporterId, t.postId).where(sql`${t.status} = 'open' and ${t.postId} is not null`),
    uniqueIndex("report_open_student").on(t.reporterId, t.studentId).where(sql`${t.status} = 'open' and ${t.studentId} is not null`),
    index("report_queue_idx").on(t.status, t.createdAt),
    index("report_post_idx").on(t.postId),
  ],
);

// What the admin did and why: one row per decision in /admin (restore, remove, dismiss, suspend).
// No foreign keys on the targets, so the record outlives a deleted post or account. The reason is
// what the owner wrote; for a removed or restored post the poster sees it in their notification.
export const adminAction = pgTable(
  "admin_action",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    adminId: text("admin_id")
      .notNull()
      .references(() => student.id),
    action: text("action").notNull(),
    postId: uuid("post_id"),
    studentId: text("student_id"),
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("admin_action_kind", sql`${t.action} in ('restore_post', 'remove_post', 'dismiss_post_reports', 'dismiss_student_reports', 'suspend_student', 'restore_student', 'place_legal_hold', 'lift_legal_hold')`),
    check("admin_action_reason_length", sql`${t.reason} is null or char_length(btrim(${t.reason})) between 1 and 300`),
    index("admin_action_recent_idx").on(t.createdAt.desc()),
  ],
);

// One ID check. draft: consent given, pictures being added. pending: waiting for the admin. approved, rejected: decided.
// withdrawn: the person took their consent back. expired: left pending too long, or an approval older than a year.
// The pictures live in the private ID bucket and their keys are set to null the moment the check is decided,
// withdrawn or expired (src/lib/verification/service.ts); what stays is the result, who decided, when and why.
export const idVerification = pgTable(
  "id_verification",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: text("student_id")
      .notNull()
      .references(() => student.id),
    status: text("status").notNull().default("draft"),
    // What the person showed: a school ID, a certificate of registration, or another school document.
    documentKind: text("document_kind").notNull(),
    // The role the person claimed when they asked (the role the check is for).
    claimedRole: text("claimed_role").notNull(),
    documentKey: text("document_key"),
    holdingKey: text("holding_key"),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    decidedBy: text("decided_by").references(() => student.id),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    // Why it was rejected (shown to the person), or a note on an approval.
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("id_verification_status", sql`${t.status} in ('draft', 'pending', 'approved', 'rejected', 'withdrawn', 'expired')`),
    check("id_verification_document_kind", sql`${t.documentKind} in ('school_id', 'registration', 'graduation', 'other')`),
    check("id_verification_reason_length", sql`${t.reason} is null or char_length(btrim(${t.reason})) between 1 and 300`),
    // Pictures exist only while the check is open.
    check("id_verification_pictures_only_while_open", sql`${t.status} in ('draft', 'pending') or (${t.documentKey} is null and ${t.holdingKey} is null)`),
    check("id_verification_pending_has_pictures", sql`${t.status} <> 'pending' or (${t.documentKey} is not null and ${t.holdingKey} is not null and ${t.submittedAt} is not null)`),
    // Decided means approved or rejected; an approval that later lapses to expired keeps its decision time, an open or withdrawn check has none.
    check("id_verification_decided", sql`(${t.status} in ('approved', 'rejected') and ${t.decidedAt} is not null) or (${t.status} in ('draft', 'pending', 'withdrawn') and ${t.decidedAt} is null) or ${t.status} = 'expired'`),
    // One open check per person.
    uniqueIndex("id_verification_one_open").on(t.studentId).where(sql`${t.status} in ('draft', 'pending')`),
    index("id_verification_queue_idx").on(t.status, t.submittedAt),
  ],
);

// Proof that a person agreed to the ID check, and when they took it back. One row per event, never edited.
// textVersion names the exact screen text (kept in src/lib/verification/consent.ts); policyVersion is content/legal/VERSION then.
export const idConsent = pgTable(
  "id_consent",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: text("student_id")
      .notNull()
      .references(() => student.id),
    event: text("event").notNull(),
    textVersion: text("text_version").notNull(),
    policyVersion: text("policy_version"),
    // For a withdrawal: where it was done.
    channel: text("channel"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("id_consent_event", sql`${t.event} in ('given', 'withdrawn')`),
    index("id_consent_student_idx").on(t.studentId, t.createdAt),
  ],
);

// Every time an admin opened a picture of an ID. Written before the link is handed out.
export const idImageView = pgTable(
  "id_image_view",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    verificationId: uuid("verification_id")
      .notNull()
      .references(() => idVerification.id),
    adminId: text("admin_id")
      .notNull()
      .references(() => student.id),
    slot: text("slot").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [check("id_image_view_slot", sql`${t.slot} in ('document', 'holding')`), index("id_image_view_verification_idx").on(t.verificationId)],
);

// One student blocking another. Private: the blocked student is never told. Neither
// side sees the other's posts or profile or can message them.
export const block = pgTable(
  "block",
  {
    blockerId: text("blocker_id")
      .notNull()
      .references(() => student.id, { onDelete: "cascade" }),
    blockedId: text("blocked_id")
      .notNull()
      .references(() => student.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.blockerId, t.blockedId] }),
    check("block_not_self", sql`${t.blockerId} <> ${t.blockedId}`),
    index("block_blocked_idx").on(t.blockedId),
  ],
);

// Funnel counting, first-party and anonymous for landing views. Student-bound stages are recorded once per student.
export const funnelEvent = pgTable(
  "funnel_event",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    stage: text("stage").notNull(),
    studentId: text("student_id").references(() => student.id, { onDelete: "cascade" }),
    utmSource: text("utm_source"),
    utmMedium: text("utm_medium"),
    utmCampaign: text("utm_campaign"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check(
      "funnel_event_stage",
      sql`${t.stage} in ('landing_view','signup_started','signup_completed','first_listing','first_message','first_handover_confirmed')`,
    ),
    // Postgres treats NULLs as distinct, so anonymous rows never collide.
    unique("funnel_event_once_per_student").on(t.studentId, t.stage),
    index("funnel_event_stage_idx").on(t.stage, t.createdAt),
  ],
);

// An anonymous vote on the landing page for which student perk to bring first. Never counted on a public page.
export const perkVote = pgTable(
  "perk_vote",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kind: text("kind").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [check("perk_vote_kind", sql`${t.kind} in ('food','clothes','printing','services','other')`)],
);

// A shop a student wants asked for a perk ("Which shop near TUP should we ask first?"). Anonymous, owner-read only.
export const perkSuggestion = pgTable(
  "perk_suggestion",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    shop: text("shop").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [check("perk_suggestion_shop_length", sql`char_length(${t.shop}) between 2 and 80 and ${t.shop} !~ '[\\r\\n]'`)],
);
