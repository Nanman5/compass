/**
 * POST /api/family/invite — mint a shareable code so a co-parent can join this family.
 *
 * Only an existing member can create one (consent gate). Returns the code, a ready-to-share
 * link (/app?join=CODE), and an expiry. Session required.
 */

import { NextResponse } from "next/server";

import { authConfig, getSessionUser } from "@/lib/auth";
import { createFamilyInvite } from "@/lib/family";

export const runtime = "nodejs";

export async function POST(): Promise<Response> {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in to invite a co-parent" }, { status: 401 });
  }

  try {
    const { code, expiresAt } = await createFamilyInvite(user);
    const url = `${authConfig().baseUrl}/app?join=${code}`;
    return NextResponse.json({ code, url, expiresAt });
  } catch (err) {
    console.error("[family] invite failed:", err);
    return NextResponse.json({ error: "Failed to create invite" }, { status: 500 });
  }
}
