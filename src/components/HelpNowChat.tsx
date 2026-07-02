"use client";

/**
 * HelpNowChat — the PRIMARY "Help Me Now" surface: a calm text chat for hard moments.
 *
 * Co-regulation first, one tiny step at a time, over /api/helpnow. Voice is the visible
 * companion mode — a "Talk it out loud" button opens the existing full-screen voice
 * experience (HelpMeNow) as an overlay and returns here when it closes.
 *
 * Same visual language as the coach: cream, aurora, wet-glass bubbles, breathing mark.
 */

import Image from "next/image";
import { forwardRef, useCallback, useEffect, useRef, useState } from "react";

import { CompassStar } from "@/components/CompassStar";
import HelpMeNow from "@/components/HelpMeNow";

const MARK_COLOR = "/brand/compass-mark-color.png";

interface Turn {
  id: number;
  role: "parent" | "compass";
  text: string;
}

/** The opening line is static — a parent in a hard moment shouldn't wait for a model. */
const OPENING = "I'm right here. What's going on?";

export default function HelpNowChat({ familyId }: { familyId: string }) {
  const [turns, setTurns] = useState<Turn[]>([{ id: 0, role: "compass", text: OPENING }]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);

  const nextId = useRef(1);
  const scrollRef = useRef<HTMLElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Keep the newest message in view.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [turns, sending]);

  // Grow the textarea with its content.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [input]);

  const send = useCallback(async () => {
    const message = input.trim();
    if (!message || sending) return;

    const history = turns.map((t) => ({ role: t.role, text: t.text }));
    setTurns((prev) => [...prev, { id: nextId.current++, role: "parent", text: message }]);
    setInput("");
    setSending(true);
    try {
      const res = await fetch("/api/helpnow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ familyId, message, history }),
      });
      const data = (await res.json()) as { reply?: string; error?: string };
      if (!res.ok) throw new Error(data.error || "Couldn't reach Compass");
      setTurns((prev) => [
        ...prev,
        { id: nextId.current++, role: "compass", text: data.reply || "I'm here. Tell me more." },
      ]);
    } catch {
      setTurns((prev) => [
        ...prev,
        {
          id: nextId.current++,
          role: "compass",
          text: "I lost the connection for a second — I'm still here. Say that again?",
        },
      ]);
    } finally {
      setSending(false);
      requestAnimationFrame(() => textareaRef.current?.focus());
    }
  }, [input, sending, turns, familyId]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  };

  return (
    <div className="relative h-full w-full overflow-hidden bg-cream">
      <div className="aurora" aria-hidden="true">
        <div className="blob blob-coral" />
        <div className="blob blob-teal" />
        <div className="blob blob-gold" />
        <div className="blob blob-rose" />
      </div>

      <a
        href="/app"
        className="glass absolute left-4 top-4 z-20 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold text-teal/80 transition hover:text-teal sm:left-6 sm:top-6"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Back
      </a>

      {/* voice — always visible, one tap away (.glass sets position:relative, so the
          absolute anchoring lives on a wrapper) */}
      <div className="absolute right-16 top-4 z-20 sm:right-20 sm:top-6">
        <button
          onClick={() => setVoiceOpen(true)}
          className="glass inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-teal transition hover:bg-teal/5 active:scale-95"
        >
          <MicIcon />
          Talk it out loud
        </button>
      </div>

      <div className="relative z-10 flex h-full w-full flex-col">
        <header className="mx-auto flex w-full max-w-2xl shrink-0 flex-col items-center gap-1.5 px-4 pb-5 pt-8 text-center sm:px-6">
          <div className={sending ? "compass-thinking" : "compass-breathe"}>
            <Image src={MARK_COLOR} alt="Compass" width={52} height={52} priority />
          </div>
          <span
            style={{ fontFamily: "var(--font-display)" }}
            className="text-lg font-semibold tracking-tight text-teal"
          >
            Compass
          </span>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-coral">
            Help me now
          </p>
        </header>

        <main ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain scroll-smooth">
          <div className="mx-auto w-full max-w-2xl space-y-4 px-4 pb-8 sm:px-6">
            {turns.map((t) =>
              t.role === "parent" ? (
                <div key={t.id} className="msg-in flex justify-end">
                  <div className="max-w-[85%] rounded-3xl rounded-tr-md bg-teal px-5 py-3 text-[0.95rem] leading-relaxed text-cream shadow-[var(--shadow-card)]">
                    {t.text}
                  </div>
                </div>
              ) : (
                <div key={t.id} className="msg-in flex items-start gap-3">
                  <span className="mt-1 shrink-0">
                    <CompassStar size={24} />
                  </span>
                  <div className="glass max-w-[85%] rounded-3xl rounded-tl-md px-5 py-3.5">
                    <p className="text-[1rem] leading-relaxed text-ink/90">{t.text}</p>
                  </div>
                </div>
              ),
            )}

            {sending && (
              <div className="msg-in flex items-start gap-3">
                <span className="mt-1 shrink-0">
                  <CompassStar size={24} className="tool-spin" />
                </span>
                <div className="glass rounded-3xl rounded-tl-md px-5 py-3.5">
                  <span className="flex items-center gap-1.5">
                    {[0, 1, 2].map((d) => (
                      <span
                        key={d}
                        className="dot h-1.5 w-1.5 rounded-full bg-teal/50"
                        style={{ animationDelay: `${d * 0.16}s` }}
                      />
                    ))}
                  </span>
                </div>
              </div>
            )}
          </div>
        </main>

        <div className="mx-auto w-full max-w-2xl shrink-0 px-4 sm:px-6">
          <Composer
            ref={textareaRef}
            value={input}
            disabled={sending}
            onChange={setInput}
            onKeyDown={onKeyDown}
            onSend={() => void send()}
          />
        </div>
      </div>

      {/* the voice experience, one tap away, closing back into this chat */}
      {voiceOpen && <HelpMeNow familyId={familyId} onClose={() => setVoiceOpen(false)} />}
    </div>
  );
}

/* ───────────────────────────────────────── composer */

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
        <label htmlFor="helpnow-input" className="sr-only">
          Tell Compass what&apos;s happening
        </label>
        <textarea
          id="helpnow-input"
          ref={ref}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          rows={1}
          disabled={disabled}
          placeholder="What's happening right now?"
          className="max-h-40 flex-1 resize-none bg-transparent py-2.5 pl-3 text-[0.98rem] text-ink placeholder:text-muted/70 focus:outline-none disabled:opacity-50"
        />
        <button
          onClick={onSend}
          disabled={disabled || value.trim().length === 0}
          aria-label="Send"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-coral text-cream shadow-[0_10px_22px_-12px_rgba(225,120,92,0.9)] transition duration-200 hover:bg-coral-deep hover:scale-105 active:scale-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M5 12h13M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
      <p className="mt-2 text-center text-[0.72rem] text-muted/80">
        Compass gives guidance, not medical advice. For health concerns, see your pediatrician.
      </p>
    </div>
  );
});

function MicIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="9" y="3" width="6" height="11" rx="3" stroke="currentColor" strokeWidth="2" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
