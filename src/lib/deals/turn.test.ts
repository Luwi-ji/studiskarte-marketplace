import { describe, expect, it } from "vitest";
import { compareTurn, conversationTurn, dealTurn, offerTurn, TURN_LABEL, viewerPays, type DealTurnFields, type Turn } from "@/lib/deals/turn";

const NOW = new Date("2026-03-10T08:00:00Z");
const HOUR = 3_600_000;
const before = new Date(NOW.getTime() - HOUR);
const after = new Date(NOW.getTime() + HOUR);

const OWNER = "owner";
const BUYER = "buyer";

/** A scheduled Showcase reservation: the buyer pays and the owner hands it over. Nothing paid or confirmed yet, the time is ahead. */
const base: Omit<DealTurnFields, "viewerId" | "viewerIsOwner"> = {
  status: "scheduled",
  scheduledAt: after,
  proposedBy: null,
  postKind: "showcase",
  amount: 500,
  paymentAskedAt: null,
  cashRequestedAt: null,
  cashAgreedAt: null,
  cashGivenAt: null,
  cashReceivedAt: null,
  paidAt: null,
  paymentConfirmedAt: null,
  ownerConfirmedAt: null,
  responderConfirmedAt: null,
};

/** The same reservation as the owner (selling, paid) and as the buyer (paying), with some fields changed. */
function both(change: Partial<DealTurnFields>): { owner: Turn; buyer: Turn } {
  return {
    owner: dealTurn({ ...base, ...change, viewerId: OWNER, viewerIsOwner: true }, NOW),
    buyer: dealTurn({ ...base, ...change, viewerId: BUYER, viewerIsOwner: false }, NOW),
  };
}

describe("offerTurn", () => {
  const pending = { status: "pending", expiresAt: after };
  it("is the owner's while pending and in time, and the buyer waits", () => {
    expect(offerTurn({ ...pending, viewerIsOwner: true }, NOW)).toBe("mine");
    expect(offerTurn({ ...pending, viewerIsOwner: false }, NOW)).toBe("theirs");
  });
  it("is nobody's once decided or out of time", () => {
    expect(offerTurn({ status: "declined", expiresAt: after, viewerIsOwner: true }, NOW)).toBe("none");
    expect(offerTurn({ status: "pending", expiresAt: before, viewerIsOwner: true }, NOW)).toBe("none");
    expect(offerTurn({ status: "pending", expiresAt: NOW, viewerIsOwner: false }, NOW)).toBe("none");
  });
});

describe("dealTurn: agreeing a time and place", () => {
  it("is neither's while nobody proposed, since either may", () => {
    expect(both({ status: "agreed", scheduledAt: null })).toEqual({ owner: "none", buyer: "none" });
  });
  it("is the one who did not propose", () => {
    expect(both({ status: "agreed", scheduledAt: null, proposedBy: BUYER })).toEqual({ owner: "mine", buyer: "theirs" });
    expect(both({ status: "agreed", scheduledAt: null, proposedBy: OWNER })).toEqual({ owner: "theirs", buyer: "mine" });
  });
  it("has no turn once the reservation is over", () => {
    for (const status of ["completed", "cancelled", "disputed"]) expect(both({ status, proposedBy: BUYER, paidAt: before })).toEqual({ owner: "none", buyer: "none" });
  });
});

describe("dealTurn: a scheduled reservation", () => {
  it("waits for the time before anyone has to confirm", () => {
    expect(both({})).toEqual({ owner: "none", buyer: "none" });
  });
  it("is both people's to confirm once the time has come", () => {
    expect(both({ scheduledAt: before })).toEqual({ owner: "mine", buyer: "mine" });
  });
  it("is the other's turn to confirm once one said it happened", () => {
    expect(both({ ownerConfirmedAt: before })).toEqual({ owner: "theirs", buyer: "mine" });
    expect(both({ responderConfirmedAt: before })).toEqual({ owner: "mine", buyer: "theirs" });
  });
  it("is the answer to a new time proposed on a scheduled reservation", () => {
    expect(both({ proposedBy: BUYER })).toEqual({ owner: "mine", buyer: "theirs" });
  });
  it("puts what is mine before what I wait on", () => {
    // The owner confirmed (waiting for the buyer), but the buyer also proposed a new time (the owner answers).
    expect(both({ ownerConfirmedAt: before, proposedBy: BUYER })).toEqual({ owner: "mine", buyer: "mine" });
  });
});

describe("dealTurn: the payment on a Showcase (the buyer pays the owner)", () => {
  it("starts with nobody's turn: either may begin", () => {
    expect(both({})).toEqual({ owner: "none", buyer: "none" });
  });
  it("is the payer's once the payee asked", () => {
    expect(both({ paymentAskedAt: before })).toEqual({ owner: "theirs", buyer: "mine" });
  });
  it("is the payee's to answer when the payer offers cash, the payer's when the payee asks for it", () => {
    expect(both({ cashRequestedAt: before, paymentAskedAt: null })).toEqual({ owner: "mine", buyer: "theirs" });
    // The payee's cash request sets the ask at the same time (see cashAskedBy).
    expect(both({ cashRequestedAt: before, paymentAskedAt: before })).toEqual({ owner: "theirs", buyer: "mine" });
  });
  it("is the payee's to confirm once the payer paid", () => {
    expect(both({ paidAt: before })).toEqual({ owner: "mine", buyer: "theirs" });
  });
  it("waits for the handover when cash is agreed, then the payer gives it", () => {
    const agreed = { cashRequestedAt: before, cashAgreedAt: before };
    expect(both(agreed)).toEqual({ owner: "none", buyer: "none" });
    expect(both({ ...agreed, scheduledAt: before, ownerConfirmedAt: before, responderConfirmedAt: before })).toEqual({ owner: "theirs", buyer: "mine" });
    expect(both({ ...agreed, scheduledAt: before })).toEqual({ owner: "mine", buyer: "mine" });
  });
  it("is the payee's to confirm once the payer gave the cash", () => {
    expect(both({ cashRequestedAt: before, cashAgreedAt: before, cashGivenAt: before })).toEqual({ owner: "mine", buyer: "theirs" });
  });
  it("is the payer's to pay once both confirmed the handover and nothing is settled", () => {
    expect(both({ ownerConfirmedAt: before, responderConfirmedAt: before })).toEqual({ owner: "theirs", buyer: "mine" });
  });
  it("is nobody's when the payment is settled or there is nothing to pay", () => {
    expect(both({ paidAt: before, paymentConfirmedAt: before })).toEqual({ owner: "none", buyer: "none" });
    expect(both({ amount: 0 })).toEqual({ owner: "none", buyer: "none" });
    expect(both({ amount: 0, ownerConfirmedAt: before })).toEqual({ owner: "theirs", buyer: "mine" });
  });
});

describe("dealTurn: a Wishlist (the poster pays whoever supplies it)", () => {
  it("swaps who pays", () => {
    // The poster (owner) pays; the supplier (responder) is paid.
    expect(both({ postKind: "wishlist", paymentAskedAt: before })).toEqual({ owner: "mine", buyer: "theirs" });
    expect(both({ postKind: "wishlist", paidAt: before })).toEqual({ owner: "theirs", buyer: "mine" });
  });
});

describe("viewerPays", () => {
  it("is the buyer on a Showcase and the poster on a Wishlist", () => {
    expect(viewerPays("showcase", false)).toBe(true);
    expect(viewerPays("showcase", true)).toBe(false);
    expect(viewerPays("wishlist", true)).toBe(true);
    expect(viewerPays("wishlist", false)).toBe(false);
  });
});

describe("conversationTurn and compareTurn", () => {
  it("needs the viewer if any transaction does, else waits if any waits", () => {
    expect(conversationTurn(["theirs", "mine", "none"])).toBe("mine");
    expect(conversationTurn(["none", "theirs"])).toBe("theirs");
    expect(conversationTurn([null, "none"])).toBe("none");
    expect(conversationTurn([])).toBe("none");
  });
  it("sorts Your turn first, then Waiting for them", () => {
    expect((["none", "theirs", "mine"] as Turn[]).sort(compareTurn)).toEqual(["mine", "theirs", "none"]);
  });
  it("labels the two turns in words", () => {
    expect(TURN_LABEL).toEqual({ mine: "Your turn", theirs: "Waiting for them" });
  });
});
