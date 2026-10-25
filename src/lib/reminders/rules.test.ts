import { describe, expect, it } from "vitest";
import { OPEN_POSTS_MAX } from "@/lib/posts/schema";
import { reminderFor, type ReminderContext } from "./rules";

const student: ReminderContext = { role: "student", showcase: "free", wishlistBlocked: false, openPosts: 0 };
const as = (patch: Partial<ReminderContext>): ReminderContext => ({ ...student, ...patch });

describe("reminders before posting a Showcase", () => {
  it("lets a student with room go ahead", () => {
    expect(reminderFor("post_showcase", student)).toBeNull();
    expect(reminderFor("post_showcase", as({ showcase: "checked" }))).toBeNull();
    expect(reminderFor("post_showcase", as({ showcase: "off" }))).toBeNull();
  });

  it("tells a guest to verify a school email, and offers a Wishlist instead", () => {
    const reminder = reminderFor("post_showcase", as({ role: "visitor" }));
    expect(reminder?.id).toBe("guest_sell");
    expect(reminder?.primary.href).toBe("/me/settings/school-email");
    expect(reminder?.secondary?.href).toBe("/posts/new/wishlist");
  });

  it("tells faculty, staff and alumni that selling is for students, without a school-email prompt", () => {
    for (const role of ["faculty", "staff", "alumni"] as const) {
      const reminder = reminderFor("post_showcase", as({ role }));
      expect(reminder?.id).toBe("role_sell");
      expect(reminder?.primary.href).toBe("/posts/new/wishlist");
    }
  });

  it("asks for an ID check at the one-showcase limit and after the first sale", () => {
    expect(reminderFor("post_showcase", as({ showcase: "limit" }))?.primary.href).toBe("/me/verify");
    expect(reminderFor("post_showcase", as({ showcase: "sold" }))?.id).toBe("needs_id_sold");
  });

  it("stops at the open-post limit", () => {
    expect(reminderFor("post_showcase", as({ openPosts: OPEN_POSTS_MAX - 1 }))).toBeNull();
    expect(reminderFor("post_showcase", as({ openPosts: OPEN_POSTS_MAX }))?.id).toBe("posts_full");
    expect(reminderFor("post_wishlist", as({ openPosts: OPEN_POSTS_MAX }))?.id).toBe("posts_full");
  });

  it("never blocks a Wishlist for a role or an ID check", () => {
    expect(reminderFor("post_wishlist", as({ role: "visitor", showcase: "sold" }))).toBeNull();
  });
});

describe("reminders before answering a Wishlist or opening a students-only listing", () => {
  it("blocks non-students, and students after a first sale with no ID check", () => {
    expect(reminderFor("answer_wishlist", as({ role: "alumni" }))?.id).toBe("role_sell");
    expect(reminderFor("answer_wishlist", as({ wishlistBlocked: true }))?.primary.href).toBe("/me/verify");
    expect(reminderFor("answer_wishlist", student)).toBeNull();
  });

  it("explains a students-only listing to everyone but students", () => {
    expect(reminderFor("students_only_listing", student)).toBeNull();
    expect(reminderFor("students_only_listing", as({ role: "visitor" }))?.id).toBe("students_only_listing");
  });
});
