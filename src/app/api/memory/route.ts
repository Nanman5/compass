/**
 * /api/memory — transparency + data autonomy (spec §8).
 *
 * GET    ?familyId=  → FamilyMemory  (powers the "what Compass remembers" panel)
 * DELETE ?familyId=  → wipe the family's partition (the parent's "forget me" control)
 *
 * Memory is scoped per family: every call filters by the familyId in the query string.
 * Server-only.
 */

import { NextResponse } from "next/server";

import { memory } from "@/lib/memory";

export const runtime = "nodejs";

export async function GET(req: Request): Promise<Response> {
  const familyId = new URL(req.url).searchParams.get("familyId");
  if (typeof familyId !== "string" || familyId.trim().length === 0) {
    return NextResponse.json({ error: "familyId is required" }, { status: 400 });
  }

  try {
    const familyMemory = await memory.getFamilyMemory(familyId);
    return NextResponse.json(familyMemory);
  } catch (err) {
    console.error("[memory] read failed:", err);
    return NextResponse.json({ error: "Failed to read memory" }, { status: 500 });
  }
}

export async function DELETE(req: Request): Promise<Response> {
  const familyId = new URL(req.url).searchParams.get("familyId");
  if (typeof familyId !== "string" || familyId.trim().length === 0) {
    return NextResponse.json({ error: "familyId is required" }, { status: 400 });
  }

  try {
    await memory.deleteFamily(familyId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[memory] delete failed:", err);
    return NextResponse.json({ error: "Failed to delete memory" }, { status: 500 });
  }
}
