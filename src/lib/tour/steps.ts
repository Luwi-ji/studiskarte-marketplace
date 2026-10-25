import type { Role } from "@/lib/identity/roles";

/** Which tour a person sees: students can sell; other school members and guests cannot, each for their own reason. */
export type TourKind = "student" | "member" | "guest";

export function tourKindFor(role: Role): TourKind {
  if (role === "student") return "student";
  return role === "visitor" ? "guest" : "member";
}

export type TourIcon = "star" | "grid" | "tool" | "heart" | "chat" | "calendar" | "shield" | "school" | "gift";
export type TourStep = {
  id: string;
  icon: TourIcon;
  title: string;
  body: string;
  /** Short lines under the body: what the person can do here. */
  points?: string[];
  /** An action that starts the thing this step is about. Shown on the last step only. */
  cta?: { label: string; href: string };
};

const FIND: TourStep = {
  id: "find",
  icon: "grid",
  title: "Find what you need",
  body: "Everything on the feed is from real students.",
  points: ["Search, or filter by school, category, condition, price and date", "Tap the heart to save a post for later", "Follow sellers you like, and their posts come first"],
};

const DEAL: TourStep = {
  id: "deal",
  icon: "calendar",
  title: "Chat, agree, hand over",
  body: "The whole deal stays in one chat.",
  points: ["Message, make an offer or reserve an item", "Pick a day, time and place between 6:00 AM and 8:00 PM", "Both confirm the handover, then leave a review"],
};

const TRUST: TourStep = {
  id: "trust",
  icon: "shield",
  title: "Safe and trusted",
  body: "Studiskarte never handles money, so pay only after you agree a time and place.",
  points: ["Badges show what was checked: school email, optional ID check", "Reviews come from completed deals", "Report or block anyone from their profile or a post", "Student perks from local shops are coming"],
};

function welcome(name: string, line: string): TourStep {
  return { id: "welcome", icon: "star", title: `Welcome, ${name}!`, body: line };
}

/** The tour for this kind of member, in order. The last step carries the action that gets them to their first win. */
export function tourSteps(kind: TourKind, name: string): TourStep[] {
  const first = name.trim().split(/\s+/)[0] || "there";
  if (kind === "student") {
    return [
      welcome(first, "Studiskarte is where students buy, sell and find things. Here is a one-minute look. Skip any time."),
      FIND,
      {
        id: "sell",
        icon: "tool",
        title: "Sell in seconds",
        body: "Tap Create, then Showcase. Your listing goes live right away. No admin approves it.",
        points: ["Add photos, a price and when you can meet", "Until your first sale you can have 1 open showcase", "Check your ID in Settings to post more"],
      },
      {
        id: "wishlist",
        icon: "heart",
        title: "Can't find it? Ask for it",
        body: "Post a Wishlist for what you are looking for and what you can spend.",
        points: ["Students who have it will reach out", "You can answer other students' Wishlists too"],
      },
      DEAL,
      { ...TRUST, cta: { label: "Post my first listing", href: "/posts/new/showcase" } },
    ];
  }
  if (kind === "member") {
    return [
      welcome(first, "Studiskarte is where students buy, sell and find things. Here is a one-minute look. Skip any time."),
      FIND,
      {
        id: "wishlist",
        icon: "heart",
        title: "Ask for what you need",
        body: "Post a Wishlist with what you are looking for and what you can spend. Students will reach out.",
      },
      {
        id: "buy",
        icon: "school",
        title: "Buying from students",
        body: "You can message, offer and reserve on any Showcase whose seller allows non-students.",
        points: ["Look for listings that are open to you", "Selling is for students, so Showcases are theirs to post"],
      },
      DEAL,
      { ...TRUST, cta: { label: "Post a Wishlist", href: "/posts/new/wishlist" } },
    ];
  }
  return [
    welcome(first, "Studiskarte is where students buy, sell and find things. Here is a one-minute look. Skip any time."),
    FIND,
    {
      id: "wishlist",
      icon: "heart",
      title: "Ask for what you need",
      body: "Post a Wishlist with what you are looking for and what you can spend. Students will reach out.",
    },
    {
      id: "student",
      icon: "school",
      title: "Want to sell? Become a student",
      body: "You joined as a Guest. Add your school email in Settings to become a student, earn the School email badge and post Showcases.",
    },
    DEAL,
    { ...TRUST, cta: { label: "Verify my school email", href: "/me/settings/school-email" } },
  ];
}
