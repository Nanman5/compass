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

export default function OnboardingChat() {
  const [messages, setMessages] = useState<VisibleMessage[]>([]);
  const [pending, setPending] = useState(true); // true during the opening kickoff
  const [done, setDone] = useState(false);
  const [profile, setProfile] = useState<ChildProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [input, setInput] = useState("");

  const familyId = useRef<string>("");
  const serverState = useRef<OnboardingState | null>(null);
  const nextId = useRef(0);
  const scrollRef = useRef<HTMLElement>(null);

  const pushMessage = useCallback((role: VisibleMessage["role"], text: string) => {
    setMessages((prev) => [...prev, { id: nextId.current++, role, text }]);
  }, []);

  /** One round-trip to the onboarding API. Returns the parsed response or throws. */
  const turn = useCallback(async (message: string): Promise<OnboardingApiResponse> => {
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
    if (!res.ok) throw new Error(data.error || "Something went wrong");
    return data;
  }, []);

  const applyResponse = useCallback((data: OnboardingApiResponse) => {
    serverState.current = data.state;
    pushMessage("assistant", data.reply);
    if (data.done) {
      setDone(true);
      if (data.profile) setProfile(data.profile);
    }
  }, [pushMessage]);

  // Kick off the conversation: send the hidden seed, render only Compass's reply.
  useEffect(() => {
    let cancelled = false;
    familyId.current = getFamilyId();
    (async () => {
      try {
        const data = await turn(KICKOFF);
        if (!cancelled) applyResponse(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Couldn't reach Compass");
      } finally {
        if (!cancelled) setPending(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [turn, applyResponse]);

  // Follow the conversation: smoothly scroll the message pane to the bottom as it grows.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, pending, done]);

  const send = useCallback(async () => {
    const text = input.trim();
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
  }, [input, pending, done, pushMessage, turn, applyResponse]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  };

  return (
    <div className="fixed inset-0 overflow-hidden bg-cream">
      {/* living ambient backdrop */}
      <div className="aurora" aria-hidden="true">
        <div className="blob blob-coral" />
        <div className="blob blob-teal" />
        <div className="blob blob-gold" />
        <div className="blob blob-rose" />
      </div>

      <div className="relative z-10 mx-auto flex h-full max-w-2xl flex-col px-4 sm:px-6">
        <Presence thinking={pending} done={done} />

        <main
          ref={scrollRef}
          className="flex-1 space-y-4 overflow-y-auto overscroll-contain scroll-smooth pb-4 pt-1"
          aria-live="polite"
        >
          {messages.map((m) =>
            m.role === "assistant" ? (
              <AssistantBubble key={m.id} text={m.text} />
            ) : (
              <UserBubble key={m.id} text={m.text} />
            ),
          )}

          {pending && <TypingBubble />}
          {error && <ErrorBubble text={error} onRetry={() => void send()} />}
          {done && profile && <Recap profile={profile} />}
        </main>

        {!done && (
          <Composer
            value={input}
            disabled={pending}
            onChange={setInput}
            onKeyDown={onKeyDown}
            onSend={() => void send()}
          />
        )}
      </div>
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
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-coral">
        {done ? "All set" : thinking ? "Listening…" : "Getting to know your family"}
      </p>
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

/* ───────────────────────────────────────── composer (wet-glass input) */

function Composer({
  value,
  disabled,
  onChange,
  onKeyDown,
  onSend,
}: {
  value: string;
  disabled: boolean;
  onChange: (v: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onSend: () => void;
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
      <div className="composer glass flex items-end gap-2 rounded-[1.6rem] p-2 pl-5">
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

const COMING_SOON = [
  {
    title: "Your one next step",
    body: "Describe a struggle and Compass returns a single concrete action — plus when to put the screen away.",
  },
  {
    title: "Win logger",
    body: "A quick “how did it go?” after you try a step, so guidance sharpens to what actually works for your child.",
  },
  {
    title: "What Compass remembers",
    body: "See and clear everything Compass has learned about your family. Your data, your call.",
  },
];

function Recap({ profile }: { profile: ChildProfile }) {
  const rows: { label: string; value: string }[] = [
    { label: "Age", value: profile.ageBand },
    { label: "Temperament", value: profile.temperament.join(", ") || "—" },
    { label: "Loves", value: profile.interests.join(", ") || "—" },
    { label: "Working on", value: profile.struggles.join(", ") || "—" },
  ];
  if (profile.context) rows.push({ label: "Context", value: profile.context });

  return (
    <div className="msg-in space-y-5 pt-2">
      <div className="glass rounded-3xl p-6">
        <p className="eyebrow">Profile saved</p>
        <h2 className="mt-1 text-2xl font-semibold text-teal">
          Here&apos;s what Compass learned about {profile.childName}
        </h2>
        <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
          {rows.map((r) => (
            <div key={r.label} className="flex flex-col">
              <dt className="text-xs font-bold uppercase tracking-wide text-muted">{r.label}</dt>
              <dd className="mt-0.5 text-[0.98rem] text-ink">{r.value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div>
        <p className="px-1 text-sm font-semibold text-teal/80">Coming next</p>
        <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {COMING_SOON.map((c) => (
            <div
              key={c.title}
              className="glass relative overflow-hidden rounded-2xl p-4 opacity-80"
              aria-disabled="true"
            >
              <span className="inline-flex items-center gap-1.5 rounded-full bg-sage-soft/70 px-2.5 py-0.5 text-[0.62rem] font-bold uppercase tracking-wide text-teal">
                <span className="h-1.5 w-1.5 rounded-full bg-coral" />
                Coming soon
              </span>
              <h3 className="mt-2.5 text-[0.95rem] font-semibold text-teal">{c.title}</h3>
              <p className="mt-1 text-[0.82rem] leading-relaxed text-ink/65">{c.body}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
