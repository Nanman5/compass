/**
 * GET /api/auth/me — the signed-in user (or { user: null }).
 * Also reports whether Google sign-in is configured, so the UI can guide setup in dev.
 */

import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { authConfig, readSession, SESSION_COOKIE } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  const jar = await cookies();
  const user = readSession(jar.get(SESSION_COOKIE)?.value);
  return NextResponse.json({
    user: user ? { sub: user.sub, email: user.email, name: user.name, picture: user.picture } : null,
    configured: authConfig().configured,
  });
}
