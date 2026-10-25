import type { MetadataRoute } from "next";

// Search engines may index the site. Crawlers that train AI models or fetch pages to answer
// AI users are asked to stay away: the site holds student profiles, listings and reviews.
// robots.txt is a request, not security.
const AI_CRAWLERS = [
  "GPTBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-User",
  "anthropic-ai",
  "CCBot",
  "Google-Extended",
  "Applebot-Extended",
  "PerplexityBot",
  "Perplexity-User",
  "Bytespider",
  "Meta-ExternalAgent",
  "cohere-ai",
];

export default function robots(): MetadataRoute.Robots {
  return {
    sitemap: "https://studiskarte.com/sitemap.xml",
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Pages that need an account, and the places the app talks to itself.
        disallow: ["/api/", "/me/", "/admin/", "/messages", "/notifications", "/offers/", "/posts/", "/welcome", "/partner/", "/forgot-password", "/search"],
        other: { "Content-Signal": "search=yes, ai-input=no, ai-train=no" },
      },
      { userAgent: AI_CRAWLERS, disallow: "/" },
    ],
  };
}
