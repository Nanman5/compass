"use client";

/**
 * WeeklyDrop — the live "This week for {child}" card.
 *
 * The product version of the landing's weekly-drop mockup (public/img/feature-weekly.png):
 * a glass card listing three pieces of guidance tailored to this child — a STUDY, a TIP,
 * and an ACTIVITY — each in a tinted, rounded icon chip with its kind label and a one-line
 * body. The data comes live from GET /api/weekly; this component is purely presentational
 * (loading / error / drop states), so the page owns familyId resolution and fetching.
 *
 * Style: cream + drifting aurora + wet-glass surface (see globals.css), Fraunces display
 * serif for headings, Nunito body. Motion is decorative and disabled under reduced-motion.
 */

import { CompassStar } from "@/components/CompassStar";
import { Icon, type IconName } from "@/components/Icon";

/* ─────────────────────────────── data shape (mirrors GET /api/weekly) */

export type WeeklyKind = "study" | "tip" | "activity";

export interface WeeklyItem {
  kind: WeeklyKind;
  title: string;
  body: string;
}

export interface WeeklyDropData {
  childName: string;
  items: WeeklyItem[];
}

/* ─────────────────────────────── per-kind presentation
   Matches the landing mockup: sage book (STUDY), coral bulb (TIP), gold shield (ACTIVITY).
   `tint` is the chip background, `ink` the icon + label color. */
const KIND_STYLE: Record<WeeklyKind, { label: string; icon: IconName; tint: string; ink: string }> = {
  study: { label: "Study", icon: "book", tint: "rgba(143, 176, 154, 0.22)", ink: "var(--color-sage)" },
  tip: { label: "Tip", icon: "bulb", tint: "rgba(225, 120, 92, 0.18)", ink: "var(--color-coral)" },
  activity: { label: "Activity", icon: "shield", tint: "rgba(230, 181, 102, 0.22)", ink: "var(--color-gold)" },
};

/** Human-friendly current date for the card's subtle dateline (e.g. "June 16"). */
function today(): string {
  return new Date().toLocaleDateString("en-US", { month: "long", day: "numeric" });
}

/* ─────────────────────────────── the card */

export function WeeklyDropCard({ data }: { data: WeeklyDropData }) {
  return (
    <article className="glass relative w-full max-w-xl rounded-[1.75rem] p-7 sm:p-9">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow text-sage">Weekly drop</p>
          <h1 className="mt-1.5 text-3xl sm:text-[2.1rem] font-semibold leading-tight text-teal">
            This week for {data.childName}
          </h1>
        </div>
        <time className="shrink-0 pt-1 text-sm font-semibold text-muted">{today()}</time>
      </header>

      <ul className="mt-7 space-y-5">
        {data.items.map((item) => (
          <WeeklyRow key={item.kind} item={item} />
        ))}
      </ul>

      <footer className="mt-7 flex items-center gap-2 border-t border-teal/10 pt-4 text-xs text-muted">
        <CompassStar size={16} />
        <span>Matched to your family from trusted, evidence-based sources.</span>
      </footer>
    </article>
  );
}

function WeeklyRow({ item }: { item: WeeklyItem }) {
  const style = KIND_STYLE[item.kind];
  return (
    <li className="flex items-start gap-4">
      <span
        className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl"
        style={{ background: style.tint, color: style.ink }}
        aria-hidden="true"
      >
        <Icon name={style.icon} size={24} />
      </span>
      <div className="min-w-0 pt-0.5">
        <p
          className="text-xs font-bold uppercase tracking-[0.1em]"
          style={{ color: style.ink }}
        >
          {style.label}
        </p>
        <p className="mt-1 font-semibold leading-snug text-teal">{item.title}</p>
        <p className="mt-0.5 text-[0.95rem] leading-relaxed text-ink/75">{item.body}</p>
      </div>
    </li>
  );
}

/* ─────────────────────────────── loading + error skeletons */

export function WeeklyDropSkeleton() {
  return (
    <article className="glass relative w-full max-w-xl rounded-[1.75rem] p-7 sm:p-9" aria-busy="true">
      <div className="flex items-start justify-between gap-4">
        <div className="w-full">
          <div className="h-3 w-24 rounded-full bg-teal/10" />
          <div className="mt-3 h-8 w-3/4 rounded-lg bg-teal/10" />
        </div>
        <div className="h-3 w-12 rounded-full bg-teal/10" />
      </div>
      <ul className="mt-7 space-y-5">
        {[0, 1, 2].map((i) => (
          <li key={i} className="flex items-start gap-4">
            <span className="h-12 w-12 shrink-0 rounded-2xl bg-teal/10" />
            <div className="w-full pt-1">
              <div className="h-2.5 w-16 rounded-full bg-teal/10" />
              <div className="mt-2.5 h-3.5 w-2/3 rounded-full bg-teal/10" />
              <div className="mt-2 h-3 w-full rounded-full bg-teal/[0.07]" />
            </div>
          </li>
        ))}
      </ul>
    </article>
  );
}

export function WeeklyDropError({ onRetry }: { onRetry: () => void }) {
  return (
    <article className="glass relative w-full max-w-xl rounded-[1.75rem] p-9 text-center">
      <CompassStar size={28} className="mx-auto" />
      <h1 className="mt-4 text-2xl font-semibold text-teal">This week&apos;s drop didn&apos;t load</h1>
      <p className="mt-2 text-sm leading-relaxed text-ink/70">
        Something hiccuped on our end. Give it another try.
      </p>
      <button onClick={onRetry} className="btn btn-primary mt-6">
        Try again
      </button>
    </article>
  );
}
