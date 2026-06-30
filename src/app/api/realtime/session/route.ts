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

import { GROUNDING_TOOLS } from "@/lib/grounding";
import { buildHelpNowInstructions, HELPNOW_TOOLS } from "@/lib/helpnow";
import { memory } from "@/lib/memory";
import { buildStoryInstructions, STORY_TOOLS, STORY_VOICE } from "@/lib/story";
import { UI_TOOLS } from "@/lib/uitools";
import { REALTIME_MODEL, REALTIME_VOICE, VOICE_INSTRUCTIONS, VOICE_TOOLS } from "@/lib/voice";

import type { RealtimeFunctionTool } from "openai/resources/realtime/realtime";

export const runtime = "nodejs";

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
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Voice is unavailable: OPENAI_API_KEY is not configured." },
      { status: 503 },
    );
  }

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
      value: secret.value,
      expiresAt: secret.expires_at,
      model: REALTIME_MODEL,
    });
  } catch (err) {
    console.error("[realtime] failed to mint client secret:", err);
    return NextResponse.json({ error: "Could not start a voice session" }, { status: 500 });
  }
}
