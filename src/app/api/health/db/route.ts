import { connection, NextResponse } from "next/server";
import { getPool } from "@/lib/db";

export async function GET() {
  // Request-time only: never run this query while the app is being built.
  await connection();
  try {
    await getPool().query("select 1");
    // Nothing about the database is returned: this route is public.
    return NextResponse.json({ ok: true });
  } catch (error) {
    // Log the cause on the server. Never return connection details to the client.
    console.error("db health check failed", error);
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
