import { NextResponse } from "next/server";

// Names this deployment, so a page left open across an update can tell it is out of date.
// The value is fixed when the deployment is built, so it changes with every deployment.
const VERSION = process.env.VERCEL_DEPLOYMENT_ID ?? process.env.VERCEL_GIT_COMMIT_SHA ?? "dev";

export function GET() {
  return NextResponse.json({ version: VERSION }, { headers: { "Cache-Control": "no-store" } });
}
