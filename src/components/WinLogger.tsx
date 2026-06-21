"use client";

/**
 * WinLogger — the daily "Check-in" surface (/app/wins).
 *
 * A warm, once-a-day reflection rather than a scoreboard. The parent picks how today felt
 * overall (Tough / Okay / Good / Great), names the root win worth keeping, and can add an
 * optional note. On submit it records the moment via the existing POST /api/episodes so it
 * joins the family's history, then settles into a recognition-first confirmation.
 *
 * No points, streaks, or grades — the point is parental self-efficacy. Style matches the
 * shared /app shell (cream base, drifting aurora, wet-glass cards). It wraps its own
 * <AppShell active="checkin"> exactly like HomeDashboard does.
 */

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

import AppShell from "@/components/AppShell";

const STILL_LIFE = "/img/dash-stilllife.png";
const FAMILY_ID_KEY = "compass.familyId";

const ROOT_WIN_MAX = 120;
const NOTE_MAX = 200;

/** The four daily-mood options. `value` is what we fold into the recorded suggestion; the
 *  copy is gentle and non-judgemental. Selected pills warm into a coral/gold tint. */
const MOODS = [
  { value: "Tough", glyph: "cloud" as const, tone: "coral" as const },
  { value: "Okay", glyph: "neutral" as const, tone: "gold" as const },
  { value: "Good", glyph: "smile" as const, tone: "gold" as const },
  { value: "Great", glyph: "star" as const, tone: "coral" as const },
] as const;

type MoodValue = (typeof MOODS)[number]["value"];

/** Resolve the client-side familyId the same way the rest of /app does: signed-in users
 *  get g:<sub>; guests fall back to the demo id persisted in localStorage. */
async function resolveFamilyId(): Promise<string> {
  try {
    const res = await fetch("/api/auth/me");
    if (res.ok) {
      const data = (await res.json()) as { user?: { sub?: string } | null };
      if (data.user?.sub) return `g:${data.user.sub}`;
    }
  } catch {
    /* fall through to the local demo id */
  }
  try {
    return localStorage.getItem(FAMILY_ID_KEY) || "guest";
  } catch {
    return "guest";
  }
}

type Phase =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "done"; mood: MoodValue | null }
  | { kind: "error"; message: string };

export default function WinLogger() {
  const [familyId, setFamilyId] = useState<string>("guest");
  const [mood, setMood] = useState<MoodValue | null>(null);
  const [rootWin, setRootWin] = useState("");
  const [note, setNote] = useState("");
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });

  useEffect(() => {
    let cancelled = false;
    void resolveFamilyId().then((id) => {
      if (!cancelled) setFamilyId(id);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const trimmedWin = rootWin.trim();
  // Require at least a mood or a root win — never an empty submission.
  const canSubmit = Boolean(mood || trimmedWin) && phase.kind !== "saving";

  async function submit() {
    if (!canSubmit) return;
    setPhase({ kind: "saving" });

    // The API needs a non-empty situation + suggestion. Fall back to gentle defaults so a
    // mood-only or win-only check-in still records cleanly.
    const situation = trimmedWin || "Daily check-in";
    const trimmedNote = note.trim();
    const feeling = mood ? `Felt ${mood}` : "Checked in";
    const suggestion = trimmedNote ? `${feeling} · ${trimmedNote}` : feeling;

    try {
      const res = await fetch("/api/episodes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ familyId, situation, suggestion }),
      });
      if (!res.ok) throw new Error("That didn't save");
      setPhase({ kind: "done", mood });
    } catch (err) {
      setPhase({
        kind: "error",
        message: err instanceof Error ? err.message : "That didn't save",
      });
    }
  }

  function reset() {
    setMood(null);
    setRootWin("");
    setNote("");
    setPhase({ kind: "idle" });
  }

  if (phase.kind === "done") {
    return (
      <AppShell active="checkin">
        <DoneState mood={phase.mood} onReset={reset} />
      </AppShell>
    );
  }

  const saving = phase.kind === "saving";

  return (
    <AppShell active="checkin">
      <div className="space-y-6">
        {/* heading */}
        <header>
          <p className="eyebrow">Check-in</p>
          <h1 className="mt-1 text-[2rem] font-semibold leading-[1.08] text-teal sm:text-[2.4rem]">
            How did today go?
          </h1>
          <p className="mt-2 text-[0.98rem] leading-relaxed text-ink/70">
            Every check-in helps you see progress over time.
          </p>
        </header>

        {/* mood — how was today overall? */}
        <section className="glass rounded-[1.4rem] p-5">
          <h2 className="text-[1.02rem] font-semibold text-teal">How was today overall?</h2>
          <div className="mt-4 grid grid-cols-4 gap-2 sm:gap-3">
            {MOODS.map((m) => {
              const active = mood === m.value;
              return (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setMood(active ? null : m.value)}
                  aria-pressed={active}
                  disabled={saving}
                  className={`group flex flex-col items-center gap-2 rounded-2xl border px-1.5 py-3 transition active:scale-[0.97] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal disabled:opacity-50 ${
                    active
                      ? `${TONE_PILL[m.tone]} shadow-[var(--shadow-card)]`
                      : "border-teal/12 bg-cream-card/60 hover:border-teal/30 hover:bg-cream-card/90"
                  }`}
                >
                  <span
                    className={`grid h-11 w-11 place-items-center rounded-full transition ${
                      active ? TONE_CIRCLE_ACTIVE[m.tone] : "bg-sage-soft/40 text-teal"
                    }`}
                  >
                    <MoodGlyph glyph={m.glyph} />
                  </span>
                  <span
                    className={`text-[0.82rem] font-bold ${active ? TONE_LABEL[m.tone] : "text-teal/80"}`}
                  >
                    {m.value}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* root win */}
        <section className="glass rounded-[1.4rem] p-5">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-[1.02rem] font-semibold text-teal">What was your root win?</h2>
            <span className="shrink-0 text-[0.72rem] font-semibold tabular-nums text-ink/45">
              {rootWin.length}/{ROOT_WIN_MAX}
            </span>
          </div>
          <textarea
            value={rootWin}
            onChange={(e) => setRootWin(e.target.value.slice(0, ROOT_WIN_MAX))}
            rows={3}
            disabled={saving}
            placeholder="Alex asked for a break instead of getting upset."
            className="mt-3 w-full resize-none rounded-2xl border border-teal/12 bg-cream-card/70 px-4 py-3 text-[0.95rem] leading-relaxed text-ink placeholder:text-muted/60 focus:border-teal/40 focus:outline-none focus:ring-2 focus:ring-sage/40 disabled:opacity-50"
          />
        </section>

        {/* optional note */}
        <section className="glass rounded-[1.4rem] p-5">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-[1.02rem] font-semibold text-teal">
              Add a note <span className="font-normal text-ink/45">(optional)</span>
            </h2>
            <span className="shrink-0 text-[0.72rem] font-semibold tabular-nums text-ink/45">
              {note.length}/{NOTE_MAX}
            </span>
          </div>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, NOTE_MAX))}
            rows={2}
            disabled={saving}
            placeholder="Anything you want to remember about today…"
            className="mt-3 w-full resize-none rounded-2xl border border-teal/12 bg-cream-card/70 px-4 py-3 text-[0.92rem] leading-relaxed text-ink placeholder:text-muted/60 focus:border-teal/40 focus:outline-none focus:ring-2 focus:ring-sage/40 disabled:opacity-50"
          />
        </section>

        {/* affirmation */}
        <AffirmationCard
          title="You're showing up, and that matters."
          body="Keep going — you're building something beautiful."
        />

        {/* submit */}
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => void submit()}
            disabled={!canSubmit}
            className="btn btn-primary w-full disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Logging…" : "Log my check-in"}
          </button>
          {phase.kind === "error" && (
            <p className="text-center text-[0.85rem] font-semibold text-coral-deep">
              {phase.message} — please try again.
            </p>
          )}
          {!mood && !trimmedWin && phase.kind !== "error" && (
            <p className="text-center text-[0.82rem] text-ink/50">
              Pick a mood or jot a win to log today.
            </p>
          )}
        </div>
      </div>
    </AppShell>
  );
}

/* ───────────────────────────────────────── confirmation */

function DoneState({ mood, onReset }: { mood: MoodValue | null; onReset: () => void }) {
  const line = useMemo(() => {
    switch (mood) {
      case "Great":
        return "What a day. Soak it in — you both earned it.";
      case "Good":
        return "Lovely. These good days quietly add up.";
      case "Okay":
        return "Okay days count too. You still showed up.";
      case "Tough":
        return "Tough days are part of it. Showing up anyway is the win.";
      default:
        return "Logged. Thank you for checking in today.";
    }
  }, [mood]);

  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center text-center">
      <AffirmationCard
        eyebrow="Logged"
        title="You're showing up, and that matters."
        body={line}
        large
      />
      <button type="button" onClick={onReset} className="btn btn-ghost mt-6">
        New check-in
      </button>
    </div>
  );
}

/* ───────────────────────────────────────── affirmation card */

function AffirmationCard({
  eyebrow,
  title,
  body,
  large,
}: {
  eyebrow?: string;
  title: string;
  body: string;
  large?: boolean;
}) {
  return (
    <div
      className={`glass relative overflow-hidden rounded-[1.4rem] ${large ? "w-full max-w-md p-7" : "p-5 pr-24 sm:pr-28"}`}
      style={{ background: "linear-gradient(118deg, #fdf6e9 0%, #f7e6d8 100%)" }}
    >
      {/* small still-life tucked into the corner */}
      <div
        className={`pointer-events-none absolute ${large ? "-right-5 -bottom-5 h-28 w-28 opacity-70" : "-right-3 -bottom-3 h-24 w-24 opacity-80 sm:h-28 sm:w-28"}`}
      >
        <Image src={STILL_LIFE} alt="" fill className="object-contain" sizes="120px" />
      </div>

      <div className="relative">
        {eyebrow && (
          <span className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-teal/10 px-3 py-1 text-[0.72rem] font-bold uppercase tracking-wide text-teal">
            <CheckGlyph />
            {eyebrow}
          </span>
        )}
        <p
          className={`font-semibold leading-snug text-teal ${large ? "text-2xl" : "text-[1.1rem]"}`}
          style={{ fontFamily: "var(--font-display)" }}
        >
          {title}
        </p>
        <p className={`mt-1.5 leading-relaxed text-ink/70 ${large ? "text-[0.98rem]" : "text-[0.9rem]"}`}>
          {body}
        </p>
      </div>
    </div>
  );
}

/* ───────────────────────────────────────── small visual helpers */

/** Active-pill border + tint per tone (coral / gold). */
const TONE_PILL: Record<"coral" | "gold", string> = {
  coral: "border-coral/45 bg-coral/12",
  gold: "border-gold/55 bg-gold/15",
};

/** Active mood-circle fill per tone. */
const TONE_CIRCLE_ACTIVE: Record<"coral" | "gold", string> = {
  coral: "bg-coral text-cream",
  gold: "bg-gold text-ink",
};

/** Active label color per tone. */
const TONE_LABEL: Record<"coral" | "gold", string> = {
  coral: "text-coral-deep",
  gold: "text-[#b8843a]",
};

function MoodGlyph({ glyph }: { glyph: "cloud" | "neutral" | "smile" | "star" }) {
  const c = {
    width: 22,
    height: 22,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
  } as const;
  switch (glyph) {
    case "cloud":
      return (
        <svg {...c}>
          <path d="M7 18h9a4 4 0 0 0 .5-7.97A5.5 5.5 0 0 0 6 9.5 3.75 3.75 0 0 0 7 18Z" />
        </svg>
      );
    case "neutral":
      return (
        <svg {...c}>
          <circle cx="12" cy="12" r="9" />
          <path d="M9 10h.01M15 10h.01M9 15h6" />
        </svg>
      );
    case "smile":
      return (
        <svg {...c}>
          <circle cx="12" cy="12" r="9" />
          <path d="M9 10h.01M15 10h.01M8.5 14a4 4 0 0 0 7 0" />
        </svg>
      );
    case "star":
      return (
        <svg {...c}>
          <path d="m12 3 2.6 5.3 5.9.9-4.25 4.15 1 5.85L12 16.8 6.75 19.4l1-5.85L3.5 9.2l5.9-.9L12 3Z" />
        </svg>
      );
  }
}

function CheckGlyph() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="m20 6-11 11-5-5"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
