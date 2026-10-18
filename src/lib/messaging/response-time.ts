import { getPool } from "@/lib/db";

export type ReplyBucket = "hour" | "few_hours" | "day" | "few_days";

export const REPLY_LABEL: Record<ReplyBucket, string> = {
  hour: "within an hour",
  few_hours: "within a few hours",
  day: "within a day",
  few_days: "within a few days",
};

// Only conversations whose first message is this recent count.
export const REPLY_WINDOW_DAYS = 30;
// Fewer qualifying conversations than this and nothing is shown.
export const REPLY_MIN_CONVERSATIONS = 5;
// A first message left unanswered this long counts as exactly this long.
export const REPLY_CAP_HOURS = 72;

export function bucketOf(hours: number): ReplyBucket {
  if (hours <= 1) return "hour";
  if (hours <= 6) return "few_hours";
  if (hours <= 24) return "day";
  return "few_days";
}

// A conversation qualifies when the other person wrote first, within the
// window, and the student either replied or REPLY_CAP_HOURS have passed.
const MEDIAN_SQL = `
with mine as (
  select f.created_at as asked_at,
    (select min(r.created_at) from message r where r.conversation_id = f.conversation_id and r.sender_id = $1 and r.id > f.id) as replied_at
  from (
    select distinct on (m.conversation_id) m.conversation_id, m.id, m.sender_id, m.created_at
    from message m
    where m.conversation_id in (select id from conversation where participant_a = $1 or participant_b = $1)
    order by m.conversation_id, m.id
  ) f
  where f.sender_id <> $1 and f.created_at >= $2::timestamptz - interval '${REPLY_WINDOW_DAYS} days'
)
select count(*)::int as n,
  percentile_cont(0.5) within group (order by least(extract(epoch from (coalesce(replied_at, asked_at + interval '${REPLY_CAP_HOURS} hours') - asked_at)), ${REPLY_CAP_HOURS * 3600})) as median_seconds
from mine
where replied_at is not null or asked_at <= $2::timestamptz - interval '${REPLY_CAP_HOURS} hours'
`;

/** How fast this student usually answers a first message, or null when there is too little to say. */
export async function getReplyTime(studentId: string, now = new Date()): Promise<ReplyBucket | null> {
  const { rows } = await getPool().query<{ n: number; median_seconds: number | null }>(MEDIAN_SQL, [
    studentId,
    now.toISOString(),
  ]);
  const { n, median_seconds } = rows[0];
  if (n < REPLY_MIN_CONVERSATIONS || median_seconds === null) return null;
  return bucketOf(median_seconds / 3600);
}
