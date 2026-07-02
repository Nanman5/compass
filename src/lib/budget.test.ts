/**
 * Tests for the per-family spend cap: charges accumulate per family, the cap cuts access
 * with a 402, and families are metered independently.
 */

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(path.join(tmpdir(), "compass-budget-"));
  process.env.COMPASS_DATA_DIR = path.join(tempDir, "families");
  process.env.FAMILY_BUDGET_USD = "0.02";
  vi.resetModules();
});

afterEach(async () => {
  delete process.env.COMPASS_DATA_DIR;
  delete process.env.FAMILY_BUDGET_USD;
  await rm(tempDir, { recursive: true, force: true });
});

describe("budgetExceededError", () => {
  it("allows spending under the cap, then returns 402 once it is crossed", async () => {
    const { budgetExceededError } = await import("@/lib/budget");
    expect(await budgetExceededError("famA", 0.01)).toBeNull(); // 0.01
    expect(await budgetExceededError("famA", 0.01)).toBeNull(); // 0.02 (== cap, still ok)
    const denied = await budgetExceededError("famA", 0.01); // 0.03 > cap
    expect(denied).not.toBeNull();
    expect(denied!.status).toBe(402);
    // and it stays closed
    const again = await budgetExceededError("famA", 0.001);
    expect(again!.status).toBe(402);
  });

  it("meters families independently", async () => {
    const { budgetExceededError } = await import("@/lib/budget");
    expect((await budgetExceededError("famA", 0.05))!.status).toBe(402);
    expect(await budgetExceededError("famB", 0.01)).toBeNull();
  });

  it("renews at midnight UTC: yesterday's spend doesn't count today", async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-07-02T23:50:00Z"));
      const { budgetExceededError } = await import("@/lib/budget");
      expect((await budgetExceededError("famA", 0.05))!.status).toBe(402); // today: blown
      vi.setSystemTime(new Date("2026-07-03T00:10:00Z")); // …twenty minutes later
      expect(await budgetExceededError("famA", 0.01)).toBeNull(); // fresh daily budget
    } finally {
      vi.useRealTimers();
    }
  });
});
