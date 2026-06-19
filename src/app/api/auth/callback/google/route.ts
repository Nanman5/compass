/**
 * GET /api/auth/callback/google — finish sign-in.
 * Verifies the CSRF state, exchanges the code for tokens, sets the signed session cookie,
 * and returns the parent to /app.
 */

import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  authConfig,
  exchangeCode,
  readSession,
  SESSION_COOKIE,
  sessionCookieOptions,
  signSession,
  STATE_COOKIE,
} from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(req: Request): Promise<Response> {
  const { baseUrl } = authConfig();
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const jar = await cookies();
  const expectedState = jar.get(STATE_COOKIE)?.value;

  if (url.searchParams.get("error")) {
    return NextResponse.redirect(`${baseUrl}/app?auth=denied`);
  }
  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(`${baseUrl}/app?auth=failed`);
  }

  try {
    const user = await exchangeCode(code);
    if (!readSession(signSession(user))) throw new Error("session round-trip failed");

    const res = NextResponse.redirect(`${baseUrl}/app`);
    res.cookies.set(SESSION_COOKIE, signSession(user), sessionCookieOptions);
    res.cookies.delete(STATE_COOKIE);
    console.info(`[auth] signed in: ${user.email}`);
    return res;
  } catch (err) {
    console.error("[auth] callback failed:", err instanceof Error ? err.message : err);
    return NextResponse.redirect(`${baseUrl}/app?auth=failed`);
  }
}
