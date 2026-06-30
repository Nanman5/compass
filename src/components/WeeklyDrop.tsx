"use client";

/**
 * WeeklyDrop — "This week's drop", presented as a readable, magazine-style screen.
 *
 * The data is the synthesized, evidence-grounded drop from GET /api/weekly: a headline + short
 * synthesis tied to THIS family's situation, three items (a STUDY insight, a TIP, an ACTIVITY),
 * a generated infographic, and the list of REAL studies it was woven from. Laid out like a small
 * weekly magazine:
 *   • a FEATURED hero card — the synthesized insight over the (generated) illustrated header;
 *   • action affordances — "Convert into a podcast" / "Create infographics" (visual for now);
 *   • a "More for you" rail — the tip + activity as horizontal glass cards;
 *   • "The research behind this" — the real studies, each linkable.
 *
 * Purely presentational; the page owns familyId, fetching, and the past-drops archive.
 * Style follows the product design system (globals.css): cream glass, Fraunces display serif,
 * teal headings, ink/70 body, coral accents.
 */

import Image from "next/image";
import Link from "next/link";

import { Icon, type IconName } from "@/components/Icon";
import type { DropItem, DropItemKind, WeeklyDrop } from "@/lib/types";

/* ─────────────────────────────── data shapes (shared with the API via @/lib/types) */

export type WeeklyDropData = WeeklyDrop;
export type { DropItem };

/* ─────────────────────────────── per-kind presentation
   `label` is a friendly read-flavored tag (not the raw kind); `icon`/`tint`/`ink` color the
   little kind chip on the rail cards. Sage book (STUDY), coral bulb (TIP), gold shield (TO TRY). */
const KIND_STYLE: Record<DropItemKind, { label: string; icon: IconName; tint: string; ink: string }> = {
  study: { label: "Insight", icon: "book", tint: "rgba(143, 176, 154, 0.22)", ink: "var(--color-sage)" },
  tip: { label: "Quick tip", icon: "bulb", tint: "rgba(225, 120, 92, 0.18)", ink: "var(--color-coral)" },
  activity: { label: "To try", icon: "shield", tint: "rgba(230, 181, 102, 0.24)", ink: "var(--color-gold)" },
};

/** Thumbnails for the "More for you" rail, cycled so each card gets a distinct illustration. */
const RAIL_THUMBS = ["/img/dash-stilllife.png", "/img/dash-plant.png"] as const;

/** The illustrated header behind the featured hero, used when no infographic was generated. */
const HERO_IMAGE = "/img/dashboard-banner.png";

/** Human-friendly current date for the dateline (e.g. "June 21"). */
function today(): string {
  return new Date().toLocaleDateString("en-US", { month: "long", day: "numeric" });
}

/** "2026-W26" → "Week 26 · 2026" for the past-drops archive. */
function prettyWeek(weekKey: string): string {
  const m = weekKey.match(/^(\d{4})-W(\d+)$/);
  return m ? `Week ${m[2]} · ${m[1]}` : weekKey;
}

/* ─────────────────────────────── the drop */

export function WeeklyDropCard({ data }: { data: WeeklyDropData }) {
  const [featured, ...rest] = data.items;
  if (!featured) return null;

  return (
    <div className="w-full space-y-7">
      {/* masthead — the synthesized through-line to present to the parent */}
      <header>
        <p className="eyebrow text-coral">This week&apos;s drop · for {data.childName}</p>
        <h1 className="mt-1 text-[2rem] font-semibold leading-[1.08] text-teal sm:text-[2.4rem]">
          {data.headline}
        </h1>
        {data.summary && (
          <p className="mt-2 text-[0.98rem] leading-relaxed text-ink/65">{data.summary}</p>
        )}
      </header>

      {/* featured hero */}
      <FeaturedCard item={featured} childName={data.childName} heroImage={data.heroImage} />

      {/* action affordances (visual for now) */}
      <DropActions />

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

      {/* the real research it was synthesized from */}
      {data.sources?.length > 0 && <SourcesList sources={data.sources} />}

      {/* provenance */}
      <footer className="flex items-center gap-2 px-1 text-xs leading-relaxed text-muted">
        <span className="text-sage">
          <Icon name="loop" size={15} />
        </span>
        <span>Synthesized for your family from real, peer-reviewed research.</span>
      </footer>
    </div>
  );
}

/** The featured item, rendered large over the generated infographic (or a warm static header). */
function FeaturedCard({
  item,
  childName,
  heroImage,
}: {
  item: DropItem;
  childName: string;
  heroImage?: string;
}) {
  const style = KIND_STYLE[item.kind];
  const generated = Boolean(heroImage);
  const hero = heroImage || HERO_IMAGE;
  return (
    <article className="glass overflow-hidden rounded-[1.6rem]">
      <div className="relative aspect-[16/10] w-full sm:aspect-[2/1]">
        <Image
          src={hero}
          alt=""
          fill
          priority
          unoptimized={generated}
          sizes="(min-width: 768px) 42rem, 100vw"
          className="object-cover"
        />
        {/* soft bottom scrim so the pill always reads */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: "linear-gradient(to top, rgba(30,77,74,0.35), transparent 52%)" }}
          aria-hidden="true"
        />
        <span className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-coral px-3 py-1 text-[0.62rem] font-bold uppercase tracking-[0.14em] text-white shadow-[var(--shadow-soft)]">
          {generated ? "Made for you" : "Featured"}
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
        {(item.source || item.url) && (
          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-ink/5 pt-3.5">
            {item.source && (
              <span className="text-[0.72rem] font-semibold uppercase tracking-[0.1em] text-ink/45">
                {item.source}
              </span>
            )}
            {item.url && (
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[0.84rem] font-semibold text-coral transition-colors hover:text-coral/80"
              >
                Read the study <span aria-hidden="true">→</span>
              </a>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

/** Two affordances on the drop — visual for now (wired up later). */
function DropActions() {
  return (
    <div className="flex flex-wrap gap-3">
      <DropActionButton icon="mic" label="Convert into a podcast" />
      <DropActionButton icon="note" label="Create infographics" />
    </div>
  );
}

function DropActionButton({ icon, label }: { icon: IconName; label: string }) {
  return (
    <button
      type="button"
      disabled
      title="Coming soon"
      className="glass inline-flex cursor-not-allowed items-center gap-2 rounded-full px-4 py-2.5 text-[0.9rem] font-semibold text-teal/85"
    >
      <span className="text-coral">
        <Icon name={icon} size={16} />
      </span>
      {label}
      <span className="ml-1 rounded-full bg-teal/10 px-2 py-0.5 text-[0.58rem] font-bold uppercase tracking-[0.1em] text-teal/60">
        Soon
      </span>
    </button>
  );
}

/** A horizontal glass card: thumbnail + kind chip + title + one-line body. */
function RailCard({ item, thumb }: { item: DropItem; thumb: string }) {
  const style = KIND_STYLE[item.kind];
  return (
    <li>
      <article className="glass flex items-center gap-4 rounded-[1.4rem] p-3.5 sm:p-4">
        <div className="relative h-[4.6rem] w-[4.6rem] shrink-0 overflow-hidden rounded-[1.1rem] sm:h-[5.2rem] sm:w-[5.2rem]">
          <Image src={thumb} alt="" fill sizes="5.2rem" className="object-cover" />
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
          <p className="mt-0.5 line-clamp-2 text-[0.88rem] leading-relaxed text-ink/65">{item.body}</p>
        </div>
      </article>
    </li>
  );
}

/** The real studies this drop was synthesized from — each linkable. */
function SourcesList({ sources }: { sources: WeeklyDrop["sources"] }) {
  return (
    <section className="space-y-3">
      <h2 className="text-[1.15rem] font-semibold text-teal">The research behind this</h2>
      <ul className="space-y-2.5">
        {sources.map((s, i) => (
          <li key={`${s.title}-${i}`}>
            <article className="glass flex items-start gap-3 rounded-[1.2rem] p-3.5">
              <span className="mt-0.5 text-sage">
                <Icon name="book" size={16} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[0.95rem] font-semibold leading-snug text-teal">{s.title}</p>
                <p className="mt-0.5 text-xs text-muted">{s.source}</p>
                {s.url && (
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-coral transition-colors hover:text-coral/80"
                  >
                    Read <span aria-hidden="true">→</span>
                  </a>
                )}
              </div>
            </article>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The saved-drops archive — revisit earlier weeks. */
export function PastDrops({
  drops,
  activeWeekKey,
  onSelect,
}: {
  drops: WeeklyDropData[];
  activeWeekKey: string;
  onSelect: (weekKey: string) => void;
}) {
  if (drops.length <= 1) return null;
  return (
    <section className="mt-9 space-y-3 border-t border-ink/5 pt-7">
      <h2 className="text-[1.15rem] font-semibold text-teal">Past drops</h2>
      <ul className="space-y-2.5">
        {drops.map((d) => {
          const active = d.weekKey === activeWeekKey;
          return (
            <li key={d.weekKey}>
              <button
                type="button"
                onClick={() => onSelect(d.weekKey)}
                aria-current={active}
                className={`glass w-full rounded-[1.2rem] p-3.5 text-left transition-shadow ${
                  active ? "ring-2 ring-coral/40" : "hover:shadow-[var(--shadow-soft)]"
                }`}
              >
                <p className="text-[0.68rem] font-bold uppercase tracking-[0.1em] text-ink/40">
                  {prettyWeek(d.weekKey)}
                </p>
                <p className="mt-0.5 text-[1.02rem] font-semibold leading-snug text-teal">
                  {d.headline}
                </p>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
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

/** First-week state: Compass doesn't know the family well enough to personalize a drop yet. */
export function WeeklyNeedsContext() {
  return (
    <div className="w-full">
      <header className="mb-6">
        <p className="eyebrow text-coral">This week&apos;s drop</p>
        <h1 className="mt-1 text-[2rem] font-semibold leading-[1.08] text-teal sm:text-[2.4rem]">
          Just getting to know you
        </h1>
      </header>
      <article className="glass rounded-[1.6rem] p-7 text-center sm:p-9">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-sage-soft/50 text-teal">
          <Icon name="bulb" size={28} />
        </span>
        <h2 className="mt-5 text-xl font-semibold text-teal">
          I don&apos;t know your family well enough yet
        </h2>
        <p className="mx-auto mt-2 max-w-md text-[0.98rem] leading-relaxed text-ink/70">
          Your weekly drop gets sharp once I know your child. Chat with me a little — who they
          are, what you&apos;re working on — and next week&apos;s drop will be made just for them.
        </p>
        <Link href="/app/coach" className="btn btn-primary mt-6">
          Tell me about your child
        </Link>
      </article>
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
