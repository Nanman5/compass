/**
 * Tests for the curated evidence index (src/lib/evidence.ts).
 *
 * Pure, in-memory, no mocks: we assert the keyword retrieval ranks tag matches above
 * incidental title/text matches, respects the limit, returns [] for an empty/garbage
 * query, and that all() exposes the full corpus without leaking the internal array.
 */

import { describe, expect, it } from "vitest";

import { evidence } from "@/lib/evidence";

describe("KeywordEvidenceIndex", () => {
  it("retrieves relevant snippets for a query", async () => {
    const hits = evidence.retrieve("bedtime routine for a toddler");
    expect(hits.length).toBeGreaterThan(0);
    // A bedtime/sleep-tagged snippet should surface.
    expect(hits.some((s) => s.tags.includes("bedtime") || s.tags.includes("sleep"))).toBe(true);
  });

  it("ranks tag matches above incidental text matches", async () => {
    // "screen-time" is a tag on several snippets — the top hit should carry that tag.
    const hits = evidence.retrieve("screen time tantrum");
    expect(hits[0]?.tags.includes("screen-time")).toBe(true);
  });

  it("respects the limit argument", async () => {
    const hits = evidence.retrieve("screen time bedtime tantrum play discipline", 2);
    expect(hits.length).toBeLessThanOrEqual(2);
  });

  it("returns an empty array for an empty or non-matching query", async () => {
    expect(evidence.retrieve("")).toEqual([]);
    expect(evidence.retrieve("   ")).toEqual([]);
    expect(evidence.retrieve("zzzz qqqq xxxx")).toEqual([]);
  });

  it("all() returns the full corpus as a fresh array (no internal-state leak)", async () => {
    const a = evidence.all();
    const b = evidence.all();
    expect(a.length).toBeGreaterThan(0);
    expect(a).not.toBe(b); // distinct array instances
    a.pop(); // mutating the returned array must not shrink the corpus
    expect(evidence.all().length).toBe(b.length);
  });
});
