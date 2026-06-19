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

import { REALTIME_MODEL, REALTIME_VOICE, VOICE_INSTRUCTIONS, VOICE_TOOLS } from "@/lib/voice";

export const runtime = "nodejs";

export async function POST(): Promise<Response> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Voice is unavailable: OPENAI_API_KEY is not configured." },
      { status: 503 },
    );
  }

  try {
    const client = new OpenAI({ apiKey });
    const secret = await client.realtime.clientSecrets.create({
      session: {
        type: "realtime",
        model: REALTIME_MODEL,
        instructions: VOICE_INSTRUCTIONS,
        audio: { output: { voice: REALTIME_VOICE } },
        tools: VOICE_TOOLS,
        tool_choice: "auto",
      },
    });

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
