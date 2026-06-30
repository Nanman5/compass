/**
 * POST /api/family/join — redeem an invite code to join a co-parent's family.
 *
 * Body: { code: string }
 * On success the caller gets a membership to the invite's family; from then on
 * /api/auth/me resolves them to that shared familyId. Session required.
 */

import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth";
import { redeemFamilyInvite } from "@/lib/family";

export const runtime = "nodejs";

export async function POST(req: Request): Promise<Response> {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in to join a family" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const code = (body as { code?: unknown })?.code;
  if (typeof code !== "string" || code.trim().length === 0) {
    return NextResponse.json({ error: "An invite code is required" }, { status: 400 });
  }

  try {
    const result = await redeemFamilyInvite(user, code);
    if (!result.ok) {
      const message =
        result.error === "expired"
          ? "That invite has expired — ask your co-parent for a new one."
          : "That code doesn't look right — double-check it with your co-parent.";
      return NextResponse.json({ error: message }, { status: 400 });
    }
    return NextResponse.json({ ok: true, familyId: result.familyId, alreadyMember: result.alreadyMember });
  } catch (err) {
    console.error("[family] join failed:", err);
    return NextResponse.json({ error: "Failed to join family" }, { status: 500 });
  }
}
