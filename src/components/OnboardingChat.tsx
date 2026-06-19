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
  const [voiceOpen, setVoiceOpen] = useState(false);

  const familyId = useRef<string>("");
  const serverState = useRef<OnboardingState | null>(null);
  const nextId = useRef(0);
  const scrollRef = useRef<HTMLElement>(null);
  const didInit = useRef(false);

  const pushMessage = useCallback((role: VisibleMessage["role"], text: string) => {
    setMessages((prev) => [...prev, { id: nextId.current++, role, text }]);
  }, []);

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
    pushMessage("assistant", data.reply);
    if (data.done) {
      setDone(true);
      if (data.profile) setProfile(data.profile);
    }
  }, [pushMessage]);

  // Lock the page to a definite full-height, no-scroll shell while /app is mounted.
  // This makes `h-full` resolve in Safari (a `min-h-full` body is an INDEFINITE height,
  // so percentage/auto heights collapse there) and keeps the document from scrolling —
  // the message pane does its own scrolling. Restored on unmount so the landing is fine.
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
    familyId.current = getFamilyId();
    const params = new URLSearchParams(window.location.search);
    // Deep-link: /app?voice=1 opens straight into the spoken onboarding.
    if (params.get("voice") === "1") {
      setVoiceOpen(true);
    }
    (async () => {
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
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const id = requestAnimationFrame(() =>
      requestAnimationFrame(() => el.scrollTo({ top: el.scrollHeight, behavior: "smooth" })),
    );
    return () => cancelAnimationFrame(id);
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
        <div className="mx-auto w-full max-w-2xl shrink-0 px-4 sm:px-6">
          <Presence thinking={pending} done={done} />
        </div>

        <main
          ref={scrollRef}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain scroll-smooth"
          aria-live="polite"
        >
          {done && profile ? (
            // Results screen: just the recap, no transcript / greeting bubble.
            <div className="mx-auto w-full max-w-4xl px-4 pb-12 pt-2 sm:px-6">
              <Recap profile={profile} />
            </div>
          ) : (
            <div className="mx-auto w-full max-w-2xl space-y-4 px-4 pb-6 pt-1 sm:px-6">
              {messages.map((m) =>
                m.role === "assistant" ? (
                  <AssistantBubble key={m.id} text={m.text} />
                ) : (
                  <UserBubble key={m.id} text={m.text} />
                ),
              )}

              {pending && <TypingBubble />}
              {error && <ErrorBubble text={error} onRetry={() => void send()} />}
            </div>
          )}
        </main>

        {!done && (
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
        )}
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

type ComingIcon = "step" | "graph" | "bookmark";

const COMING_SOON: { title: string; body: string; icon: ComingIcon }[] = [
  {
    title: "Your one next step",
    body: "Describe a struggle and Compass returns a single concrete action — plus when to put the screen away.",
    icon: "step",
  },
  {
    title: "Win logger",
    body: "A quick “how did it go?” after you try a step, so guidance sharpens to what actually works for your child.",
    icon: "graph",
  },
  {
    title: "What Compass remembers",
    body: "See and clear everything Compass has learned about your family. Your data, your call.",
    icon: "bookmark",
  },
];

function Recap({ profile }: { profile: ChildProfile }) {
  const left: [string, string][] = [
    ["Age", profile.ageBand],
    ["Loves", profile.interests.join(", ") || "—"],
  ];
  const right: [string, string][] = [
    ["Temperament", profile.temperament.join(", ") || "—"],
    ["Working on", profile.struggles.join(", ") || "—"],
  ];

  return (
    <div className="msg-in space-y-8">
      {/* boarding-pass style profile card: solid teal stub + warm gradient body */}
      <div className="overflow-hidden rounded-[1.6rem] shadow-[var(--shadow-soft)]">
        <div className="flex">
          <div className="relative hidden w-16 shrink-0 flex-col items-center justify-center gap-3 bg-teal text-cream/90 sm:flex">
            <span className="absolute left-3 top-4 text-cream/40">✦</span>
            <span className="absolute bottom-4 right-3 text-xs text-cream/40">✦</span>
            <span className="grid h-10 w-10 place-items-center rounded-full border border-cream/30">
              <LeafIcon />
            </span>
          </div>
          <div
            className="relative flex-1 p-6 sm:p-7"
            style={{
              background:
                "linear-gradient(115deg, #fdfbf6 0%, #f7e7d8 55%, #dfeae6 100%)",
            }}
          >
            <p className="eyebrow">Profile saved</p>
            <h2 className="mt-1 text-2xl font-semibold leading-tight text-teal">
              Here&apos;s what Compass learned about {profile.childName}
            </h2>
            <div className="mt-5 grid grid-cols-1 gap-6 sm:grid-cols-2 sm:divide-x sm:divide-teal/15">
              <dl className="space-y-4 sm:pr-6">
                {left.map(([k, v]) => (
                  <Field key={k} label={k} value={v} />
                ))}
              </dl>
              <dl className="space-y-4 sm:pl-6">
                {right.map(([k, v]) => (
                  <Field key={k} label={k} value={v} />
                ))}
              </dl>
            </div>
          </div>
        </div>
      </div>

      {/* coming next */}
      <div>
        <div className="flex items-center gap-4">
          <span className="eyebrow shrink-0">Coming next</span>
          <span className="h-px flex-1 bg-teal/15" />
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {COMING_SOON.map((c) => (
            <div key={c.title} className="glass flex flex-col rounded-2xl p-5" aria-disabled="true">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-sage-soft/50 text-teal">
                <ComingSoonIcon kind={c.icon} />
              </span>
              <h3 className="mt-3 text-[0.98rem] font-semibold leading-snug text-teal">{c.title}</h3>
              <p className="mt-1.5 flex-1 text-[0.84rem] leading-relaxed text-ink/65">{c.body}</p>
              <div className="mt-4 flex justify-end">
                <span
                  className="grid h-9 w-9 place-items-center rounded-full border border-teal/20 text-teal/60"
                  title="Coming soon"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M5 12h13M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* footer */}
      <div className="pt-2 text-center">
        <span className="text-coral">♡</span>
        <p className="mt-1 text-sm italic text-teal/70" style={{ fontFamily: "var(--font-display)" }}>
          Guidance for your family. Built around you.
        </p>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[0.68rem] font-bold uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-0.5 text-[0.98rem] text-ink">{value}</dd>
    </div>
  );
}

function LeafIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 20s8-3 8-11V5h-4c-8 0-8 8-8 8 0-4-3-5-3-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ComingSoonIcon({ kind }: { kind: ComingIcon }) {
  const common = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", "aria-hidden": true } as const;
  if (kind === "step")
    return (
      <svg {...common}>
        <path d="M4 19h5v-5h5V9h5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  if (kind === "graph")
    return (
      <svg {...common}>
        <path d="M4 16l5-5 4 3 7-8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="9" cy="11" r="1.4" fill="currentColor" />
        <circle cx="13" cy="14" r="1.4" fill="currentColor" />
      </svg>
    );
  return (
    <svg {...common}>
      <path d="M7 4h10v16l-5-3-5 3V4z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
