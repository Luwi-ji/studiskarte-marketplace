import { connection, NextResponse } from "next/server";
import { getPool } from "@/lib/db";

export async function GET() {
  // Request-time only: never run this query while the app is being built.
  await connection();
  try {
    const { rows } = await getPool().query<{
      database: string;
      server_time: string;
    }>("select current_database() as database, now()::text as server_time");
    return NextResponse.json({ ok: true, ...rows[0] });
  } catch (error) {
    // Log the cause on the server. Never return connection details to the client.
    console.error("db health check failed", error);
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
