import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import sharp from "sharp";
import { getObjectStore } from "@/lib/images/store";
import type { ShareCard } from "@/lib/posts/share-card";

// Brand tokens from src/app/globals.css: the logo's blue, the cap's navy, the tassel's gold.
const BLUE = "#0365fc";
const NAVY = "#0b2a6f";
const GOLD = "#f5b301";

const PHOTO_LINK_SECONDS = 60;

// The fonts and logo never change, so they are read once. Figtree is the app's font; the peso sign
// is not in its Latin subset, so a one-glyph font stands in for it.
const [figtree, peso, logo] = await Promise.all([
  readFile(join(process.cwd(), "assets/Figtree-ExtraBold.ttf")),
  readFile(join(process.cwd(), "assets/Peso-ExtraBold.ttf")),
  readFile(join(process.cwd(), "public/logo.png")),
]);
const LOGO_URL = `data:image/png;base64,${logo.toString("base64")}`;

const FONTS = [
  { name: "Figtree", data: figtree, weight: 800, style: "normal" },
  { name: "Peso", data: peso, weight: 800, style: "normal" },
] as const;

/**
 * Both cards hold only what ShareCard allows: never the seller. A caller sets the cache headers (a
 * member's story card is private; the public link card is cached for minutes).
 */
type Options = { headers: Record<string, string> };

/** The story card, 9:16 (Instagram and Facebook Stories, Messages, status posts). */
const STORY = { width: 1080, height: 1920, margin: 72, photoHeight: 940, titleChars: 80 };
/** The link card, 1.91:1: the size chat apps and social networks draw above a shared link. */
const UNFURL = { width: 1200, height: 630, photoWidth: 630, panelPadding: 44, titleChars: 52 };

/** A listing as a story card, for the Share button. Throws when the photo cannot be loaded. */
export async function renderStoryCard(card: ShareCard, options: Options): Promise<ImageResponse> {
  const photo = await loadPhoto(card.photoKey, STORY.width - STORY.margin * 2, STORY.photoHeight);
  return new ImageResponse(<Story card={card} photo={photo} />, { width: STORY.width, height: STORY.height, fonts: [...FONTS], headers: options.headers });
}

/** A listing as a link card: the picture on the left, the price and title on the right. Throws when the photo cannot be loaded. */
export async function renderUnfurlCard(card: ShareCard, options: Options): Promise<ImageResponse> {
  const photo = await loadPhoto(card.photoKey, UNFURL.photoWidth, UNFURL.height);
  return new ImageResponse(<Unfurl card={card} photo={photo} />, { width: UNFURL.width, height: UNFURL.height, fonts: [...FONTS], headers: options.headers });
}

/** The first photo, cropped to the card's photo box as a JPEG (the stored WebP is not read by the renderer). */
async function loadPhoto(key: string, width: number, height: number): Promise<string> {
  const response = await fetch(await getObjectStore().signedUrl(key, PHOTO_LINK_SECONDS));
  if (!response.ok) throw new Error(`photo answered ${response.status}`);
  const jpeg = await sharp(Buffer.from(await response.arrayBuffer()))
    .rotate()
    .resize(width, height, { fit: "cover" })
    .jpeg({ quality: 88 })
    .toBuffer();
  return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
}

/** A title that fits the card's lines: cut at a word, with an ellipsis. */
function clampTitle(title: string, max: number): string {
  if (title.length <= max) return title;
  const cut = title.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return `${cut.slice(0, space > max / 2 ? space : max).trimEnd()}…`;
}

function Pill({ children, size }: { children: string; size: "large" | "small" }) {
  const large = size === "large";
  return (
    <div style={{ display: "flex", backgroundColor: "rgba(255,255,255,0.94)", color: NAVY, fontSize: large ? 40 : 28, padding: large ? "14px 32px" : "8px 22px", borderRadius: 999 }}>
      {children}
    </div>
  );
}

/** The logo is blue on blue, so it sits on a white tile. */
function Logo({ size }: { size: number }) {
  return (
    <div style={{ display: "flex", padding: size / 10, backgroundColor: "white", borderRadius: size * 0.36 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={LOGO_URL} width={size} height={size} alt="" style={{ borderRadius: size * 0.26 }} />
    </div>
  );
}

function Price({ price, size, style }: { price: string; size: number; style?: Record<string, string | number> }) {
  // The renderer draws one font per run, so the peso sign is its own run.
  const [beforePeso, afterPeso] = price.split("₱");
  return (
    <div style={{ display: "flex", alignItems: "baseline", fontSize: size, lineHeight: 1.1, color: GOLD, ...style }}>
      {afterPeso === undefined ? (
        <span>{price}</span>
      ) : (
        <>
          {beforePeso ? <span style={{ marginRight: size / 4 }}>{beforePeso.trim()}</span> : null}
          <span style={{ fontFamily: "Peso" }}>₱</span>
          <span>{afterPeso}</span>
        </>
      )}
    </div>
  );
}

function Story({ card, photo }: { card: ShareCard; photo: string }) {
  const photoWidth = STORY.width - STORY.margin * 2;
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        padding: `88px ${STORY.margin}px 80px`,
        backgroundImage: `linear-gradient(180deg, ${BLUE} 0%, ${BLUE} 55%, ${NAVY} 100%)`,
        color: "white",
        fontFamily: "Figtree",
      }}
    >
      <div style={{ display: "flex", alignItems: "center" }}>
        <Logo size={100} />
        <div style={{ display: "flex", flexDirection: "column", marginLeft: 28 }}>
          <div style={{ fontSize: 56, lineHeight: 1.05 }}>Studiskarte</div>
          <div style={{ fontSize: 44, lineHeight: 1.1, color: "rgba(255,255,255,0.85)" }}>Marketplace</div>
        </div>
      </div>

      <div style={{ position: "relative", display: "flex", width: photoWidth, height: STORY.photoHeight, marginTop: 56, borderRadius: 56, overflow: "hidden", backgroundColor: "white" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo} width={photoWidth} height={STORY.photoHeight} alt="" />
        <div style={{ position: "absolute", top: 36, left: 36, display: "flex" }}>
          <Pill size="large">{card.kind}</Pill>
        </div>
        {card.school ? (
          <div style={{ position: "absolute", top: 36, right: 36, display: "flex" }}>
            <Pill size="large">{card.school}</Pill>
          </div>
        ) : null}
      </div>

      <Price price={card.price} size={128} style={{ marginTop: 52 }} />
      <div style={{ display: "flex", marginTop: 12, fontSize: 68, lineHeight: 1.18 }}>{clampTitle(card.title, STORY.titleChars)}</div>

      <div style={{ display: "flex", marginTop: "auto", alignItems: "flex-end", justifyContent: "space-between", fontSize: 42 }}>
        <div style={{ display: "flex" }}>studiskarte.com</div>
        <div style={{ display: "flex", color: "rgba(255,255,255,0.85)" }}>Student marketplace</div>
      </div>
    </div>
  );
}

function Unfurl({ card, photo }: { card: ShareCard; photo: string }) {
  const panelWidth = UNFURL.width - UNFURL.photoWidth;
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        backgroundImage: `linear-gradient(160deg, ${BLUE} 0%, ${BLUE} 55%, ${NAVY} 100%)`,
        color: "white",
        fontFamily: "Figtree",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={photo} width={UNFURL.photoWidth} height={UNFURL.height} alt="" />
      <div style={{ display: "flex", flexDirection: "column", width: panelWidth, height: "100%", padding: UNFURL.panelPadding }}>
        <div style={{ display: "flex", alignItems: "center" }}>
          <Logo size={64} />
          <div style={{ display: "flex", flexDirection: "column", marginLeft: 18, fontSize: 32, lineHeight: 1.1 }}>
            <div style={{ display: "flex" }}>Studiskarte</div>
            <div style={{ display: "flex", color: "rgba(255,255,255,0.85)" }}>Marketplace</div>
          </div>
        </div>

        <div style={{ display: "flex", marginTop: 40 }}>
          <Pill size="small">{card.kind}</Pill>
          {card.school ? (
            <div style={{ display: "flex", marginLeft: 12 }}>
              <Pill size="small">{card.school}</Pill>
            </div>
          ) : null}
        </div>

        <Price price={card.price} size={84} style={{ marginTop: 24 }} />
        <div style={{ display: "flex", marginTop: 10, fontSize: 44, lineHeight: 1.18 }}>{clampTitle(card.title, UNFURL.titleChars)}</div>

        <div style={{ display: "flex", marginTop: "auto", fontSize: 30, color: "rgba(255,255,255,0.85)" }}>studiskarte.com</div>
      </div>
    </div>
  );
}
