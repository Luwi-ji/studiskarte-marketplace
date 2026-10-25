import { cashAskedBy, paymentStage, type HandoverConfirmations, type PaymentFields } from "@/lib/deals/slot";

/**
 * Whose move an ongoing transaction is waiting for, from the viewer's side. Pure: no database, no clock of its own.
 * It reads the same fields as the conversation's cards (`HandoverPanel`, `PaymentSteps`), so the chip in Messages
 * and the "Next:" line in the thread agree.
 *
 * - "mine": the viewer has something to answer or confirm.
 * - "theirs": the viewer did their part; the other person is the one being waited on.
 * - "none": nothing is due from either side yet (either may start the next step, or the time has not come).
 */
export type Turn = "mine" | "theirs" | "none";

export const TURN_LABEL: Record<Exclude<Turn, "none">, string> = { mine: "Your turn", theirs: "Waiting for them" };

/** The viewer is the one paying: the buyer, or on a Wishlist the one who posted it. */
export function viewerPays(postKind: string, viewerIsOwner: boolean): boolean {
  return postKind === "wishlist" ? viewerIsOwner : !viewerIsOwner;
}

/** An offer: its owner decides while it is pending and in time; the one who made it waits. */
export function offerTurn(o: { status: string; expiresAt: Date; viewerIsOwner: boolean }, now: Date): Turn {
  if (o.status !== "pending" || o.expiresAt.getTime() <= now.getTime()) return "none";
  return o.viewerIsOwner ? "mine" : "theirs";
}

export type DealTurnFields = PaymentFields &
  HandoverConfirmations & {
    status: string;
    scheduledAt: Date | null;
    /** The student who proposed the time and place now waiting for an answer, or null. */
    proposedBy: string | null;
    postKind: string;
    viewerIsOwner: boolean;
    viewerId: string;
  };

/** Several things can wait at once: the viewer's own come first, then the other person's. */
function strongest(turns: Turn[]): Turn {
  return turns.includes("mine") ? "mine" : turns.includes("theirs") ? "theirs" : "none";
}

/** The payment step. Each stage is a two-way handshake: whoever said something waits, the other answers (see slot.ts). */
function paymentTurn(d: DealTurnFields, pays: boolean, handoverStarted: boolean, both: boolean): Turn {
  const stage = paymentStage(d);
  switch (stage) {
    case "asked":
      return pays ? "mine" : "theirs";
    case "cash_requested": {
      // The payer offers cash or the payee asks for it; the other one answers.
      const askedByViewer = cashAskedBy(d) === "payee" ? !pays : pays;
      return askedByViewer ? "theirs" : "mine";
    }
    case "paid":
    case "cash_given":
      return pays ? "theirs" : "mine";
    case "cash_agreed":
      // The cash changes hands at the handover: the payer says so once it is time, the payee waits for that.
      return handoverStarted ? (pays ? "mine" : "theirs") : "none";
    case "open":
      // Either may start the payment. Once both confirmed the handover it is the last step left: the payer pays.
      return both ? (pays ? "mine" : "theirs") : "none";
    default:
      return "none";
  }
}

/**
 * A reservation being carried out ("agreed": a time and place to agree; "scheduled": the handover and the payment).
 * Anything else (completed, cancelled, reported) has no turn.
 */
export function dealTurn(d: DealTurnFields, now: Date): Turn {
  const proposal: Turn = d.proposedBy === null ? "none" : d.proposedBy === d.viewerId ? "theirs" : "mine";
  if (d.status === "agreed") return proposal;
  if (d.status !== "scheduled") return "none";

  const mine = d.viewerIsOwner ? d.ownerConfirmedAt : d.responderConfirmedAt;
  const theirs = d.viewerIsOwner ? d.responderConfirmedAt : d.ownerConfirmedAt;
  const timeCame = d.scheduledAt !== null && d.scheduledAt.getTime() <= now.getTime();
  // Confirming opens when the other says it happened, or when the time has come and the viewer has not said so.
  const handover: Turn = mine && theirs ? "none" : mine ? "theirs" : theirs || timeCame ? "mine" : "none";
  const payment = paymentTurn(d, viewerPays(d.postKind, d.viewerIsOwner), timeCame || !!mine || !!theirs, !!mine && !!theirs);
  return strongest([proposal, handover, payment]);
}

/** One conversation can hold several transactions: it needs the viewer if any of them does. Missing entries count as no turn. */
export function conversationTurn(turns: Iterable<Turn | null | undefined>): Turn {
  return strongest([...turns].map((t) => t ?? "none"));
}

const RANK: Record<Turn, number> = { mine: 0, theirs: 1, none: 2 };

/** For sorting: "Your turn" first, then "Waiting for them", then the rest. Ties keep their order (the sort is stable). */
export function compareTurn(a: Turn, b: Turn): number {
  return RANK[a] - RANK[b];
}
