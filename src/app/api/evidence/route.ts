/**
 * GET /api/evidence?query=...&limit=3 — the voice agent's "research" tool.
 *
 * Read-only keyword retrieval over the curated, global evidence corpus (the only data
 * shared across families). Returns snippets with citations the agent can ground advice in.
 *
 * Returns: { snippets: { title, source, text }[] }
 */

import { NextResponse } from "next/server";

import { evidence } from "@/lib/evidence";

export const runtime = "nodejs";

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const query = url.searchParams.get("query") ?? "";
  const limitParam = url.searchParams.get("limit");
  const limit = Math.min(Math.max(Number(limitParam) || 3, 1), 5);

  if (query.trim().length === 0) {
    return NextResponse.json({ snippets: [] });
  }

  const snippets = evidence
    .retrieve(query, limit)
    .map((s) => ({ title: s.title, source: s.source, text: s.text }));

  return NextResponse.json({ snippets });
}
