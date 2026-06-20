"use client";

/**
 * PastePersonalize — the Paste & Personalize experience (/app/paste).
 *
 * One job, done warmly: the parent pastes advice they found in the wild (a reel, an
 * article, a screenshot), Compass spends a beat "reading", then returns ONE concrete
 * next step fit to their child — grounded against trusted guidance, with a gentle
 * caution when the advice isn't fully supported.
 *
 * It talks to POST /api/personalize. The client owns the family scope exactly like the
 * onboarding does: a signed-in user is `g:<sub>` (from /api/auth/me), otherwise the
 * per-browser demo id in localStorage (so it shares the same memory the onboarding built).
 *
 * Style: cream base + drifting aurora + wet-glass surfaces (see globals.css). Motion is
 * decorative and disabled under prefers-reduced-motion.
 */

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

/** The real Compass mark — full color for the header presence. */
const MARK_COLOR = "/brand/compass-mark-color.png";
/** Mirrors OnboardingChat's localStorage key so Paste shares the family's memory. */
const FAMILY_ID_KEY = "compass.familyId";

interface PersonalizeResult {
  step: string;
  screenNote: string;
  supported: boolean;
  caution?: string;
  citations: { title: string; source: string }[];
}

type Phase = "idle" | "reading" | "done" | "error";

/** Resolve the family scope: signed-in account first, else the per-browser demo id. */
async function resolveFamilyId(): Promise<string> {
  try {
    const res = await fetch("/api/auth/me");
    const data = await res.json();
    if (data?.user?.sub) return `g:${data.user.sub}`;
  } catch {
    /* fall through to the local demo id */
  }
  const existing = localStorage.getItem(FAMILY_ID_KEY);
  if (existing) return existing;
  const id = `demo-${crypto.randomUUID()}`;
  localStorage.setItem(FAMILY_ID_KEY, id);
  return id;
}

export default function PastePersonalize() {
  const [content, setContent] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<PersonalizeResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const familyId = useRef<string>("");
  const resultRef = useRef<HTMLDivElement>(null);

  // Resolve the family scope once on mount (so submit is instant).
  useEffect(() => {
    let alive = true;
    (async () => {
      const id = await resolveFamilyId();
      if (alive) familyId.current = id;
    })();
    return () => {
      alive = false;
    };
  }, []);

  // When a result lands, bring it gently into view (it renders below the fold on mobile).
  useEffect(() => {
    if (phase === "done" && resultRef.current) {
      const id = requestAnimationFrame(() =>
        resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
      );
      return () => cancelAnimationFrame(id);
    }
  }, [phase]);

  const submit = useCallback(async () => {
    const text = content.trim();
    if (text.length === 0 || phase === "reading") return;

    setPhase("reading");
    setError(null);
    setResult(null);

    try {
      if (!familyId.current) familyId.current = await resolveFamilyId();
      const res = await fetch("/api/personalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ familyId: familyId.current, content: text }),
      });
      const data = (await res.json()) as PersonalizeResult & { error?: string };
      if (!res.ok) throw new Error(data.error || "Something went wrong");
      setResult(data);
      setPhase("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't reach Compass");
      setPhase("error");
    }
  }, [content, phase]);

  const reset = useCallback(() => {
    setContent("");
    setResult(null);
    setError(null);
    setPhase("idle");
  }, []);

  // Cmd/Ctrl+Enter submits from the textarea (Enter alone keeps newlines for pasted text).
  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      void submit();
    }
  };

  const reading = phase === "reading";

  return (
    <div className="relative min-h-dvh w-full overflow-hidden bg-cream">
      {/* living ambient backdrop */}
      <div className="aurora" aria-hidden="true">
        <div className="blob blob-coral" />
        <div className="blob blob-teal" />
        <div className="blob blob-gold" />
        <div className="blob blob-rose" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-2xl flex-col px-4 py-10 sm:px-6 sm:py-14">
        <Presence reading={reading} />

        {/* The paste box stays mounted while reading (so the textarea keeps the text),
            but is replaced by the result once we have one. */}
        {phase === "done" && result ? (
          <div ref={resultRef}>
            <ResultCard result={result} onReset={reset} />
          </div>
        ) : (
          <PasteBox
            value={content}
            onChange={setContent}
            onKeyDown={onKeyDown}
            onSubmit={() => void submit()}
            reading={reading}
            error={phase === "error" ? error : null}
          />
        )}
      </div>
    </div>
  );
}

/* ───────────────────────────────────────── presence (the living compass) */

function Presence({ reading }: { reading: boolean }) {
  return (
    <header className="flex flex-col items-center gap-1.5 pb-8 text-center">
      <div className="compass-breathe">
        <Image
          src={MARK_COLOR}
          alt="Compass"
          width={52}
          height={52}
          priority
          className={reading ? "compass-thinking" : ""}
        />
      </div>
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-coral">
        {reading ? "Reading…" : "Paste & Personalize"}
      </p>
      <h1 className="max-w-md text-balance text-2xl font-semibold leading-tight text-teal sm:text-[1.7rem]">
        Saw a reel, an article, a screenshot of advice?
      </h1>
      <p className="max-w-md text-[0.95rem] leading-relaxed text-ink/70">
        Drop it in. Compass checks it against trusted guidance and turns it into one step
        that fits your child.
      </p>
    </header>
  );
}

/* ───────────────────────────────────────── paste box */

function PasteBox({
  value,
  onChange,
  onKeyDown,
  onSubmit,
  reading,
  error,
}: {
  value: string;
  onChange: (v: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onSubmit: () => void;
  reading: boolean;
  error: string | null;
}) {
  const empty = value.trim().length === 0;

  return (
    <div className="msg-in">
      <div className="composer glass rounded-[1.6rem] p-2.5">
        <label htmlFor="paste" className="sr-only">
          Paste the advice you found
        </label>
        <textarea
          id="paste"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={reading}
          rows={6}
          placeholder="Paste a reel transcript, an article, or a screenshot of advice here…"
          className="block max-h-[40dvh] min-h-[7.5rem] w-full resize-none rounded-2xl bg-transparent px-3 py-2.5 text-[0.98rem] leading-relaxed text-ink placeholder:text-muted/70 focus:outline-none disabled:opacity-50"
        />
        <div className="flex items-center justify-between gap-3 px-1.5 pt-1.5">
          <span className="hidden text-xs text-muted/80 sm:block">
            Compass reads it as evidence, never as orders.
          </span>
          <button
            onClick={onSubmit}
            disabled={empty || reading}
            className="btn btn-primary ml-auto disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0"
          >
            {reading ? (
              <>
                <SpinnerStar />
                Compass is reading…
              </>
            ) : (
              <>
                Personalize this
                <ArrowRight />
              </>
            )}
          </button>
        </div>
      </div>

      {error && (
        <p className="msg-in mt-3 text-center text-sm font-semibold text-coral-deep">
          {error} — try again in a moment.
        </p>
      )}

      <p className="mt-5 text-center text-xs leading-relaxed text-muted">
        Private to your family. Compass never shares what you paste.
      </p>
    </div>
  );
}

/* ───────────────────────────────────────── result card */

function ResultCard({ result, onReset }: { result: PersonalizeResult; onReset: () => void }) {
  {
    const { step, screenNote, supported, caution, citations } = result;

    return (
      <div className="msg-in space-y-5">
        {/* The one step — the hero of the card. */}
        <div className="overflow-hidden rounded-[1.6rem] shadow-[var(--shadow-soft)]">
          <div
            className="relative p-6 sm:p-7"
            style={{
              background: "linear-gradient(115deg, #fdfbf6 0%, #f7e7d8 55%, #dfeae6 100%)",
            }}
          >
            <div className="flex items-center gap-2">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-coral/15 text-coral">
                <StepIcon />
              </span>
              <p className="eyebrow">Your one next step</p>
            </div>
            <p className="mt-4 text-[1.18rem] font-medium leading-relaxed text-ink sm:text-[1.25rem]">
              {step}
            </p>

            {/* When to put the screen away — the product's soul. */}
            <div className="mt-5 flex items-start gap-2.5 rounded-2xl bg-teal/[0.06] px-4 py-3.5">
              <span className="mt-0.5 shrink-0 text-teal/70">
                <ScreenIcon />
              </span>
              <p className="text-[0.92rem] leading-relaxed text-teal">
                <span className="font-bold">When to put the screen away:</span> {screenNote}
              </p>
            </div>
          </div>
        </div>

        {/* Checked against trusted guidance — the epistemic-humility line. */}
        <div className="glass rounded-2xl p-5">
          <div className="flex items-center gap-2">
            <span className={`shrink-0 ${supported ? "text-sage" : "text-gold"}`}>
              {supported ? <ShieldCheckIcon /> : <ScaleIcon />}
            </span>
            <p className="text-[0.92rem] font-bold text-teal">
              {supported
                ? "Checked against trusted guidance"
                : "Worth holding a little lightly"}
            </p>
          </div>

          {!supported && caution && (
            <p className="mt-2.5 text-[0.9rem] leading-relaxed text-ink/75">{caution}</p>
          )}

          {citations.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {citations.map((c) => (
                <li key={c.title} className="flex items-start gap-2 text-[0.86rem] leading-snug">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-coral" />
                  <span>
                    <span className="font-semibold text-ink">{c.title}</span>
                    <span className="text-muted"> — {c.source}</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2.5 text-[0.86rem] leading-relaxed text-muted">
              No single source covered this directly, so Compass leaned on widely-accepted
              principles. Trust what you see in your own child.
            </p>
          )}
        </div>

        <div className="flex items-center justify-center gap-4 pt-1">
          <button onClick={onReset} className="btn btn-ghost">
            <PasteIcon />
            Paste something else
          </button>
          <a href="/app" className="text-sm font-semibold text-teal/70 underline underline-offset-2 hover:text-teal">
            Back to Compass
          </a>
        </div>
      </div>
    );
  }
}

/* ───────────────────────────────────────── icons (feature-local, brand-tinted) */

function ArrowRight() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 12h13M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SpinnerStar() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="tool-spin">
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function StepIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 19h5v-5h5V9h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ScreenIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="4" width="18" height="13" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M8 21h8M12 17v4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function ShieldCheckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3 5 6v5c0 4.5 3 7.6 7 9 4-1.4 7-4.5 7-9V6l-7-3Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="m9.5 12 1.8 1.8L15 10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ScaleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3v18M7 21h10M5 7h14M5 7l-2.5 5a2.5 2.5 0 0 0 5 0L5 7Zm14 0-2.5 5a2.5 2.5 0 0 0 5 0L19 7Z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PasteIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="6" y="4" width="12" height="16" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M9 4a3 3 0 0 1 6 0" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M9 12h6M9 16h4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}
