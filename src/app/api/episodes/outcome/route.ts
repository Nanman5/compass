/**
 * POST /api/episodes/outcome — the Win Logger's write path.
 *
 * After a parent tries a step Compass suggested, they log how it went. This records the
 * outcome on the matching episode in this family's episodic memory, which later sharpens
 * the Coach's guidance toward what actually works for their child.
 *
 * Body: { familyId: string, episodeId: string, outcome: string }
 * Returns: { ok: true }
 *
 * Memory is scoped per family — the write only ever touches the caller's partition.
 * Server-only (writes per-family memory).
 */

import { NextResponse } from "next/server";

import { familyAccessError } from "@/lib/authz";
import { memory } from "@/lib/memory";

export const runtime = "nodejs";

export async function POST(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { familyId, episodeId, outcome } = (body ?? {}) as {
    familyId?: unknown;
    episodeId?: unknown;
    outcome?: unknown;
  };

  if (typeof familyId !== "string" || familyId.trim().length === 0) {
    return NextResponse.json({ error: "familyId is required" }, { status: 400 });
  }
  if (typeof episodeId !== "string" || episodeId.trim().length === 0) {
    return NextResponse.json({ error: "episodeId is required" }, { status: 400 });
  }
  if (typeof outcome !== "string" || outcome.trim().length === 0) {
    return NextResponse.json({ error: "outcome is required" }, { status: 400 });
  }

  const denied = await familyAccessError(familyId);
  if (denied) return denied;

  try {
    await memory.updateEpisodeOutcome(familyId, episodeId, outcome.trim());
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[episodes/outcome] update failed:", err);
    // A missing episode is the caller's fault (bad id); everything else is a 500.
    const message = err instanceof Error ? err.message : "";
    const status = message.includes("not found") ? 404 : 500;
    return NextResponse.json(
      { error: status === 404 ? "Episode not found" : "Failed to log outcome" },
      { status },
    );
  }
}
