"use client";

import Link from "next/link";
import QRCode from "react-qr-code";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { startAdminMfaEnrollment, verifyAdminMfaEnrollment, replaceAdminRecoveryCodes } from "./actions";

const field = "h-11 w-full rounded-xl border border-zinc-300 bg-white px-3 text-base dark:border-zinc-700 dark:bg-zinc-950";
const primary = "h-11 rounded-xl bg-brand px-4 text-sm font-semibold text-white disabled:opacity-50";
const secondary = "inline-flex h-11 items-center justify-center rounded-xl border border-zinc-300 px-4 text-sm font-medium disabled:opacity-50 dark:border-zinc-700";

type Enrollment = { totpURI: string; backupCodes: string[] };

function RecoveryCodes({ codes }: { codes: string[] }) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-950 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-50">
      <p className="font-semibold">Save these recovery codes now</p>
      <p className="text-sm">Each code works once. Keep them offline, outside Studiskarte and your authenticator app.</p>
      <ul className="grid grid-cols-2 gap-2 font-mono text-sm tracking-wide" aria-label="Recovery codes">
        {codes.map((code) => <li key={code}>{code}</li>)}
      </ul>
    </div>
  );
}

export function MfaPanel({ enabled, recent }: { enabled: boolean; recent: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [recovery, setRecovery] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const secret = enrollment ? new URL(enrollment.totpURI).searchParams.get("secret") : null;

  function begin() {
    setError(null);
    startTransition(async () => {
      const result = await startAdminMfaEnrollment(password);
      if (!result.ok) return setError(result.error);
      setPassword("");
      setEnrollment(result);
    });
  }

  function verify() {
    setError(null);
    startTransition(async () => {
      const result = await verifyAdminMfaEnrollment(code);
      if (!result.ok) return setError(result.error);
      router.refresh();
    });
  }

  function replaceCodes() {
    setError(null);
    startTransition(async () => {
      const result = await replaceAdminRecoveryCodes(password);
      if (!result.ok) return setError(result.error);
      setPassword("");
      setRecovery(result.backupCodes);
    });
  }

  if (enabled) {
    return (
      <div className="flex flex-col gap-5">
        <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950">
          <p className="font-semibold">Authenticator protection is on</p>
          <p className="text-sm text-zinc-700 dark:text-zinc-300">Admin access requires a current authenticator or recovery code.</p>
        </div>
        {!recent ? (
          <Link href="/two-factor?next=/admin/security" className={primary}>Verify now</Link>
        ) : (
          <div className="flex flex-col gap-3 rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
            <h2 className="font-semibold">Replace recovery codes</h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">This immediately invalidates every old recovery code.</p>
            <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="current-password" placeholder="Current password" aria-label="Current password" className={field} />
            <button type="button" disabled={pending || !password} onClick={replaceCodes} className={secondary}>{pending ? "Working…" : "Make new recovery codes"}</button>
          </div>
        )}
        {recovery ? <RecoveryCodes codes={recovery} /> : null}
        {error ? <p role="alert" className="text-sm text-red-600">{error}</p> : null}
      </div>
    );
  }

  if (!enrollment) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">Use an authenticator app such as 1Password, Google Authenticator or Authy. Your current password is required to start.</p>
        <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="current-password" placeholder="Current password" aria-label="Current password" className={field} />
        {error ? <p role="alert" className="text-sm text-red-600">{error}</p> : null}
        <button type="button" disabled={pending || !password} onClick={begin} className={primary}>{pending ? "Starting…" : "Set up authenticator"}</button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="self-center rounded-2xl bg-white p-4"><QRCode value={enrollment.totpURI} size={192} /></div>
      <div className="flex flex-col gap-1 text-sm">
        <p className="font-semibold">Scan the QR code</p>
        <p className="text-zinc-600 dark:text-zinc-400">If scanning fails, enter this setup key manually:</p>
        <code className="break-all rounded-lg bg-zinc-100 p-2 dark:bg-zinc-900">{secret}</code>
      </div>
      <RecoveryCodes codes={enrollment.backupCodes} />
      <label className="flex flex-col gap-2">
        <span className="text-sm font-semibold">Enter the 6-digit code to finish</span>
        <input value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" className={`${field} font-mono tracking-widest`} />
      </label>
      {error ? <p role="alert" className="text-sm text-red-600">{error}</p> : null}
      <button type="button" disabled={pending || code.length !== 6} onClick={verify} className={primary}>{pending ? "Checking…" : "Turn on two-factor authentication"}</button>
    </div>
  );
}
