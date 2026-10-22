"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useNavigate } from "@/components/pending-nav";
import { BottomSheet } from "@/components/bottom-sheet";
import { LISTED, LISTED_LABEL, SORT_LABEL, SORTS } from "@/lib/discovery/filters";
import { CONDITION_LABEL, CONDITIONS, PRICE_MAX } from "@/lib/posts/schema";

type Option = { id: string; name: string };

type Props = {
  /** The page the filters apply to, e.g. "/" or "/search". */
  action: string;
  categories: Option[];
  schools: Option[];
  /** What is chosen now, as the page's query-string values. */
  values: Record<string, string>;
  /** Query-string values to keep when filters change (the search words and tab). */
  keep: Record<string, string>;
  activeCount: number;
  /** "icon" is a small icon-only trigger with the count as a badge, for a tight toolbar. */
  variant?: "button" | "icon";
};

type Screen = "root" | "school" | "sort" | "kind" | "category" | "condition" | "price" | "listed";
type Price = { min?: number; max?: number };

const FILTER_KEYS = ["kind", "category", "condition", "min", "max", "school", "listed", "sort"];
// These can have several choices; they travel in the address as one comma-separated list.
const MULTI_KEYS = ["category", "condition", "school"];

// The slider runs from 0 to PRICE_TOP; its top end means "no upper limit".
const PRICE_TOP = 10_000;
const PRICE_STEP = 50;

const KINDS = [
  { value: "", label: "Showcase and Wishlist" },
  { value: "showcase", label: "Showcase (for sale or giveaway)" },
  { value: "wishlist", label: "Wishlist (looking for)" },
];
const SORT_OPTIONS = SORTS.map((value) => ({ value, label: SORT_LABEL[value] }));
const LISTED_OPTIONS = [{ value: "", label: "Any time" }, ...LISTED.map((value) => ({ value, label: LISTED_LABEL[value] }))];
const CONDITION_OPTIONS = CONDITIONS.map((id) => ({ id, name: CONDITION_LABEL[id] }));

const TITLE: Record<Screen, string> = {
  root: "Filters",
  school: "School",
  sort: "Sort by",
  kind: "Type",
  category: "Category",
  condition: "Condition",
  price: "Price",
  listed: "Date listed",
};

const hairline = "border-b border-zinc-200 dark:border-zinc-800";
const headerButton = "flex h-11 min-w-11 items-center rounded-lg text-base font-medium disabled:text-zinc-400 disabled:dark:text-zinc-600";

function list(values: Record<string, string>, key: string): string[] {
  return (values[key] ?? "").split(",").filter(Boolean);
}

function whole(text: string | undefined): number | undefined {
  return text !== undefined && /^\d{1,7}$/.test(text) ? Number(text) : undefined;
}

function peso(amount: number): string {
  return `₱${amount.toLocaleString("en-US")}`;
}

function priceSummary({ min, max }: Price): string {
  if (min !== undefined && max !== undefined) return `${peso(min)} to ${peso(max)}`;
  if (min !== undefined) return `${peso(min)} and up`;
  if (max !== undefined) return `Up to ${peso(max)}`;
  return "Any";
}

function pickedSummary(ids: string[], options: Option[]): string {
  if (ids.length === 0) return "Any";
  if (ids.length === 1) return options.find((o) => o.id === ids[0])?.name ?? "1 selected";
  return `${ids.length} selected`;
}

const SlidersIcon = ({ size }: { size: string }) => (
  <svg viewBox="0 0 24 24" className={size} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
    <path d="M4 7h10M18 7h2M4 17h2M10 17h10M14 5v4M6 15v4" />
  </svg>
);

/** The Filters button and the bottom sheet it opens. Applying changes the page's query string. */
export function FilterSheet({ action, categories, schools, values, keep, activeCount, variant = "button" }: Props) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  // Each opening starts from what the page has, so changes left unapplied are dropped.
  const [session, setSession] = useState(0);

  function show() {
    setSession((n) => n + 1);
    setOpen(true);
  }

  function apply(params: URLSearchParams) {
    const qs = params.toString();
    navigate(qs ? `${action}?${qs}` : action);
    setOpen(false);
  }

  return (
    <>
      {variant === "icon" ? (
        <button
          type="button"
          onClick={show}
          aria-haspopup="dialog"
          aria-label={activeCount > 0 ? `Filters, ${activeCount} active` : "Filters"}
          className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full active:opacity-80"
        >
          <SlidersIcon size="h-6 w-6" />
          {activeCount > 0 ? (
            <span aria-hidden className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-semibold text-white">
              {activeCount > 9 ? "9+" : activeCount}
            </span>
          ) : null}
        </button>
      ) : (
        <button type="button" onClick={show} aria-haspopup="dialog" className="flex h-11 shrink-0 items-center gap-2 rounded-lg border border-zinc-300 px-3 font-medium dark:border-zinc-700">
          <SlidersIcon size="h-5 w-5" />
          Filters{activeCount > 0 ? ` (${activeCount})` : ""}
        </button>
      )}

      <BottomSheet open={open} onOpenChange={setOpen} label="Filters">
        <FilterForm key={`${session}:${JSON.stringify(values)}`} keep={keep} values={values} categories={categories} schools={schools} onApply={apply} onClose={() => setOpen(false)} />
      </BottomSheet>
    </>
  );
}

type FormProps = Pick<Props, "categories" | "schools" | "values" | "keep"> & {
  onApply: (params: URLSearchParams) => void;
  onClose: () => void;
};

function FilterForm({ categories, schools, values, keep, onApply, onClose }: FormProps) {
  const [screen, setScreen] = useState<Screen>("root");
  const [sort, setSort] = useState(values.sort ?? "newest");
  const [kind, setKind] = useState(values.kind ?? "");
  const [listed, setListed] = useState(values.listed ?? "");
  const [category, setCategory] = useState(() => list(values, "category"));
  const [condition, setCondition] = useState(() => list(values, "condition"));
  const [school, setSchool] = useState(() => list(values, "school"));
  const [price, setPrice] = useState<Price>({ min: whole(values.min), max: whole(values.max) });

  // Focus follows the slide: the new screen's title, or the row that opened the screen when coming back.
  const opener = useRef<Screen>("root");
  const first = useRef(true);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const target = screen === "root" ? root.current?.querySelector<HTMLElement>(`[data-row="${opener.current}"]`) : document.getElementById(`filter-title-${screen}`);
    target?.focus({ preventScroll: true });
  }, [screen]);

  const dirty = sort !== "newest" || kind !== "" || listed !== "" || category.length + condition.length + school.length > 0 || price.min !== undefined || price.max !== undefined;

  function open(next: Screen) {
    opener.current = next;
    setScreen(next);
  }

  function back() {
    setScreen("root");
  }

  function resetAll() {
    setSort("newest");
    setKind("");
    setListed("");
    setCategory([]);
    setCondition([]);
    setSchool([]);
    setPrice({});
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const params = new URLSearchParams(keep);
    for (const key of FILTER_KEYS) {
      const value = MULTI_KEYS.includes(key) ? data.getAll(key).filter((v) => typeof v === "string" && v !== "").join(",") : data.get(key);
      if (typeof value === "string" && value !== "" && !(key === "sort" && value === "newest")) params.set(key, value);
    }
    onApply(params);
  }

  const rows: { screen: Exclude<Screen, "root">; value: string }[] = [
    { screen: "school", value: pickedSummary(school, schools) },
    { screen: "sort", value: SORT_LABEL[sort as keyof typeof SORT_LABEL] ?? "Newest first" },
    { screen: "kind", value: kind === "" ? "Any" : (KINDS.find((k) => k.value === kind)?.label.split(" (")[0] ?? "Any") },
    { screen: "category", value: pickedSummary(category, categories) },
    { screen: "condition", value: pickedSummary(condition, CONDITION_OPTIONS) },
    { screen: "price", value: priceSummary(price) },
    { screen: "listed", value: listed === "" ? "Any" : (LISTED_LABEL[listed as keyof typeof LISTED_LABEL] ?? "Any") },
  ];


  return (
    <form onSubmit={submit} className="relative h-[85dvh] min-h-0 max-h-full overflow-hidden">
      {/* What is chosen travels as hidden fields, so the address uses the same names as ever. */}
      <input type="hidden" name="sort" value={sort} />
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="listed" value={listed} />
      {category.map((id) => <input key={id} type="hidden" name="category" value={id} />)}
      {condition.map((id) => <input key={id} type="hidden" name="condition" value={id} />)}
      {school.map((id) => <input key={id} type="hidden" name="school" value={id} />)}
      {price.min !== undefined ? <input type="hidden" name="min" value={price.min} /> : null}
      {price.max !== undefined ? <input type="hidden" name="max" value={price.max} /> : null}

      <div ref={root} inert={screen !== "root"} className={`${layer} ${screen === "root" ? "" : "-translate-x-1/4"}`}>
        <div data-sheet-drag className={`grid shrink-0 touch-none grid-cols-[5rem_1fr_5rem] items-center px-2 ${hairline}`}>
          <button type="button" onClick={onClose} aria-label="Close filters" className="flex h-11 w-11 items-center justify-center rounded-full">
            <BackIcon />
          </button>
          <h2 id="filter-title-root" tabIndex={-1} className="text-center text-lg font-semibold outline-none">
            Filters
          </h2>
          <button type="button" onClick={resetAll} disabled={!dirty} className={`${headerButton} justify-end px-2`}>
            Reset all
          </button>
        </div>
        <ul className="min-h-0 flex-1 overflow-y-auto">
          {rows.map((row) => (
            <li key={row.screen} className={hairline}>
              <button type="button" data-row={row.screen} onClick={() => open(row.screen)} className="flex min-h-16 w-full items-center justify-between gap-3 px-4 py-2 text-left">
                <span className="flex min-w-0 flex-col">
                  <span className="text-base font-medium">{TITLE[row.screen]}</span>
                  <span className="truncate text-sm text-zinc-500">{row.value}</span>
                </span>
                <ChevronIcon />
              </button>
            </li>
          ))}
        </ul>
        <div className="shrink-0 border-t border-zinc-200 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 dark:border-zinc-800">
          <button type="submit" className="h-12 w-full rounded-lg bg-brand text-base font-semibold text-white active:opacity-90">
            Show
          </button>
        </div>
      </div>

      <SubScreen id="school" screen={screen} onBack={back} onReset={() => setSchool([])} canReset={school.length > 0}>
        <MultiChoice name="School" options={schools} picked={school} onChange={setSchool} empty="No schools yet." />
      </SubScreen>
      <SubScreen id="sort" screen={screen} onBack={back} onReset={() => setSort("newest")} canReset={sort !== "newest"}>
        <SingleChoice name="sort" options={SORT_OPTIONS} value={sort} onPick={setSort} onDone={back} />
      </SubScreen>
      <SubScreen id="kind" screen={screen} onBack={back} onReset={() => setKind("")} canReset={kind !== ""}>
        <SingleChoice name="kind-choice" options={KINDS} value={kind} onPick={setKind} onDone={back} />
      </SubScreen>
      <SubScreen id="category" screen={screen} onBack={back} onReset={() => setCategory([])} canReset={category.length > 0}>
        <MultiChoice name="Category" options={categories} picked={category} onChange={setCategory} empty="No categories yet." />
      </SubScreen>
      <SubScreen id="condition" screen={screen} onBack={back} onReset={() => setCondition([])} canReset={condition.length > 0}>
        <MultiChoice name="Condition" options={CONDITION_OPTIONS} picked={condition} onChange={setCondition} empty="" />
      </SubScreen>
      <SubScreen id="price" screen={screen} onBack={back} onReset={() => setPrice({})} canReset={price.min !== undefined || price.max !== undefined}>
        <PriceRange price={price} onChange={setPrice} />
      </SubScreen>
      <SubScreen id="listed" screen={screen} onBack={back} onReset={() => setListed("")} canReset={listed !== ""}>
        <SingleChoice name="listed-choice" options={LISTED_OPTIONS} value={listed} onPick={setListed} onDone={back} />
      </SubScreen>
    </form>
  );
}

const layer = "absolute inset-0 flex flex-col bg-[var(--background)] transition-transform duration-200 ease-out motion-reduce:transition-none";

function SubScreen({ id, screen, onBack, onReset, canReset, children }: { id: Exclude<Screen, "root">; screen: Screen; onBack: () => void; onReset: () => void; canReset: boolean; children: ReactNode }) {
  return (
    <div inert={screen !== id} className={`${layer} ${screen === id ? "" : "translate-x-full"}`}>
      <div data-sheet-drag className={`grid shrink-0 touch-none grid-cols-[5rem_1fr_5rem] items-center px-2 ${hairline}`}>
        <button type="button" onClick={onBack} aria-label="Back to filters" className="flex h-11 w-11 items-center justify-center rounded-full">
          <BackIcon />
        </button>
        <h2 id={`filter-title-${id}`} tabIndex={-1} className="text-center text-lg font-semibold outline-none">
          {TITLE[id]}
        </h2>
        <button type="button" onClick={onReset} disabled={!canReset} aria-label={`Reset ${TITLE[id].toLowerCase()}`} className={`${headerButton} justify-end px-2`}>
          Reset
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto pb-[env(safe-area-inset-bottom)]">{children}</div>
    </div>
  );
}

function BackIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M15 5l-7 7 7 7" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-zinc-500" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 5l7 7-7 7" />
    </svg>
  );
}

const choiceRow = `flex min-h-14 cursor-pointer items-center justify-between gap-3 px-4 py-2 text-base ${hairline}`;
const control = "h-5 w-5 shrink-0";

/** One answer; picking it goes back to the list. Arrow keys only move the choice, Enter confirms it. */
function SingleChoice({ name, options, value, onPick, onDone }: { name: string; options: { value: string; label: string }[]; value: string; onPick: (value: string) => void; onDone: () => void }) {
  return (
    <div role="radiogroup" aria-label={TITLE_FOR[name] ?? name}>
      {options.map((o) => (
        <label key={o.value} className={choiceRow} onClick={(event) => event.detail > 0 && onDone()}>
          {o.label}
          <input
            type="radio"
            name={name}
            className={control}
            checked={value === o.value}
            onChange={() => onPick(o.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                onPick(o.value);
                onDone();
              }
            }}
          />
        </label>
      ))}
    </div>
  );
}

const TITLE_FOR: Record<string, string> = { sort: "Sort by", "kind-choice": "Type", "listed-choice": "Date listed" };

/** Any number of answers; the list stays open. */
function MultiChoice({ name, options, picked, onChange, empty }: { name: string; options: Option[]; picked: string[]; onChange: (ids: string[]) => void; empty: string }) {
  if (options.length === 0) return <p className="px-4 py-4 text-sm text-zinc-500">{empty}</p>;
  return (
    <div role="group" aria-label={name}>
      <p className="px-4 py-2 text-sm text-zinc-500">Choose one or more. None chosen means any.</p>
      {options.map((o) => (
        <label key={o.id} className={choiceRow}>
          {o.name}
          <input type="checkbox" className={control} checked={picked.includes(o.id)} onChange={(event) => onChange(event.target.checked ? [...picked, o.id] : picked.filter((id) => id !== o.id))} />
        </label>
      ))}
    </div>
  );
}

const THUMB = [
  "pointer-events-none absolute inset-0 h-11 w-full appearance-none bg-transparent focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-brand-text",
  "[&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-11 [&::-webkit-slider-thumb]:w-11 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-8 [&::-webkit-slider-thumb]:border-solid [&::-webkit-slider-thumb]:border-transparent [&::-webkit-slider-thumb]:bg-brand [&::-webkit-slider-thumb]:bg-clip-padding [&::-webkit-slider-thumb]:shadow-[inset_0_0_0_3px_white]",
  "[&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-7 [&::-moz-range-thumb]:w-7 [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-brand [&::-moz-range-thumb]:shadow-[inset_0_0_0_3px_white]",
  "[&::-webkit-slider-runnable-track]:bg-transparent [&::-moz-range-track]:bg-transparent",
].join(" ");

const numberField = "h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 text-base text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50";

/** Two stacked range inputs make one two-thumb slider that keys and screen readers still work with. Untouched means no price filter. */
function PriceRange({ price, onChange }: { price: Price; onChange: (price: Price) => void }) {
  const lo = Math.min(price.min ?? 0, PRICE_TOP);
  const hi = Math.min(price.max ?? PRICE_TOP, PRICE_TOP);
  const unlimited = price.max === undefined || price.max >= PRICE_TOP;

  function typed(text: string): number | undefined {
    return text === "" ? undefined : Math.min(Math.max(0, Math.floor(Number(text)) || 0), PRICE_MAX);
  }

  // A lowest price above the highest one would match nothing, so swap them when a field is left.
  function order() {
    if (price.min !== undefined && price.max !== undefined && price.min > price.max) onChange({ min: price.max, max: price.min });
  }

  return (
    <div className="flex flex-col gap-5 px-4 py-5">
      <p className="text-center text-xl font-semibold" aria-live="polite">
        {peso(lo)} to {unlimited ? `${peso(PRICE_TOP)}+` : peso(hi)}
      </p>

      <div className="relative h-11">
        <div aria-hidden className="absolute inset-x-[22px] top-1/2 h-1 -translate-y-1/2 rounded-full bg-zinc-200 dark:bg-zinc-700">
          <div className="absolute inset-y-0 rounded-full bg-brand" style={{ left: `${(lo / PRICE_TOP) * 100}%`, right: `${100 - (hi / PRICE_TOP) * 100}%` }} />
        </div>
        <input
          type="range"
          min={0}
          max={PRICE_TOP}
          step={PRICE_STEP}
          value={lo}
          aria-label="Lowest price"
          aria-valuetext={peso(lo)}
          onChange={(event) => {
            const v = Math.min(Number(event.target.value), hi);
            onChange({ ...price, min: v > 0 ? v : undefined });
          }}
          className={`${THUMB} ${lo > PRICE_TOP / 2 ? "z-20" : "z-10"}`}
        />
        <input
          type="range"
          min={0}
          max={PRICE_TOP}
          step={PRICE_STEP}
          value={hi}
          aria-label="Highest price"
          aria-valuetext={unlimited ? `${peso(PRICE_TOP)} or more` : peso(hi)}
          onChange={(event) => {
            const v = Math.max(Number(event.target.value), lo);
            onChange({ ...price, max: v >= PRICE_TOP ? undefined : v });
          }}
          className={`${THUMB} ${lo > PRICE_TOP / 2 ? "z-10" : "z-20"}`}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm text-zinc-500">
          Lowest (₱)
          <input type="number" inputMode="numeric" min={0} step={1} placeholder="No minimum" value={price.min ?? ""} onChange={(event) => onChange({ ...price, min: typed(event.target.value) })} onBlur={order} className={numberField} />
        </label>
        <label className="flex flex-col gap-1 text-sm text-zinc-500">
          Highest (₱)
          <input type="number" inputMode="numeric" min={0} step={1} placeholder="No maximum" value={price.max ?? ""} onChange={(event) => onChange({ ...price, max: typed(event.target.value) })} onBlur={order} className={numberField} />
        </label>
      </div>
      <p className="text-sm text-zinc-500">Free posts count as ₱0. Posts with a negotiable price do not match a price range.</p>
    </div>
  );
}
