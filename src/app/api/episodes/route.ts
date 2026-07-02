/**
 * POST /api/episodes — record an interaction as an episode in family memory.
 *
 * Used by the "Help Me Now" voice coach to quietly log a hard moment (what was happening +
 * the suggestion given) so it becomes part of the family's history and can later get a
 * "how did it go?" outcome in the Win Logger. Tenant-scoped by familyId.
 *
 * Body: { familyId, situation, suggestion }. Returns: { episode }.
 */

import { NextResponse } from "next/server";

import { familyAccessError } from "@/lib/authz";
import { memory } from "@/lib/memory";

export const runtime = "nodejs";

export async function POST(req: Request): Promise<Response> {
  let body: { familyId?: unknown; situation?: unknown; suggestion?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const familyId = typeof body.familyId === "string" ? body.familyId.trim() : "";
  const situation = typeof body.situation === "string" ? body.situation.trim() : "";
  const suggestion = typeof body.suggestion === "string" ? body.suggestion.trim() : "";

  if (!familyId || !situation || !suggestion) {
    return NextResponse.json(
      { error: "familyId, situation and suggestion are required" },
      { status: 400 },
    );
  }

  const denied = await familyAccessError(familyId);
  if (denied) return denied;

  try {
    const episode = await memory.addEpisode({ familyId, situation, suggestion });
    return NextResponse.json({ episode });
  } catch (err) {
    console.error("[episodes] failed to add episode:", err);
    return NextResponse.json({ error: "Could not save the moment" }, { status: 500 });
  }
}
