/**
 * POST /api/learnings — let a parent add a durable fact about their family by hand.
 *
 * This feeds the SAME memory the Coach reads before every answer, so anything the parent
 * adds here ("Alex has a new baby sister", "bedtime got worse since starting school") is
 * picked up next time they ask for guidance. Parent-stated facts are high-confidence.
 * Tenant-scoped by familyId.
 *
 * Body: { familyId, fact }. Returns: { learning }.
 */

import { NextResponse } from "next/server";

import { familyAccessError } from "@/lib/authz";
import { memory } from "@/lib/memory";

export const runtime = "nodejs";

export async function POST(req: Request): Promise<Response> {
  let body: { familyId?: unknown; fact?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const familyId = typeof body.familyId === "string" ? body.familyId.trim() : "";
  const fact = typeof body.fact === "string" ? body.fact.trim() : "";

  if (!familyId || !fact) {
    return NextResponse.json({ error: "familyId and fact are required" }, { status: 400 });
  }
  if (fact.length > 600) {
    return NextResponse.json({ error: "That note is a bit long — keep it short." }, { status: 400 });
  }

  const denied = await familyAccessError(familyId);
  if (denied) return denied;

  try {
    const learning = await memory.addLearning({
      familyId,
      fact,
      source: "parent", // the parent told us directly — trust it
      confidence: 1,
      sensitivity: "low",
    });
    return NextResponse.json({ learning });
  } catch (err) {
    console.error("[learnings] failed to add learning:", err);
    return NextResponse.json({ error: "Could not save that" }, { status: 500 });
  }
}
