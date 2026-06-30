/**
 * GET /api/auth/me — the signed-in user (or { user: null }).
 * Also reports whether Google sign-in is configured, so the UI can guide setup in dev,
 * and the resolved `familyId` for this account — the SHARED tenant a signed-in user reads
 * (via membership), so co-parents converge on the same family memory.
 */

import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { authConfig, readSession, SESSION_COOKIE } from "@/lib/auth";
import { resolveFamilyId } from "@/lib/family";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  const jar = await cookies();
  const user = readSession(jar.get(SESSION_COOKIE)?.value);
  const familyId = user ? await resolveFamilyId(user) : null;
  return NextResponse.json({
    user: user ? { sub: user.sub, email: user.email, name: user.name, picture: user.picture } : null,
    familyId,
    configured: authConfig().configured,
  });
}
