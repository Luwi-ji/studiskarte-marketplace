// The questions on Settings, FAQs. Every statement here comes from the product documents and the code behind the app
// (PRODUCT.md, docs/roles-and-verification-plan.md, content/legal/*.md, src/lib/posts, src/lib/deals, src/lib/identity,
// src/lib/verification). When one of those rules changes, change the answer here too.

import { LISTING_DAYS } from "@/lib/posts/update";
import { OPEN_POSTS_MAX } from "@/lib/posts/schema";
import { OFFER_DAYS } from "@/lib/deals/rules";
import { HANDLE_CHANGE_DAYS, HANDLE_MAX, HANDLE_MIN } from "@/lib/identity/names";
import { TEXT_MAX as REVIEW_TEXT_MAX } from "@/lib/deals/review";
import { EXPIRY_WARNING_DAYS } from "@/lib/posts/format";

export type Faq = {
  q: string;
  /** Paragraphs. */
  text: string[];
  /** A bulleted list after the paragraphs. */
  list?: string[];
};

export type FaqTopic = { id: string; title: string; items: Faq[] };

export const FAQ_TOPICS: FaqTopic[] = [
  {
    id: "getting-started",
    title: "Getting started and roles",
    items: [
      {
        q: "Who can use Studiskarte?",
        text: [
          "Anyone aged 16 or older. Studiskarte is a student marketplace: you post things you offer or look for, chat, agree a time and a place, and hand it over.",
          "Everyone has a role: Student, Faculty or teacher, Staff, Alumni or Guest.",
        ],
      },
      {
        q: "What can each role do?",
        text: ["A role is not an identity check. Only the ID checked badge says that an ID was checked."],
        list: [
          "Student: post Showcase and Wishlist listings, message, make offers and reserve.",
          "Faculty or teacher, Staff, Alumni and Guest: browse, buy and post Wishlist items. They can message the seller of a Showcase, make an offer or reserve only when the seller allowed non-students on that listing. Only students can answer a Wishlist.",
        ],
      },
      {
        q: "School email or personal email?",
        text: [
          "Students, Faculty or teachers, Staff and Alumni sign up with a school email, which puts you at your school. We send a code to it to confirm it, and it is never shown to others.",
          "A personal email makes you a Guest, when Guest sign-up is open.",
        ],
      },
      {
        q: "Why am I a Guest?",
        text: [
          "You are a Guest until you confirm a school email. In Settings, tap Become a student, enter your school email, and type the 6-digit code we send. The code works for 10 minutes.",
        ],
      },
    ],
  },
  {
    id: "posting",
    title: "Posting",
    items: [
      {
        q: "Showcase or Wishlist?",
        text: [
          "A Showcase is something you offer, for a price or for free. A Wishlist is something you are looking for. Only students can post a Showcase; everyone can post a Wishlist.",
        ],
      },
      {
        q: "How long does a listing last?",
        text: [
          `${LISTING_DAYS} days from when it is listed. In the last ${EXPIRY_WARNING_DAYS} days you are warned.`,
          `An expired listing can be relisted. That starts a new ${LISTING_DAYS} days and counts against your open posts like a new one.`,
        ],
      },
      {
        q: "How many posts can I have open?",
        text: [`Up to ${OPEN_POSTS_MAX} open posts at a time.`],
      },
      {
        q: "Why can I only have one Showcase?",
        text: [
          "Until you have an ID check, you can have one open Showcase at a time. After your first Showcase sale you need a current ID check to post more Showcases.",
          "A listing you withdraw, delete or let expire without a sale frees the place. Wishlists are not limited this way.",
        ],
      },
      {
        q: "How do I withdraw or delete a listing?",
        text: [
          "Find the listing in My posts or on your profile. You can edit an open or reserved listing.",
          "Withdraw takes a listing down for good: it leaves the feed and cannot be relisted. You cannot withdraw while a reservation is still being carried out; cancel it first.",
          "Delete takes a withdrawn or expired listing off your list. Its messages and deals stay for the other students. A listing with a finished sale cannot be deleted.",
        ],
      },
    ],
  },
  {
    id: "buying-and-selling",
    title: "Buying and selling",
    items: [
      {
        q: "How do offers and reservations work?",
        text: [
          "On a listing, tap Make offer or Reserve. On a Wishlist the buttons read Offer a price and I have this.",
          `Your offer appears as a card in your chat with the other student. They accept or decline it. An offer stays open for ${OFFER_DAYS} days, you can have one pending offer per listing, and you can take it back. Once accepted it becomes a reservation.`,
          "Then you agree a time and place in the same chat.",
        ],
      },
      {
        q: "How does payment work?",
        text: [
          "The app never moves money. It does not hold your money and it does not protect a payment.",
          "Each listing says how it can be paid: cash, online payment or others. Payment is cash at the meet-up or another way you two agree.",
          "Do not pay before the handover is agreed. The main scam is paying and never receiving the goods.",
        ],
      },
      {
        q: "What is the handover?",
        text: [
          "The handover is when the item changes hands. You agree the time and place in the chat. Meet-ups are set between 6:00 AM and 8:00 PM.",
          "When it happens, both of you confirm it in the chat. The deal is complete when you both confirmed and the payment is settled. You find your deals in Transactions.",
        ],
      },
      {
        q: "Can I review the other student?",
        text: [
          `Yes. Once a deal is complete, either of you can give the other 1 to 5 stars and an optional note of up to ${REVIEW_TEXT_MAX} characters. Each of you can review once per deal, and a review cannot be changed.`,
        ],
      },
    ],
  },
  {
    id: "safety",
    title: "Safety",
    items: [
      {
        q: "How do I meet safely?",
        text: [],
        list: [
          "Meet in a public place, in daylight where you can.",
          "Meet between 6:00 AM and 8:00 PM. The app does not accept an earlier or later meet-up.",
          "Tell a friend where you are going and who you are meeting.",
          "You can say no, leave or cancel at any time.",
          "If you are in danger now, leave the place and call 911.",
        ],
      },
      {
        q: "How do I report a listing or a student?",
        text: [
          "Use the menu with three dots on a listing, a profile or a chat, or use Report a listing and Report a user in Settings. Choose what is wrong and add a note if you like.",
          "If a child is being harmed, or the content is sexual and involves someone under 18, choose the first reason.",
        ],
      },
      {
        q: "What happens after I report?",
        text: [
          "The owner of Studiskarte reviews reports. The owner aims to read child safety and urgent reports within 24 hours and others within 3 working days.",
          "A listing reported for child safety is hidden at once. Any other listing is hidden when three different members have reported it. The owner can restore it, remove it or suspend an account. No account is suspended automatically.",
          "The other student is not told who reported.",
        ],
      },
      {
        q: "How do I block someone?",
        text: [
          "Use the menu with three dots on their profile or chat and choose Block. Neither of you sees the other any more, and they are not told. You can lift a block in Settings, under Blocked people.",
        ],
      },
    ],
  },
  {
    id: "id-check",
    title: "ID check",
    items: [
      {
        q: "What is the ID check?",
        text: [
          "An optional check that gives your profile an ID checked badge. You send a picture of your school ID or certificate of registration and a photo of you holding it. Graduates send a diploma, a certificate of graduation or an alumni ID instead, never a transcript.",
          "It also confirms that you are at least 16. Start it from Settings, ID check.",
        ],
      },
      {
        q: "Do I have to do it?",
        text: [
          "No. Without it you can still browse, message, make offers, reserve and post Wishlists, and you can have one open Showcase until your first sale.",
        ],
      },
      {
        q: "Who sees my pictures?",
        text: [
          "Only the owner of Studiskarte. They are kept in a private place apart from listing photos, and are opened only through links that stop working after a few minutes.",
          "The pictures are deleted when the decision is made. If nobody decides within 7 days, they are deleted too. We keep the result, who decided, the date and a short reason.",
        ],
      },
      {
        q: "How long does the badge last?",
        text: [
          "12 months. If a check is rejected you can try again, up to 3 times in total. You can withdraw your consent at any time in Settings, ID check, with one tap. Your badge is then removed.",
        ],
      },
    ],
  },
  {
    id: "account",
    title: "Account",
    items: [
      {
        q: "How do I change my profile?",
        text: ["In Settings, tap your name at the top. You can change your picture, display name, handle and bio."],
      },
      {
        q: "Can I change my handle?",
        text: [
          `Yes, once every ${HANDLE_CHANGE_DAYS} days. A handle has ${HANDLE_MIN} to ${HANDLE_MAX} characters: letters a to z, numbers, dots and underscores.`,
        ],
      },
      {
        q: "How do I delete my account?",
        text: [
          "In Settings, tap Delete my account and type your handle to confirm. This is final.",
          "Your profile, handle, picture and school email are erased, and you are signed out everywhere. Your open listings are withdrawn and reservations still being arranged are cancelled.",
          "Your messages and finished deals stay for the other student, shown as Deleted account. You can sign up again later as a new student.",
        ],
      },
    ],
  },
];
