"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useAction } from "@/app/safety/use-action";
import { preparePhoto } from "@/lib/images/prepare-photo";
import { DOCUMENT_LABEL, type DocumentKind } from "@/lib/verification/config";
import { ID_CONSENT } from "@/lib/verification/consent";
import { startCheckAction, submitCheckAction, withdrawConsentAction } from "./actions";

const BUTTON = "flex h-11 w-full items-center justify-center rounded-lg border border-zinc-400 text-sm font-medium disabled:opacity-50 dark:border-zinc-600";
const PRIMARY = "flex h-12 w-full items-center justify-center rounded-lg bg-brand font-medium text-white disabled:opacity-50";
// Continue and Not now on the consent screen: same size and weight. Disabled is a flat grey button, never a faint outline.
const CONSENT_BUTTON =
  "flex h-12 w-full items-center justify-center rounded-lg border-2 border-zinc-500 text-base font-medium disabled:border-zinc-300 disabled:bg-zinc-100 disabled:text-zinc-600 dark:border-zinc-400 dark:disabled:border-zinc-700 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-400";
// The promises a person most needs, in this order: deletion first. Anything else in the notice follows in its own order.
const KEY_POINTS = ["What happens next", "Who sees them", "You can change your mind"];

function ErrorLine({ message }: { message: string | null }) {
  return message ? (
    <p role="alert" className="text-sm text-red-600">
      {message}
    </p>
  ) : null;
}

/** The consent screen. The box starts unticked; nothing is asked or stored until it is ticked and "Continue" is pressed. */
export function ConsentForm({ kinds }: { kinds: readonly DocumentKind[] }) {
  const step = useAction();
  const [kind, setKind] = useState<DocumentKind>(kinds[0]);
  const [agreed, setAgreed] = useState(false);

  const keyPoints = KEY_POINTS.flatMap((label) => ID_CONSENT.points.filter((point) => point.label === label));
  const otherPoints = ID_CONSENT.points.filter((point) => !KEY_POINTS.includes(point.label));

  return (
    <div className="flex flex-col gap-5">
      <h2 className="text-lg font-semibold">{ID_CONSENT.title}</h2>
      <p className="text-zinc-700 dark:text-zinc-300">{ID_CONSENT.intro}</p>
      <dl className="flex flex-col gap-4 rounded-xl border border-brand bg-zinc-50 p-4 dark:bg-zinc-900">
        {keyPoints.map((point) => (
          <div key={point.label}>
            <dt className="font-semibold">{point.label}</dt>
            <dd className="text-zinc-800 dark:text-zinc-200">{point.text}</dd>
          </div>
        ))}
      </dl>
      <dl className="flex flex-col gap-4 text-sm">
        {otherPoints.map((point) => (
          <div key={point.label}>
            <dt className="font-semibold">{point.label}</dt>
            <dd className="text-zinc-700 dark:text-zinc-300">{point.text}</dd>
          </div>
        ))}
      </dl>
      <p className="text-sm text-zinc-700 dark:text-zinc-300">{ID_CONSENT.controller}</p>
      <p className="text-sm">
        <Link href="/legal/privacy" className="inline-flex min-h-11 items-center underline">
          Read the Privacy Policy
        </Link>
      </p>

      <fieldset className="flex flex-col gap-1">
        <legend className="text-sm font-medium">Which document will you show?</legend>
        {kinds.map((value) => (
          <label key={value} className="flex min-h-11 items-center gap-3 text-sm">
            <input type="radio" name="documentKind" value={value} checked={kind === value} onChange={() => setKind(value)} className="h-5 w-5" />
            {DOCUMENT_LABEL[value]}
          </label>
        ))}
      </fieldset>

      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" checked={agreed} onChange={(event) => setAgreed(event.target.checked)} className="mt-0.5 h-5 w-5 shrink-0" />
        <span>{ID_CONSENT.checkbox}</span>
      </label>

      <div className="flex flex-col gap-2">
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={!agreed || step.busy}
            aria-describedby="consent-next"
            className={CONSENT_BUTTON}
            onClick={() => void step.run(() => startCheckAction(kind, agreed))}
          >
            {ID_CONSENT.agree}
          </button>
          <Link href="/me/settings" className={CONSENT_BUTTON}>
            {ID_CONSENT.decline}
          </Link>
        </div>
        <p id="consent-next" className="text-sm text-zinc-600 dark:text-zinc-400">
          {agreed ? "Next you add two pictures." : "Tick the box above to continue."}
        </p>
      </div>
      <ErrorLine message={step.error} />
    </div>
  );
}

type Slot = "document" | "holding";
type SlotState = { status: "idle" | "uploading" | "done"; preview: string | null; error: string | null };

function PictureSlot({
  slot,
  title,
  help,
  alreadySaved,
  onUploaded,
  onFailed,
}: {
  slot: Slot;
  title: string;
  help: string;
  alreadySaved: boolean;
  onUploaded: () => void;
  onFailed: () => void;
}) {
  const [state, setState] = useState<SlotState>({ status: alreadySaved ? "done" : "idle", preview: null, error: null });
  const previewRef = useRef<string | null>(null);
  useEffect(
    () => () => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    },
    [],
  );

  async function choose(file: File | undefined) {
    if (!file) return;
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    // The preview is made here, in the browser. The app never sends an ID picture back.
    const preview = URL.createObjectURL(file);
    previewRef.current = preview;
    setState({ status: "uploading", preview, error: null });
    onFailed();
    try {
      const prepared = await preparePhoto(file);
      if (!prepared) throw new Error("Could not read that photo. Try another one.");
      const body = new FormData();
      body.set("photo", prepared, prepared === file ? file.name : "photo.jpg");
      const response = await fetch(`/api/verification/upload?slot=${slot}`, { method: "POST", body });
      const reply: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(reply && typeof reply === "object" && "error" in reply && typeof reply.error === "string" ? reply.error : "Could not upload the photo. Try again.");
      }
      setState({ status: "done", preview, error: null });
      onUploaded();
    } catch (error) {
      setState({ status: "idle", preview, error: error instanceof Error ? error.message : "Could not upload the photo. Try again." });
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
      <p className="font-medium">{title}</p>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">{help}</p>
      {state.preview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={state.preview} alt="" className="max-h-56 w-full rounded-lg object-contain" />
      ) : null}
      <p className="text-sm" aria-live="polite">
        {state.status === "uploading" ? "Uploading…" : state.status === "done" ? "Picture saved." : "Not added yet."}
      </p>
      <label className={`${BUTTON} cursor-pointer`}>
        {state.status === "done" ? "Choose another picture" : "Choose a picture"}
        <input
          type="file"
          accept="image/*"
          capture={slot === "holding" ? "user" : undefined}
          disabled={state.status === "uploading"}
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            void choose(file);
          }}
        />
      </label>
      <ErrorLine message={state.error} />
    </div>
  );
}

/** The two pictures, then "Send to the owner" once both are saved. */
export function UploadStep({ hasDocument, hasHolding }: { hasDocument: boolean; hasHolding: boolean }) {
  const [saved, setSaved] = useState<Record<Slot, boolean>>({ document: hasDocument, holding: hasHolding });
  const send = useAction();
  const mark = (slot: Slot, value: boolean) => setSaved((prev) => ({ ...prev, [slot]: value }));

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">Add your pictures</h2>
      <p className="text-sm text-zinc-700 dark:text-zinc-300">
        The pictures go to a private area that only the owner can open. You may cover your ID number.
      </p>
      <PictureSlot
        slot="document"
        title="1. Your ID"
        help="Your school ID or certificate of registration. Your name and school must be easy to read."
        alreadySaved={hasDocument}
        onUploaded={() => mark("document", true)}
        onFailed={() => mark("document", false)}
      />
      <PictureSlot
        slot="holding"
        title="2. You holding it"
        help="A photo of you holding the same document, with your face in the picture."
        alreadySaved={hasHolding}
        onUploaded={() => mark("holding", true)}
        onFailed={() => mark("holding", false)}
      />
      <button type="button" disabled={!saved.document || !saved.holding || send.busy} className={PRIMARY} onClick={() => void send.run(submitCheckAction)}>
        {send.busy ? "Sending…" : "Send to the owner"}
      </button>
      <ErrorLine message={send.error} />
    </div>
  );
}

/** Takes the consent back in one tap. */
export function WithdrawSection() {
  const step = useAction();
  return (
    <section className="flex flex-col gap-3 border-t border-zinc-200 pt-6 dark:border-zinc-800">
      <h2 className="text-lg font-semibold">{ID_CONSENT.withdrawTitle}</h2>
      <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-700 dark:text-zinc-300">
        {ID_CONSENT.withdrawPoints.map((point) => (
          <li key={point}>{point}</li>
        ))}
      </ul>
      <button type="button" disabled={step.busy} className={BUTTON} onClick={() => void step.run(withdrawConsentAction)}>
        {ID_CONSENT.withdrawButton}
      </button>
      <ErrorLine message={step.error} />
    </section>
  );
}
