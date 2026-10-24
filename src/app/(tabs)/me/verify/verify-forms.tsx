"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useAction } from "@/app/safety/use-action";
import { ConfirmSheet } from "@/components/confirm-sheet";
import { SettingsRow, SettingsSection } from "@/components/settings-list";
import { preparePhoto } from "@/lib/images/prepare-photo";
import { DOCUMENT_LABEL, type DocumentKind } from "@/lib/verification/config";
import { ID_CONSENT } from "@/lib/verification/consent";
import { startCheckAction, submitCheckAction, withdrawConsentAction } from "./actions";

const BUTTON = "flex h-11 w-full items-center justify-center rounded-lg border border-zinc-400 text-sm font-medium disabled:opacity-50 dark:border-zinc-600";
// Previous and Next sit side by side at the same size. Disabled is a flat grey button, never a faint outline.
const PREVIOUS =
  "flex h-12 w-full items-center justify-center rounded-lg border-2 border-zinc-500 text-base font-medium dark:border-zinc-400";
const NEXT =
  "flex h-12 w-full items-center justify-center rounded-lg bg-brand text-base font-medium text-white disabled:bg-zinc-200 disabled:text-zinc-600 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-400";
// The promises a person most needs, in this order: deletion first. Anything else in the notice follows in its own order.
const KEY_POINTS = ["What happens next", "Who sees them", "You can change your mind"];

const STEP_NAMES = ["Consent", "ID picture", "Photo holding it", "Review and send"] as const;

function ErrorLine({ message }: { message: string | null }) {
  return message ? (
    <p role="alert" className="text-sm text-red-600 dark:text-red-400">
      {message}
    </p>
  ) : null;
}

type Slot = "document" | "holding";
type SlotState = { status: "idle" | "uploading" | "done"; preview: string | null; error: string | null };
type Picture = { slot: Slot; state: SlotState; choose: (file: File | undefined) => Promise<void> };

/** One picture's upload state. It lives in the wizard, so going back and forth between steps keeps what was already added. */
function usePicture(slot: Slot, alreadySaved: boolean): Picture {
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
    } catch (error) {
      setState({ status: "idle", preview, error: error instanceof Error ? error.message : "Could not upload the photo. Try again." });
    }
  }

  return { slot, state, choose };
}

function PictureSlot({ picture, title, help }: { picture: Picture; title: string; help: string }) {
  const { slot, state, choose } = picture;
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

/** "Step 2 of 4", the step's name and a bar. */
function Progress({ step }: { step: number }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
          Step {step} of {STEP_NAMES.length}
        </p>
        <p className="min-w-0 truncate text-sm font-semibold">{STEP_NAMES[step - 1]}</p>
      </div>
      <div
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={STEP_NAMES.length}
        aria-valuenow={step}
        aria-valuetext={`Step ${step} of ${STEP_NAMES.length}: ${STEP_NAMES[step - 1]}`}
        className="h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800"
      >
        <div className="h-full rounded-full bg-brand transition-[width]" style={{ width: `${(step / STEP_NAMES.length) * 100}%` }} />
      </div>
    </div>
  );
}

/** Previous and Next, then the plain reason when Next is off, then any error. */
function StepNav({ previous, next, reason, error }: { previous: ReactNode; next: ReactNode; reason: string | null; error: string | null }) {
  return (
    <div className="flex flex-col gap-2 pt-1">
      <div className="grid grid-cols-2 gap-2">
        {previous}
        {next}
      </div>
      {reason ? (
        <p id="step-reason" className="text-sm text-zinc-600 dark:text-zinc-400">
          {reason}
        </p>
      ) : null}
      <ErrorLine message={error} />
    </div>
  );
}

type Draft = { documentKind: DocumentKind; hasDocument: boolean; hasHolding: boolean };

/**
 * The ID check as four steps: consent, the ID, the photo holding it, review and send. `draft` is the check already started
 * (consent given), or null. The page keys this by the draft, so it starts afresh when a draft is opened or closed.
 */
export function VerifyWizard({ kinds, draft, notice }: { kinds: readonly DocumentKind[]; draft: Draft | null; notice?: ReactNode }) {
  const [step, setStep] = useState(() => (!draft ? 1 : !draft.hasDocument ? 2 : !draft.hasHolding ? 3 : 4));
  const [kind, setKind] = useState<DocumentKind>(draft?.documentKind ?? kinds[0]);
  // The consent is already given once a draft exists: the box shows ticked and cannot be changed.
  const [agreed, setAgreed] = useState(draft !== null);
  const documentPicture = usePicture("document", draft?.hasDocument ?? false);
  const holdingPicture = usePicture("holding", draft?.hasHolding ?? false);
  const start = useAction();
  const send = useAction();

  const documentSaved = documentPicture.state.status === "done";
  const holdingSaved = holdingPicture.state.status === "done";
  const previous = (to: number) => (
    <button type="button" className={PREVIOUS} onClick={() => setStep(to)}>
      Previous
    </button>
  );

  return (
    <div className="flex flex-col gap-5">
      <Progress step={step} />

      {step === 1 ? (
        <ConsentStep
          kinds={kinds}
          kind={kind}
          onKind={setKind}
          agreed={agreed}
          onAgreed={setAgreed}
          locked={draft !== null}
          notice={notice}
          nav={
            <StepNav
              previous={
                <Link href="/me/settings" className={PREVIOUS}>
                  {ID_CONSENT.decline}
                </Link>
              }
              next={
                <button
                  type="button"
                  disabled={!agreed || start.busy}
                  aria-describedby="step-reason"
                  className={NEXT}
                  onClick={() => (draft ? setStep(2) : void start.run(() => startCheckAction(kind, agreed)))}
                >
                  Next
                </button>
              }
              reason={draft ? "You agreed when you started. Your pictures stay as they are." : agreed ? "Next you add a picture of your ID." : "Tick the box above to continue."}
              error={start.error}
            />
          }
        />
      ) : null}

      {step === 2 ? (
        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">Picture of your ID</h2>
          <p className="text-sm text-zinc-700 dark:text-zinc-300">The picture goes to a private area that only the owner can open. You may cover your ID number.</p>
          <PictureSlot picture={documentPicture} title="Your ID" help="Your school ID or certificate of registration. Your name and school must be easy to read." />
          <StepNav
            previous={previous(1)}
            next={
              <button type="button" disabled={!documentSaved} aria-describedby="step-reason" className={NEXT} onClick={() => setStep(3)}>
                Next
              </button>
            }
            reason={documentSaved ? null : documentPicture.state.status === "uploading" ? "Wait for the picture to finish uploading." : "Add the picture of your ID to continue."}
            error={null}
          />
        </section>
      ) : null}

      {step === 3 ? (
        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">Photo of you holding it</h2>
          <p className="text-sm text-zinc-700 dark:text-zinc-300">This photo goes to the same private area. It shows the owner that the ID is yours.</p>
          <PictureSlot picture={holdingPicture} title="You holding your ID" help="A photo of you holding the same document, with your face in the picture." />
          <StepNav
            previous={previous(2)}
            next={
              <button type="button" disabled={!holdingSaved} aria-describedby="step-reason" className={NEXT} onClick={() => setStep(4)}>
                Next
              </button>
            }
            reason={holdingSaved ? null : holdingPicture.state.status === "uploading" ? "Wait for the photo to finish uploading." : "Add the photo of you holding your ID to continue."}
            error={null}
          />
        </section>
      ) : null}

      {step === 4 ? (
        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">Review and send</h2>
          <p className="text-sm text-zinc-700 dark:text-zinc-300">Check that your name and school can be read and that your face is in the photo. Tap a row to change it.</p>
          <div className="-mx-4">
            <SettingsSection label="Your check">
              <SettingsRow label="Document" description={DOCUMENT_LABEL[kind]} plain />
              <SettingsRow
                label="Picture of your ID"
                value={documentSaved ? "Added" : "Missing"}
                icon={<Thumb src={documentPicture.state.preview} />}
                onClick={() => setStep(2)}
              />
              <SettingsRow
                label="Photo holding it"
                value={holdingSaved ? "Added" : "Missing"}
                icon={<Thumb src={holdingPicture.state.preview} />}
                onClick={() => setStep(3)}
              />
            </SettingsSection>
          </div>
          <dl className="flex flex-col gap-1 rounded-xl border border-brand bg-zinc-50 p-4 dark:bg-zinc-900">
            {ID_CONSENT.points
              .filter((point) => point.label === "What happens next")
              .map((point) => (
                <div key={point.label}>
                  <dt className="font-semibold">{point.label}</dt>
                  <dd className="text-sm text-zinc-800 dark:text-zinc-200">{point.text}</dd>
                </div>
              ))}
          </dl>
          <StepNav
            previous={previous(3)}
            next={
              <button type="button" disabled={!documentSaved || !holdingSaved || send.busy} aria-describedby="step-reason" className={NEXT} onClick={() => void send.run(submitCheckAction)}>
                {send.busy ? "Sending…" : "Send to the owner"}
              </button>
            }
            reason={documentSaved && holdingSaved ? null : "Add both pictures first."}
            error={send.error}
          />
        </section>
      ) : null}
    </div>
  );
}

/** A small preview of a picture added in this visit; a grey tile when there is none (a picture added earlier is never sent back). */
function Thumb({ src }: { src: string | null }) {
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" className="h-11 w-11 shrink-0 rounded-lg object-cover" />
  ) : (
    <span aria-hidden className="h-11 w-11 shrink-0 rounded-lg bg-zinc-100 dark:bg-zinc-800" />
  );
}

/** Step 1: the notice, the choice of document and the box. Nothing is asked or stored until the box is ticked and Next is pressed. */
function ConsentStep({
  kinds,
  kind,
  onKind,
  agreed,
  onAgreed,
  locked,
  notice,
  nav,
}: {
  kinds: readonly DocumentKind[];
  kind: DocumentKind;
  onKind: (kind: DocumentKind) => void;
  agreed: boolean;
  onAgreed: (agreed: boolean) => void;
  locked: boolean;
  notice?: ReactNode;
  nav: ReactNode;
}) {
  const keyPoints = KEY_POINTS.flatMap((label) => ID_CONSENT.points.filter((point) => point.label === label));
  const otherPoints = ID_CONSENT.points.filter((point) => !KEY_POINTS.includes(point.label));

  return (
    <div className="flex flex-col gap-5">
      {notice}
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
        <legend className="pb-1 text-sm font-medium">Which document will you show?</legend>
        <div className="divide-y divide-zinc-200 rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {kinds.map((value) => (
            <label key={value} className="flex min-h-12 items-center gap-3 px-3 py-2 text-sm">
              <input type="radio" name="documentKind" value={value} checked={kind === value} disabled={locked} onChange={() => onKind(value)} className="h-5 w-5 shrink-0" />
              {DOCUMENT_LABEL[value]}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" checked={agreed} disabled={locked} onChange={(event) => onAgreed(event.target.checked)} className="mt-0.5 h-5 w-5 shrink-0" />
        <span>{ID_CONSENT.checkbox}</span>
      </label>

      {nav}
    </div>
  );
}

/**
 * Takes the consent back, behind a confirmation. What it does (service withdrawConsent): closes any open check and deletes
 * its pictures, takes the ID checked badge off, and writes the withdrawal down. The copy below says exactly that, by state.
 */
export function WithdrawSection({ state }: { state: "approved" | "pending" | "draft" }) {
  const step = useAction();
  const [open, setOpen] = useState(false);
  const approved = state === "approved";
  const label = approved ? "Remove my ID check" : "Cancel my ID check";

  return (
    <div className="-mx-4 border-t-8 border-zinc-100 dark:border-zinc-900">
      <SettingsSection
        label={approved ? "Remove your ID check" : "Stop your ID check"}
        note={
          approved
            ? "This takes the ID checked badge off your profile. Your pictures were already deleted when the owner decided, so there is nothing more to delete. We keep a record that you removed the check. You can ask for a new check later."
            : state === "pending"
              ? "This deletes your pictures now and stops the check, so the owner will not decide on it. You can start again later."
              : "This deletes any pictures you added and stops the check. You can start again later."
        }
      >
        <SettingsRow
          label={label}
          description={approved ? "Takes off your ID checked badge" : "Deletes your pictures and stops the check"}
          danger
          onClick={() => setOpen(true)}
        />
      </SettingsSection>
      <ConfirmSheet
        open={open}
        onOpenChange={setOpen}
        title={approved ? "Remove your ID check?" : "Cancel your ID check?"}
        confirmLabel={step.busy ? "Working…" : label}
        cancelLabel={approved ? "Keep my badge" : "Keep my check"}
        onConfirm={() => void step.run(withdrawConsentAction, () => setOpen(false))}
        busy={step.busy}
        error={step.error}
        danger
      >
        <ul className="list-disc space-y-1 pl-5">
          {approved ? (
            <>
              <li>Your ID checked badge comes off your profile now.</li>
              <li>Your pictures are already deleted. We keep only the owner&apos;s decision and a record that you agreed and then removed the check.</li>
              <li>Without the badge you can have one open showcase listing at a time.</li>
              <li>You can ask for a new check later.</li>
            </>
          ) : (
            <>
              <li>{state === "pending" ? "Your pictures are deleted now and the owner will not see them." : "Any pictures you added are deleted now."}</li>
              <li>The check stops. Nothing else about your account changes.</li>
              <li>This also takes back your agreement. We keep a record that you agreed and then cancelled.</li>
              <li>You can start a new check later.</li>
            </>
          )}
        </ul>
      </ConfirmSheet>
    </div>
  );
}
