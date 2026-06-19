/**
 * Tests for conversational onboarding (src/lib/onboarding.ts).
 *
 * The LLM is a scripted fake: the chat turns return canned questions/closings, and the
 * final extraction call returns a canned JSON profile. We assert the prompt-chain shape
 * (one turn at a time, sentinel detection) and the DEFENSIVE normalization that protects
 * memory — especially COPPA name-minimization (first name only) and age-band validation.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { LlmClient, LlmGenerateOptions, LlmResponse } from "@/lib/types";

const generateMock = vi.fn<(opts: LlmGenerateOptions) => Promise<LlmResponse>>();
vi.mock("@/lib/llm", () => ({
  getLlm: vi.fn(async (): Promise<LlmClient> => ({
    provider: "openai",
    model: "fake-test-model",
    generate: generateMock,
  })),
}));

function reply(text: string): LlmResponse {
  return { text, toolCalls: [] };
}

beforeEach(() => {
  generateMock.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("startOnboarding", () => {
  it("seeds a fresh state with the system prompt and requires a familyId", async () => {
    const { startOnboarding } = await import("./onboarding");
    const state = startOnboarding("famA");
    expect(state.familyId).toBe("famA");
    expect(state.done).toBe(false);
    expect(state.messages).toHaveLength(1);
    expect(state.messages[0]?.role).toBe("system");

    expect(() => startOnboarding("")).toThrow(/familyId/);
  });
});

describe("onboardingTurn", () => {
  it("returns the next question and no profile while the chat is ongoing", async () => {
    const { startOnboarding, onboardingTurn } = await import("./onboarding");
    generateMock.mockResolvedValueOnce(reply("Lovely — what's your child's nickname?"));

    const state = startOnboarding("famA");
    const result = await onboardingTurn(state, "I need help with bedtime");

    expect(result.done).toBe(false);
    expect(result.profile).toBeUndefined();
    expect(result.reply).toMatch(/nickname/);
    // The transcript now holds: system, user, assistant.
    expect(state.messages.map((m) => m.role)).toEqual(["system", "user", "assistant"]);
  });

  it("rejects an empty user message", async () => {
    const { startOnboarding, onboardingTurn } = await import("./onboarding");
    const state = startOnboarding("famA");
    await expect(onboardingTurn(state, "   ")).rejects.toThrow(/userMessage/);
  });

  it("on completion: strips the sentinel, extracts a profile, and normalizes it", async () => {
    const { startOnboarding, onboardingTurn } = await import("./onboarding");

    // Turn 1: model signals completion with the sentinel appended.
    generateMock.mockResolvedValueOnce(
      reply("Thanks, I've got what I need to help with Mia. [[ONBOARDING_COMPLETE]]"),
    );
    // Turn 2 (extraction): model returns JSON — note a FULL name and an out-of-range age band.
    generateMock.mockResolvedValueOnce(
      reply(
        JSON.stringify({
          childName: "Mia Rivera Gomez",
          ageBand: "10-12", // invalid → must fall back to a valid band
          temperament: ["sensitive", "curious"],
          interests: ["dinosaurs"],
          struggles: ["bedtime"],
          context: "Bilingual household.",
        }),
      ),
    );

    const state = startOnboarding("famA");
    const result = await onboardingTurn(state, "Her name is Mia, she's 3, bedtime is hard");

    expect(result.done).toBe(true);
    // Sentinel must not leak to the parent-facing reply.
    expect(result.reply).not.toContain("[[ONBOARDING_COMPLETE]]");
    expect(result.profile).toBeDefined();

    const p = result.profile!;
    expect(p.familyId).toBe("famA");
    // COPPA: only the first name is kept.
    expect(p.childName).toBe("Mia");
    // Invalid age band is replaced with a valid one.
    expect(["0-1", "2-3", "4-5", "6-8"]).toContain(p.ageBand);
    expect(p.interests).toEqual(["dinosaurs"]);
    expect(p.struggles).toEqual(["bedtime"]);
  });

  it("falls back to safe defaults when extraction returns malformed JSON", async () => {
    const { startOnboarding, onboardingTurn } = await import("./onboarding");

    generateMock.mockResolvedValueOnce(reply("All set! [[ONBOARDING_COMPLETE]]"));
    generateMock.mockResolvedValueOnce(reply("totally not json {{{"));

    const state = startOnboarding("famA");
    const result = await onboardingTurn(state, "done");

    expect(result.done).toBe(true);
    const p = result.profile!;
    expect(p.childName).toBe("their child"); // safe default
    expect(p.ageBand).toBe("2-3"); // safe default
    expect(p.temperament).toEqual([]);
  });
});
