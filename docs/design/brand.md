# Studiskarte brand

Source of truth for how Studiskarte looks and sounds. Tokens live in `src/app/globals.css`; the evidence behind each rule is in `docs/design/principles.md`. Anything marked **owner** needs your decision.

## Who it is for and what it should feel like

Students in the Philippines (and later faculty, staff, alumni and visitors) who buy, sell and look for things inside a school community. The brand promise is the tagline: **"Where student hustle meets student needs."** The feeling to build: *friendly, trustworthy, quick*. Friendly because the mascot is a playful student; trustworthy because the product is about meeting strangers and the research says trust is the thing people weigh (principles 1 to 6); quick because posting and replying fast is what keeps a campus market alive (principles 7, 19).

Studiskarte is not Vinted or Depop (fashion, escrow, polished editorial). It sits between a campus community board and a safe, simple marketplace. Closest peers: Facebook Marketplace and Carousell Philippines.

## The mascot and logo

The logo (`public/logo.png`, source `assets/studiskarte-logo.jpg`) is a white, S-shaped character wearing a navy graduation cap with a gold tassel, a gold backpack and a folder, on the brand blue. The palette below is taken from it.

- Use the logo on the brand blue (splash screen, sign-in, app icon). It is not placed on white or photographs.
- Clear space around it: at least a quarter of its width. Minimum size 48 px.
- The mascot is **unnamed**. **owner:** a name would make it usable in empty states, onboarding and the feature tour.
- The word mark is "Studiskarte" in the brand font, bold. "Studiskarte Marketplace" is the long name (page titles, the installed app); the short name is "Studiskarte".

## Colour

| Token | Hex | Use | Contrast |
| --- | --- | --- | --- |
| `brand` | `#0365fc` | Primary buttons, links, active tab, focus accents | White on it 4.92:1 |
| `brand-text` | `#0365fc` light, `#6aa5ff` dark | Blue used as text | 4.92:1 on white, 7.65:1 on the dark page |
| `brand-strong` | `#0b2a6f` | Weighty headings, pressed states, badge outline | 13.3:1 on white |
| `gold` | `#f5b301` | Ratings (stars), perks, small celebrations | 1.85:1 on white, so **never as text on white**; navy on gold is 7.2:1 |
| Neutrals (`zinc-*`) | tinted toward the brand blue | Text, borders, surfaces | See `globals.css`: `zinc-500` 5.40:1 on white and 6.46:1 on the dark page; `zinc-600` 7.89:1 on white |
| Page | `#ffffff` light, `#0b101a` dark | Backgrounds | Text on page 17.4:1 and 16.2:1 |

Rules:
- Neutrals are tinted, never pure grey or pure black (same advice as Impeccable, below). The existing `zinc-*` classes already take the tint, so no page needed rewriting.
- Meaning never relies on colour alone: statuses carry words, stars carry numbers (WCAG 1.4.1).
- Dark mode is automatic (`prefers-color-scheme`); text steps flip so contrast holds in both.
- Warnings keep amber, success green, danger red, as they are.

## Type

One variable font, **Figtree** (friendly, rounded, readable at small sizes, covers "ñ"), self-hosted at build so nothing loads from Google at run time and the data cost is one small file (principle 20, P2). System fonts are the fallback. Body 16 px or more (inputs must be 16 px so iPhones do not zoom); labels and captions 12 to 14 px; page titles 20 to 24 px semibold; no more than three sizes on one screen.

## Voice

Plain, warm, direct. Short sentences, active verbs, say what happens next.
- **English** for navigation, buttons, errors and every legal or safety message (P14: plain language is a legal duty for privacy notices).
- **A light Taglish touch** only in low-stakes moments (greetings, empty states, success messages), for example "Walang laman pa. Mag-post na!". **Not tested yet:** run it with a handful of students before shipping (P14, weak evidence).
- Never blame the student ("You entered…"), never use slang in errors, never use "oops".
- Numbers and money in Philippine style: ₱1,200; dates "Sat, Oct 17"; time "3:00 PM" (already in the app).
- Safety copy leads with the scam that matters: do not pay before the handover is agreed (principle 16).

## Components and layout rules

- Mobile first at 360 px; tap targets 44 px or more; primary action largest; destructive actions never next to confirming ones (principle 20).
- Cards are used for a post, an offer, a reservation. Do not put a card inside a card, and do not wrap plain text in a card to decorate it.
- Badges: *school mark* ("verified at TUP"), plus a *role* once roles exist (student, faculty, staff, alumni, visitor), plus *ID checked* only when it was (principle 3). The word "verified" is a promise; each badge says what was checked.
- Stars always come with the review count and items sold (principle 1). A new seller shows "New".
- Empty states say what to do next and have one button.
- Motion: short (under 200 ms), ease-out, nothing bouncing, respects reduced motion.
- Photos reserve their space so nothing jumps while loading.

## Using Impeccable

[Impeccable](https://github.com/pbakaus/impeccable) (Apache-2.0) is a design skill for AI coding agents: commands such as `audit`, `critique`, `polish`, `harden`, `onboard` and a set of deterministic detectors for generic AI-looking design. It fits here as a **review aid**, not as a source of taste: our decisions come from the research and the mascot.

I did not install it. Its installer adds a skill, edit hooks to the project and a downloaded binary (`~/.impeccable/bin`) that runs on your machine. If you want it: `npx impeccable install`, read what it wrote first, then `/impeccable init` (it records the product facts in `PRODUCT.md`) and run `audit` and `critique` on one page at a time.

## What is not done yet

- A name for the mascot, and expressions for empty and error states (**owner**, needs art).
- A proper app-icon set from the mascot on the blue, with a maskable safe zone (the current icons come from the same logo; check them on an Android home screen).
- Taglish copy test with students.
- The roles badge set; it waits for the roles work.
