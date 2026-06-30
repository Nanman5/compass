"use client";

/**
 * Storytime — the shared "Story Together" voice experience over OpenAI Realtime (mode "story").
 *
 * Pure voice: the parent and Compass tell a story together, out loud, with fluid (never forced)
 * turn-taking that lives in the prompt. No screen tools — just a calm breathing presence and the
 * live narration as a caption. Same proven WebRTC plumbing as HelpMeNow/VoiceOnboarding.
 */

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

const MARK_COLOR = "/brand/compass-mark-color.png";

const slog = (...a: unknown[]) => console.info("[story]", ...a);
const serr = (...a: unknown[]) => console.error("[story]", ...a);

type Status = "connecting" | "live" | "error";

export default function Storytime({ familyId }: { familyId: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("connecting");
  const [caption, setCaption] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [muted, setMuted] = useState(false);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const micRef = useRef<MediaStream | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);

  const cleanup = useCallback(() => {
    micRef.current?.getTracks().forEach((t) => t.stop());
    micRef.current = null;
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
    router.push("/app");
  }, [cleanup, router]);

  const handleEvent = useCallback((raw: string) => {
    let msg: { type?: string; delta?: string };
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    const type = msg.type ?? "";
    if (type === "error") serr("realtime error:", raw.slice(0, 300));
    if (type.endsWith("transcript.delta") && typeof msg.delta === "string") {
      setCaption((c) => (c + msg.delta).slice(-280));
    } else if (type === "response.created") {
      setCaption("");
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const tokenRes = await fetch("/api/realtime/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "story", familyId }),
        });
        const token = await tokenRes.json();
        if (!tokenRes.ok) throw new Error(token.error || "Could not start the story");
        if (cancelled) return;

        const pc = new RTCPeerConnection();
        pcRef.current = pc;

        const audioEl = new Audio();
        audioEl.autoplay = true;
        audioElRef.current = audioEl;
        pc.ontrack = (e) => {
          audioEl.srcObject = e.streams[0];
        };

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
        if (!sdpRes.ok) throw new Error(`Story handshake failed (${sdpRes.status})`);
        const answer = { type: "answer" as const, sdp: await sdpRes.text() };
        if (cancelled) return;
        await pc.setRemoteDescription(answer);
        slog("handshake complete");
      } catch (err) {
        if (cancelled) return;
        const m = err instanceof Error ? err.message : "Story failed to start";
        serr("failed:", m);
        setErrorMsg(
          m.includes("Permission") || m.includes("denied")
            ? "I need the microphone to tell the story with you."
            : m,
        );
        setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
      cleanup();
    };
  }, [cleanup, handleEvent, familyId]);

  const toggleMute = useCallback(() => {
    const next = !muted;
    setMuted(next);
    micRef.current?.getAudioTracks().forEach((t) => (t.enabled = !next));
  }, [muted]);

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-cream">
      <div className="aurora" aria-hidden="true">
        <div className="blob blob-coral" />
        <div className="blob blob-teal" />
        <div className="blob blob-gold" />
        <div className="blob blob-rose" />
      </div>

      <button
        onClick={leave}
        className="glass absolute left-4 top-4 z-20 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold text-teal/80 transition hover:text-teal sm:left-6 sm:top-6"
        aria-label="End the story"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        The end
      </button>

      <div className="relative z-10 flex h-full flex-col items-center justify-between px-6 py-10">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-coral">
          {status === "connecting" ? "Once upon a time…" : status === "error" ? "Couldn't begin" : "Story together"}
        </p>

        {/* breathing presence */}
        <div className="flex flex-col items-center gap-8 text-center">
          <div className="relative grid h-64 w-64 place-items-center">
            <span className="voice-ring" style={{ width: "100%", height: "100%", animationDelay: "0s" }} />
            <span className="voice-ring" style={{ width: "76%", height: "76%", animationDelay: "0.8s" }} />
            <span className="voice-ring" style={{ width: "54%", height: "54%", animationDelay: "1.6s" }} />
            <span className="relative grid h-28 w-28 place-items-center">
              <span className="voice-halo" aria-hidden="true" />
              <Image src={MARK_COLOR} alt="Compass" width={88} height={88} priority className="compass-breathe relative" />
            </span>
          </div>

          <div className="min-h-[4rem] max-w-lg">
            {status === "error" ? (
              <p className="text-coral-deep">{errorMsg}</p>
            ) : (
              <p className="text-base leading-relaxed text-ink sm:text-lg">
                {caption ||
                  (status === "connecting"
                    ? "Settling in…"
                    : "Start us off, or say “you begin” — we’ll tell it together.")}
              </p>
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
          <button onClick={leave} className="btn btn-primary px-7" aria-label="Finish the story">
            {status === "error" ? "Back" : "Finish"}
          </button>
        </div>
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
