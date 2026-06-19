/**
 * POST /api/coach — run one Coach agent turn.
 *
 * The parent describes a situation; the Coach (a bounded tool-loop, see src/lib/coach.ts)
 * loads this family's memory, retrieves evidence, and returns ONE concrete next step plus
 * a "when to put the screen away" note — along with the full agent trajectory for the
 * "Behind the scenes" panel.
 *
 * Body: { familyId: string, message: string }
 * Returns: CoachTurnResult
 *
 * Server-only (reads secrets + reads/writes per-family memory).
 */

import { NextResponse } from "next/server";

import { runCoachTurn } from "@/lib/coach";

export const runtime = "nodejs";

export async function POST(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { familyId, message } = (body ?? {}) as {
    familyId?: unknown;
    message?: unknown;
  };

  if (typeof familyId !== "string" || familyId.trim().length === 0) {
    return NextResponse.json({ error: "familyId is required" }, { status: 400 });
  }
  if (typeof message !== "string" || message.trim().length === 0) {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }

  try {
    const result = await runCoachTurn({ familyId, message });
    return NextResponse.json(result);
  } catch (err) {
    console.error("[coach] turn failed:", err);
    return NextResponse.json({ error: "Coach turn failed" }, { status: 500 });
  }
}
