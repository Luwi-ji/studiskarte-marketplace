"use client";

import { useActionState, useState } from "react";
import { buttonClass, inputClass, linkClass } from "../auth-styles";
import { verifySecondFactor, type TwoFactorState } from "./actions";

export function TwoFactorForm({ next }: { next: string }) {
  const [method, setMethod] = useState<"totp" | "backup">("totp");
  const [state, action, pending] = useActionState<TwoFactorState, FormData>(verifySecondFactor, {});
  const error = state.method === method ? state.error : undefined;

  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="method" value={method} />
      <input type="hidden" name="next" value={next} />
      <label className="flex flex-col gap-2">
        <span className="text-sm font-semibold">{method === "totp" ? "Authenticator code" : "Recovery code"}</span>
        <input
          name="code"
          inputMode={method === "totp" ? "numeric" : "text"}
          autoComplete="one-time-code"
          pattern={method === "totp" ? "[0-9]*" : undefined}
          maxLength={method === "totp" ? 6 : 64}
          required
          autoFocus
          className={`${inputClass} font-mono tracking-widest`}
        />
      </label>
      {error ? <p role="alert" className="text-sm text-red-600">{error}</p> : null}
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Checking…" : "Continue"}
      </button>
      <button type="button" disabled={pending} className={linkClass} onClick={() => setMethod(method === "totp" ? "backup" : "totp")}>
        {method === "totp" ? "Use a recovery code" : "Use an authenticator code"}
      </button>
    </form>
  );
}
