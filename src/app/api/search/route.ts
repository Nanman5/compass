/**
 * POST /api/search — live-web grounding for the voice agents.
 *
 * Body: { query: string } → { answer, sources } via Gemini + Google Search grounding.
 * Server-only (reads GEMINI_API_KEY through @/lib/grounding).
 */

import { NextResponse } from "next/server";

import { groundedSearch } from "@/lib/grounding";

export const runtime = "nodejs";

export async function POST(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const query = typeof (body as { query?: unknown })?.query === "string" ? (body as { query: string }).query.trim() : "";
  if (!query) return NextResponse.json({ error: "query is required" }, { status: 400 });

  try {
    return NextResponse.json(await groundedSearch(query));
  } catch (err) {
    console.error("[search] grounding failed:", err);
    return NextResponse.json({ error: "Couldn't look that up right now" }, { status: 500 });
  }
}
