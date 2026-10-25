import { NextResponse } from "next/server";
import { clientIp } from "@/lib/identity/auth";
import { sendMail } from "@/lib/mail";
import { consume } from "@/lib/rate-limit";
import { cleanHeader, cleanText, MESSAGE_MAX } from "@/lib/support/send";
import { SUPPORT_EMAIL } from "@/lib/support/config";

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const MESSAGE_MIN = 5;

/**
 * "Message us" on the landing page: a visitor with no account writes to the owner. Body: { name?, email, message, website? }.
 * `website` is a trap field that people never see; a robot fills it and gets a quiet success.
 */
export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return NextResponse.json({ error: "Bad origin" }, { status: 403 });
  }
  let body: Record<string, unknown> = {};
  try {
    const parsed: unknown = await request.json();
    if (parsed && typeof parsed === "object") body = parsed as Record<string, unknown>;
  } catch {
    body = {};
  }
  const text = (key: string) => (typeof body[key] === "string" ? (body[key] as string) : "");
  if (text("website").trim() !== "") return new NextResponse(null, { status: 204 });

  const email = cleanHeader(text("email"), 120).toLowerCase();
  const name = cleanHeader(text("name"), 60);
  const message = cleanText(text("message"));
  if (!EMAIL.test(email)) return NextResponse.json({ error: "Enter a valid email so we can reply.", field: "email" }, { status: 400 });
  if (message.length < MESSAGE_MIN) return NextResponse.json({ error: "Write a short message.", field: "message" }, { status: 400 });
  if (message.length > MESSAGE_MAX) return NextResponse.json({ error: `Keep it under ${MESSAGE_MAX} characters.`, field: "message" }, { status: 400 });

  const ip = clientIp(request.headers) ?? "unknown";
  const hourly = await consume({ action: "landing_contact", key: ip, max: 3, windowSeconds: 3600 });
  const daily = hourly && (await consume({ action: "landing_contact_day", key: ip, max: 8, windowSeconds: 24 * 3600 }));
  if (!daily) return NextResponse.json({ error: "You have sent a few messages already. Try again later." }, { status: 429 });

  try {
    await sendMail({
      to: SUPPORT_EMAIL,
      subject: cleanHeader(`[Landing] ${message.split("\n")[0]}`, 100),
      text: `From the landing page (not signed in)\nName: ${name || "(not given)"}\nEmail: ${email}\n\n${message}\n`,
      replyTo: email,
    });
  } catch (error) {
    console.error("sending a landing contact message failed", error);
    return NextResponse.json({ error: "Could not send your message right now. Try again later." }, { status: 502 });
  }
  return new NextResponse(null, { status: 204 });
}
