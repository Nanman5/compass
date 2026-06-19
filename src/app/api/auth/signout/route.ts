/**
 * POST /api/auth/signout — clear the session cookie.
 */

import { NextResponse } from "next/server";

import { SESSION_COOKIE } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(): Promise<Response> {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
