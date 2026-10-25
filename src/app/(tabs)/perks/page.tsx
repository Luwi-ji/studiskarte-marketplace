import { Suspense } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { requireActiveStudent } from "@/lib/access";
import { isPerkKind, limitLine, PERK_KINDS, perkKindLabel } from "@/lib/perks/kinds";
import { getOwnProfile } from "@/lib/identity/profile";
import { listPerks, perkFilterOptions } from "@/lib/perks/list";
import { limitReached, studentPerkState } from "@/lib/perks/voucher";
import { VoucherSheet } from "./voucher-sheet";

export const metadata = { title: "Perks · Studiskarte Marketplace" };

const dateFormat = new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeZone: "Asia/Manila" });

export default function PerksPage({ searchParams }: PageProps<"/perks">) {
  return (
    <>
      <PageHeader title="Perks" logo />
      <main className="mx-auto w-full max-w-md flex-1 px-3 py-3">
        <Suspense fallback={<p className="p-4 text-zinc-500">Loading…</p>}>
          <Perks searchParams={searchParams} />
        </Suspense>
      </main>
    </>
  );
}

function href(kind: string | undefined, area: string | undefined): string {
  const query = new URLSearchParams();
  if (kind) query.set("kind", kind);
  if (area) query.set("area", area);
  const text = query.toString();
  return text ? `/perks?${text}` : "/perks";
}

function Chip({ to, active, children }: { to: string; active: boolean; children: string }) {
  return (
    <Link
      href={to}
      replace
      aria-current={active ? "true" : undefined}
      className={`flex h-11 shrink-0 items-center rounded-full border px-4 text-sm ${active ? "border-transparent bg-brand font-medium text-white" : "border-zinc-300 dark:border-zinc-700"}`}
    >
      {children}
    </Link>
  );
}

async function Perks({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const me = await requireActiveStudent();
  const raw = await searchParams;
  const kindParam = typeof raw.kind === "string" ? raw.kind : undefined;
  const kind = isPerkKind(kindParam) ? kindParam : undefined;
  const area = typeof raw.area === "string" && raw.area ? raw.area : undefined;

  const [options, perks, profile] = await Promise.all([perkFilterOptions(me.schoolDomain), listPerks(me.schoolDomain, { kind, area }), getOwnProfile(me.id)]);
  const states = await studentPerkState(me.id, perks);
  const kinds = PERK_KINDS.filter((k) => options.kinds.includes(k.id));
  const filtered = kind !== undefined || area !== undefined;

  return (
    <div className="flex flex-col gap-3">
      <p className="px-1 text-sm text-zinc-600 dark:text-zinc-400">Discounts from shops near campus, for members of your school.</p>

      {kinds.length > 1 ? (
        <nav aria-label="Kind" className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1">
          <Chip to={href(undefined, area)} active={!kind}>
            All
          </Chip>
          {kinds.map((k) => (
            <Chip key={k.id} to={href(k.id, area)} active={kind === k.id}>
              {k.label}
            </Chip>
          ))}
        </nav>
      ) : null}
      {options.areas.length > 1 ? (
        <nav aria-label="Area" className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1">
          <Chip to={href(kind, undefined)} active={!area}>
            Any area
          </Chip>
          {options.areas.map((a) => (
            <Chip key={a} to={href(kind, a)} active={area === a}>
              {a}
            </Chip>
          ))}
        </nav>
      ) : null}

      {perks.length === 0 ? (
        <div className="flex flex-col items-center gap-4 px-6 py-14 text-center">
          <p className="text-zinc-600 dark:text-zinc-400">
            {filtered ? "No perks match these filters." : "No perks near your school yet. Partner shops are being added."}
          </p>
          {filtered ? (
            <Link href="/perks" replace className="flex h-11 items-center rounded-full border border-zinc-300 px-5 text-sm font-medium dark:border-zinc-700">
              Clear filters
            </Link>
          ) : (
            <Link href="/" className="flex h-12 items-center rounded-full bg-brand px-6 font-medium text-white">
              Browse the feed
            </Link>
          )}
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {perks.map((p) => {
            const limit = limitLine(p.limitPerStudent, p.limitPeriod);
            const state = states.get(p.id) ?? { open: null, used: 0 };
            const open = state.open;
            return (
              <li key={p.id} className="flex flex-col gap-1 rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
                <p className="text-sm text-zinc-500">
                  {p.partnerName} · {perkKindLabel(p.kind)}
                </p>
                <h2 className="text-base font-semibold leading-snug">{p.title}</h2>
                <p className="text-sm text-zinc-700 dark:text-zinc-300">{p.terms}</p>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  {[p.area, limit, p.left !== null ? `${p.left} left` : null, p.endsAt ? `Until ${dateFormat.format(p.endsAt)}` : null].filter(Boolean).join(" · ")}
                </p>
                {p.claimable ? (
                  <div className="pt-1">
                    {me.schoolDomain === null ? (
                      <Link href="/me/settings/school-email" className="flex h-11 w-full items-center justify-center rounded-full border border-zinc-300 text-sm font-semibold dark:border-zinc-700">
                        Verify school email to claim
                      </Link>
                    ) : (
                      <VoucherSheet
                        perk={{ id: p.id, title: p.title, partnerName: p.partnerName }}
                        studentName={profile?.displayName ?? ""}
                        handle={profile?.handle ?? me.handle}
                        open={open ? { id: open.id, code: open.code, expiresAt: open.expiresAt.toISOString() } : null}
                        label={open ? "Show voucher" : "Claim"}
                        disabledReason={open ? null : p.left === 0 ? "All claimed" : limitReached(p.limitPerStudent, p.limitPeriod, state.used)}
                      />
                    )}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
