DRAFT for lawyer review, not live.

Before publishing: delete this note, fill or remove every [bracket] (and any text marked "applies once ... opens" that is not yet true), and delete the last section ("Notes for the lawyer").

# Cookies and Local Storage Policy

This page lists what Studiskarte Marketplace ("the app") stores on your phone or computer, and why. Last updated [date of adoption]. It sits beside the Privacy Policy.

## At a glance

- **We use no advertising cookies, no marketing pixels and no analytics tools.** We found none in the app's code.
- The app sets **one cookie that matters every day**: the one that keeps you signed in.
- A second, short-lived cookie is set **only while you sign in with Google**.
- The app installs a **service worker** that keeps one offline page on your device. It stores no private data.
- If you turn on **alerts**, your browser keeps a push subscription and we keep a copy on our server so we can send them.
- The app does **not** use localStorage or sessionStorage. [to confirm in a browser check before publishing]
- You can clear all of this in your browser settings. Doing so signs you out.

## What we store, one item at a time

Every item below is **strictly necessary** or **functional**. None is for advertising or tracking. "Strictly necessary" means the app cannot work without it. "Functional" means you asked for the feature it supports.

### Cookies

- **Sign-in cookie** (named `better-auth.session_token`; on the live site it carries the prefix `__Secure-`). *Strictly necessary.* Keeps you signed in. It holds a signed token that points to your session on our server, not your email or password. It is sent only to our site, only over https, and cannot be read by scripts on the page (flags: Secure, HttpOnly, SameSite=Lax). It lasts **up to 30 days** and is renewed when you use the app after a day. It is removed when you sign out, delete your account, or when your session is ended (for example after a password reset or a suspension). Set by Better Auth, the sign-in library the app uses.
- **Google sign-in state cookie** (named `better-auth.state`, with the `__Secure-` prefix on the live site). *Strictly necessary, only if you choose "Continue with Google".* Protects the sign-in from forgery by matching your return from Google to the request you made. It lasts **5 minutes** and is not used again. Set by Better Auth. A matching record is kept in our database for up to 10 minutes.
- **Cookies that the app is set up not to use:** the library's optional session-cache cookie (`session_data`) and its "do not remember me" cookie (`dont_remember`) are not enabled in the app's settings. [to confirm in a browser check]

### Service worker and offline page

- **Service worker** (`/sw.js`, on our own domain). *Functional.* Lets the app show a "connection needed" page when you are offline, and shows device alerts when you have turned them on. It runs only for pages of our own site. It is registered when you open the app.
- **Offline page copy** (browser Cache Storage, cache name `offline-v2`). *Functional.* Holds exactly one page, `/offline.html`, which is the same for everyone and has no personal data. It stays until the worker updates it or you clear site data. When the app updates, older caches are deleted. Page loads, data, pictures and scripts are not stored by the worker.

### Alerts (only if you turn them on)

- **Push subscription** (kept by your browser and its push service, for example Google, Apple, Mozilla or Microsoft, depending on your device). *Functional, only if you turn on alerts in the app.* It is created when you allow notifications. We store its address and keys in our database, linked to your account, so we can send you alerts. You may have alerts on up to 10 devices. We delete the record when you turn alerts off for that device, when the push service says the device is gone, and when your account is deleted. An alert carries a headline, the listing's title and, for a handover, the agreed time and place. It never carries message text, a name or an amount.
- **Notification permission** (stored by your browser, not by us). *Functional.* Your browser remembers whether you allowed alerts. You can change it in the browser's site settings.

### Error reports (Sentry)

- **No cookies and no local storage are requested for error reports.** The app sends crash reports to Sentry only in the live version and only if an error happens. The app's settings tell Sentry not to collect your identity, cookies, headers, request bodies, query strings, page variables or database data, and the app removes these again before sending, and blanks email addresses in the text. Tracing and session replay are off. [to confirm in a browser check that the Sentry script stores nothing on the device] More about this is in the Privacy Policy.

### Other things you may notice

- **Google sign-in.** If you tap "Continue with Google", you leave our site and Google may set its own cookies on google.com. We do not control them. They are covered by Google's policies. [to confirm: policy not read]
- **Fonts.** The app's font is downloaded when the app is built and served from our own site. The browser does not contact Google Fonts when you open a page, as far as the code shows. [to confirm in a browser check]
- **Pictures.** Listing and profile pictures are loaded from private storage at Cloudflare (R2) through short-lived signed links. [to confirm whether any cookie is set by that domain]
- **Hosting and network.** The app is served by Vercel and its address records are at Cloudflare (see the Privacy Policy). Our code does not set a Vercel or Cloudflare cookie. Whether Vercel or Cloudflare set a technical cookie of their own (for example a bot-protection cookie such as `__cf_bm`) on this site depends on how the domain is set up. [to confirm in a browser check]
- **Calendar link.** If you make a calendar link, it is a private web address, not a cookie. Anyone with the link can read your handover schedule (listing title, time, place and method; no names, amounts or notes). You can replace or turn it off in the app.

## What we do not use

- No advertising cookies or ad networks.
- No Meta, TikTok or similar pixels.
- No Google Analytics or any other analytics tool. [to confirm: none found in the code or in `package.json`]
- No cookies to follow you across other sites.
- No sale of browsing information.

If we add any of these in future, we will update this page and ask for your agreement first where the law requires it.

## Why we may store these

The Data Privacy Act (RA 10173) permits processing of personal information when at least one condition exists, among them the data subject's consent (Sec. 12(a)), when it is necessary to fulfil a contract with the data subject (Sec. 12(b)), or when it is necessary for the legitimate interests of the controller, unless overridden by the data subject's fundamental rights (Sec. 12(f)). "Consent" is a freely given, specific, informed indication of will (Sec. 3(b)).

- The sign-in cookie, the Google sign-in state cookie and the offline page serve the service you asked for when you made an account and signed in. [lawyer: confirm whether to rely on Sec. 12(b), Sec. 12(f) or both.]
- Alerts are **your choice**. We rely on your consent, given when you tap the alert switch and allow notifications in your browser. You can withdraw it at any time by turning alerts off.
- Error reports are for keeping the app working. We rely on our legitimate interest, with the settings above to keep the data to a minimum. [lawyer: confirm.]

We do not ask you to accept cookies in a banner, because the cookies we set are needed to run the app and the optional ones (alerts) have their own switch. [lawyer: confirm that no banner is needed.]

Your rights over your personal data are in the Privacy Policy.

## How to clear or block what is stored

- **Sign out** in the app. This removes the sign-in cookie.
- **Turn alerts off** in Settings. This removes the subscription from your device and from our server.
- **Clear site data** in your browser:
  - Chrome or Edge: Settings, Privacy, Site settings, find our site, Clear data.
  - Firefox: Settings, Privacy and Security, Cookies and Site Data, Manage data.
  - Safari on iPhone: Settings, Safari, Advanced, Website Data. If you added the app to your Home Screen, remove it from the Home Screen too.
  - This removes the cookie, the service worker and the offline page copy.
- **Block cookies** in your browser settings. The app will not let you sign in without its sign-in cookie.

## Changes

We may change this page and will change the date above.

## Contact

support@studiskarte.com

## Notes for the lawyer (delete before publishing)

Every storage claim, with the file it comes from (checked 2026-10-22):

- Sign-in cookie, name, flags, lifetime: `src/lib/identity/auth.ts` (`SESSION_SECONDS = 30 * 24 * 60 * 60`, `session: { expiresIn: SESSION_SECONDS, updateAge: 24 * 60 * 60 }`, `nextCookies()` plugin sets the cookie from server actions). Cookie name `better-auth.session_token`, `__Secure-` prefix when the base URL is https, `secure`, `httpOnly`, `sameSite: lax`: from the library source `node_modules/better-auth/dist/cookies/index.mjs` (version 1.7.9 in `package.json`). **Not checked in a live browser.** Confirm the exact name and flags in dev tools on studiskarte.com.
- Google state cookie: `socialProviders` with Google in `src/lib/identity/auth.ts` (shown only if `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set). The library stores the OAuth state in the database (the app has a database adapter) and sets a signed cookie `state` with `maxAge` 300 seconds and a verification row that expires in 10 minutes: `node_modules/better-auth/dist/state.mjs`, `node_modules/better-auth/dist/context/create-context.mjs` (`storeStateStrategy` is "database" when the adapter is stateful). Not checked in a live browser.
- Session cache cookie (`session_data`) and `dont_remember`: the options in `src/lib/identity/auth.ts` set no `cookieCache`, and sign-in calls (`src/lib/identity/password.ts`, `src/app/(public)/sign-up/actions.ts`, `src/app/(public)/sign-in/actions.ts`) do not pass `rememberMe: false`. Inference from the library defaults; verify in a browser.
- No `localStorage`, `sessionStorage`, `document.cookie`, `indexedDB`: a search of `src/` and `public/` found none (the only hits for "cookie" were a comment in `src/app/(tabs)/me/settings/actions.ts` and Sentry scrubbing in `src/lib/sentry-options.ts`). The theme follows the system setting through CSS (`src/app/layout.tsx`); no theme preference is stored.
- Service worker: `public/sw.js` (cache `offline-v2`, only `/offline.html`; fetch handler only for page navigations; push and notificationclick handlers; older caches deleted), registered in `src/app/service-worker-registration.tsx` with scope `/` and `updateViaCache: "none"`; headers for `/sw.js` in `next.config.ts` (`no-store`, own-origin script policy). `public/offline.html` is the stored page.
- Push subscription: browser side in `src/components/alerts-toggle.tsx` and `src/lib/notifications/push/device.ts`; server side in `src/lib/notifications/push/subscriptions.ts` (limit of 10 devices, `removeSubscription`), `src/lib/notifications/push/notify.ts` (a gone subscription is deleted), table `push_subscription` in `src/db/schema.ts` (endpoint, p256dh, auth; deleted with the student by cascade). Payload content: `src/lib/notifications/push/payload.ts` (title, body of listing title and detail, url, tag). Deleted with the account: `src/lib/identity/delete-account.ts` (line deleting `pushSubscription`).
- Sentry: `src/lib/sentry-options.ts` (`enabled` only in production with a DSN; `dataCollection` off for user info, cookies, headers, bodies, query params; `scrubEvent`; no tracing or replay), `src/instrumentation-client.ts`, `src/instrumentation.ts`. Whether the Sentry browser SDK writes anything to the device itself was not checked; Sentry's own terms were not read.
- Fonts: `src/app/layout.tsx` (`next/font/google`, with a comment saying it is self-hosted at build time). Not verified in the network tab.
- Images: signed links from `@aws-sdk/s3-request-presigner` to `*.r2.cloudflarestorage.com` in `src/lib/images/store.ts`. Whether that host sets cookies: not checked.
- Vercel and Cloudflare: no code sets their cookies. `vercel.json` only has a cron. Whether `__cf_bm` or a Vercel cookie appears depends on whether Cloudflare proxies the site and on Vercel settings. **Confirm in a browser and in the Cloudflare dashboard.**
- Analytics or ads: a search of `package.json` and `src/` for Vercel Analytics, Speed Insights, Google Analytics or Tag Manager, PostHog, Plausible, Meta pixel, AdSense, reCAPTCHA and Turnstile found none. Google Search Console verification (a meta tag in `src/app/layout.tsx` and `public/googlecd78568d8c3687df.html`) does not set a cookie on members.
- Calendar link: `src/lib/calendar/feed.ts` (a private feed address; only listing title, time, place, method and role are read, per its header comment; the link-making code was not read).

Law:

- Data Privacy Act (RA 10173), read on lawphil.net 2026-10-22: Sec. 3(b) consent, Sec. 3(g) personal information, Sec. 11 principles, Sec. 12(a), (b), (f) criteria for lawful processing. The Act does not mention cookies. Whether a session token or push endpoint is "personal information" (Sec. 3(g)) is not decided here. NPC guidance on cookies and consent banners was **not read**. Whether an NPC advisory covers cookies [to confirm].
- The Internet Transactions Act, the Cybercrime Prevention Act and any NPC rule on cookies were not used. The ePrivacy-style opt-in rule of other countries does not apply here by itself; I did not rely on it.

Questions: (1) is it enough to treat sign-in and offline storage as necessary, with no banner? (2) is push consent given by the browser prompt enough, or does the app need its own consent text? (3) is the Sentry basis (legitimate interest) right, given that data goes outside the Philippines (see `privacy.md`, Sec. 21)?

Placeholders: `[date of adoption]`, inline `[to confirm]`, `[to confirm in a browser check]` and `[lawyer: ...]` notes. Before adoption, someone should open the live site, sign in, and list the cookies and storage in dev tools (Application tab) to check the lists above.
