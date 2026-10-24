/**
 * Fills the DEV database (the one the staging site uses) with test people and listings, so the staging site is not empty.
 * Run: npx tsx --env-file=.env.local scripts/seed-staging.ts        (add `clean` to remove everything it made)
 * Refuses to run unless NEON_BRANCH=dev. Test logins: handles staging_sam and staging_bea, password below (dev only).
 */
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { hashPassword } from "better-auth/crypto";
import { eq, like } from "drizzle-orm";
import sharp from "sharp";
import { account, image, post, student } from "../src/db/schema";
import { getDb, getPool } from "../src/lib/db";
import { acceptOffer } from "../src/lib/deals/accept";
import { makeOffer } from "../src/lib/deals/offers";
import { getObjectStore } from "../src/lib/images/store";
import { createPost } from "../src/lib/posts/create";
import { createTestStudent, deleteTestStudent } from "../src/test/fixtures";

const PASSWORD = "Staging-Pass-2026";
const people = [
  { id: "staging-sam", handle: "staging_sam", name: "Sam Santos", bio: "Selling textbooks and dorm stuff. Meet at the library." },
  { id: "staging-bea", handle: "staging_bea", name: "Bea Reyes", bio: "Looking for lab gear and calculators." },
];
const db = getDb();
const store = getObjectStore();

async function clean() {
  const ids = (await db.select({ id: student.id }).from(student).where(like(student.id, "staging-%"))).map((s) => s.id);
  for (const id of ids) {
    const imgs = await db.select({ key: image.key, thumbKey: image.thumbKey }).from(image).where(eq(image.ownerId, id));
    await db.delete(post).where(eq(post.ownerId, id)).catch(() => {});
    await db.delete(image).where(eq(image.ownerId, id)).catch(() => {});
    await store.delete(imgs.flatMap((i) => [i.key, i.thumbKey])).catch(() => {});
    await deleteTestStudent(id).catch((e) => console.log("could not remove", id, e.message));
  }
  console.log("removed", ids.length, "people");
}

async function photo(owner: string, colour: string) {
  const bytes = await sharp({ create: { width: 800, height: 800, channels: 3, background: colour } }).webp().toBuffer();
  const thumb = await sharp(bytes).resize(300, 300).webp().toBuffer();
  const name = randomUUID();
  const key = `posts/${owner}/${name}.webp`;
  const thumbKey = `posts/${owner}/${name}-thumb.webp`;
  await store.put(key, bytes, "image/webp");
  await store.put(thumbKey, thumb, "image/webp");
  const [img] = await db.insert(image).values({ ownerId: owner, purpose: "post_photo", key, thumbKey, width: 800, height: 800, bytes: bytes.length }).returning({ id: image.id });
  return img.id;
}

async function seed() {
  if (process.env.NEON_BRANCH !== "dev") throw new Error("Refusing: NEON_BRANCH is not 'dev'.");
  await clean();
  const version = readFileSync("content/legal/VERSION", "utf8").trim();
  for (const p of people) {
    await createTestStudent(p.id, { handle: p.handle, name: p.name });
    await db.update(student).set({ termsVersion: version, termsAcceptedAt: new Date(), ageConfirmedAt: new Date(), bio: p.bio }).where(eq(student.id, p.id));
    await db.insert(account).values({ id: `acc-${p.id}`, accountId: p.id, providerId: "credential", userId: p.id, password: await hashPassword(PASSWORD) });
  }
  const weekdays = [1, 2, 3, 4, 5].map((weekday) => ({ kind: "weekly" as const, weekday, startTime: "09:00", endTime: "17:00" }));
  const make = async (owner: string, kind: "showcase" | "wishlist", title: string, price: string | null, category: string, colour: string, condition: string | null = "used_good") => {
    const result = await createPost({
      ownerId: owner,
      input: {
        kind, title, description: `${title}. Seeded for testing.`, categoryId: category, condition,
        priceKind: price ? "amount" : "free", priceAmount: price ?? "", quantity: "1", exchangeMeetup: true, exchangeDelivery: false,
        meetupLocation: "Main gate", paymentCash: true, paymentOnline: true, availability: weekdays, photos: [{ id: await photo(owner, colour), caption: "" }],
      },
    });
    if (!result.ok) throw new Error(`${title}: ${JSON.stringify(result.errors)}`);
    return result.id;
  };
  const textbook = await make("staging-sam", "showcase", "Calculus textbook, 9th edition", "450", "textbooks", "#3366cc");
  await make("staging-sam", "showcase", "Casio fx-991ES Plus calculator", "600", "electronics", "#cc7a33");
  await make("staging-sam", "showcase", "Desk lamp, barely used", "250", "dorm", "#33aa77");
  await make("staging-sam", "showcase", "Free study notes, Physics 101", null, "textbooks", "#8855cc");
  await make("staging-sam", "wishlist", "Looking for a lab gown, size M", "300", "uniforms", "#cc3366");
  await make("staging-bea", "showcase", "Mini fan, USB rechargeable", "180", "dorm", "#33a0cc");
  await make("staging-bea", "showcase", "Nursing uniform set", "700", "uniforms", "#aacc33");
  await make("staging-bea", "wishlist", "Wanted: scientific calculator", "500", "electronics", "#cc5533");
  await make("staging-bea", "wishlist", "Wanted: dorm fan", "200", "dorm", "#5533cc");
  const offer = await makeOffer({ responderId: "staging-bea", postId: textbook, input: { kind: "reserve", quantity: "1", note: "Can I reserve this?" } });
  if (offer.ok) await acceptOffer({ ownerId: "staging-sam", offerId: offer.offerId });
  console.log(`Seeded. Log in as staging_sam or staging_bea with password ${PASSWORD}. Bea has a reservation on Sam's textbook.`);
}

(process.argv[2] === "clean" ? clean() : seed()).then(() => getPool().end()).catch((e) => { console.error(e); process.exit(1); });
