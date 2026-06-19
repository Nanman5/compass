"use client";

/**
 * VoiceOnboarding — spoken onboarding over OpenAI Realtime (gpt-realtime-2) via WebRTC.
 *
 * Flow (per the Realtime WebRTC guide):
 *  1. POST /api/realtime/session to mint an ephemeral client secret (our key never ships).
 *  2. Open an RTCPeerConnection: send the mic track, play the model's audio track, and
 *     open the "oai-events" data channel for events.
 *  3. POST our SDP offer to https://api.openai.com/v1/realtime/calls with the secret;
 *     apply the SDP answer.
 *  4. On the data channel: stream the assistant transcript as live captions, and when the
 *     model emits a function_call (in response.done), execute it against our APIs and send
 *     the result back (conversation.item.create → response.create).
 *
 * Tools the agent can call: save_family_profile (→ /api/profile) and research_parenting
 * (→ /api/evidence). A WebAudio analyser drives the calm ring animation (--level).
 *
 * The whole thing is a full-screen overlay with a peaceful, breathing visual.
 */

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

import type { ChildProfile } from "@/lib/types";

// Tool names — kept as literals so this client file never imports the server voice module.
const TOOL_SAVE_PROFILE = "save_family_profile";
const TOOL_RESEARCH = "research_parenting";

const MARK_COLOR = "/brand/compass-mark-color.png";

type Status = "connecting" | "live" | "error";

interface FunctionCallItem {
  type: string;
  name?: string;
  call_id?: string;
  arguments?: string;
}

export default function VoiceOnboarding({
  familyId,
  onClose,
  onProfileSaved,
}: {
  familyId: string;
  onClose: () => void;
  onProfileSaved?: (profile: ChildProfile) => void;
}) {
  const [status, setStatus] = useState<Status>("connecting");
  const [caption, setCaption] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [muted, setMuted] = useState(false);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const micRef = useRef<MediaStream | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const pulseRef = useRef<HTMLDivElement | null>(null);

  /** Tear down every audio/RTC resource. Safe to call multiple times. */
  const cleanup = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
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

  const close = useCallback(() => {
    cleanup();
    onClose();
  }, [cleanup, onClose]);

  /** Drive the calm ring animation from the model's audio amplitude. */
  const startAnalyser = useCallback((stream: MediaStream) => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    audioCtxRef.current = ctx;
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser); // analyser only — playback happens on the <audio> element
    const data = new Uint8Array(analyser.frequencyBinCount);
    let smoothed = 0;

    const tick = () => {
      analyser.getByteFrequencyData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) sum += data[i];
      const level = Math.min(1, sum / data.length / 90); // 0..1, gently scaled
      smoothed += (level - smoothed) * 0.18; // low-pass so it glides, never jitters
      pulseRef.current?.style.setProperty("--level", smoothed.toFixed(3));
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  /** Execute a tool the model asked for, then hand the result back over the data channel. */
  const executeTool = useCallback(
    async (item: FunctionCallItem) => {
      const dc = dcRef.current;
      if (!dc || !item.name || !item.call_id) return;
      let args: Record<string, unknown> = {};
      try {
        args = item.arguments ? JSON.parse(item.arguments) : {};
      } catch {
        /* leave args empty */
      }

      let result: unknown;
      try {
        if (item.name === TOOL_SAVE_PROFILE) {
          setNote("Saving what I learned…");
          const res = await fetch("/api/profile", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ familyId, ...args }),
          });
          const data = await res.json();
          if (data?.profile) {
            onProfileSaved?.(data.profile as ChildProfile);
            setNote(`Saved ${(data.profile as ChildProfile).childName}'s profile ✓`);
          }
          result = data;
        } else if (item.name === TOOL_RESEARCH) {
          setNote("Looking that up…");
          const query = typeof args.query === "string" ? args.query : "";
          const res = await fetch(`/api/evidence?query=${encodeURIComponent(query)}&limit=3`);
          result = await res.json();
          setNote(null);
        } else {
          result = { error: `unknown tool: ${item.name}` };
        }
      } catch (err) {
        result = { error: err instanceof Error ? err.message : "tool failed" };
      }

      dc.send(
        JSON.stringify({
          type: "conversation.item.create",
          item: {
            type: "function_call_output",
            call_id: item.call_id,
            output: JSON.stringify(result ?? {}),
          },
        }),
      );
      dc.send(JSON.stringify({ type: "response.create" }));
    },
    [familyId, onProfileSaved],
  );

  /** Handle one realtime server event off the data channel. */
  const handleEvent = useCallback(
    (raw: string) => {
      let msg: { type?: string; delta?: string; response?: { output?: FunctionCallItem[] } };
      try {
        msg = JSON.parse(raw);
      } catch {
        return;
      }
      const type = msg.type ?? "";

      // Live assistant captions: any "...transcript.delta" carries spoken text.
      if (type.endsWith("transcript.delta") && typeof msg.delta === "string") {
        setCaption((c) => c + msg.delta);
        return;
      }
      if (type === "response.created") {
        setCaption("");
        return;
      }
      // Tool calls arrive as function_call items in the finished response.
      if (type === "response.done") {
        for (const item of msg.response?.output ?? []) {
          if (item.type === "function_call") void executeTool(item);
        }
      }
    },
    [executeTool],
  );

  // Establish the realtime connection once, on mount.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const tokenRes = await fetch("/api/realtime/session", { method: "POST" });
        const token = await tokenRes.json();
        if (!tokenRes.ok) throw new Error(token.error || "Could not start voice");
        if (cancelled) return;

        const pc = new RTCPeerConnection();
        pcRef.current = pc;

        // Play the model's voice.
        const audioEl = new Audio();
        audioEl.autoplay = true;
        audioElRef.current = audioEl;
        pc.ontrack = (e) => {
          audioEl.srcObject = e.streams[0];
          startAnalyser(e.streams[0]);
        };

        // Send the mic.
        const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (cancelled) {
          mic.getTracks().forEach((t) => t.stop());
          return;
        }
        micRef.current = mic;
        mic.getTracks().forEach((t) => pc.addTrack(t, mic));

        // Events.
        const dc = pc.createDataChannel("oai-events");
        dcRef.current = dc;
        dc.onmessage = (e) => handleEvent(e.data);
        dc.onopen = () => !cancelled && setStatus("live");

        // Offer → OpenAI → answer.
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        const sdpRes = await fetch("https://api.openai.com/v1/realtime/calls", {
          method: "POST",
          body: offer.sdp,
          headers: { Authorization: `Bearer ${token.value}`, "Content-Type": "application/sdp" },
        });
        if (!sdpRes.ok) throw new Error("Voice handshake failed");
        const answer = { type: "answer" as const, sdp: await sdpRes.text() };
        if (cancelled) return;
        await pc.setRemoteDescription(answer);
      } catch (err) {
        if (cancelled) return;
        const m = err instanceof Error ? err.message : "Voice failed to start";
        setErrorMsg(m.includes("Permission") || m.includes("denied") ? "I need microphone access to talk." : m);
        setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [cleanup, handleEvent, startAnalyser]);

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

      <div className="relative z-10 flex h-full flex-col items-center justify-between px-6 py-10">
        {/* top: status */}
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-coral">
          {status === "connecting" ? "Connecting…" : status === "error" ? "Couldn't connect" : "Talking with Compass"}
        </p>

        {/* center: the breathing presence */}
        <div className="flex flex-col items-center gap-8">
          <div ref={pulseRef} className="voice-pulse relative grid h-64 w-64 place-items-center">
            <span className="voice-ring" style={{ width: "100%", height: "100%", animationDelay: "0s" }} />
            <span className="voice-ring" style={{ width: "76%", height: "76%", animationDelay: "0.8s" }} />
            <span className="voice-ring" style={{ width: "54%", height: "54%", animationDelay: "1.6s" }} />
            <span className="relative grid h-28 w-28 place-items-center">
              <span className="voice-halo" aria-hidden="true" />
              <Image src={MARK_COLOR} alt="Compass" width={88} height={88} priority className="compass-breathe relative" />
            </span>
          </div>

          {/* live caption / note */}
          <div className="min-h-[3.5rem] max-w-md text-center">
            {status === "error" ? (
              <p className="text-coral-deep">{errorMsg}</p>
            ) : (
              <>
                <p className="text-lg leading-relaxed text-ink">
                  {caption || (status === "connecting" ? "Warming up the microphone…" : "Say hello whenever you're ready.")}
                </p>
                {note && <p className="mt-2 text-sm font-semibold text-teal">{note}</p>}
              </>
            )}
          </div>
        </div>

        {/* bottom: controls */}
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
          <button
            onClick={close}
            className="btn btn-primary px-7"
            aria-label="End voice conversation"
          >
            {status === "error" ? "Back to chat" : "End conversation"}
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
