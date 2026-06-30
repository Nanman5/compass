"use client";

/**
 * OnboardingChat — the immersive, living onboarding experience (/app).
 *
 * A full-screen, minimal chat that talks to POST /api/onboarding one turn at a time.
 * The client owns a demo `familyId` (persisted in localStorage) and the opaque server
 * `state` it threads back each turn; it renders its own `visible` transcript so the
 * hidden kickoff turn never shows. When the flow completes, the API has already saved
 * the distilled profile to this family's memory, and we surface it as a recap plus the
 * "coming soon" surfaces (Coach, Win Logger, Memory) that the demo doesn't open yet.
 *
 * Style: cream base + drifting aurora + wet-glass surfaces (see globals.css). Motion is
 * decorative and disabled under prefers-reduced-motion.
 */

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

import HomeDashboard from "@/components/HomeDashboard";
import VoiceOnboarding from "@/components/VoiceOnboarding";
import type { ChildProfile, OnboardingState } from "@/lib/types";

/** The real Compass mark — full color for the header, monochrome teal for inline avatars. */
const MARK_COLOR = "/brand/compass-mark-color.png";
const MARK_TEAL = "/brand/compass-mark-teal.png";

/** Small inline brand avatar shown beside each assistant message. */
function MarkAvatar({ className }: { className?: string }) {
  return (
    <Image
      src={MARK_TEAL}
      alt=""
      width={26}
      height={26}
      aria-hidden="true"
      className={className}
    />
  );
}

interface VisibleMessage {
  id: number;
  role: "assistant" | "user";
  text: string;
  /** Tap-to-answer options the agent offered with this message (parsed from [[CHIPS…]]). */
  chips?: { options: string[]; multi: boolean };
}

/** Pull a [[CHIPS: a | b]] (single) or [[CHIPS_MULTI: a | b]] (multi) directive out of a
 *  reply, returning the cleaned text and the parsed options so the brackets never show. */
function parseChips(reply: string): { text: string; chips?: VisibleMessage["chips"] } {
  const m = reply.match(/\[\[CHIPS(_MULTI)?:\s*([^\]]+)\]\]/i);
  if (!m) return { text: reply };
  const options = m[2]
    .split("|")
    .map((o) => o.trim())
    .filter(Boolean);
  const text = reply.replace(m[0], "").trim();
  return { text, chips: options.length ? { options, multi: Boolean(m[1]) } : undefined };
}

interface OnboardingApiResponse {
  reply: string;
  done: boolean;
  profile?: ChildProfile;
  state: OnboardingState;
  error?: string;
}

const FAMILY_ID_KEY = "compass.familyId";
/** Hidden first turn — the API needs a message to produce Compass's opening question. */
const KICKOFF = "Hi";

/** Stable per-browser demo family id (so memory accumulates across reloads). */
function getFamilyId(): string {
  const existing = localStorage.getItem(FAMILY_ID_KEY);
  if (existing) return existing;
  const id = `demo-${crypto.randomUUID()}`;
  localStorage.setItem(FAMILY_ID_KEY, id);
  return id;
}

export default function OnboardingChat({ familyId: familyIdProp }: { familyId?: string } = {}) {
  const [messages, setMessages] = useState<VisibleMessage[]>([]);
  const [pending, setPending] = useState(true); // true during the opening kickoff
  const [done, setDone] = useState(false);
  const [returning, setReturning] = useState(false);
  const [confirmed, setConfirmed] = useState(false); // parent tapped "continue" past the recap
  const [profile, setProfile] = useState<ChildProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [voiceOpen, setVoiceOpen] = useState(false);

  const familyId = useRef<string>("");
  const serverState = useRef<OnboardingState | null>(null);
  const nextId = useRef(0);
  const scrollRef = useRef<HTMLElement>(null);
  const didInit = useRef(false);

  const pushMessage = useCallback(
    (role: VisibleMessage["role"], text: string, chips?: VisibleMessage["chips"]) => {
      setMessages((prev) => [...prev, { id: nextId.current++, role, text, chips }]);
    },
    [],
  );

  /** One round-trip to the onboarding API. Returns the parsed response or throws. */
  const turn = useCallback(async (message: string): Promise<OnboardingApiResponse> => {
    console.info("[chat] → turn:", message.slice(0, 80));
    const res = await fetch("/api/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        familyId: familyId.current,
        message,
        state: serverState.current ?? undefined,
      }),
    });
    const data = (await res.json()) as OnboardingApiResponse;
    if (!res.ok) {
      console.error("[chat] turn failed:", res.status, data.error);
      throw new Error(data.error || "Something went wrong");
    }
    console.info("[chat] ← reply, done =", data.done);
    return data;
  }, []);

  const applyResponse = useCallback((data: OnboardingApiResponse) => {
    serverState.current = data.state;
    const { text, chips } = parseChips(data.reply);
    pushMessage("assistant", text, chips);
    if (data.done) {
      setDone(true);
      if (data.profile) setProfile(data.profile);
    }
  }, [pushMessage]);

  // Lock the page to a definite full-height, no-scroll shell while the CHAT (incl. the
  // completion recap) is showing. This makes `h-full` resolve in Safari (a `min-h-full` body
  // is an INDEFINITE height, so percentage/auto heights collapse there) and keeps the document
  // from scrolling — the message pane scrolls itself. We unlock on unmount, which is exactly
  // when the parent taps "continue" and we hand off to the dashboard (a normal scrolling page).
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

  // Kick off the conversation exactly once (guard against React StrictMode double-invoke,
  // which otherwise fires two kickoffs → two greeting bubbles).
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    // Signed-in users get a per-account familyId; guests fall back to a local demo id.
    familyId.current = familyIdProp ?? getFamilyId();
    const params = new URLSearchParams(window.location.search);
    // Deep-link: /app?voice=1 opens straight into the spoken onboarding.
    if (params.get("voice") === "1") {
      setVoiceOpen(true);
    }
    (async () => {
      // Returning family? If Compass already knows this child, greet them back and go
      // straight to their home — never re-onboard someone it already remembers.
      try {
        const memRes = await fetch(`/api/memory?familyId=${encodeURIComponent(familyId.current)}`);
        if (memRes.ok) {
          const mem = (await memRes.json()) as { profile?: ChildProfile | null };
          if (mem?.profile?.childName) {
            setProfile(mem.profile);
            setReturning(true);
            setDone(true);
            setPending(false);
            return;
          }
        }
      } catch {
        /* no saved family yet → fall through to onboarding */
      }
      try {
        const data = await turn(KICKOFF);
        applyResponse(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't reach Compass");
      } finally {
        setPending(false);
      }
    })();
  }, [turn, applyResponse]);

  // Follow the conversation: scroll the pane fully to the bottom as it grows. Wait two
  // frames so the new bubble's layout (entrance animation, wrapped text, avatar) has
  // settled before we measure — otherwise we scroll short and the last line is cut off.
  // BUT once we're done (showing the dashboard), scroll to the TOP so the banner + greeting
  // are what the parent sees first, not the footer.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const id = requestAnimationFrame(() =>
      requestAnimationFrame(() =>
        el.scrollTo({ top: el.scrollHeight, behavior: "smooth" }),
      ),
    );
    return () => cancelAnimationFrame(id);
  }, [messages, pending, done]);

  const send = useCallback(
    async (override?: string) => {
      const text = (override ?? input).trim();
      if (!text || pending || done) return;
      setInput("");
      setError(null);
      pushMessage("user", text);
      setPending(true);
      try {
        const data = await turn(text);
        applyResponse(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't reach Compass");
      } finally {
        setPending(false);
      }
    },
    [input, pending, done, pushMessage, turn, applyResponse],
  );

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  };

  // Start onboarding over from the dashboard, overwriting the existing profile. We only spend
  // tokens on the kickoff greeting here — deliberately, because the parent asked for it.
  const restart = useCallback(async () => {
    serverState.current = null;
    setMessages([]);
    setProfile(null);
    setReturning(false);
    setDone(false);
    setError(null);
    setPending(true);
    try {
      const data = await turn(KICKOFF);
      applyResponse(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't reach Compass");
    } finally {
      setPending(false);
    }
  }, [turn, applyResponse]);

  // Onboarding complete → hand off to the full Home dashboard (a normal scrolling page).
  // A FRESH completion first shows Compass's closing message + a recap of what it learned, and
  // only hands off once the parent taps continue (so it never cuts away mid-goodbye). A
  // RETURNING family (already known) skips straight in.
  if (done && profile && (returning || confirmed)) {
    return (
      <HomeDashboard
        profile={profile}
        returning={returning}
        onRestart={() => void restart()}
      />
    );
  }

  return (
    <div className="relative h-full w-full overflow-hidden bg-cream">
      {/* living ambient backdrop */}
      <div className="aurora" aria-hidden="true">
        <div className="blob blob-coral" />
        <div className="blob blob-teal" />
        <div className="blob blob-gold" />
        <div className="blob blob-rose" />
      </div>

      {/* Full-width column so the scrollbar sits at the window's right edge; each
          section centers its own content to max-w-2xl. */}
      <div className="relative z-10 flex h-full w-full flex-col">
        {!done && (
          <div className="mx-auto w-full max-w-2xl shrink-0 px-4 sm:px-6">
            <Presence thinking={pending} done={done} />
          </div>
        )}

        <main
          ref={scrollRef}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain scroll-smooth"
          aria-live="polite"
        >
          {(
            <div className="mx-auto w-full max-w-2xl space-y-4 px-4 pb-6 pt-1 sm:px-6">
              {messages.map((m) =>
                m.role === "assistant" ? (
                  <AssistantBubble key={m.id} text={m.text} />
                ) : (
                  <UserBubble key={m.id} text={m.text} />
                ),
              )}

              {(() => {
                const last = messages[messages.length - 1];
                if (!pending && !error && last?.role === "assistant" && last.chips) {
                  return (
                    <ChipPicker
                      key={last.id}
                      chips={last.chips}
                      onSend={(v) => void send(v)}
                    />
                  );
                }
                return null;
              })()}

              {pending && (messages.length === 0 ? <GreetingSkeleton /> : <TypingBubble />)}
              {error && <ErrorBubble text={error} onRetry={() => void send()} />}
            </div>
          )}
        </main>

        {!done ? (
          <div className="mx-auto w-full max-w-2xl shrink-0 px-4 sm:px-6">
            <Composer
              value={input}
              disabled={pending}
              onChange={setInput}
              onKeyDown={onKeyDown}
              onSend={() => void send()}
              onVoice={() => setVoiceOpen(true)}
            />
          </div>
        ) : profile ? (
          <div className="mx-auto w-full max-w-2xl shrink-0 px-4 pb-5 pt-2 sm:px-6">
            <CompletionCard profile={profile} onContinue={() => setConfirmed(true)} />
          </div>
        ) : null}
      </div>

      {voiceOpen && (
        <VoiceOnboarding
          familyId={familyId.current}
          onClose={() => setVoiceOpen(false)}
          onProfileSaved={(p) => {
            setProfile(p);
            setDone(true);
          }}
        />
      )}
    </div>
  );
}

/* ───────────────────────────────────────── completion recap (the closing beat) */

/** Shown after Compass's closing message: a warm recap of what it learned, with a single
 *  "continue" tap that hands off to the dashboard — so onboarding never cuts away abruptly. */
function CompletionCard({
  profile,
  onContinue,
}: {
  profile: ChildProfile;
  onContinue: () => void;
}) {
  const name = profile.childName || "your little one";
  const facts = [
    profile.ageBand && `Age ${profile.ageBand}`,
    profile.struggles[0] && `Working on ${profile.struggles[0]}`,
    profile.temperament[0],
    profile.interests[0] && `Loves ${profile.interests[0]}`,
  ].filter(Boolean) as string[];

  return (
    <div className="msg-in glass rounded-[1.6rem] p-5 sm:p-6">
      <p className="text-[0.72rem] font-bold uppercase tracking-[0.14em] text-coral">All set</p>
      <h3
        className="mt-1 text-[1.15rem] font-semibold text-teal"
        style={{ fontFamily: "var(--font-display)" }}
      >
        Here&apos;s what I&apos;ll remember about {name}
      </h3>
      {facts.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {facts.map((f) => (
            <li
              key={f}
              className="rounded-full border border-teal/15 bg-cream-card/70 px-3 py-1.5 text-[0.82rem] font-semibold text-teal"
            >
              {f}
            </li>
          ))}
        </ul>
      )}
      <button onClick={onContinue} className="btn btn-primary mt-5 w-full">
        Take me to {name}&apos;s space
      </button>
      <p className="mt-3 text-center text-xs leading-relaxed text-muted">
        You can change or erase any of this anytime in Memory.
      </p>
    </div>
  );
}

/* ───────────────────────────────────────── presence (the living compass) */

function Presence({ thinking, done }: { thinking: boolean; done: boolean }) {
  return (
    <header className="flex shrink-0 flex-col items-center gap-1.5 pt-8 pb-6 text-center">
      <div className={done ? "" : "compass-breathe"}>
        <Image
          src={MARK_COLOR}
          alt="Compass"
          width={56}
          height={56}
          priority
          className={thinking && !done ? "compass-thinking" : ""}
        />
      </div>
      <span
        style={{ fontFamily: "var(--font-display)" }}
        className="text-lg font-semibold tracking-tight text-teal"
      >
        Compass
      </span>
      {!done && (
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-coral">
          {thinking ? "Listening…" : "Getting to know your family"}
        </p>
      )}
    </header>
  );
}

/* ───────────────────────────────────────── message bubbles */

function AssistantBubble({ text }: { text: string }) {
  return (
    <div className="msg-in flex items-start gap-2.5">
      <MarkAvatar className="mt-0.5 shrink-0 opacity-90" />
      <div className="glass max-w-[85%] rounded-3xl rounded-tl-md px-5 py-3.5 text-[0.98rem] leading-relaxed text-ink">
        {text}
      </div>
    </div>
  );
}

function UserBubble({ text }: { text: string }) {
  return (
    <div className="msg-in flex justify-end">
      <div className="max-w-[85%] rounded-3xl rounded-tr-md bg-teal px-5 py-3.5 text-[0.98rem] leading-relaxed text-cream shadow-[var(--shadow-card)]">
        {text}
      </div>
    </div>
  );
}

function TypingBubble() {
  return (
    <div className="msg-in flex items-start gap-2.5">
      <MarkAvatar className="mt-0.5 shrink-0 opacity-90" />
      <div className="glass flex items-center gap-1.5 rounded-3xl rounded-tl-md px-5 py-4">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="dot h-2 w-2 rounded-full bg-teal/60"
            style={{ animationDelay: `${i * 0.16}s` }}
          />
        ))}
      </div>
    </div>
  );
}

/** First-load placeholder: a calm shimmering bubble while Compass writes its opening line —
 *  gentler than bouncing dots on an empty screen. */
function GreetingSkeleton() {
  return (
    <div className="msg-in flex items-start gap-2.5">
      <MarkAvatar className="mt-0.5 shrink-0 opacity-60" />
      <div className="glass w-full max-w-[85%] rounded-3xl rounded-tl-md px-5 py-4">
        <div className="space-y-2.5 animate-pulse">
          <div className="h-3.5 w-[92%] rounded-full bg-teal/10" />
          <div className="h-3.5 w-[78%] rounded-full bg-teal/10" />
          <div className="h-3.5 w-[55%] rounded-full bg-teal/10" />
        </div>
      </div>
    </div>
  );
}

function ErrorBubble({ text, onRetry }: { text: string; onRetry: () => void }) {
  return (
    <div className="msg-in flex items-start gap-2.5">
      <MarkAvatar className="mt-0.5 shrink-0 opacity-60" />
      <div className="glass max-w-[85%] rounded-3xl rounded-tl-md px-5 py-3.5 text-[0.95rem] leading-relaxed text-ink">
        <p className="text-coral-deep">{text}</p>
        <button
          onClick={onRetry}
          className="mt-2 text-sm font-bold text-teal underline underline-offset-2 hover:text-teal-soft"
        >
          Try again
        </button>
      </div>
    </div>
  );
}

/* ───────────────────────────────────────── tap-to-answer chips */

function ChipPicker({
  chips,
  onSend,
}: {
  chips: NonNullable<VisibleMessage["chips"]>;
  onSend: (value: string) => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const base =
    "rounded-full border px-4 py-2 text-sm font-semibold transition active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal";

  if (!chips.multi) {
    return (
      <div className="msg-in flex flex-wrap gap-2 pl-9">
        {chips.options.map((o) => (
          <button
            key={o}
            onClick={() => onSend(o)}
            className={`${base} border-teal/25 bg-cream-card/70 text-teal hover:border-teal hover:bg-teal/5`}
          >
            {o}
          </button>
        ))}
      </div>
    );
  }

  const toggle = (o: string) =>
    setSelected((s) => (s.includes(o) ? s.filter((x) => x !== o) : [...s, o]));

  return (
    <div className="msg-in flex flex-wrap items-center gap-2 pl-9">
      {chips.options.map((o) => {
        const on = selected.includes(o);
        return (
          <button
            key={o}
            onClick={() => toggle(o)}
            aria-pressed={on}
            className={`${base} ${on ? "border-teal bg-teal text-cream" : "border-teal/25 bg-cream-card/70 text-teal hover:border-teal hover:bg-teal/5"}`}
          >
            {o}
          </button>
        );
      })}
      <button
        onClick={() => onSend(selected.join(", "))}
        disabled={selected.length === 0}
        className="rounded-full bg-coral px-5 py-2 text-sm font-bold text-cream shadow-[var(--shadow-card)] transition hover:bg-coral-deep active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Continue
      </button>
    </div>
  );
}

/* ───────────────────────────────────────── composer (wet-glass input) */

function Composer({
  value,
  disabled,
  onChange,
  onKeyDown,
  onSend,
  onVoice,
}: {
  value: string;
  disabled: boolean;
  onChange: (v: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onSend: () => void;
  onVoice: () => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Grow the textarea with its content (up to the CSS max-height), and shrink back
  // when it's cleared after a send — keeps the composer feeling responsive.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  return (
    <div className="shrink-0 pb-5 pt-2">
      <div className="composer glass flex items-end gap-2 rounded-[1.6rem] p-2 pl-2">
        <button
          onClick={onVoice}
          aria-label="Talk to Compass instead"
          title="Talk to Compass"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-teal text-cream shadow-[var(--shadow-card)] transition duration-200 hover:bg-teal-soft hover:scale-105 active:scale-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <rect x="9" y="3" width="6" height="11" rx="3" stroke="currentColor" strokeWidth="2" />
            <path d="M5 11a7 7 0 0 0 14 0M12 18v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
        <label htmlFor="reply" className="sr-only">
          Your reply
        </label>
        <textarea
          id="reply"
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          rows={1}
          disabled={disabled}
          placeholder="Type your reply…"
          className="max-h-32 flex-1 resize-none bg-transparent py-2.5 text-[0.98rem] text-ink placeholder:text-muted/70 focus:outline-none disabled:opacity-50"
        />
        <button
          onClick={onSend}
          disabled={disabled || value.trim().length === 0}
          aria-label="Send reply"
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
    </div>
  );
}

/* ───────────────────────────────────────── completion recap + coming soon */
