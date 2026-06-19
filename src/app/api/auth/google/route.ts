/**
 * GET /api/auth/google — start the Google sign-in flow.
 * Mints a CSRF state, stashes it in a short-lived cookie, and redirects to Google's consent.
 */

import { NextResponse } from "next/server";

import { authConfig, buildAuthUrl, newState, STATE_COOKIE } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  const { configured, baseUrl } = authConfig();
  if (!configured) {
    // Not wired yet — bounce back to the app with a flag so the UI can explain.
    return NextResponse.redirect(`${baseUrl}/app?auth=unconfigured`);
  }

  const state = newState();
  const res = NextResponse.redirect(buildAuthUrl(state));
  res.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });
  return res;
}
