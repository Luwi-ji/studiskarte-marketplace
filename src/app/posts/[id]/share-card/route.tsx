import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { connection } from "next/server";
import { ImageResponse } from "next/og";
import sharp from "sharp";
import { z } from "zod";
import { getSignedInStudent, hasFinishedSignUp } from "@/lib/access";
import { getObjectStore } from "@/lib/images/store";
import { getShareCard, type ShareCard } from "@/lib/posts/share-card";
import { consume } from "@/lib/rate-limit";

// The card is a 9:16 story (Instagram and Facebook Stories, Messages, status posts).
const WIDTH = 1080;
const HEIGHT = 1920;
const MARGIN = 72;
const PHOTO_WIDTH = WIDTH - MARGIN * 2;
const PHOTO_HEIGHT = 940;
const PHOTO_LINK_SECONDS = 60;
/** What fits in the title's three lines at its size. */
const TITLE_CHARS = 80;

// Brand tokens from src/app/globals.css: the logo's blue, the cap's navy, the tassel's gold.
const BLUE = "#0365fc";
const NAVY = "#0b2a6f";
const GOLD = "#f5b301";

// The fonts and logo never change, so they are read once. Figtree is the app's font; the peso sign
// is not in its Latin subset, so a one-glyph font stands in for it.
const [figtree, peso, logo] = await Promise.all([
  readFile(join(process.cwd(), "assets/Figtree-ExtraBold.ttf")),
  readFile(join(process.cwd(), "assets/Peso-ExtraBold.ttf")),
  readFile(join(process.cwd(), "public/logo.png")),
]);
const LOGO_URL = `data:image/png;base64,${logo.toString("base64")}`;

/**
 * A listing as a story card, for the Share button. The image holds only what ShareCard allows:
 * never the seller. Members only, like the post page; the answer is private.
 */
export async function GET(request: Request, { params }: RouteContext<"/posts/[id]/share-card">) {
  // Request-time only: never run this while the app is being built.
  await connection();
  const me = await getSignedInStudent(request.headers);
  if (!me || !hasFinishedSignUp(me)) return plain("Sign in first", 401);
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) return plain("Not found", 404);
  if (!(await consume({ action: "share_card", key: me.id, max: 30, windowSeconds: 60 * 60 }))) {
    return plain("Too many share cards. Try again later.", 429);
  }
  const card = await getShareCard(me.id, id.data);
  if (!card) return plain("Not found", 404);

  let photo: string;
  try {
    photo = await loadPhoto(card.photoKey);
  } catch (error) {
    console.error("share card photo failed", error);
    return plain("Could not load the photo", 502);
  }

  return new ImageResponse(<Card card={card} photo={photo} />, {
    width: WIDTH,
    height: HEIGHT,
    fonts: [
      { name: "Figtree", data: figtree, weight: 800, style: "normal" },
      { name: "Peso", data: peso, weight: 800, style: "normal" },
    ],
    headers: { "Cache-Control": "private, no-store" },
  });
}

function plain(message: string, status: number) {
  return new Response(message, { status, headers: { "Cache-Control": "private, no-store" } });
}

/** The first photo, cropped to the card's photo box as a JPEG (the stored WebP is not read by the renderer). */
async function loadPhoto(key: string): Promise<string> {
  const response = await fetch(await getObjectStore().signedUrl(key, PHOTO_LINK_SECONDS));
  if (!response.ok) throw new Error(`photo answered ${response.status}`);
  const jpeg = await sharp(Buffer.from(await response.arrayBuffer()))
    .rotate()
    .resize(PHOTO_WIDTH, PHOTO_HEIGHT, { fit: "cover" })
    .jpeg({ quality: 88 })
    .toBuffer();
  return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
}

/** A title that fits the card's three lines: cut at a word, with an ellipsis. */
function clampTitle(title: string): string {
  if (title.length <= TITLE_CHARS) return title;
  const cut = title.slice(0, TITLE_CHARS);
  const space = cut.lastIndexOf(" ");
  return `${cut.slice(0, space > TITLE_CHARS / 2 ? space : TITLE_CHARS).trimEnd()}…`;
}

function Pill({ children }: { children: string }) {
  return (
    <div style={{ display: "flex", backgroundColor: "rgba(255,255,255,0.94)", color: NAVY, fontSize: 40, padding: "14px 32px", borderRadius: 999 }}>
      {children}
    </div>
  );
}

function Card({ card, photo }: { card: ShareCard; photo: string }) {
  // The renderer draws one font per run, so the peso sign is its own run.
  const [beforePeso, afterPeso] = card.price.split("₱");
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        padding: `88px ${MARGIN}px 80px`,
        backgroundImage: `linear-gradient(180deg, ${BLUE} 0%, ${BLUE} 55%, ${NAVY} 100%)`,
        color: "white",
        fontFamily: "Figtree",
      }}
    >
      <div style={{ display: "flex", alignItems: "center" }}>
        {/* The logo is blue on blue, so it sits on a white tile. */}
        <div style={{ display: "flex", padding: 10, backgroundColor: "white", borderRadius: 36 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO_URL} width={100} height={100} alt="" style={{ borderRadius: 26 }} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", marginLeft: 28 }}>
          <div style={{ fontSize: 56, lineHeight: 1.05 }}>Studiskarte</div>
          <div style={{ fontSize: 44, lineHeight: 1.1, color: "rgba(255,255,255,0.85)" }}>Marketplace</div>
        </div>
      </div>

      <div style={{ position: "relative", display: "flex", width: PHOTO_WIDTH, height: PHOTO_HEIGHT, marginTop: 56, borderRadius: 56, overflow: "hidden", backgroundColor: "white" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo} width={PHOTO_WIDTH} height={PHOTO_HEIGHT} alt="" />
        <div style={{ position: "absolute", top: 36, left: 36, display: "flex" }}>
          <Pill>{card.kind}</Pill>
        </div>
        {card.school ? (
          <div style={{ position: "absolute", top: 36, right: 36, display: "flex" }}>
            <Pill>{card.school}</Pill>
          </div>
        ) : null}
      </div>

      <div style={{ display: "flex", alignItems: "baseline", marginTop: 52, fontSize: 128, lineHeight: 1.1, color: GOLD }}>
        {afterPeso === undefined ? (
          <span>{card.price}</span>
        ) : (
          <>
            {beforePeso ? <span style={{ marginRight: 32 }}>{beforePeso.trim()}</span> : null}
            <span style={{ fontFamily: "Peso" }}>₱</span>
            <span>{afterPeso}</span>
          </>
        )}
      </div>
      <div style={{ display: "flex", marginTop: 12, fontSize: 68, lineHeight: 1.18 }}>{clampTitle(card.title)}</div>

      <div style={{ display: "flex", marginTop: "auto", alignItems: "flex-end", justifyContent: "space-between", fontSize: 42 }}>
        <div style={{ display: "flex" }}>studiskarte.com</div>
        <div style={{ display: "flex", color: "rgba(255,255,255,0.85)" }}>Student marketplace</div>
      </div>
    </div>
  );
}
