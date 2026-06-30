/**
 * GET /api/family — who can reach the signed-in user's family.
 *
 * Returns the resolved familyId, the caller's role, and the "shared with" member list
 * (adult names/emails only — never child data). Session required.
 */

import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth";
import { listFamilyMembers, resolveFamilyId } from "@/lib/family";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in to manage family access" }, { status: 401 });
  }

  try {
    const familyId = await resolveFamilyId(user);
    const members = await listFamilyMembers(familyId);
    return NextResponse.json({
      familyId,
      role: members.find((m) => m.userSub === user.sub)?.role ?? "owner",
      members: members.map((m) => ({
        name: m.name ?? "Co-parent",
        email: m.email ?? "",
        role: m.role,
        you: m.userSub === user.sub,
      })),
    });
  } catch (err) {
    console.error("[family] list failed:", err);
    return NextResponse.json({ error: "Failed to load family" }, { status: 500 });
  }
}
