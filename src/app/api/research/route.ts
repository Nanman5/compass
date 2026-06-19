/**
 * GET /api/research?q=...&sort=relevance|cited|recent&limit=5
 *
 * The agent's research tool. Returns two layers:
 *  - `curated`: hand-vetted studies from Compass's high-trust library (instant, offline).
 *  - `live`: quality-filtered peer-reviewed results from Europe PMC (RCTs / reviews /
 *    meta-analyses, MEDLINE-indexed), with journal, year, citation count and a link.
 *
 * Returns: { query, curated: Study[], live: ResearchResult[] }
 * Server-only.
 */

import { NextResponse } from "next/server";

import { searchResearch, type ResearchSort } from "@/lib/research";
import { studies } from "@/lib/studies";

export const runtime = "nodejs";

const SORTS: ResearchSort[] = ["relevance", "cited", "recent"];

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const query = (url.searchParams.get("q") ?? url.searchParams.get("query") ?? "").trim();
  if (!query) {
    return NextResponse.json({ query: "", curated: [], live: [] });
  }

  const sortParam = url.searchParams.get("sort");
  const sort: ResearchSort = SORTS.includes(sortParam as ResearchSort)
    ? (sortParam as ResearchSort)
    : "relevance";
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 5, 1), 10);

  // Curated is instant; the live search runs in parallel and degrades to [] on failure.
  const curated = studies.retrieve(query, 3);
  const live = await searchResearch(query, { limit, sort });

  console.info(`[research] "${query}" → ${curated.length} curated, ${live.length} live`);
  return NextResponse.json({ query, curated, live });
}
