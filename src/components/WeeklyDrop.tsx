"use client";

/**
 * WeeklyDrop — "This week's drop", presented as a readable, magazine-style screen.
 *
 * The data is the same live, evidence-grounded drop from GET /api/weekly: three pieces of
 * guidance for ONE child — a STUDY, a TIP, and an ACTIVITY. Here it's laid out like a small
 * weekly magazine rather than a list:
 *   • a FEATURED hero card — the first item shown large, over a warm illustrated header;
 *   • a "More for you" rail — the remaining items as horizontal glass cards with a thumbnail.
 *
 * Purely presentational (loading / error / drop states); the page owns familyId + fetching.
 * Style follows the product design system (see HomeDashboard.tsx / globals.css): cream glass,
 * Fraunces display serif for headings, teal headings, ink/70 body, coral accents.
 */

import Image from "next/image";

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
   `label` is a friendly read-flavored tag (not the raw kind); `icon`/`tint`/`ink` color the
   little kind chip on the rail cards. Sage book (STUDY), coral bulb (TIP), gold shield (TO TRY). */
const KIND_STYLE: Record<
  WeeklyKind,
  { label: string; icon: IconName; tint: string; ink: string }
> = {
  study: { label: "Insight", icon: "book", tint: "rgba(143, 176, 154, 0.22)", ink: "var(--color-sage)" },
  tip: { label: "Quick tip", icon: "bulb", tint: "rgba(225, 120, 92, 0.18)", ink: "var(--color-coral)" },
  activity: { label: "To try", icon: "shield", tint: "rgba(230, 181, 102, 0.24)", ink: "var(--color-gold)" },
};

/** Thumbnails for the "More for you" rail, cycled so each card gets a distinct illustration. */
const RAIL_THUMBS = ["/img/dash-stilllife.png", "/img/dash-plant.png"] as const;

/** The illustrated header behind the featured hero. */
const HERO_IMAGE = "/img/dashboard-banner.png";

/** Human-friendly current date for the dateline (e.g. "June 21"). */
function today(): string {
  return new Date().toLocaleDateString("en-US", { month: "long", day: "numeric" });
}

/* ─────────────────────────────── the drop */

export function WeeklyDropCard({ data }: { data: WeeklyDropData }) {
  const [featured, ...rest] = data.items;
  if (!featured) return null;

  return (
    <div className="w-full space-y-7">
      {/* masthead */}
      <header>
        <p className="eyebrow text-coral">This week&apos;s drop</p>
        <h1 className="mt-1 text-[2rem] font-semibold leading-[1.08] text-teal sm:text-[2.4rem]">
          For {data.childName}
        </h1>
        <p className="mt-2 text-[0.98rem] leading-relaxed text-ink/65">
          A few small, evidence-based reads chosen for {data.childName} this week.
        </p>
      </header>

      {/* featured hero */}
      <FeaturedCard item={featured} childName={data.childName} />

      {/* more for you */}
      {rest.length > 0 && (
        <section className="space-y-3.5">
          <div className="flex items-baseline justify-between">
            <h2 className="text-[1.15rem] font-semibold text-teal">More for you</h2>
            <time className="text-xs font-semibold text-muted">{today()}</time>
          </div>
          <ul className="space-y-3.5">
            {rest.map((item, i) => (
              <RailCard key={item.kind} item={item} thumb={RAIL_THUMBS[i % RAIL_THUMBS.length]} />
            ))}
          </ul>
        </section>
      )}

      {/* provenance */}
      <footer className="flex items-center gap-2 px-1 text-xs leading-relaxed text-muted">
        <span className="text-sage">
          <Icon name="loop" size={15} />
        </span>
        <span>Matched to your family from trusted, evidence-based sources.</span>
      </footer>
    </div>
  );
}

/** The first item, rendered large over a warm illustrated header. */
function FeaturedCard({ item, childName }: { item: WeeklyItem; childName: string }) {
  const style = KIND_STYLE[item.kind];
  return (
    <article className="glass overflow-hidden rounded-[1.6rem]">
      <div className="relative aspect-[16/10] w-full sm:aspect-[2/1]">
        <Image
          src={HERO_IMAGE}
          alt=""
          fill
          priority
          sizes="(min-width: 768px) 42rem, 100vw"
          className="object-cover"
        />
        {/* soft bottom scrim so the FEATURED pill always reads */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: "linear-gradient(to top, rgba(30,77,74,0.35), transparent 52%)" }}
          aria-hidden="true"
        />
        <span className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-coral px-3 py-1 text-[0.62rem] font-bold uppercase tracking-[0.14em] text-white shadow-[var(--shadow-soft)]">
          Featured
        </span>
      </div>

      <div className="p-5 sm:p-6">
        <p className="text-[0.72rem] font-bold uppercase tracking-[0.12em] text-ink/45">
          {style.label} · for {childName}
        </p>
        <h3
          className="mt-2 text-[1.5rem] font-semibold leading-[1.12] text-teal sm:text-[1.7rem]"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {item.title}
        </h3>
        <p className="mt-2.5 text-[0.98rem] leading-relaxed text-ink/75">{item.body}</p>
      </div>
    </article>
  );
}

/** A horizontal glass card: thumbnail + kind chip + title + one-line body. */
function RailCard({ item, thumb }: { item: WeeklyItem; thumb: string }) {
  const style = KIND_STYLE[item.kind];
  return (
    <li>
      <article className="glass flex items-center gap-4 rounded-[1.4rem] p-3.5 sm:p-4">
        <div className="relative h-[4.6rem] w-[4.6rem] shrink-0 overflow-hidden rounded-[1.1rem] sm:h-[5.2rem] sm:w-[5.2rem]">
          <Image
            src={thumb}
            alt=""
            fill
            sizes="5.2rem"
            className="object-cover"
          />
        </div>
        <div className="min-w-0 flex-1">
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[0.62rem] font-bold uppercase tracking-[0.1em]"
            style={{ background: style.tint, color: style.ink }}
          >
            <Icon name={style.icon} size={12} />
            {style.label}
          </span>
          <h3 className="mt-1.5 truncate text-[1.02rem] font-semibold leading-snug text-teal">
            {item.title}
          </h3>
          <p className="mt-0.5 line-clamp-2 text-[0.88rem] leading-relaxed text-ink/65">
            {item.body}
          </p>
        </div>
      </article>
    </li>
  );
}

/* ─────────────────────────────── loading + error states */

export function WeeklyDropSkeleton() {
  return (
    <div className="w-full space-y-7" aria-busy="true">
      <div>
        <div className="h-3 w-28 rounded-full bg-teal/10" />
        <div className="mt-3 h-9 w-44 rounded-lg bg-teal/10" />
        <div className="mt-3 h-3 w-3/4 rounded-full bg-teal/[0.07]" />
      </div>

      <div className="glass overflow-hidden rounded-[1.6rem]">
        <div className="aspect-[16/10] w-full bg-teal/[0.06] sm:aspect-[2/1]" />
        <div className="space-y-3 p-5 sm:p-6">
          <div className="h-2.5 w-32 rounded-full bg-teal/10" />
          <div className="h-6 w-2/3 rounded-lg bg-teal/10" />
          <div className="h-3 w-full rounded-full bg-teal/[0.07]" />
        </div>
      </div>

      <div className="space-y-3.5">
        <div className="h-5 w-32 rounded-full bg-teal/10" />
        {[0, 1].map((i) => (
          <div key={i} className="glass flex items-center gap-4 rounded-[1.4rem] p-3.5 sm:p-4">
            <div className="h-[4.6rem] w-[4.6rem] shrink-0 rounded-[1.1rem] bg-teal/[0.06] sm:h-[5.2rem] sm:w-[5.2rem]" />
            <div className="w-full space-y-2">
              <div className="h-2.5 w-16 rounded-full bg-teal/10" />
              <div className="h-3.5 w-2/3 rounded-full bg-teal/10" />
              <div className="h-3 w-full rounded-full bg-teal/[0.07]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function WeeklyDropError({ onRetry }: { onRetry: () => void }) {
  return (
    <article className="glass mx-auto w-full max-w-md rounded-[1.6rem] p-8 text-center">
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-sage-soft/60 text-teal">
        <Icon name="feed" size={24} />
      </span>
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
