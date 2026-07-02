/**
 * POST /api/coach — run one Coach agent turn, streamed.
 *
 * The parent describes a situation; the Coach (a bounded tool-loop, see src/lib/coach.ts)
 * loads this family's memory, retrieves evidence, and returns ONE concrete next step (or a
 * conversational reply for greetings/clarifications) plus the full agent trajectory.
 *
 * The response is NDJSON — one JSON object per line, emitted as the agent works, so the UI
 * can show the agent thinking in real time instead of a mute spinner:
 *   { "type": "step",   "step": TrajectoryStep }   ← live, one per agent action
 *   { "type": "result", "result": CoachTurnResult } ← last line
 *   { "type": "error",  "error": string }           ← last line on failure
 *
 * Body: { familyId: string, message: string }
 * Server-only (reads secrets + reads/writes per-family memory).
 */

import { NextResponse } from "next/server";

import { familyAccessError } from "@/lib/authz";
import { runCoachTurn } from "@/lib/coach";

export const runtime = "nodejs";

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

  // Narrow the optional conversation context (older turns are dropped server-side too).
  const turns = (Array.isArray(history) ? history : [])
    .filter(
      (t): t is { role: "parent" | "compass"; text: string } =>
        !!t &&
        typeof t === "object" &&
        ((t as { role?: unknown }).role === "parent" || (t as { role?: unknown }).role === "compass") &&
        typeof (t as { text?: unknown }).text === "string",
    )
    .slice(-8);

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(encoder.encode(`${JSON.stringify(obj)}\n`));
      try {
        const result = await runCoachTurn({
          familyId,
          message,
          history: turns,
          onStep: (step) => send({ type: "step", step }),
        });
        send({ type: "result", result });
      } catch (err) {
        console.error("[coach] turn failed:", err);
        send({ type: "error", error: "Coach turn failed" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-store",
      // Defeat proxy buffering (nginx/Cloud Run) so steps actually arrive live.
      "x-accel-buffering": "no",
    },
  });
}
