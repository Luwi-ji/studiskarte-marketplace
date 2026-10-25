import type { Role } from "@/lib/identity/roles";
import { OPEN_POSTS_MAX } from "@/lib/posts/schema";
import { UNCHECKED_SHOWCASE_MAX } from "@/lib/verification/config";

/** What a person is about to do. */
export type ReminderTrigger = "post_showcase" | "post_wishlist" | "answer_wishlist" | "students_only_listing";

/** What decides whether a reminder is needed. Read on the server (see src/app/reminders/actions.ts). */
export type ReminderContext = {
  role: Role;
  /** Where the person stands on showcases without an ID check (see showcase-limit.ts). */
  showcase: "off" | "checked" | "free" | "sold" | "limit";
  /** A first sale is done and there is no current ID check: answering a Wishlist is closed. */
  wishlistBlocked: boolean;
  openPosts: number;
};

export type ReminderIcon = "school" | "shield" | "grid" | "flag";
export type Reminder = {
  id: string;
  icon: ReminderIcon;
  title: string;
  body: string;
  primary: { label: string; href: string };
  secondary?: { label: string; href: string };
};

const VERIFY_SCHOOL_EMAIL = { label: "Verify my school email", href: "/me/settings/school-email" };
const CHECK_ID = { label: "Check my ID", href: "/me/verify" };
const POST_WISHLIST = { label: "Post a Wishlist", href: "/posts/new/wishlist" };

const ROLE_NOUN: Record<Exclude<Role, "student" | "visitor">, string> = { faculty: "faculty", staff: "staff", alumni: "an alum" };

/** Only students can sell. A guest can become one by verifying a school email; faculty, staff and alumni cannot. */
function notAStudent(role: Role, what: "post a Showcase" | "answer a Wishlist"): Reminder {
  if (role === "visitor") {
    return {
      id: "guest_sell",
      icon: "school",
      title: "Only students can sell",
      body: `You joined as a Guest with a personal email. Verify a school email to become a student, then you can ${what.replace("a Showcase", "Showcases").replace("a Wishlist", "Wishlists")}. You can still buy and post Wishlists.`,
      primary: VERIFY_SCHOOL_EMAIL,
      secondary: what === "post a Showcase" ? POST_WISHLIST : { label: "Back to the feed", href: "/" },
    };
  }
  const noun = ROLE_NOUN[role as keyof typeof ROLE_NOUN] ?? "a member";
  return {
    id: "role_sell",
    icon: "school",
    title: "Selling is for students",
    body: `You are signed up as ${noun}. You can buy and post Wishlists, but only students can ${what === "post a Showcase" ? "post Showcases" : "answer Wishlists"}.`,
    primary: what === "post a Showcase" ? POST_WISHLIST : { label: "Back to the feed", href: "/" },
  };
}

const NEEDS_ID_LIMIT: Reminder = {
  id: "needs_id_limit",
  icon: "shield",
  title: "Check your ID to post more",
  body: `Until your first sale you can have ${UNCHECKED_SHOWCASE_MAX} open showcase. Check your ID to post more. It is optional, and the pictures are deleted once it is decided.`,
  primary: CHECK_ID,
};

const NEEDS_ID_SOLD: Reminder = {
  id: "needs_id_sold",
  icon: "shield",
  title: "First sale done. Check your ID to keep selling",
  body: "Your first sale is complete. Check your ID to post more showcases and answer Wishlists. It is optional, and the pictures are deleted once it is decided.",
  primary: CHECK_ID,
};

const POSTS_FULL: Reminder = {
  id: "posts_full",
  icon: "grid",
  title: `You have ${OPEN_POSTS_MAX} open posts`,
  body: "That is the most at one time. Withdraw or finish one, then post again.",
  primary: { label: "Go to My posts", href: "/me/posts" },
};

/** The reminder to show before this action, or null when the person may go ahead. */
export function reminderFor(trigger: ReminderTrigger, ctx: ReminderContext): Reminder | null {
  switch (trigger) {
    case "post_showcase":
      if (ctx.role !== "student") return notAStudent(ctx.role, "post a Showcase");
      if (ctx.showcase === "sold") return NEEDS_ID_SOLD;
      if (ctx.showcase === "limit") return NEEDS_ID_LIMIT;
      return ctx.openPosts >= OPEN_POSTS_MAX ? POSTS_FULL : null;
    case "post_wishlist":
      return ctx.openPosts >= OPEN_POSTS_MAX ? POSTS_FULL : null;
    case "answer_wishlist":
      if (ctx.role !== "student") return notAStudent(ctx.role, "answer a Wishlist");
      return ctx.wishlistBlocked ? NEEDS_ID_SOLD : null;
    case "students_only_listing":
      return ctx.role === "student"
        ? null
        : {
            id: "students_only_listing",
            icon: "school",
            title: "This seller sells to students only",
            body: "The seller has not opened this listing to faculty, staff, alumni or guests. Try another listing, or post a Wishlist for what you need.",
            primary: { label: "Back to the feed", href: "/" },
            secondary: POST_WISHLIST,
          };
  }
}
