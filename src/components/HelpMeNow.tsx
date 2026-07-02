"use client";

/**
 * HelpMeNow — the in-the-moment crisis voice coach over OpenAI Realtime (gpt-realtime-2).
 *
 * Same WebRTC flow as VoiceOnboarding, but a different persona: it co-regulates the PARENT
 * first, then offers one tiny next thing. The session is minted with mode:"helpnow" so the
 * server personalizes the coach with this family's profile, and its one tool (log_help_moment)
 * quietly records the moment as an episode (→ /api/episodes) for the family's history.
 *
 * Full-screen, peaceful: drifting aurora + a breathing Compass presence + live captions.
 */

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { connectGeminiLive, type LiveVoiceSession } from "@/lib/livevoice";

// Tool names kept as literals so this client file never imports the server modules.
const TOOL_LOG_MOMENT = "log_help_moment";
const TOOL_START_TIMER = "start_timer"; // UI-control tool (#11): a calm visible countdown
const TOOL_SHOW_SCENE = "show_scene";
const TOOL_LOOK_IT_UP = "look_it_up"; // live-web grounding via Gemini + Google Search
const MARK_COLOR = "/brand/compass-mark-color.png";

const hlog = (...a: unknown[]) => console.info("[helpnow]", ...a);
const herr = (...a: unknown[]) => console.error("[helpnow]", ...a);

type Status = "connecting" | "live" | "error";

interface FunctionCallItem {
  type: string;
  name?: string;
  call_id?: string;
  arguments?: string;
}

/** A calm countdown the agent can drop on screen (breathing / wind-down). */
interface CalmTimer {
  label: string;
  total: number;
  remaining: number;
}

export default function HelpMeNow({ familyId, onClose }: { familyId: string; onClose?: () => void }) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("connecting");
  const [caption, setCaption] = useState("");
  const [logged, setLogged] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [muted, setMuted] = useState(false);
  const [timer, setTimer] = useState<CalmTimer | null>(null);
  const [scene, setScene] = useState<{ emoji: string; caption: string } | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const liveRef = useRef<LiveVoiceSession | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const micRef = useRef<MediaStream | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const pulseRef = useRef<HTMLDivElement | null>(null);

  const cleanup = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    micRef.current?.getTracks().forEach((t) => t.stop());
    micRef.current = null;
    liveRef.current?.close();
    liveRef.current = null;
    dcRef.current?.close();
    dcRef.current = null;
    pcRef.current?.close();
    pcRef.current = null;
    if (audioElRef.current) {
      audioElRef.current.srcObject = null;
      audioElRef.current = null;
    }
  }, []);

  const leave = useCallback(() => {
    cleanup();
    // As an overlay over the Help Now chat, closing returns to the chat; standalone, go home.
    if (onClose) onClose();
    else router.push("/app");
  }, [cleanup, router, onClose]);

  /** Some parents don't want to talk out loud in a hard moment — let them switch to the
   *  text coach instead. We tear down the voice session first, then hand off. */
  const switchToChat = useCallback(() => {
    cleanup();
    router.push("/app/coach");
  }, [cleanup, router]);

  // Count an agent-started timer down; clear it shortly after it reaches zero.
  useEffect(() => {
    if (!timer) return;
    if (timer.remaining <= 0) {
      const t = setTimeout(() => setTimer(null), 1200);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setTimer((c) => (c ? { ...c, remaining: c.remaining - 1 } : c)), 1000);
    return () => clearTimeout(t);
  }, [timer]);

  /** Drive the calm ring animation from the model's audio amplitude. */
  const startAnalyser = useCallback((stream: MediaStream) => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    audioCtxRef.current = ctx;
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);
    let smoothed = 0;
    const tick = () => {
      analyser.getByteFrequencyData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) sum += data[i];
      const level = Math.min(1, sum / data.length / 90);
      smoothed += (level - smoothed) * 0.18;
      pulseRef.current?.style.setProperty("--level", smoothed.toFixed(3));
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  /** Do the actual tool work (shared by the WebRTC and Gemini Live transports). */
  const runTool = useCallback(
    async (name: string, args: Record<string, unknown>): Promise<unknown> => {
      hlog("tool call →", name, args);
      let result: unknown;
      try {
        if (name === TOOL_LOG_MOMENT) {
          const res = await fetch("/api/episodes", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              familyId,
              situation: typeof args.situation === "string" ? args.situation : "",
              suggestion: typeof args.suggestion === "string" ? args.suggestion : "",
            }),
          });
          result = await res.json();
          if (res.ok) setLogged(true);
        } else if (name === TOOL_START_TIMER) {
          // UI-control tool (#11): a calm visible countdown — breathing / wind-down.
          const total = Math.max(3, Math.min(120, Number(args.seconds) || 20));
          const label = typeof args.label === "string" ? args.label : "Three slow breaths";
          setTimer({ label, total, remaining: total });
          result = { ok: true };
        } else if (name === TOOL_SHOW_SCENE) {
          // UI-control tool (#11): paint a calming scene the parent can look at.
          setScene({
            emoji: typeof args.emoji === "string" ? args.emoji : "✨",
            caption: typeof args.caption === "string" ? args.caption : "",
          });
          result = { ok: true };
        } else if (name === TOOL_LOOK_IT_UP) {
          // live-web grounding (Gemini + Google Search) so the agent can check real info.
          const q = typeof args.query === "string" ? args.query : "";
          const r = await fetch("/api/search", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query: q, familyId }),
          });
          result = r.ok ? await r.json() : { error: "couldn't look that up" };
        } else {
          result = { error: `unknown tool: ${name}` };
        }
      } catch (err) {
        herr("tool failed:", name, err);
        result = { error: err instanceof Error ? err.message : "tool failed" };
      }
      return result;
    },
    [familyId],
  );

  /** Execute a tool the model asked for, then hand the result back over the data channel. */
  const executeTool = useCallback(
    async (item: FunctionCallItem) => {
      const dc = dcRef.current;
      if (!dc || !item.name || !item.call_id) return;
      let args: Record<string, unknown> = {};
      try {
        args = item.arguments ? JSON.parse(item.arguments) : {};
      } catch {
        /* leave empty */
      }
      const result = await runTool(item.name, args);
      dc.send(
        JSON.stringify({
          type: "conversation.item.create",
          item: { type: "function_call_output", call_id: item.call_id, output: JSON.stringify(result ?? {}) },
        }),
      );
      dc.send(JSON.stringify({ type: "response.create" }));
    },
    [runTool],
  );

  const handleEvent = useCallback(
    (raw: string) => {
      let msg: { type?: string; delta?: string; response?: { output?: FunctionCallItem[] } };
      try {
        msg = JSON.parse(raw);
      } catch {
        return;
      }
      const type = msg.type ?? "";
      if (type === "error") herr("realtime error event:", raw.slice(0, 400));
      if (type.endsWith("transcript.delta") && typeof msg.delta === "string") {
        setCaption((c) => c + msg.delta);
        return;
      }
      if (type === "response.created") {
        setCaption("");
        return;
      }
      if (type === "response.done") {
        for (const item of msg.response?.output ?? []) {
          if (item.type === "function_call") void executeTool(item);
        }
      }
    },
    [executeTool],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        hlog("starting help session…");
        const tokenRes = await fetch("/api/realtime/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "helpnow", familyId }),
        });
        const token = await tokenRes.json();
        if (!tokenRes.ok) throw new Error(token.error || "Could not start voice");
        if (cancelled) return;

        // ── Gemini Live transport (fallback when OpenAI is unavailable or rejects) ──
        const startGemini = (tok: typeof token, mic: MediaStream) => {
          hlog("connecting via gemini live fallback:", tok.model);
          liveRef.current = connectGeminiLive({
            token: tok.value,
            model: tok.model,
            instructions: tok.instructions ?? "",
            tools: tok.tools ?? [],
            mic,
            onOpen: () => {
              if (!cancelled) setStatus("live");
            },
            onTurnStart: () => setCaption(""),
            onCaptionDelta: (t) => setCaption((c) => c + t),
            onToolCall: runTool,
            onLevel: (level) => pulseRef.current?.style.setProperty("--level", String(level)),
            onError: (m) => {
              if (cancelled) return;
              herr("gemini live error:", m);
              setStatus("error");
            },
          });
        };

        if (token.provider === "gemini") {
          const mic = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
          });
          if (cancelled) {
            mic.getTracks().forEach((t) => t.stop());
            return;
          }
          micRef.current = mic;
          startGemini(token, mic);
          return;
        }

        const pc = new RTCPeerConnection();
        pcRef.current = pc;

        const audioEl = new Audio();
        audioEl.autoplay = true;
        audioElRef.current = audioEl;
        pc.ontrack = (e) => {
          audioEl.srcObject = e.streams[0];
          startAnalyser(e.streams[0]);
        };

        // Echo cancellation is ESSENTIAL on a phone speaker: otherwise the agent hears its
        // own voice and interrupts itself / transcribes the echo as if the parent spoke.
        const mic = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        });
        if (cancelled) {
          mic.getTracks().forEach((t) => t.stop());
          return;
        }
        micRef.current = mic;
        mic.getTracks().forEach((t) => pc.addTrack(t, mic));

        const dc = pc.createDataChannel("oai-events");
        dcRef.current = dc;
        dc.onmessage = (e) => handleEvent(e.data);
        dc.onopen = () => {
          if (!cancelled) setStatus("live");
        };

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        const sdpRes = await fetch("https://api.openai.com/v1/realtime/calls", {
          method: "POST",
          body: offer.sdp,
          headers: { Authorization: `Bearer ${token.value}`, "Content-Type": "application/sdp" },
        });
        if (!sdpRes.ok) {
          // OpenAI minted a token but rejected the call (e.g. 429 quota) — switch to Gemini.
          hlog(`openai handshake failed (${sdpRes.status}) → trying gemini live fallback`);
          pc.close();
          pcRef.current = null;
          dcRef.current = null;
          const fbRes = await fetch("/api/realtime/session", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ mode: "helpnow", familyId, provider: "gemini" }),
          });
          const fb = await fbRes.json();
          if (cancelled) return;
          if (!fbRes.ok || fb.provider !== "gemini") {
            throw new Error(`Voice handshake failed (${sdpRes.status})`);
          }
          startGemini(fb, mic);
          return;
        }
        const answer = { type: "answer" as const, sdp: await sdpRes.text() };
        if (cancelled) return;
        await pc.setRemoteDescription(answer);
        hlog("handshake complete");
      } catch (err) {
        if (cancelled) return;
        const m = err instanceof Error ? err.message : "Voice failed to start";
        herr("failed to start:", m);
        setErrorMsg(m.includes("Permission") || m.includes("denied") ? "I need microphone access to talk with you." : m);
        setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
      cleanup();
    };
  }, [cleanup, handleEvent, runTool, startAnalyser, familyId]);

  const toggleMute = useCallback(() => {
    const next = !muted;
    setMuted(next);
    micRef.current?.getAudioTracks().forEach((t) => (t.enabled = !next));
    liveRef.current?.setMuted(next); // gemini fallback: also stop sending frames
  }, [muted]);

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-cream">
      <div className="aurora" aria-hidden="true">
        <div className="blob blob-coral" />
        <div className="blob blob-teal" />
        <div className="blob blob-gold" />
        <div className="blob blob-rose" />
      </div>

      <div className="relative z-10 flex h-full flex-col items-center justify-between px-6 py-10">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-coral">
          {status === "connecting" ? "I'm right here…" : status === "error" ? "Couldn't connect" : "Help me now"}
        </p>

        <div className="flex flex-col items-center gap-8">
          {scene && (
            <div key={scene.emoji + scene.caption} className="msg-in flex flex-col items-center gap-1.5">
              <span className="text-6xl" aria-hidden="true">{scene.emoji}</span>
              {scene.caption && (
                <span className="text-base font-semibold text-teal" style={{ fontFamily: "var(--font-display)" }}>
                  {scene.caption}
                </span>
              )}
            </div>
          )}
          <div ref={pulseRef} className="voice-pulse relative grid h-64 w-64 place-items-center">
            <span className="voice-ring" style={{ width: "100%", height: "100%", animationDelay: "0s" }} />
            <span className="voice-ring" style={{ width: "76%", height: "76%", animationDelay: "0.8s" }} />
            <span className="voice-ring" style={{ width: "54%", height: "54%", animationDelay: "1.6s" }} />
            <span className="relative grid h-28 w-28 place-items-center">
              <span className="voice-halo" aria-hidden="true" />
              <Image src={MARK_COLOR} alt="Compass" width={88} height={88} priority className="compass-breathe relative" />
            </span>
          </div>

          <div className="min-h-[4rem] max-w-xs text-center sm:max-w-md">
            {status === "error" ? (
              <p className="text-coral-deep">{errorMsg}</p>
            ) : (
              <>
                <p className="text-base leading-relaxed text-ink sm:text-lg">
                  {caption ||
                    (status === "connecting"
                      ? "Take a slow breath. I'm getting ready…"
                      : "I'm here with you. Tell me what's happening.")}
                </p>
                {logged && (
                  <p className="mt-3 text-sm text-teal/70">Saved this moment — we’ll check in on it later.</p>
                )}
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4">
          {status === "live" && (
            <button
              onClick={toggleMute}
              aria-pressed={muted}
              className="glass grid h-14 w-14 place-items-center rounded-full text-teal transition hover:scale-105 active:scale-95"
              aria-label={muted ? "Unmute microphone" : "Mute microphone"}
            >
              {muted ? <MicOffIcon /> : <MicIcon />}
            </button>
          )}
          {/* Don't want to talk out loud? Switch to typing it through with the coach. */}
          <button
            onClick={switchToChat}
            aria-label="Switch to text chat instead"
            title="Rather type? Switch to chat"
            className="glass grid h-14 w-14 place-items-center rounded-full text-teal transition hover:scale-105 active:scale-95"
          >
            <ChatIcon />
          </button>
          <button onClick={leave} className="btn btn-primary px-7" aria-label="End and go back">
            {status === "error" ? "Back" : "I'm okay now"}
          </button>
        </div>
      </div>

      {timer && <CalmTimerOverlay timer={timer} />}
    </div>
  );
}

/** Full-screen calm countdown the agent drops in (start_timer) — breathing / wind-down. */
function CalmTimerOverlay({ timer }: { timer: CalmTimer }) {
  const pct = Math.max(0, timer.remaining / timer.total);
  const R = 52;
  const C = 2 * Math.PI * R;
  return (
    <div className="absolute inset-0 z-30 grid place-items-center bg-cream/70 backdrop-blur-sm">
      <div className="glass flex flex-col items-center gap-4 rounded-[2rem] px-10 py-8 text-center">
        <div className="relative grid h-32 w-32 place-items-center">
          <svg width="128" height="128" viewBox="0 0 128 128" className="-rotate-90">
            <circle cx="64" cy="64" r={R} fill="none" stroke="rgba(30,77,74,0.12)" strokeWidth="8" />
            <circle
              cx="64" cy="64" r={R} fill="none" stroke="var(--color-coral)" strokeWidth="8" strokeLinecap="round"
              strokeDasharray={C} strokeDashoffset={C * (1 - pct)}
              style={{ transition: "stroke-dashoffset 1s linear" }}
            />
          </svg>
          <span className="absolute text-3xl font-semibold text-teal">{Math.max(0, timer.remaining)}</span>
        </div>
        <p className="text-lg font-semibold text-teal" style={{ fontFamily: "var(--font-display)" }}>
          {timer.label}
        </p>
      </div>
    </div>
  );
}

function MicIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="9" y="3" width="6" height="11" rx="3" stroke="currentColor" strokeWidth="2" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function MicOffIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M9 9v2a3 3 0 0 0 4.5 2.6M15 11V6a3 3 0 0 0-5.8-1.1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M5 11a7 7 0 0 0 10.5 6.1M12 18v3M4 4l16 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7a2.5 2.5 0 0 1-2.5 2.5H10l-4 3.5v-3.5A2.5 2.5 0 0 1 4 13.5v-7z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}
