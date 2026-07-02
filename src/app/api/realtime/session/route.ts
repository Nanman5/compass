/**
 * POST /api/realtime/session — mint a short-lived OpenAI Realtime client secret.
 *
 * The browser must NOT see our OpenAI API key. Instead we mint an ephemeral client
 * secret (an `ek_...` value) here, with the session pre-configured for voice onboarding:
 * the gpt-realtime-2 model, the Compass voice instructions, a warm voice, and the two
 * basic tools (save profile, research). The client uses this secret to open a WebRTC
 * session directly with OpenAI; the secret expires quickly and can't touch anything else.
 *
 * Returns: { value: string, expiresAt: number, model: string }
 * Server-only (reads OPENAI_API_KEY).
 */

import "server-only";

import { NextResponse } from "next/server";
import OpenAI from "openai";

import { familyAccessError } from "@/lib/authz";
import { GROUNDING_TOOLS } from "@/lib/grounding";
import { buildHelpNowInstructions, HELPNOW_TOOLS } from "@/lib/helpnow";
import { memory } from "@/lib/memory";
import { buildStoryInstructions, STORY_TOOLS, STORY_VOICE } from "@/lib/story";
import { UI_TOOLS } from "@/lib/uitools";
import { REALTIME_MODEL, REALTIME_VOICE, VOICE_INSTRUCTIONS, VOICE_TOOLS } from "@/lib/voice";

import type { RealtimeFunctionTool } from "openai/resources/realtime/realtime";

export const runtime = "nodejs";

/* ─────────────────────────────── Gemini Live fallback (no OpenAI key / mint failed) */

const GEMINI_LIVE_MODEL = process.env.GEMINI_LIVE_MODEL || "gemini-3.1-flash-live-preview";

/** RealtimeFunctionTool → Gemini functionDeclaration (drop keys its schema rejects). */
function toGeminiTools(tools: RealtimeFunctionTool[]) {
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    parameters: stripSchemaKeys(t.parameters) as Record<string, unknown>,
  }));
}

function stripSchemaKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripSchemaKeys);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (k === "additionalProperties" || k === "$schema") continue;
      out[k] = stripSchemaKeys(v);
    }
    return out;
  }
  return value;
}

/**
 * Mint a short-lived Gemini ephemeral token (an `auth_tokens/...` name). The browser uses
 * it on the Live API's Constrained bidi endpoint — the real GEMINI_API_KEY never ships.
 */
async function mintGeminiLiveSession(
  instructions: string,
  tools: RealtimeFunctionTool[],
): Promise<Response> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "Voice is unavailable: no OPENAI_API_KEY or GEMINI_API_KEY configured." },
      { status: 503 },
    );
  }
  const expiresAt = Date.now() + 10 * 60_000;
  const res = await fetch("https://generativelanguage.googleapis.com/v1alpha/auth_tokens", {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({ uses: 1, expireTime: new Date(expiresAt).toISOString() }),
    signal: AbortSignal.timeout(8_000),
  });
  if (!res.ok) {
    console.error(`[realtime] gemini token mint failed (${res.status})`);
    return NextResponse.json({ error: "Could not start a voice session" }, { status: 500 });
  }
  const token = (await res.json()) as { name?: string };
  if (!token.name) {
    return NextResponse.json({ error: "Could not start a voice session" }, { status: 500 });
  }
  console.info(`[voice] minted GEMINI live token (fallback, model=${GEMINI_LIVE_MODEL})`);
  return NextResponse.json({
    provider: "gemini",
    value: token.name,
    expiresAt: Math.floor(expiresAt / 1000),
    model: `models/${GEMINI_LIVE_MODEL}`,
    // The Constrained endpoint takes setup from the client, so ship the session config.
    // These reach only this user's own browser — no keys, no other family's data.
    instructions,
    tools: toGeminiTools(tools),
  });
}

/**
 * Input-audio config shared by both personas. Tuned to stop the agent interrupting ITSELF
 * on a phone: the speaker's audio bleeds into the mic, and the default VAD reads that echo
 * as the parent talking → it barges in on its own reply and transcribes the echo (the
 * "hallucination"). Mitigations, layered with the client's echo-cancellation constraints:
 *   • noise_reduction `near_field` — for a phone held close (cuts background + echo bleed).
 *   • server_vad threshold 0.6 (above default 0.5) — needs louder, clearer speech to fire,
 *     so attenuated echo no longer trips it; longer silence avoids jumping on short pauses.
 * interrupt_response stays true so a REAL interruption from the parent still works.
 */
const INPUT_AUDIO = {
  noise_reduction: { type: "near_field" as const },
  turn_detection: {
    type: "server_vad" as const,
    threshold: 0.6,
    prefix_padding_ms: 300,
    silence_duration_ms: 600,
    create_response: true,
    interrupt_response: true,
  },
};

/**
 * Body (all optional): { mode?: "onboarding" | "helpnow", familyId?: string }.
 * Default mode is onboarding (so existing callers that POST no body keep working). For
 * "helpnow" we personalize the crisis-coach instructions with the family's saved profile.
 */
export async function POST(req: Request): Promise<Response> {
  let mode: "onboarding" | "helpnow" | "story" = "onboarding";
  let familyId = "";
  try {
    const body = (await req.json()) as { mode?: string; familyId?: string };
    if (body?.mode === "helpnow") mode = "helpnow";
    else if (body?.mode === "story") mode = "story";
    if (typeof body?.familyId === "string") familyId = body.familyId.trim();
  } catch {
    /* no body → onboarding defaults */
  }

  // The familyId is only used to personalize instructions with that family's profile —
  // still gate it, so a stranger can't mint a session pre-loaded with someone else's child.
  if (familyId) {
    const denied = await familyAccessError(familyId);
    if (denied) return denied;
  }

  let instructions = VOICE_INSTRUCTIONS;
  let tools: RealtimeFunctionTool[] = VOICE_TOOLS;
  let voice = REALTIME_VOICE;
  if (mode === "helpnow") {
    const profile = familyId ? await memory.getProfile(familyId).catch(() => null) : null;
    instructions = buildHelpNowInstructions(profile);
    // The crisis coach can drive the screen (timer/scene) and check the live web (grounding).
    tools = [...HELPNOW_TOOLS, ...UI_TOOLS, ...GROUNDING_TOOLS];
  } else if (mode === "story") {
    const profile = familyId ? await memory.getProfile(familyId).catch(() => null) : null;
    instructions = buildStoryInstructions(profile);
    tools = STORY_TOOLS;
    voice = STORY_VOICE; // a more theatrical voice for the storyteller
  }

  // Primary: OpenAI Realtime (WebRTC). Fallback: Gemini Live (gemini-3.1-flash-live-preview)
  // when no OpenAI key is configured or the mint fails, so voice keeps working.
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return mintGeminiLiveSession(instructions, tools);
  }
  try {
    const client = new OpenAI({ apiKey });
    const secret = await client.realtime.clientSecrets.create({
      session: {
        type: "realtime",
        model: REALTIME_MODEL,
        instructions,
        audio: { input: INPUT_AUDIO, output: { voice } },
        tools,
        tool_choice: "auto",
      },
    });

    console.info(`[voice] minted realtime token (mode=${mode}, model=${REALTIME_MODEL}, voice=${voice})`);
    return NextResponse.json({
      provider: "openai",
      value: secret.value,
      expiresAt: secret.expires_at,
      model: REALTIME_MODEL,
    });
  } catch (err) {
    console.error("[realtime] openai mint failed, trying gemini live fallback:", err);
    return mintGeminiLiveSession(instructions, tools);
  }
}
