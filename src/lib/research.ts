/**
 * Compass — live, quality-filtered research search (Europe PMC).
 *
 * When the curated studies library (`@/lib/studies`) doesn't cover a question, the agent
 * can search the peer-reviewed literature in real time. We use Europe PMC (no API key; it
 * indexes PubMed/MEDLINE + PMC) and constrain to QUALITY: MEDLINE-sourced, and limited to
 * the strongest evidence types (RCTs, systematic reviews, meta-analyses, clinical trials).
 * Results carry the journal, year, publication type and citation count so the caller — and
 * the user — can judge credibility, and a DOI/URL to read the source.
 *
 * Server-only: makes outbound HTTP. Never trust a single result; this returns evidence to
 * weigh, not authority.
 */

import "server-only";

const ENDPOINT = "https://www.ebi.ac.uk/europepmc/webservices/rest/search";
const TIMEOUT_MS = 12_000;

/** Strong-evidence publication types only — this is the quality gate. */
const QUALITY_TYPES =
  '(PUB_TYPE:"randomized controlled trial" OR PUB_TYPE:"systematic review" OR PUB_TYPE:"meta-analysis" OR PUB_TYPE:"clinical trial")';

export type ResearchSort = "relevance" | "cited" | "recent";

export interface ResearchResult {
  title: string;
  authors: string;
  journal: string;
  year: string;
  pubTypes: string[];
  citedByCount: number;
  doi: string | null;
  url: string;
  /** Plain-text abstract excerpt (HTML stripped, trimmed). */
  abstract: string;
}

interface EpmcResult {
  id?: string;
  source?: string;
  title?: string;
  authorString?: string;
  journalInfo?: { journal?: { title?: string } };
  pubYear?: string;
  pubTypeList?: { pubType?: string[] };
  citedByCount?: number;
  doi?: string;
  abstractText?: string;
}

/** Strip HTML tags + collapse whitespace (Europe PMC abstracts include <h4> section tags). */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sortParam(sort: ResearchSort): string | undefined {
  if (sort === "cited") return "CITED desc";
  if (sort === "recent") return "P_PDATE_D desc";
  return undefined; // relevance = Europe PMC default
}

/**
 * Search peer-reviewed literature, quality-gated. Returns [] on any failure (network /
 * timeout / parse) so callers degrade gracefully to the curated library.
 */
export async function searchResearch(
  query: string,
  opts: { limit?: number; sort?: ResearchSort } = {},
): Promise<ResearchResult[]> {
  const q = query.trim();
  if (!q) return [];
  const limit = Math.min(Math.max(opts.limit ?? 5, 1), 10);

  const fullQuery = `(${q}) AND SRC:MED AND ${QUALITY_TYPES}`;
  const params = new URLSearchParams({
    query: fullQuery,
    format: "json",
    resultType: "core",
    pageSize: String(limit),
  });
  const sort = sortParam(opts.sort ?? "relevance");
  if (sort) params.set("sort", sort);

  try {
    const res = await fetch(`${ENDPOINT}?${params.toString()}`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      console.warn(`[research] Europe PMC returned ${res.status}`);
      return [];
    }
    const data = (await res.json()) as { resultList?: { result?: EpmcResult[] } };
    const results = data.resultList?.result ?? [];
    return results.map(normalize);
  } catch (err) {
    console.warn("[research] live search failed:", err instanceof Error ? err.message : err);
    return [];
  }
}

function normalize(r: EpmcResult): ResearchResult {
  const abstract = r.abstractText ? stripHtml(r.abstractText) : "";
  return {
    title: r.title?.replace(/\.$/, "") ?? "Untitled",
    authors: r.authorString ?? "",
    journal: r.journalInfo?.journal?.title ?? "",
    year: r.pubYear ?? "",
    pubTypes: (r.pubTypeList?.pubType ?? []).filter(
      (t) => !/journal article|research support/i.test(t),
    ),
    citedByCount: r.citedByCount ?? 0,
    doi: r.doi ?? null,
    url: r.doi
      ? `https://doi.org/${r.doi}`
      : r.source && r.id
        ? `https://europepmc.org/article/${r.source}/${r.id}`
        : "https://europepmc.org",
    abstract: abstract.length > 360 ? `${abstract.slice(0, 359)}…` : abstract,
  };
}
