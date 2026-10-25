import type { MetadataRoute } from "next";
import { currentLegal, LEGAL_SLUGS } from "@/lib/legal/documents";

const ORIGIN = "https://studiskarte.com";

/**
 * The pages a search engine may list: the landing page, About, the legal documents and sign-up. Everything else needs an
 * account, so it has no place here (and robots.txt keeps crawlers out of it).
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const pages: { path: string; priority: number }[] = [
    { path: "/", priority: 1 },
    { path: "/about", priority: 0.6 },
    { path: "/sign-up", priority: 0.5 },
    ...(currentLegal() ? LEGAL_SLUGS.map((slug) => ({ path: `/legal/${slug}`, priority: 0.3 })) : []),
  ];
  return pages.map(({ path, priority }) => ({ url: `${ORIGIN}${path === "/" ? "" : path}`, priority }));
}
