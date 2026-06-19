/**
 * Tests for the per-family memory store. The central invariant is TENANT ISOLATION:
 * a caller working with family A can never read or mutate family B's data. We also
 * cover the basic round-trips (saveProfile/getProfile, learnings, episodes, delete).
 *
 * Each test uses a fresh temp data dir via COMPASS_DATA_DIR so runs are hermetic and
 * never touch the repo's real .data/ directory.
 */

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { ChildProfile } from "@/lib/types";

let tempDir: string;

// Point the store at a throwaway directory before each test, then load a FRESH module
// instance so the singleton picks up the env var. (vitest resetModules is on per-test.)
beforeEach(async () => {
  tempDir = await mkdtemp(path.join(tmpdir(), "compass-mem-"));
  process.env.COMPASS_DATA_DIR = tempDir;
});

afterEach(async () => {
  delete process.env.COMPASS_DATA_DIR;
  await rm(tempDir, { recursive: true, force: true });
});

function sampleProfile(familyId: string, childName: string): ChildProfile {
  const now = new Date().toISOString();
  return {
    familyId,
    childName,
    ageBand: "2-3",
    temperament: ["sensitive"],
    interests: ["dinosaurs"],
    struggles: ["bedtime"],
    context: "Bilingual household.",
    createdAt: now,
    updatedAt: now,
  };
}

describe("LocalMemoryStore", () => {
  it("round-trips a profile via saveProfile/getProfile", async () => {
    const { memory } = await import("./memory");
    const saved = await memory.saveProfile(sampleProfile("famA", "Mia"));

    expect(saved.childName).toBe("Mia");
    expect(saved.familyId).toBe("famA");
    expect(saved.updatedAt).toBeTruthy();

    const fetched = await memory.getProfile("famA");
    expect(fetched).not.toBeNull();
    expect(fetched?.childName).toBe("Mia");
    expect(fetched?.interests).toEqual(["dinosaurs"]);
  });

  it("returns null/empty for a family with no data", async () => {
    const { memory } = await import("./memory");
    expect(await memory.getProfile("ghost")).toBeNull();

    const mem = await memory.getFamilyMemory("ghost");
    expect(mem.profile).toBeNull();
    expect(mem.learnings).toEqual([]);
    expect(mem.episodes).toEqual([]);
  });

  it("ISOLATION: family A cannot read family B's data", async () => {
    const { memory } = await import("./memory");
    await memory.saveProfile(sampleProfile("famA", "Mia"));
    await memory.saveProfile(sampleProfile("famB", "Leo"));
    await memory.addLearning({
      familyId: "famB",
      fact: "Leo fears the dark.",
      source: "onboarding",
      confidence: 0.9,
      sensitivity: "medium",
    });

    const aProfile = await memory.getProfile("famA");
    expect(aProfile?.childName).toBe("Mia");

    // Family A's view contains ONLY family A — none of B's profile or learnings.
    const aMemory = await memory.getFamilyMemory("famA");
    expect(aMemory.profile?.childName).toBe("Mia");
    expect(aMemory.learnings).toHaveLength(0);
    expect(aMemory.learnings.some((l) => l.familyId === "famB")).toBe(false);

    // And B still has its own data intact.
    const bMemory = await memory.getFamilyMemory("famB");
    expect(bMemory.profile?.childName).toBe("Leo");
    expect(bMemory.learnings).toHaveLength(1);
    expect(bMemory.learnings[0]?.familyId).toBe("famB");
  });

  it("appends learnings scoped to a family and stamps id/createdAt", async () => {
    const { memory } = await import("./memory");
    const l1 = await memory.addLearning({
      familyId: "famA",
      fact: "Mia calms with a night-light.",
      source: "coach-turn",
      confidence: 0.8,
      sensitivity: "low",
    });
    await memory.addLearning({
      familyId: "famA",
      fact: "Mia loves stegosaurus.",
      source: "coach-turn",
      confidence: 0.7,
      sensitivity: "low",
    });

    expect(l1.id).toBeTruthy();
    expect(l1.createdAt).toBeTruthy();

    const mem = await memory.getFamilyMemory("famA");
    expect(mem.learnings).toHaveLength(2);
    expect(mem.learnings.every((l) => l.familyId === "famA")).toBe(true);
  });

  it("appends episodes and updates an outcome, scoped to the family", async () => {
    const { memory } = await import("./memory");
    const ep = await memory.addEpisode({
      familyId: "famA",
      situation: "Bedtime is a battle.",
      suggestion: "Try a 2-minute warning then the dinosaur book.",
    });
    expect(ep.id).toBeTruthy();
    expect(ep.outcome).toBeUndefined();

    await memory.updateEpisodeOutcome("famA", ep.id, "Worked — asleep by 8.");
    const mem = await memory.getFamilyMemory("famA");
    expect(mem.episodes).toHaveLength(1);
    expect(mem.episodes[0]?.outcome).toBe("Worked — asleep by 8.");
  });

  it("updateEpisodeOutcome will not touch another family's episode", async () => {
    const { memory } = await import("./memory");
    const epB = await memory.addEpisode({
      familyId: "famB",
      situation: "Screen-off tantrum.",
      suggestion: "Offer a sensory bin as the swap.",
    });

    // Trying to update B's episode while scoped to A must fail — no cross-tenant write.
    await expect(
      memory.updateEpisodeOutcome("famA", epB.id, "hacked"),
    ).rejects.toThrow();

    const bMem = await memory.getFamilyMemory("famB");
    expect(bMem.episodes[0]?.outcome).toBeUndefined();
  });

  it("deleteFamily wipes only that family's partition", async () => {
    const { memory } = await import("./memory");
    await memory.saveProfile(sampleProfile("famA", "Mia"));
    await memory.saveProfile(sampleProfile("famB", "Leo"));

    await memory.deleteFamily("famA");

    expect(await memory.getProfile("famA")).toBeNull();
    expect((await memory.getProfile("famB"))?.childName).toBe("Leo");
  });

  it("saveProfile preserves original createdAt on update and bumps updatedAt", async () => {
    const { memory } = await import("./memory");
    const first = await memory.saveProfile(sampleProfile("famA", "Mia"));
    await new Promise((r) => setTimeout(r, 5));
    const second = await memory.saveProfile({
      ...sampleProfile("famA", "Mia"),
      struggles: ["bedtime", "screen tantrums"],
    });

    expect(second.createdAt).toBe(first.createdAt);
    expect(second.updatedAt >= first.updatedAt).toBe(true);
    expect(second.struggles).toContain("screen tantrums");
  });
});
