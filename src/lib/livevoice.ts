/**
 * Compass — minimal Gemini Live audio client (the voice FALLBACK path).
 *
 * The primary voice stack is OpenAI Realtime over WebRTC (see VoiceOnboarding / HelpMeNow).
 * When OpenAI isn't available, /api/realtime/session mints a Gemini ephemeral token instead
 * and the components connect through here: a WebSocket to the Live API's *Constrained*
 * bidi endpoint (the only method ephemeral tokens may call), mic PCM16@16k up, PCM16@24k
 * audio down, with function calling and output transcription for captions.
 *
 * Browser-only (WebAudio + WebSocket). No API keys touch this file — only the short-lived
 * `auth_tokens/...` value minted server-side.
 */

const LIVE_WS_BASE =
  "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContentConstrained";

const INPUT_RATE = 16_000;
const OUTPUT_RATE = 24_000;

export interface GeminiFunctionDeclaration {
  name: string;
  description?: string;
  parameters?: Record<string, unknown>;
}

export interface LiveVoiceOptions {
  /** Ephemeral token from /api/realtime/session (an `auth_tokens/...` name). */
  token: string;
  /** e.g. "models/gemini-3.1-flash-live-preview" (server sends it fully qualified). */
  model: string;
  instructions: string;
  tools: GeminiFunctionDeclaration[];
  mic: MediaStream;
  onOpen: () => void;
  /** Streamed caption text for what the model is saying. */
  onCaptionDelta: (text: string) => void;
  /** A new model turn began (clear the caption). */
  onTurnStart: () => void;
  /** Execute a tool and resolve its result (mirrors the WebRTC path's dispatch). */
  onToolCall: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  /** Smoothed model-speech level 0..1 — drives the breathing ring. */
  onLevel?: (level: number) => void;
  onError: (message: string) => void;
}

export interface LiveVoiceSession {
  close: () => void;
  setMuted: (muted: boolean) => void;
}

interface ServerMessage {
  setupComplete?: unknown;
  serverContent?: {
    interrupted?: boolean;
    turnComplete?: boolean;
    outputTranscription?: { text?: string };
    modelTurn?: { parts?: Array<{ inlineData?: { data?: string; mimeType?: string } }> };
  };
  toolCall?: {
    functionCalls?: Array<{ id?: string; name?: string; args?: Record<string, unknown> }>;
  };
}

export function connectGeminiLive(opts: LiveVoiceOptions): LiveVoiceSession {
  let closed = false;
  let muted = false;
  let turnOpen = false;

  const ws = new WebSocket(`${LIVE_WS_BASE}?access_token=${encodeURIComponent(opts.token)}`);

  /* ── playback: schedule 24k PCM16 chunks back-to-back on one clock ── */
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const playCtx = new AudioCtx({ sampleRate: OUTPUT_RATE });
  let playHead = 0;
  const liveSources = new Set<AudioBufferSourceNode>();
  let smoothedLevel = 0;

  const playChunk = (b64: string) => {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const samples = new Int16Array(bytes.buffer, 0, Math.floor(bytes.byteLength / 2));
    if (samples.length === 0) return;

    const buffer = playCtx.createBuffer(1, samples.length, OUTPUT_RATE);
    const channel = buffer.getChannelData(0);
    let sum = 0;
    for (let i = 0; i < samples.length; i++) {
      const v = samples[i] / 32768;
      channel[i] = v;
      sum += v * v;
    }
    // Feed the ring animation from this chunk's RMS (low-passed so it glides).
    const rms = Math.min(1, Math.sqrt(sum / samples.length) * 4);
    smoothedLevel += (rms - smoothedLevel) * 0.3;
    opts.onLevel?.(Number(smoothedLevel.toFixed(3)));

    const src = playCtx.createBufferSource();
    src.buffer = buffer;
    src.connect(playCtx.destination);
    liveSources.add(src);
    src.onended = () => {
      liveSources.delete(src);
      if (liveSources.size === 0) opts.onLevel?.(0);
    };
    playHead = Math.max(playHead, playCtx.currentTime) + buffer.duration;
    src.start(playHead - buffer.duration);
  };

  /** The parent interrupted — drop everything queued so the model goes quiet at once. */
  const flushPlayback = () => {
    for (const src of liveSources) {
      try {
        src.stop();
      } catch {
        /* already stopped */
      }
    }
    liveSources.clear();
    playHead = 0;
    opts.onLevel?.(0);
  };

  /* ── capture: mic → downsample to 16k PCM16 → realtimeInput frames ── */
  const capCtx = new AudioCtx();
  const source = capCtx.createMediaStreamSource(opts.mic);
  // ScriptProcessor is deprecated but universally supported — right for a fallback path.
  const processor = capCtx.createScriptProcessor(4096, 1, 1);
  const ratio = capCtx.sampleRate / INPUT_RATE;

  processor.onaudioprocess = (e) => {
    if (closed || muted || ws.readyState !== WebSocket.OPEN) return;
    const input = e.inputBuffer.getChannelData(0);
    const outLen = Math.floor(input.length / ratio);
    const pcm = new Int16Array(outLen);
    for (let i = 0; i < outLen; i++) {
      const v = Math.max(-1, Math.min(1, input[Math.floor(i * ratio)]));
      pcm[i] = v < 0 ? v * 0x8000 : v * 0x7fff;
    }
    let bin = "";
    const bytes = new Uint8Array(pcm.buffer);
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    ws.send(
      JSON.stringify({
        realtimeInput: { audio: { data: btoa(bin), mimeType: `audio/pcm;rate=${INPUT_RATE}` } },
      }),
    );
  };
  source.connect(processor);
  processor.connect(capCtx.destination); // required for onaudioprocess to fire (silent: gain 0 not needed, processor outputs nothing)

  /* ── protocol ── */
  ws.onopen = () => {
    ws.send(
      JSON.stringify({
        setup: {
          model: opts.model,
          generationConfig: { responseModalities: ["AUDIO"] },
          systemInstruction: { parts: [{ text: opts.instructions }] },
          ...(opts.tools.length > 0 ? { tools: [{ functionDeclarations: opts.tools }] } : {}),
          outputAudioTranscription: {},
        },
      }),
    );
  };

  ws.onmessage = async (e) => {
    const text = typeof e.data === "string" ? e.data : await (e.data as Blob).text();
    let msg: ServerMessage;
    try {
      msg = JSON.parse(text) as ServerMessage;
    } catch {
      return;
    }

    if (msg.setupComplete !== undefined) {
      opts.onOpen();
      return;
    }

    const content = msg.serverContent;
    if (content) {
      if (content.interrupted) {
        flushPlayback();
        turnOpen = false;
      }
      const parts = content.modelTurn?.parts ?? [];
      const hasAudio = parts.some((p) => p.inlineData?.data);
      if ((hasAudio || content.outputTranscription) && !turnOpen) {
        turnOpen = true;
        opts.onTurnStart();
      }
      for (const part of parts) {
        if (part.inlineData?.data) playChunk(part.inlineData.data);
      }
      if (content.outputTranscription?.text) {
        opts.onCaptionDelta(content.outputTranscription.text);
      }
      if (content.turnComplete) turnOpen = false;
    }

    for (const call of msg.toolCall?.functionCalls ?? []) {
      if (!call.name || !call.id) continue;
      let response: unknown;
      try {
        response = await opts.onToolCall(call.name, call.args ?? {});
      } catch (err) {
        response = { error: err instanceof Error ? err.message : "tool failed" };
      }
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            toolResponse: {
              functionResponses: [{ id: call.id, name: call.name, response: wrapResponse(response) }],
            },
          }),
        );
      }
    }
  };

  ws.onclose = (e) => {
    if (closed) return;
    // 1000 = clean end; anything else while the surface is open is worth surfacing.
    if (e.code !== 1000) opts.onError(e.reason || "Voice connection closed");
  };
  ws.onerror = () => {
    if (!closed) opts.onError("Voice connection failed");
  };

  const close = () => {
    closed = true;
    processor.disconnect();
    source.disconnect();
    capCtx.close().catch(() => {});
    flushPlayback();
    playCtx.close().catch(() => {});
    try {
      ws.close(1000);
    } catch {
      /* already closed */
    }
  };

  return {
    close,
    setMuted: (m) => {
      muted = m;
    },
  };
}

/** The Live API wants an OBJECT response; wrap primitives/arrays so nothing throws. */
function wrapResponse(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return { result: value ?? null };
}
