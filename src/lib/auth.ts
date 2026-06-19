/**
 * Compass — Google sign-in (standard OAuth 2.0 Authorization Code flow).
 *
 * Deliberately NOT Firebase and NOT a third-party auth library — a small, version-proof
 * manual flow against Google's public OAuth endpoints, with a signed (HMAC) session cookie.
 * The OAuth Client ID/Secret live in a dedicated, non-Firebase Google Cloud project and are
 * read from env. Server-only: never expose the client secret or signing key to the browser.
 *
 *   /api/auth/google            → redirect to Google's consent screen
 *   /api/auth/callback/google   → exchange code, set session cookie, return to /app
 *   /api/auth/me                → current user (or null)
 *   /api/auth/signout           → clear the session
 */

import "server-only";

import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "compass_session";
export const STATE_COOKIE = "compass_oauth_state";
const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "openid email profile";

export interface SessionUser {
  sub: string; // Google user id (stable) — also our per-user familyId seed
  email: string;
  name: string;
  picture: string;
  exp: number; // epoch seconds
}

/* ─────────────────────────────── env / config */

export function authConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID || "";
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || "";
  const baseUrl = process.env.APP_BASE_URL || "http://localhost:3000";
  return {
    clientId,
    clientSecret,
    baseUrl,
    redirectUri: `${baseUrl}/api/auth/callback/google`,
    configured: Boolean(clientId && clientSecret && authSecret()),
  };
}

function authSecret(): string {
  return process.env.AUTH_SECRET || "";
}

/* ─────────────────────────────── OAuth URLs */

export function buildAuthUrl(state: string): string {
  const { clientId, redirectUri } = authConfig();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPE,
    state,
    access_type: "online",
    prompt: "select_account",
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

export function newState(): string {
  return randomUUID();
}

/** Exchange the authorization code for tokens and return the decoded id_token claims. */
export async function exchangeCode(code: string): Promise<SessionUser> {
  const { clientId, clientSecret, redirectUri } = authConfig();
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) {
    throw new Error(`token exchange failed (${res.status})`);
  }
  const data = (await res.json()) as { id_token?: string };
  if (!data.id_token) throw new Error("no id_token in token response");

  // The id_token came directly from Google's token endpoint over TLS, authenticated with
  // our client secret, so we can trust its claims without re-verifying the signature.
  const claims = decodeJwtPayload(data.id_token);
  return {
    sub: String(claims.sub ?? ""),
    email: String(claims.email ?? ""),
    name: String(claims.name ?? claims.email ?? "there"),
    picture: String(claims.picture ?? ""),
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE,
  };
}

function decodeJwtPayload(jwt: string): Record<string, unknown> {
  const part = jwt.split(".")[1] ?? "";
  const json = Buffer.from(part, "base64url").toString("utf8");
  return JSON.parse(json) as Record<string, unknown>;
}

/* ─────────────────────────────── signed session cookie */

/** Sign a session: base64url(json).base64url(hmac). */
export function signSession(user: SessionUser): string {
  const body = Buffer.from(JSON.stringify(user)).toString("base64url");
  const mac = createHmac("sha256", authSecret()).update(body).digest("base64url");
  return `${body}.${mac}`;
}

/** Verify + decode a session cookie; null if tampered or expired. */
export function readSession(token: string | undefined): SessionUser | null {
  if (!token) return null;
  const [body, mac] = token.split(".");
  if (!body || !mac) return null;
  const expected = createHmac("sha256", authSecret()).update(body).digest("base64url");
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const user = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionUser;
    if (!user.sub || (user.exp && user.exp * 1000 < Date.now())) return null;
    return user;
  } catch {
    return null;
  }
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: SESSION_MAX_AGE,
};
