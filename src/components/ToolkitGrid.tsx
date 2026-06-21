/**
 * ToolkitGrid — the body of the "Toolkit" tab: a calm directory of every tool in Compass.
 *
 * A heading block followed by a responsive grid of glass cards (1 col on mobile, 2 col at sm+).
 * Each card links to its tool route and matches the HomeDashboard card language: a sage-soft
 * icon circle, a teal title, an ink/70 one-liner, and a small round arrow affordance pinned
 * bottom-right. Icons are defined inline here so the grid is self-contained.
 */

import Link from "next/link";
import type { ReactElement } from "react";

import AppShell from "@/components/AppShell";

type Tool = {
  href: string;
  title: string;
  blurb: string;
  Icon: () => ReactElement;
};

const TOOLS: Tool[] = [
  {
    href: "/app/help",
    title: "Help me now",
    blurb:
      "In a hard moment? Tap to talk — a calm voice helps you steady yourself, then your child.",
    Icon: HeartIcon,
  },
  {
    href: "/app/coach",
    title: "Your one next step",
    blurb:
      "Describe a struggle — Compass returns one concrete action, plus when to put the screen away.",
    Icon: StepIcon,
  },
  {
    href: "/app/paste",
    title: "Paste & personalize",
    blurb:
      "Drop in a reel, link, or screenshot; Compass checks it against trusted evidence and hands back one thing to try.",
    Icon: SparkleIcon,
  },
  {
    href: "/app/weekly",
    title: "This week's drop",
    blurb: "A study, a tip, and an activity matched to your child right now.",
    Icon: CalendarIcon,
  },
  {
    href: "/app/wins",
    title: "Win logger / Check-in",
    blurb: "A quick “how did it go?” so guidance sharpens to what works.",
    Icon: GraphIcon,
  },
  {
    href: "/app/memory",
    title: "What Compass remembers",
    blurb: "See and clear everything Compass has learned. Your data, your call.",
    Icon: BookmarkIcon,
  },
];

export default function ToolkitGrid() {
  return (
    <AppShell active="toolkit">
      <div className="space-y-7">
        {/* heading */}
        <div>
          <p className="eyebrow">Your toolkit</p>
          <h1 className="mt-1 text-[2rem] font-semibold leading-[1.08] text-teal sm:text-[2.4rem]">
            Practical tools. Real support.
          </h1>
          <p className="mt-2 text-[0.98rem] leading-relaxed text-ink/70">
            Everything here is built for real life with your child.
          </p>
        </div>

        {/* tool grid */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {TOOLS.map((tool) => (
            <ToolCard key={tool.href} tool={tool} />
          ))}
        </div>
      </div>
    </AppShell>
  );
}

function ToolCard({ tool }: { tool: Tool }) {
  const { Icon } = tool;
  return (
    <Link
      href={tool.href}
      className="glass group relative flex flex-col rounded-[1.4rem] p-5 pb-14 transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-soft)]"
    >
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-sage-soft/60 text-teal">
        <Icon />
      </span>
      <h3 className="mt-3.5 text-[1.05rem] font-semibold leading-snug text-teal">{tool.title}</h3>
      <p className="mt-1.5 text-[0.88rem] leading-relaxed text-ink/70">{tool.blurb}</p>
      <span
        className="absolute bottom-4 right-4 grid h-9 w-9 place-items-center rounded-full bg-teal/[0.07] text-teal/70 transition group-hover:bg-coral group-hover:text-white"
        aria-hidden="true"
      >
        <Arrow />
      </span>
    </Link>
  );
}

function Arrow() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M5 12h13M13 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ── Tool icons (inline so the grid stays self-contained) ─────────────── */

function HeartIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 20s-6.5-4.2-6.5-9A3.5 3.5 0 0 1 12 8a3.5 3.5 0 0 1 6.5 3c0 4.8-6.5 9-6.5 9z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function StepIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 19h4v-4h4V9h4V5h4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="19" cy="5" r="1.5" fill="currentColor" />
    </svg>
  );
}

function SparkleIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 4l1.7 4.6L18 10l-4.3 1.4L12 16l-1.7-4.6L6 10l4.3-1.4L12 4z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M18 15l.7 1.8L20 17.5l-1.3.7L18 20l-.7-1.8L16 17.5l1.3-.7L18 15z" fill="currentColor" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4" y="5" width="16" height="15" rx="2.5" stroke="currentColor" strokeWidth="1.7" />
      <path d="M4 9.5h16M8 3.5v3M16 3.5v3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <circle cx="9" cy="13.5" r="1.1" fill="currentColor" />
      <circle cx="14" cy="13.5" r="1.1" fill="currentColor" />
    </svg>
  );
}

function GraphIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 4v15h15" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <path
        d="M8 14l3-3 2.5 2.5L19 8"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function BookmarkIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M7 4h10v16l-5-3.2L7 20V4z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
