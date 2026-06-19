/**
 * Tests for the curated studies library — keyword retrieval ranks tag matches above
 * incidental text, respects the limit, and returns [] for empty/garbage queries.
 */

import { describe, expect, it } from "vitest";

import { studies, STUDIES } from "@/lib/studies";

describe("curated studies index", () => {
  it("retrieves relevant studies by topic", () => {
    const hits = studies.retrieve("technoference parent distraction");
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.some((s) => s.id === "DB_004_TECHNOFERENCE_LONGITUDINAL")).toBe(true);
  });

  it("surfaces the crisis-usability study for Help Me Now queries", () => {
    const hits = studies.retrieve("tantrum crisis voice help me now");
    expect(hits[0]?.id).toBe("DB_009_PAUSE_STEPS_QUAL");
  });

  it("ranks tag matches above incidental text and respects the limit", () => {
    const hits = studies.retrieve("chatbot scalability low-bandwidth cost", 1);
    expect(hits).toHaveLength(1);
    expect(hits[0]?.id).toBe("DB_002_AFINI_CLUSTER_RCT");
  });

  it("returns an empty array for empty or non-matching queries", () => {
    expect(studies.retrieve("")).toEqual([]);
    expect(studies.retrieve("   ")).toEqual([]);
    expect(studies.retrieve("zzzz qqqq")).toEqual([]);
  });

  it("all() exposes the full corpus as a fresh array", () => {
    const a = studies.all();
    expect(a).toHaveLength(STUDIES.length);
    a.pop();
    expect(studies.all()).toHaveLength(STUDIES.length);
  });
});
