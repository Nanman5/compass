"use client";

/**
 * WinLogger — the "how did it go?" surface (/app/wins).
 *
 * Every episode is something the parent actually tried, with a step Compass suggested.
 * This screen lists the recent ones; for any that haven't been reflected on yet, it asks
 * a gentle "How did it go?" with three low-stakes options (Worked / Sort of / Not really)
 * and an optional note. Logging POSTs to /api/episodes/outcome and the card settles into
 * a warm, recognition-first acknowledgement.
 *
 * The point is parental self-efficacy, NOT scorekeeping: no points, streaks, or grades.
 * "Not really" is framed as useful learning, never failure — Compass adjusts from it.
 *
 * Style matches the immersive /app shell: cream base, drifting aurora, wet-glass cards
 * (see globals.css + OnboardingChat). Motion is decorative and respects reduced-motion.
 */

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";

import { CompassStar } from "@/components/CompassStar";
import { Icon } from "@/components/Icon";
import type { Episode, FamilyMemory } from "@/lib/types";

const MARK_COLOR = "/brand/compass-mark-color.png";
const FAMILY_ID_KEY = "compass.familyId";

/** The three reflection options. Value is what we persist as the episode outcome; the
 *  copy is deliberately gentle and self-efficacy-forward (no pass/fail framing). */
const OPTIONS = [
  {
    value: "worked",
    label: "It worked",
    sub: "Going to try it again",
    tone: "sage" as const,
  },
  {
    value: "sort-of",
    label: "Sort of",
    sub: "A little better than before",
    tone: "gold" as const,
  },
  {
    value: "not-really",
    label: "Not this time",
    sub: "We'll find another way",
    tone: "coral" as const,
  },
] as const;

type OptionValue = (typeof OPTIONS)[number]["value"];

/** Warm, recognition-first message shown once a card is logged. Keyed by the option so
 *  the affirmation always centers the parent's effort, whatever the result. */
const AFFIRMATIONS: Record<OptionValue, string> = {
  worked: "Beautiful. You noticed what your child needed and followed through — that's the whole thing.",
  "sort-of": "That counts. Small shifts like this are exactly how new habits take root.",
  "not-really": "Showing up and trying is the win. Compass will fold this in and suggest a gentler angle next time.",
};

/** Resolve the client-side familyId the same way the rest of /app does: signed-in users
 *  get g:<sub>; guests fall back to the demo id persisted in localStorage. */
async function resolveFamilyId(): Promise<string | null> {
  try {
    const res = await fetch("/api/auth/me");
    if (res.ok) {
      const data = (await res.json()) as { user?: { sub?: string } | null };
      if (data.user?.sub) return `g:${data.user.sub}`;
    }
  } catch {
    /* fall through to the local demo id */
  }
  return localStorage.getItem(FAMILY_ID_KEY);
}

type LogState =
  | { phase: "idle" }
  | { phase: "saving" }
  | { phase: "done"; choice: OptionValue }
  | { phase: "error"; message: string };

export default function WinLogger() {
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [episodes, setEpisodes] = useState<Episode[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Per-episode UI state for the reflection interaction, keyed by episode id.
  const [logStates, setLogStates] = useState<Record<string, LogState>>({});

  // Lock the document to a fixed full-height, no-scroll shell while mounted (matches
  // OnboardingChat) so the aurora stays put and only the content pane scrolls.
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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const id = await resolveFamilyId();
      if (cancelled) return;
      setFamilyId(id);
      if (!id) {
        setEpisodes([]); // no family yet → empty state (prompts onboarding)
        return;
      }
      try {
        const res = await fetch(`/api/memory?familyId=${encodeURIComponent(id)}`);
        if (!res.ok) throw new Error("Couldn't load your wins");
        const data = (await res.json()) as FamilyMemory;
        if (cancelled) return;
        setEpisodes(data.episodes ?? []);
      } catch (err) {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : "Couldn't load your wins");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const log = useCallback(
    async (episode: Episode, choice: OptionValue, note: string) => {
      if (!familyId) return;
      setLogStates((s) => ({ ...s, [episode.id]: { phase: "saving" } }));
      // Persist the human-friendly label plus any note so memory reads back as a sentence.
      const label = OPTIONS.find((o) => o.value === choice)?.label ?? choice;
      const outcome = note.trim() ? `${label} — ${note.trim()}` : label;
      try {
        const res = await fetch("/api/episodes/outcome", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ familyId, episodeId: episode.id, outcome }),
        });
        if (!res.ok) throw new Error("That didn't save");
        // Reflect the new outcome locally so the card flips to its logged state.
        setEpisodes((prev) =>
          prev ? prev.map((e) => (e.id === episode.id ? { ...e, outcome } : e)) : prev,
        );
        setLogStates((s) => ({ ...s, [episode.id]: { phase: "done", choice } }));
      } catch (err) {
        setLogStates((s) => ({
          ...s,
          [episode.id]: { phase: "error", message: err instanceof Error ? err.message : "That didn't save" },
        }));
      }
    },
    [familyId],
  );

  // Newest first — most recent attempt sits at the top.
  const ordered = useMemo(
    () =>
      episodes
        ? [...episodes].sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
          )
        : null,
    [episodes],
  );

  const openCount = ordered?.filter((e) => !e.outcome).length ?? 0;

  return (
    <div className="relative h-full w-full overflow-hidden bg-cream">
      {/* living ambient backdrop (same vocabulary as the onboarding shell) */}
      <div className="aurora" aria-hidden="true">
        <div className="blob blob-coral" />
        <div className="blob blob-teal" />
        <div className="blob blob-gold" />
        <div className="blob blob-rose" />
      </div>

      <div className="relative z-10 flex h-full w-full flex-col">
        <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain scroll-smooth">
          <div className="mx-auto w-full max-w-2xl px-4 pb-16 pt-10 sm:px-6">
            <Header openCount={openCount} hasEpisodes={(ordered?.length ?? 0) > 0} />

            <div className="mt-8">
              {ordered === null && !loadError && <LoadingState />}
              {loadError && <LoadError message={loadError} />}
              {ordered !== null && ordered.length === 0 && <EmptyState />}

              {ordered !== null && ordered.length > 0 && (
                <ul className="space-y-5">
                  {ordered.map((e) => (
                    <li key={e.id} className="msg-in">
                      <EpisodeCard
                        episode={e}
                        state={logStates[e.id] ?? { phase: "idle" }}
                        onLog={(choice, note) => void log(e, choice, note)}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

/* ───────────────────────────────────────── header (presence) */

function Header({ openCount, hasEpisodes }: { openCount: number; hasEpisodes: boolean }) {
  // A quiet, encouraging subtitle — never a tally to chase.
  const subtitle = !hasEpisodes
    ? "Where the steps you try come back to you."
    : openCount > 0
      ? openCount === 1
        ? "One step is waiting for a quick reflection."
        : `${openCount} steps are waiting for a quick reflection.`
      : "All caught up. Lovely work showing up for your family.";

  return (
    <header className="flex flex-col items-center gap-2 text-center">
      <div className="compass-breathe">
        <Image src={MARK_COLOR} alt="Compass" width={48} height={48} priority />
      </div>
      <p className="eyebrow">Win logger</p>
      <h1 className="text-3xl font-semibold leading-tight text-teal sm:text-4xl">
        How did it go?
      </h1>
      <p className="max-w-md text-[0.95rem] leading-relaxed text-ink/70">{subtitle}</p>
    </header>
  );
}

/* ───────────────────────────────────────── episode card */

function EpisodeCard({
  episode,
  state,
  onLog,
}: {
  episode: Episode;
  state: LogState;
  onLog: (choice: OptionValue, note: string) => void;
}) {
  // An episode is "logged" if it had an outcome on load, or we just saved one.
  const logged = Boolean(episode.outcome) || state.phase === "done";

  return (
    <article className="glass rounded-3xl p-5 sm:p-6">
      {/* What the parent was working through + the step Compass offered. */}
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-sage-soft/45 text-teal">
          <Icon name="bulb" size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[0.68rem] font-bold uppercase tracking-wide text-coral">
            You tried
          </p>
          <p className="mt-1 text-[1.02rem] font-semibold leading-snug text-teal">
            {episode.suggestion}
          </p>
          {episode.situation && (
            <p className="mt-1.5 text-[0.88rem] leading-relaxed text-ink/65">
              <span className="text-muted">When: </span>
              {episode.situation}
            </p>
          )}
        </div>
      </div>

      <div className="mt-4 border-t border-teal/10 pt-4">
        {logged ? (
          <LoggedRow episode={episode} justSaved={state.phase === "done"} choice={state.phase === "done" ? state.choice : undefined} />
        ) : (
          <Reflect state={state} onLog={onLog} />
        )}
      </div>
    </article>
  );
}

/* ───────────────────────────────────────── reflection interaction */

function Reflect({
  state,
  onLog,
}: {
  state: LogState;
  onLog: (choice: OptionValue, note: string) => void;
}) {
  const [choice, setChoice] = useState<OptionValue | null>(null);
  const [note, setNote] = useState("");
  const saving = state.phase === "saving";

  return (
    <div>
      <p className="text-[0.88rem] font-semibold text-ink/75">How did it go?</p>

      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
        {OPTIONS.map((o) => {
          const active = choice === o.value;
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => setChoice(o.value)}
              aria-pressed={active}
              disabled={saving}
              className={`group flex flex-col items-start rounded-2xl border px-3.5 py-3 text-left transition active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal disabled:opacity-50 ${
                active
                  ? `${TONE_ACTIVE[o.tone]} shadow-[var(--shadow-card)]`
                  : "border-teal/15 bg-cream-card/60 hover:border-teal/35 hover:bg-cream-card/90"
              }`}
            >
              <span className="flex items-center gap-1.5">
                <span className={active ? "text-current" : TONE_DOT[o.tone]}>
                  <ChoiceGlyph value={o.value} />
                </span>
                <span className="text-[0.92rem] font-bold">{o.label}</span>
              </span>
              <span className={`mt-0.5 text-[0.78rem] leading-snug ${active ? "text-current/80" : "text-ink/55"}`}>
                {o.sub}
              </span>
            </button>
          );
        })}
      </div>

      {choice && (
        <div className="msg-in mt-3">
          <label htmlFor={`note-${choice}`} className="sr-only">
            Add a note (optional)
          </label>
          <textarea
            id={`note-${choice}`}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            disabled={saving}
            placeholder="Want to add a note? (optional)"
            className="w-full resize-none rounded-2xl border border-teal/15 bg-cream-card/70 px-4 py-3 text-[0.92rem] text-ink placeholder:text-muted/70 focus:border-teal/40 focus:outline-none focus:ring-2 focus:ring-sage/40 disabled:opacity-50"
          />
          <div className="mt-3 flex items-center gap-3">
            <button
              type="button"
              onClick={() => onLog(choice, note)}
              disabled={saving}
              className="btn btn-primary px-6 py-2.5 text-[0.92rem] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Saving…" : "Log it"}
            </button>
            {state.phase === "error" && (
              <span className="text-[0.85rem] font-semibold text-coral-deep">
                {state.message} — try again
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ───────────────────────────────────────── logged state (recognition) */

function LoggedRow({
  episode,
  justSaved,
  choice,
}: {
  episode: Episode;
  justSaved: boolean;
  choice?: OptionValue;
}) {
  // On a fresh save, lead with a warm affirmation; on reload, just show what was logged.
  const affirmation = choice ? AFFIRMATIONS[choice] : null;

  return (
    <div className={justSaved ? "msg-in" : undefined}>
      <div className="flex items-center gap-2 text-teal">
        <span className="grid h-6 w-6 place-items-center rounded-full bg-sage-soft/60">
          <Icon name="check" size={14} />
        </span>
        <span className="text-[0.8rem] font-bold uppercase tracking-wide">Logged</span>
        <CompassStar size={15} className="ml-auto opacity-70" />
      </div>

      {affirmation && (
        <p className="mt-2.5 text-[0.95rem] italic leading-relaxed text-teal/85" style={{ fontFamily: "var(--font-display)" }}>
          {affirmation}
        </p>
      )}

      {episode.outcome && (
        <p className="mt-2 text-[0.88rem] leading-relaxed text-ink/70">
          <span className="font-semibold text-teal/75">You noted: </span>
          {episode.outcome}
        </p>
      )}
    </div>
  );
}

/* ───────────────────────────────────────── empty / loading / error */

function EmptyState() {
  return (
    <div className="glass rounded-3xl px-6 py-12 text-center">
      <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-sage-soft/40 text-teal">
        <Icon name="loop" size={26} />
      </span>
      <h2 className="mt-4 text-xl font-semibold text-teal">No steps to reflect on yet</h2>
      <p className="mx-auto mt-2 max-w-sm text-[0.92rem] leading-relaxed text-ink/65">
        When you bring Compass a moment and try the step it suggests, it lands here. Then
        you can tell Compass how it went — and the guidance grows around what works for
        your child.
      </p>
      <a href="/app/coach" className="btn btn-primary mt-6 inline-flex">
        Talk to Compass
      </a>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="space-y-5" aria-hidden="true">
      {[0, 1].map((i) => (
        <div key={i} className="glass rounded-3xl p-6">
          <div className="flex items-center gap-3">
            <span className="dot h-9 w-9 rounded-full bg-teal/10" style={{ animationDelay: `${i * 0.2}s` }} />
            <div className="flex-1 space-y-2">
              <span className="dot block h-3 w-2/3 rounded-full bg-teal/10" />
              <span className="dot block h-3 w-1/3 rounded-full bg-teal/10" style={{ animationDelay: "0.1s" }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function LoadError({ message }: { message: string }) {
  return (
    <div className="glass rounded-3xl px-6 py-10 text-center">
      <p className="text-[0.95rem] font-semibold text-coral-deep">{message}</p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="mt-3 text-sm font-bold text-teal underline underline-offset-2 hover:text-teal-soft"
      >
        Try again
      </button>
    </div>
  );
}

/* ───────────────────────────────────────── small visual helpers */

/** Tailwind classes per tone for an *active* (selected) option pill. */
const TONE_ACTIVE: Record<"sage" | "gold" | "coral", string> = {
  sage: "border-teal bg-teal text-cream",
  gold: "border-gold bg-gold text-ink",
  coral: "border-coral bg-coral text-cream",
};

/** Tone color for the glyph when the option is *not* selected. */
const TONE_DOT: Record<"sage" | "gold" | "coral", string> = {
  sage: "text-teal",
  gold: "text-gold",
  coral: "text-coral",
};

function ChoiceGlyph({ value }: { value: OptionValue }) {
  const common = { width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;
  if (value === "worked")
    return (
      <svg {...common}>
        <path d="m20 6-11 11-5-5" />
      </svg>
    );
  if (value === "sort-of")
    return (
      <svg {...common}>
        <path d="M5 12h14" />
      </svg>
    );
  // not-really → a soft "again / loop back" arrow, never an X (no failure framing).
  return (
    <svg {...common}>
      <path d="M3 12a9 9 0 1 0 3-6.7M3 4v4h4" />
    </svg>
  );
}
