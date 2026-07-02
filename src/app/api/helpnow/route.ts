/**
 * POST /api/helpnow — one turn of the Help Me Now TEXT chat (the primary surface;
 * voice is the companion mode).
 *
 * A single bounded LLM call with the crisis-coach persona: co-regulate the parent first,
 * then one tiny concrete thing. The model may attach `logMoment` once the moment eases —
 * we persist it as an episode so it joins the family's history (same as the voice tool).
 *
 * Body: { familyId: string, message: string, history?: { role: "parent"|"compass", text }[] }
 * Returns: { reply: string }
 * Server-only (reads secrets + this family's memory).
 */

import { NextResponse } from "next/server";

import { familyAccessError } from "@/lib/authz";
import { budgetExceededError, COST } from "@/lib/budget";
import { buildHelpNowChatInstructions } from "@/lib/helpnow";
import { getLlm } from "@/lib/llm";
import { memory } from "@/lib/memory";
import { asString, extractJsonObject } from "@/lib/parse";
import type { ChatMessage } from "@/lib/types";

export const runtime = "nodejs";

const FALLBACK_REPLY =
  "I'm right here with you. Take one slow breath — then tell me what's happening.";

export async function POST(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { familyId, message, history } = (body ?? {}) as {
    familyId?: unknown;
    message?: unknown;
    history?: unknown;
  };

  if (typeof familyId !== "string" || familyId.trim().length === 0) {
    return NextResponse.json({ error: "familyId is required" }, { status: 400 });
  }
  if (typeof message !== "string" || message.trim().length === 0) {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }

  const denied = await familyAccessError(familyId);
  if (denied) return denied;

  const overBudget = await budgetExceededError(familyId, COST.chatTurn);
  if (overBudget) return overBudget;

  const turns: ChatMessage[] = (Array.isArray(history) ? history : [])
    .filter(
      (t): t is { role: "parent" | "compass"; text: string } =>
        !!t &&
        typeof t === "object" &&
        ((t as { role?: unknown }).role === "parent" || (t as { role?: unknown }).role === "compass") &&
        typeof (t as { text?: unknown }).text === "string",
    )
    .slice(-10)
    .map((t) => ({
      role: t.role === "parent" ? ("user" as const) : ("assistant" as const),
      content: t.text.slice(0, 1_000),
    }));

  try {
    const profile = await memory.getProfile(familyId).catch(() => null);
    const llm = await getLlm();
    const response = await llm.generate({
      system: buildHelpNowChatInstructions(profile),
      messages: [...turns, { role: "user", content: message }],
      temperature: 0.6,
      json: true,
    });

    const parsed = extractJsonObject(response.text);
    const reply = asString(parsed?.reply) || FALLBACK_REPLY;

    // The model marked the moment as easing — quietly save it to the family's history.
    const logMoment = parsed?.logMoment as { situation?: unknown; suggestion?: unknown } | undefined;
    const situation = asString(logMoment?.situation);
    const suggestion = asString(logMoment?.suggestion);
    if (situation && suggestion) {
      await memory
        .addEpisode({ familyId, situation, suggestion })
        .catch((err) => console.error("[helpnow] failed to log moment:", err));
    }

    return NextResponse.json({ reply });
  } catch (err) {
    console.error("[helpnow] turn failed:", err);
    // Never leave a parent in a hard moment staring at an error.
    return NextResponse.json({ reply: FALLBACK_REPLY });
  }
}
