"use client";

/**
 * TodaySnapshot — the "Today" tab's daily snapshot: four labeled, calm glass sections
 * (this week's focus, a root win, an insight, and a gentle nudge), personalized from the
 * family's memory. Presentational only — the page resolves familyId and fetches
 * GET /api/memory; this component shapes that memory into warm copy and renders it.
 *
 * Style mirrors HomeDashboard: glass cards rounded-[1.4rem] p-5, sage-soft icon circles,
 * teal headings, ink/70 body, eyebrow section labels (see globals.css).
 */

import Link from "next/link";

import type { ChildProfile, Episode } from "@/lib/types";

/* ─────────────────────────────── memory shape (subset of GET /api/memory) */

export interface SnapshotMemory {
  profile: ChildProfile | null;
  episodes: Episode[];
}

/* ─────────────────────────────── focus: framed around the current struggle */

/** Maps a known struggle to a warm, connection-first focus for the week. */
const FOCUS_BY_STRUGGLE: Record<string, { title: string; line: string }> = {
  bedtime: { title: "Bedtime connection", line: "Small moments tonight build better sleep tomorrow." },
  sleep: { title: "Bedtime connection", line: "Small moments tonight build better sleep tomorrow." },
  tantrums: { title: "Riding the big feelings", line: "Staying close through the storm teaches calm." },
  meltdowns: { title: "Riding the big feelings", line: "Staying close through the storm teaches calm." },
  screens: { title: "Gentle screen limits", line: "A warm hand-off off the screen beats a hard stop." },
  "screen-time": { title: "Gentle screen limits", line: "A warm hand-off off the screen beats a hard stop." },
  transitions: { title: "Easing the transitions", line: "A little warning and a little ritual smooth the change." },
  mealtimes: { title: "Calmer mealtimes", line: "Low pressure at the table builds an easier appetite." },
  eating: { title: "Calmer mealtimes", line: "Low pressure at the table builds an easier appetite." },
  separation: { title: "Goodbyes that feel safe", line: "A steady, short goodbye builds trust to return." },
  sharing: { title: "Learning to share", line: "Turns come easier when feelings are named first." },
  focus: { title: "Settling into focus", line: "Short, cozy attention now grows longer over time." },
};

function pickFocus(profile: ChildProfile | null): { title: string; line: string } {
  const struggles = profile?.struggles ?? [];
  for (const s of struggles) {
    const key = s.trim().toLowerCase();
    const direct = FOCUS_BY_STRUGGLE[key];
    if (direct) return direct;
    // loose match: focus on the first word that appears in our map
    const hit = Object.keys(FOCUS_BY_STRUGGLE).find((k) => key.includes(k));
    if (hit) {
      const f = FOCUS_BY_STRUGGLE[hit];
      return f;
    }
  }
  // generic calm focus when we have no struggle to anchor to
  return { title: "Connection first", line: "A little warmth today plants tomorrow's confidence." };
}

/* ─────────────────────────────── root win: most recent episode with an outcome */

function pickRootWin(episodes: Episode[]): string {
  const withOutcome = episodes.filter((e) => e.outcome && e.outcome.trim().length > 0);
  if (withOutcome.length === 0) {
    return "Every calm choice counts — even the quiet ones no one claps for.";
  }
  // episodes are appended in time order; the last one is the most recent.
  const latest = withOutcome[withOutcome.length - 1];
  const outcome = (latest.outcome ?? "").trim();
  // keep it to one warm line
  return outcome.length > 160 ? `${outcome.slice(0, 157).trimEnd()}…` : outcome;
}

/* ─────────────────────────────── the snapshot */

export default function TodaySnapshot({ memory }: { memory: SnapshotMemory }) {
  const focus = pickFocus(memory.profile);
  const rootWin = pickRootWin(memory.episodes);

  return (
    <div className="space-y-7">
      <header>
        <p className="eyebrow">Today</p>
        <h1 className="mt-1 text-[2rem] font-semibold leading-[1.08] text-teal sm:text-[2.4rem]">
          Today&apos;s snapshot
        </h1>
        <p className="mt-2 text-[0.98rem] leading-relaxed text-ink/70">
          A calm look at where you and your little one are today.
        </p>
      </header>

      <Section label="This week's focus">
        <Card icon={<MoonIcon />}>
          <CardTitle>{focus.title}</CardTitle>
          <CardBody>{focus.line}</CardBody>
        </Card>
      </Section>

      <Section label="Root win">
        <Card icon={<SparkleIcon />}>
          <CardTitle>Calm choice</CardTitle>
          <CardBody>{rootWin}</CardBody>
        </Card>
      </Section>

      <Section label="Insight">
        <Card icon={<GraphIcon />}>
          <CardTitle>Patterns over perfection</CardTitle>
          <CardBody>
            Consistency matters more than getting it &ldquo;right&rdquo; every time.
          </CardBody>
          <CardLink href="/app/memory">See the full insight</CardLink>
        </Card>
      </Section>

      <Section label="Gentle nudge">
        <Card icon={<HeartIcon />}>
          <CardTitle>Two minutes for connection</CardTitle>
          <CardBody>A quick, calm check-in can reset the whole evening.</CardBody>
          <CardLink href="/app/coach">Try it tonight</CardLink>
        </Card>
      </Section>
    </div>
  );
}

/* ─────────────────────────────── building blocks (HomeDashboard card vocabulary) */

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section>
      <p className="eyebrow mb-2">{label}</p>
      {children}
    </section>
  );
}

function Card({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="glass rounded-[1.4rem] p-5">
      <div className="flex items-start gap-3.5">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-sage-soft/60 text-teal">
          {icon}
        </span>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}

function CardTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-[1.02rem] font-semibold text-teal">{children}</h3>;
}

function CardBody({ children }: { children: React.ReactNode }) {
  return <p className="mt-1 text-[0.9rem] leading-relaxed text-ink/70">{children}</p>;
}

function CardLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-teal/80 transition hover:text-teal"
    >
      {children}
      <Arrow />
    </Link>
  );
}

/* ─────────────────────────────── icons (1.5px stroke, currentColor — matches the set) */

function Arrow() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 12h13M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M20 13.5A8 8 0 1 1 10.5 4a6.5 6.5 0 0 0 9.5 9.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

function SparkleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3.5c.4 3.6 1.9 5.1 5.5 5.5-3.6.4-5.1 1.9-5.5 5.5-.4-3.6-1.9-5.1-5.5-5.5 3.6-.4 5.1-1.9 5.5-5.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M18 14.5c.2 1.6.9 2.3 2.5 2.5-1.6.2-2.3.9-2.5 2.5-.2-1.6-.9-2.3-2.5-2.5 1.6-.2 2.3-.9 2.5-2.5Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  );
}

function GraphIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 5v14h16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7.5 14l3-3.5 2.5 2.5 4-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function HeartIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 20s-6.5-4.2-6.5-9A3.5 3.5 0 0 1 12 8a3.5 3.5 0 0 1 6.5 3c0 4.8-6.5 9-6.5 9z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}
