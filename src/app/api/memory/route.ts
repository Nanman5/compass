/**
 * /api/memory — transparency + data autonomy (spec §8).
 *
 * GET    ?familyId=  → FamilyMemory  (powers the "what Compass remembers" panel)
 * DELETE ?familyId=  → wipe the family's partition (the parent's "forget me" control)
 *
 * Memory is scoped per family. For SIGNED-IN callers we additionally verify the requested
 * family is actually theirs (their own or one they co-parent) — so an authenticated user
 * can't read or wipe another family by guessing its id. Guests (no session) keep using the
 * local demo id they own, unchanged.
 * Server-only.
 */

import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth";
import { userCanAccessFamily } from "@/lib/family";
import { memory } from "@/lib/memory";

export const runtime = "nodejs";

/** When a session exists, the requested family must belong to that user. Guests pass through. */
async function denyIfNotAllowed(familyId: string): Promise<Response | null> {
  const user = await getSessionUser();
  if (user && !(await userCanAccessFamily(user, familyId))) {
    return NextResponse.json({ error: "Not your family" }, { status: 403 });
  }
  return null;
}

export async function GET(req: Request): Promise<Response> {
  const familyId = new URL(req.url).searchParams.get("familyId");
  if (typeof familyId !== "string" || familyId.trim().length === 0) {
    return NextResponse.json({ error: "familyId is required" }, { status: 400 });
  }

  const denied = await denyIfNotAllowed(familyId);
  if (denied) return denied;

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

  const denied = await denyIfNotAllowed(familyId);
  if (denied) return denied;

  try {
    await memory.deleteFamily(familyId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[memory] delete failed:", err);
    return NextResponse.json({ error: "Failed to delete memory" }, { status: 500 });
  }
}
