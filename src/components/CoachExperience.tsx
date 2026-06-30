"use client";

/**
 * CoachExperience — "Your one next step" (/app/coach).
 *
 * A calm, full-screen surface where a parent describes an in-the-moment struggle and
 * Compass returns ONE concrete next step. We POST the situation to /api/coach and render
 * the result: the single step (big and warm), the "when to put the screen away" note,
 * the evidence citations used, and a collapsible "Behind the scenes" panel that walks
 * the agent's trajectory (so the experience reads as genuinely agentic, not a one-shot
 * answer).
 *
 * Style mirrors the onboarding experience (see globals.css + OnboardingChat): cream base,
 * drifting aurora, wet-glass surfaces, and a breathing Compass mark. Motion is decorative
 * and disabled under prefers-reduced-motion. This component reimplements nothing shared —
 * it reuses the .glass / .aurora / .compass-* primitives.
 */

import Image from "next/image";
import { forwardRef, useCallback, useEffect, useRef, useState } from "react";

import { CompassStar } from "@/components/CompassStar";
import { Icon } from "@/components/Icon";
import type { CoachTurnResult } from "@/lib/types";

/** Full-color Compass mark — same asset the onboarding presence uses. */
const MARK_COLOR = "/brand/compass-mark-color.png";

const FAMILY_ID_KEY = "compass.familyId";

/**
 * Resolve the family scope exactly as OnboardingChat / AppGate do: a signed-in user maps
 * to `g:<sub>`; a guest falls back to the per-browser demo id in localStorage. We never
 * mint a new id here — if onboarding hasn't run we still send whatever scope exists, and
 * the Coach simply has no profile to personalize from yet.
 */
async function resolveFamilyId(): Promise<string> {
  try {
    const res = await fetch("/api/auth/me");
    const data = await res.json();
    if (data?.familyId) return data.familyId as string;
  } catch {
    /* fall through to the local demo id */
  }
  const existing = localStorage.getItem(FAMILY_ID_KEY);
  if (existing) return existing;
  const id = `demo-${crypto.randomUUID()}`;
  localStorage.setItem(FAMILY_ID_KEY, id);
  return id;
}

/** A few gentle starters so a blank textarea never feels intimidating. */
const PROMPTS = [
  "Bedtime turns into a battle every night.",
  "Tablet time ends in a meltdown.",
  "Mornings are chaos getting out the door.",
  "Won't eat anything but the same three foods.",
];

type Phase = "idle" | "thinking" | "result" | "error";

export default function CoachExperience() {
  const [input, setInput] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<CoachTurnResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** The situation the current result answers — shown above the step for context. */
  const [askedAbout, setAskedAbout] = useState("");

  const familyId = useRef<string>("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Lock the document to a full-height, non-scrolling shell while mounted (the result
  // pane scrolls itself). Mirrors OnboardingChat so Safari resolves h-full and the
  // landing's scroll behavior is restored on unmount.
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prev = { htmlH: html.style.height, bodyH: body.style.height, bodyO: body.style.overflow };
    html.style.height = "100%";
    body.style.height = "100%";
    body.style.overflow = "hidden";
    return () => {
      html.style.height = prev.htmlH;
      body.style.height = prev.bodyH;
      body.style.overflow = prev.bodyO;
    };
  }, []);

  // Resolve the family scope once on mount, before any send.
  useEffect(() => {
    let active = true;
    void (async () => {
      const id = await resolveFamilyId();
      if (active) familyId.current = id;
    })();
    return () => {
      active = false;
    };
  }, []);

  // Grow the textarea with its content, up to the CSS max-height.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [input]);

  const ask = useCallback(async () => {
    const message = input.trim();
    if (!message || phase === "thinking") return;

    setAskedAbout(message);
    setError(null);
    setResult(null);
    setPhase("thinking");

    try {
      // The scope may not have resolved yet on a very fast submit — make sure of it.
      if (!familyId.current) familyId.current = await resolveFamilyId();

      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ familyId: familyId.current, message }),
      });
      const data = (await res.json()) as CoachTurnResult & { error?: string };
      if (!res.ok) throw new Error(data.error || "Coach turn failed");
      setResult(data);
      setPhase("result");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't reach Compass");
      setPhase("error");
    }
  }, [input, phase]);

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
    setAskedAbout("");
    setPhase("idle");
    setInput("");
    // Return focus to the composer so the parent can ask the next thing immediately.
    requestAnimationFrame(() => textareaRef.current?.focus());
  }, []);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      void ask();
    }
  };

  const showComposer = phase === "idle" || phase === "thinking";

  return (
    <div className="relative h-full w-full overflow-hidden bg-cream">
      {/* living ambient backdrop */}
      <div className="aurora" aria-hidden="true">
        <div className="blob blob-coral" />
        <div className="blob blob-teal" />
        <div className="blob blob-gold" />
        <div className="blob blob-rose" />
      </div>

      {/* back to the app (this surface locks scroll, so it isn't wrapped in the shell) */}
      <a
        href="/app"
        className="glass absolute left-4 top-4 z-20 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold text-teal/80 transition hover:text-teal sm:left-6 sm:top-6"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Back
      </a>

      <div className="relative z-10 flex h-full w-full flex-col">
        {/* presence header */}
        <header className="mx-auto flex w-full max-w-2xl shrink-0 flex-col items-center gap-1.5 px-4 pb-5 pt-8 text-center sm:px-6">
          <div className={phase === "result" ? "" : "compass-breathe"}>
            <Image
              src={MARK_COLOR}
              alt="Compass"
              width={52}
              height={52}
              priority
              className={phase === "thinking" ? "compass-thinking" : ""}
            />
          </div>
          <span
            style={{ fontFamily: "var(--font-display)" }}
            className="text-lg font-semibold tracking-tight text-teal"
          >
            Compass
          </span>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-coral">
            {phase === "thinking" ? "Thinking it through…" : "Your one next step"}
          </p>
        </header>

        {/* scrolling body */}
        <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain scroll-smooth">
          <div className="mx-auto w-full max-w-2xl px-4 pb-10 sm:px-6">
            {phase === "idle" && (
              <Intro
                onPick={(p) => {
                  setInput(p);
                  requestAnimationFrame(() => textareaRef.current?.focus());
                }}
              />
            )}

            {phase === "thinking" && <Thinking situation={askedAbout} />}

            {phase === "error" && (
              <ErrorCard text={error ?? "Something went wrong"} onRetry={() => void ask()} />
            )}

            {phase === "result" && result && (
              <ResultView result={result} situation={askedAbout} onAskAnother={reset} />
            )}
          </div>
        </main>

        {/* composer (only while asking) */}
        {showComposer && (
          <div className="mx-auto w-full max-w-2xl shrink-0 px-4 sm:px-6">
            <Composer
              ref={textareaRef}
              value={input}
              disabled={phase === "thinking"}
              onChange={setInput}
              onKeyDown={onKeyDown}
              onSend={() => void ask()}
            />
          </div>
        )}
      </div>
    </div>
  );
}

/* ───────────────────────────────────────── intro (empty state) */

function Intro({ onPick }: { onPick: (prompt: string) => void }) {
  return (
    <div className="msg-in pt-2">
      <div className="glass rounded-3xl p-6 sm:p-8">
        <h1 className="text-2xl font-semibold leading-tight text-teal sm:text-[1.7rem]">
          What&apos;s hard right now?
        </h1>
        <p className="mt-2 text-[0.98rem] leading-relaxed text-ink/75">
          Describe one in-the-moment struggle in your own words. Compass will look at what it
          knows about your child, weigh trusted guidance, and hand you a single next step to
          try today — plus when to put the screen away.
        </p>

        <div className="mt-6">
          <p className="eyebrow">Or start from one of these</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {PROMPTS.map((p) => (
              <button
                key={p}
                onClick={() => onPick(p)}
                className="rounded-full border border-teal/20 bg-cream-card/70 px-4 py-2 text-left text-sm font-semibold text-teal transition hover:border-teal hover:bg-teal/5 active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────────────────────── thinking state */

function Thinking({ situation }: { situation: string }) {
  /** Cycle warm status lines so the wait feels alive, not stuck. */
  const lines = [
    "Reading what you shared…",
    "Looking up what Compass knows about your child…",
    "Weighing trusted guidance…",
    "Shaping one step that fits today…",
  ];
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((n) => (n + 1) % lines.length), 1800);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="msg-in pt-2">
      {situation && <SituationChip situation={situation} />}
      <div className="glass mt-4 flex items-center gap-4 rounded-3xl p-6">
        <span className="compass-thinking shrink-0">
          <CompassStar size={34} className="tool-spin" />
        </span>
        <div className="min-w-0">
          <p className="text-[1.02rem] font-semibold text-teal">{lines[i]}</p>
          <div className="mt-2 flex items-center gap-1.5">
            {[0, 1, 2].map((d) => (
              <span
                key={d}
                className="dot h-1.5 w-1.5 rounded-full bg-teal/50"
                style={{ animationDelay: `${d * 0.16}s` }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────────────────────── result */

function ResultView({
  result,
  situation,
  onAskAnother,
}: {
  result: CoachTurnResult;
  situation: string;
  onAskAnother: () => void;
}) {
  return (
    <div className="msg-in space-y-5 pt-2">
      {situation && <SituationChip situation={situation} />}

      {/* the one next step — the hero of the screen */}
      <div className="relative overflow-hidden rounded-[1.6rem] shadow-[var(--shadow-soft)]">
        <div
          className="relative p-6 sm:p-8"
          style={{
            background: "linear-gradient(125deg, #fdfbf6 0%, #f7e7d8 58%, #dfeae6 100%)",
          }}
        >
          <span className="pointer-events-none absolute right-5 top-5 text-teal/15">
            <CompassStar size={60} />
          </span>
          <p className="eyebrow">Your one next step</p>
          <p
            className="mt-3 max-w-[34ch] text-[1.45rem] font-semibold leading-snug text-teal sm:text-[1.7rem]"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {result.nextStep}
          </p>
        </div>
      </div>

      {/* when to put the screen away — the soul of the product */}
      {result.screenNote && (
        <div className="glass-teal flex items-start gap-3.5 rounded-3xl p-5 text-cream">
          <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-cream/15">
            <Icon name="shield" size={18} className="text-cream" />
          </span>
          <div>
            <p className="text-[0.7rem] font-bold uppercase tracking-[0.1em] text-cream/70">
              When to put the screen away
            </p>
            <p className="mt-1 text-[0.98rem] leading-relaxed text-cream/95">
              {result.screenNote}
            </p>
          </div>
        </div>
      )}

      {/* citations used */}
      {result.citations.length > 0 && (
        <div className="glass rounded-3xl p-5">
          <div className="flex items-center gap-2 text-teal">
            <Icon name="book" size={17} className="text-coral" />
            <p className="text-[0.7rem] font-bold uppercase tracking-[0.1em] text-teal/70">
              Grounded in
            </p>
          </div>
          <ul className="mt-3 space-y-2.5">
            {result.citations.map((c, idx) => (
              <li key={`${c.title}-${idx}`} className="flex items-start gap-2.5">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-coral" />
                <span className="min-w-0">
                  <span className="text-[0.95rem] font-semibold leading-snug text-ink">
                    {c.title}
                  </span>
                  {c.source && (
                    <span className="block text-[0.82rem] text-muted">{c.source}</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* behind the scenes — proves it's agentic */}
      <BehindTheScenes result={result} />

      {/* ask another */}
      <div className="flex justify-center pt-1">
        <button onClick={onAskAnother} className="btn btn-primary">
          <Icon name="chat" size={18} className="text-cream" />
          Ask about something else
        </button>
      </div>
    </div>
  );
}

/** The parent's situation, echoed back so the step keeps its context on screen. */
function SituationChip({ situation }: { situation: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[88%] rounded-3xl rounded-tr-md bg-teal px-5 py-3 text-[0.95rem] leading-relaxed text-cream shadow-[var(--shadow-card)]">
        {situation}
      </div>
    </div>
  );
}

/* ───────────────────────────────────────── behind the scenes (trajectory) */

const STEP_META: Record<
  string,
  { label: (tool?: string) => string; icon: Parameters<typeof Icon>[0]["name"] }
> = {
  tool_call: { label: () => "Used a tool", icon: "loop" },
  tool_result: { label: () => "Got a result", icon: "check" },
  thinking: { label: () => "Thought it through", icon: "bulb" },
  final: { label: () => "Wrote your step", icon: "note" },
};

function BehindTheScenes({ result }: { result: CoachTurnResult }) {
  const [open, setOpen] = useState(false);
  const { trajectory, meta } = result;

  return (
    <div className="glass overflow-hidden rounded-3xl">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition hover:bg-teal/[0.03] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-teal"
      >
        <span className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-sage-soft/40 text-teal">
            <Icon name="loop" size={16} />
          </span>
          <span>
            <span className="block text-[0.95rem] font-semibold text-teal">Behind the scenes</span>
            <span className="block text-[0.8rem] text-muted">
              {trajectory.length} step{trajectory.length === 1 ? "" : "s"} · {meta.provider}/{meta.model}
            </span>
          </span>
        </span>
        <Chevron open={open} />
      </button>

      {open && (
        <div className="border-t border-teal/10 px-5 pb-5 pt-4">
          <ol className="relative space-y-4 border-l border-teal/15 pl-5">
            {trajectory.map((step, idx) => {
              const kindMeta = STEP_META[step.kind] ?? STEP_META.thinking;
              return (
                <li key={idx} className="relative">
                  <span className="absolute -left-[1.65rem] top-0 grid h-6 w-6 place-items-center rounded-full border border-teal/15 bg-cream-card text-teal">
                    <Icon name={kindMeta.icon} size={13} />
                  </span>
                  <p className="text-[0.78rem] font-bold uppercase tracking-wide text-teal/55">
                    {step.tool ?? kindMeta.label(step.tool)}
                  </p>
                  <p className="mt-0.5 text-[0.9rem] leading-relaxed text-ink/80">{step.summary}</p>
                </li>
              );
            })}
          </ol>

          <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-teal/10 pt-4 text-[0.78rem] text-muted">
            <MetaStat label="Model" value={`${meta.provider} · ${meta.model}`} />
            <MetaStat label="Tool rounds" value={String(meta.steps)} />
            <MetaStat label="Time" value={`${(meta.ms / 1000).toFixed(1)}s`} />
            {result.learnings.length > 0 && (
              <MetaStat
                label="Learned"
                value={`${result.learnings.length} new fact${result.learnings.length === 1 ? "" : "s"}`}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function MetaStat({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="font-semibold uppercase tracking-wide text-teal/50">{label}</span>
      <span className="text-ink/70">{value}</span>
    </span>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={`shrink-0 text-teal/60 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
    >
      <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ───────────────────────────────────────── error */

function ErrorCard({ text, onRetry }: { text: string; onRetry: () => void }) {
  return (
    <div className="msg-in pt-2">
      <div className="glass rounded-3xl p-6">
        <p className="text-[0.7rem] font-bold uppercase tracking-[0.1em] text-coral-deep">
          That didn&apos;t go through
        </p>
        <p className="mt-1.5 text-[0.98rem] leading-relaxed text-ink/80">{text}</p>
        <button onClick={onRetry} className="btn btn-primary mt-4">
          Try again
        </button>
      </div>
    </div>
  );
}

/* ───────────────────────────────────────── composer (wet-glass input) */

interface ComposerProps {
  value: string;
  disabled: boolean;
  onChange: (v: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onSend: () => void;
}

const Composer = forwardRef<HTMLTextAreaElement, ComposerProps>(function Composer(
  { value, disabled, onChange, onKeyDown, onSend },
  ref,
) {
  return (
    <div className="shrink-0 pb-5 pt-2">
      <div className="composer glass flex items-end gap-2 rounded-[1.6rem] p-2">
        <label htmlFor="situation" className="sr-only">
          Describe the struggle
        </label>
        <textarea
          id="situation"
          ref={ref}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          rows={1}
          disabled={disabled}
          placeholder="Describe what's happening…"
          className="max-h-40 flex-1 resize-none bg-transparent py-2.5 pl-3 text-[0.98rem] text-ink placeholder:text-muted/70 focus:outline-none disabled:opacity-50"
        />
        <button
          onClick={onSend}
          disabled={disabled || value.trim().length === 0}
          aria-label="Get my next step"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-coral text-cream shadow-[0_10px_22px_-12px_rgba(225,120,92,0.9)] transition duration-200 hover:bg-coral-deep hover:scale-105 active:scale-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M5 12h13M13 6l6 6-6 6"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
      <p className="mt-2 text-center text-[0.72rem] text-muted/80">
        Compass gives guidance, not medical advice. For health concerns, see your pediatrician.
      </p>
    </div>
  );
});
