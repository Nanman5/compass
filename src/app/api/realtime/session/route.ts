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

import { buildHelpNowInstructions, HELPNOW_TOOLS } from "@/lib/helpnow";
import { memory } from "@/lib/memory";
import { REALTIME_MODEL, REALTIME_VOICE, VOICE_INSTRUCTIONS, VOICE_TOOLS } from "@/lib/voice";

import type { RealtimeFunctionTool } from "openai/resources/realtime/realtime";

export const runtime = "nodejs";

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

  let mode: "onboarding" | "helpnow" = "onboarding";
  let familyId = "";
  try {
    const body = (await req.json()) as { mode?: string; familyId?: string };
    if (body?.mode === "helpnow") mode = "helpnow";
    if (typeof body?.familyId === "string") familyId = body.familyId.trim();
  } catch {
    /* no body → onboarding defaults */
  }

  let instructions = VOICE_INSTRUCTIONS;
  let tools: RealtimeFunctionTool[] = VOICE_TOOLS;
  if (mode === "helpnow") {
    const profile = familyId ? await memory.getProfile(familyId).catch(() => null) : null;
    instructions = buildHelpNowInstructions(profile);
    tools = HELPNOW_TOOLS;
  }

  try {
    const client = new OpenAI({ apiKey });
    const secret = await client.realtime.clientSecrets.create({
      session: {
        type: "realtime",
        model: REALTIME_MODEL,
        instructions,
        audio: { output: { voice: REALTIME_VOICE } },
        tools,
        tool_choice: "auto",
      },
    });

    console.info(`[voice] minted realtime token (mode=${mode}, model=${REALTIME_MODEL}, voice=${REALTIME_VOICE})`);
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
