import type { NextConfig } from "next";
const cspReportOnly = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""} https://challenges.cloudflare.com`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.r2.dev https://*.r2.cloudflarestorage.com",
  "font-src 'self' data:",
  "connect-src 'self' https://challenges.cloudflare.com https://*.sentry.io",
  "frame-src https://challenges.cloudflare.com",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "media-src 'self' blob:",
  "report-uri /api/csp-report",
].join("; ");


const nextConfig: NextConfig = {
  /* config options here */
  poweredByHeader: false,
  // The legal text is read from disk at request time (to ask for acceptance and to show it), so
  // every server bundle must carry it.
  outputFileTracingIncludes: {
    "/*": ["./content/legal/**/*"],
    "/**": ["./content/legal/**/*"],
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // The service worker must never be served from a cache, or fixes to it
  // would not reach phones (Next.js PWA guide).
  async headers() {
    return [
      {
        // Every page: nobody else may frame the app (clickjacking on Accept, Confirm, Delete),
        // browsers must not guess types, and other sites learn only our origin from a link.
        // Vercel already sends Strict-Transport-Security.
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "Content-Security-Policy-Report-Only", value: cspReportOnly },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
  // The old address, kept alive by Vercel, sends people to the real domain. /api is left alone:
  // Vercel's daily cron and any caller still using the old host must reach the job endpoint
  // and the auth routes without a redirect.
  async redirects() {
    return [
      {
        source: "/:path((?!api/).*)",
        has: [{ type: "host", value: "studiskarte-marketplace.vercel.app" }],
        destination: "https://studiskarte.com/:path",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
