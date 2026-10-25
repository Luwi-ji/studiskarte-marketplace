import { desc, eq, sql } from "drizzle-orm";
import { contactMessage, perkSuggestion, perkVote, student } from "@/db/schema";
import { getDb } from "@/lib/db";
import { PERK_KINDS } from "@/lib/perks/kinds";

const NOT_ADMIN = "Only an admin can do this.";

export type Inbox = {
  messages: { id: string; name: string | null; email: string; message: string; createdAt: Date }[];
  /** Shops students asked for, one row per name (case and spacing ignored), most asked first. */
  suggestions: { shop: string; count: number; lastAt: Date }[];
  /** Votes per kind of perk, most votes first, kinds with none included. */
  votes: { kind: string; label: string; count: number }[];
  totalVotes: number;
};

/** What visitors left on the landing page: notes, shop suggestions and perk votes. */
export async function getInbox(): Promise<Inbox> {
  const db = getDb();
  const [messages, suggestions, voteRows] = await Promise.all([
    db.select().from(contactMessage).orderBy(desc(contactMessage.createdAt)).limit(100),
    db
      .select({
        shop: sql<string>`min(${perkSuggestion.shop})`,
        count: sql<number>`count(*)::int`,
        lastAt: sql<Date>`max(${perkSuggestion.createdAt})`,
      })
      .from(perkSuggestion)
      .groupBy(sql`lower(btrim(${perkSuggestion.shop}))`)
      .orderBy(sql`count(*) desc`, sql`max(${perkSuggestion.createdAt}) desc`)
      .limit(100),
    db.select({ kind: perkVote.kind, count: sql<number>`count(*)::int` }).from(perkVote).groupBy(perkVote.kind),
  ]);
  const byKind = new Map(voteRows.map((v) => [v.kind, v.count]));
  const votes = PERK_KINDS.map((k) => ({ kind: k.id, label: k.label, count: byKind.get(k.id) ?? 0 })).sort((a, b) => b.count - a.count);
  return {
    messages,
    suggestions: suggestions.map((s) => ({ ...s, lastAt: new Date(s.lastAt) })),
    votes,
    totalVotes: votes.reduce((sum, v) => sum + v.count, 0),
  };
}

/** Deletes a message once it has been answered. The admin flag is read from the database here, not trusted from the caller. */
export async function deleteContactMessage(adminId: string, id: string): Promise<{ ok: boolean; error?: string }> {
  const db = getDb();
  const [admin] = await db.select({ isAdmin: student.isAdmin, status: student.accountStatus }).from(student).where(eq(student.id, adminId));
  if (admin?.isAdmin !== true || admin.status !== "active") return { ok: false, error: NOT_ADMIN };
  await db.delete(contactMessage).where(eq(contactMessage.id, id));
  return { ok: true };
}
