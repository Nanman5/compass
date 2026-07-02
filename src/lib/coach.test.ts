/**
 * Tests for the Coach agent tool-loop (src/lib/coach.ts).
 *
 * The LLM is replaced with a SCRIPTED fake (a queue of canned LlmResponses) so the loop
 * is fully deterministic — no network, no provider keys. Memory and evidence are the REAL
 * modules: memory points at a throwaway temp dir (COMPASS_DATA_DIR), so we exercise the
 * genuine scoped reads/writes the agent performs.
 *
 * What we prove:
 *  - the loop runs tools the model requests and feeds results back, then parses the final;
 *  - tool calls are HARD-SCOPED to the request familyId (a familyId in model args is ignored);
 *  - citations retrieved during the turn survive even if the model omits them from its JSON;
 *  - the interaction is always logged (safety net) even if the model never calls log_interaction;
 *  - reaching max_steps still yields a final answer (the closing no-tools call), never a throw.
 */

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { LlmClient, LlmGenerateOptions, LlmResponse, ToolCall } from "@/lib/types";

// Mock the LLM module so getLlm() returns our scripted fake instead of a real provider.
const generateMock = vi.fn<(opts: LlmGenerateOptions) => Promise<LlmResponse>>();
vi.mock("@/lib/llm", () => ({
  getLlm: vi.fn(async (): Promise<LlmClient> => ({
    provider: "openai",
    model: "fake-test-model",
    generate: generateMock,
  })),
}));

// research.ts is server-only (throws if imported in the test env) and hits the network;
// the coach imports it for the find_studies tool, so stub it out here.
vi.mock("@/lib/research", () => ({
  searchResearch: vi.fn(async () => []),
}));

/** Build a scripted LLM: each call to generate() returns the next response in `queue`. */
function script(...responses: LlmResponse[]): void {
  let i = 0;
  generateMock.mockImplementation(async () => {
    const next = responses[Math.min(i, responses.length - 1)];
    i += 1;
    return next;
  });
}

function toolCall(name: string, args: Record<string, unknown> = {}): ToolCall {
  return { id: `call-${name}`, name, arguments: args };
}

function finalText(nextStep: string, screenNote: string, citations: unknown[] = []): string {
  return "```json\n" + JSON.stringify({ nextStep, screenNote, citations }) + "\n```";
}

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(path.join(tmpdir(), "compass-coach-"));
  process.env.COMPASS_DATA_DIR = tempDir;
  generateMock.mockReset();
});

afterEach(async () => {
  delete process.env.COMPASS_DATA_DIR;
  await rm(tempDir, { recursive: true, force: true });
});

describe("runCoachTurn", () => {
  it("validates input", async () => {
    const { runCoachTurn } = await import("./coach");
    await expect(runCoachTurn({ familyId: "", message: "hi" })).rejects.toThrow(/familyId/);
    await expect(runCoachTurn({ familyId: "famA", message: "" })).rejects.toThrow(/message/);
  });

  it("runs the tool-loop, parses the final answer, and reports trajectory + meta", async () => {
    const { runCoachTurn } = await import("./coach");

    // Turn 1: model asks for the profile + evidence. Turn 2: model returns the final JSON.
    script(
      {
        text: "",
        toolCalls: [
          toolCall("get_family_profile"),
          toolCall("retrieve_evidence", { query: "bedtime routine toddler" }),
        ],
      },
      {
        text: finalText(
          "Try a two-minute warning before lights out tonight.",
          "Dim the tablet 30 minutes before bed.",
          [{ title: "Consistent bedtime routines help young children settle", source: "Zero to Three — Healthy Sleep Habits" }],
        ),
        toolCalls: [],
      },
    );

    const result = await runCoachTurn({ familyId: "famA", message: "bedtime is a battle" });

    expect(result.nextStep).toMatch(/two-minute warning/);
    expect(result.screenNote).toMatch(/Dim the tablet/);
    expect(result.citations.length).toBeGreaterThan(0);
    expect(result.meta.provider).toBe("openai");
    expect(result.meta.model).toBe("fake-test-model");
    expect(result.meta.steps).toBe(2);

    // Trajectory records both tool calls and a final step.
    const tools = result.trajectory.filter((s) => s.kind === "tool_call").map((s) => s.tool);
    expect(tools).toContain("get_family_profile");
    expect(tools).toContain("retrieve_evidence");
    expect(result.trajectory.some((s) => s.kind === "final")).toBe(true);
  });

  it("carries retrieved citations into the result even if the final JSON omits them", async () => {
    const { runCoachTurn } = await import("./coach");
    script(
      { text: "", toolCalls: [toolCall("retrieve_evidence", { query: "screen time tantrum transition" })] },
      // Final block declares NO citations, but the turn retrieved some.
      { text: finalText("Offer a sensory bin as the swap.", "Set the end-point together first.", []), toolCalls: [] },
    );

    const result = await runCoachTurn({ familyId: "famA", message: "screen-off meltdown" });
    expect(result.citations.length).toBeGreaterThan(0);
  });

  it("ENFORCES SCOPE: a familyId passed in tool args cannot redirect the write", async () => {
    const { runCoachTurn } = await import("./coach");
    const { memory } = await import("./memory");

    script(
      {
        text: "",
        toolCalls: [
          // Model maliciously/incorrectly tries to write into another family.
          toolCall("record_learning", { fact: "injected fact about another family", familyId: "victim" }),
        ],
      },
      { text: finalText("A calm next step.", "A gentle screen note."), toolCalls: [] },
    );

    await runCoachTurn({ familyId: "famA", message: "anything" });

    // The learning landed in famA (the trusted request scope), NOT in "victim".
    const famA = await memory.getFamilyMemory("famA");
    const victim = await memory.getFamilyMemory("victim");
    expect(famA.learnings.some((l) => l.fact.includes("injected fact"))).toBe(true);
    expect(victim.learnings).toHaveLength(0);
  });

  it("auto-logs the interaction even when the model never calls log_interaction", async () => {
    const { runCoachTurn } = await import("./coach");
    const { memory } = await import("./memory");

    script({ text: finalText("Read one dinosaur book before bed.", "Put the screen away after."), toolCalls: [] });

    await runCoachTurn({ familyId: "famA", message: "bedtime help" });

    const mem = await memory.getFamilyMemory("famA");
    expect(mem.episodes).toHaveLength(1);
    expect(mem.episodes[0]?.suggestion).toMatch(/dinosaur book/);
  });

  it("always returns a final answer after reaching max_steps (closing call has no tools)", async () => {
    const { runCoachTurn } = await import("./coach");

    // Every scripted turn keeps asking for a tool → the loop hits MAX_STEPS (6),
    // then the closing no-tools call provides the final JSON.
    let calls = 0;
    generateMock.mockImplementation(async () => {
      calls += 1;
      if (calls <= 6) {
        return { text: "", toolCalls: [toolCall("get_family_profile")] };
      }
      return { text: finalText("Take one calm minute before the next transition.", "End the screen on a clear cue."), toolCalls: [] };
    });

    const result = await runCoachTurn({ familyId: "famA", message: "loop forever" });
    expect(result.nextStep).toMatch(/calm minute/);
    expect(result.meta.steps).toBe(6);
  });

  it("answers a greeting conversationally: no fabricated step, nothing logged", async () => {
    const { runCoachTurn } = await import("./coach");
    const { memory } = await import("./memory");

    script({
      text: "```json\n" + JSON.stringify({ kind: "chat", reply: "Hey! What's going on with your little one today?" }) + "\n```",
      toolCalls: [],
    });

    const steps: string[] = [];
    const result = await runCoachTurn({
      familyId: "famA",
      message: "heyy",
      onStep: (s) => steps.push(s.kind),
    });

    expect(result.kind).toBe("chat");
    expect(result.reply).toMatch(/going on/);
    expect(result.nextStep).toBe("");
    expect(result.screenNote).toBe("");
    expect(result.citations).toEqual([]);
    // A greeting is NOT an episode — the auto-log safety net must not fire.
    const mem = await memory.getFamilyMemory("famA");
    expect(mem.episodes).toHaveLength(0);
    // The live observer saw the trajectory as it happened.
    expect(steps).toContain("final");
  });

  it("replays the assistant's tool calls in the transcript (OpenAI requires the pairing)", async () => {
    const { runCoachTurn } = await import("./coach");

    script(
      { text: "", toolCalls: [toolCall("get_family_profile")] },
      { text: finalText("One small step.", "Screens away at dinner."), toolCalls: [] },
    );

    await runCoachTurn({ familyId: "famA", message: "bedtime battle" });

    // The 2nd generate() call sees the transcript with the tool result — its preceding
    // assistant message MUST carry the matching toolCalls or the OpenAI provider 400s.
    const secondCall = generateMock.mock.calls[1][0];
    const assistantTurn = secondCall.messages.find((m) => m.role === "assistant");
    const toolTurn = secondCall.messages.find((m) => m.role === "tool");
    expect(assistantTurn?.toolCalls?.map((c) => c.id)).toEqual(["call-get_family_profile"]);
    expect(toolTurn?.toolCallId).toBe("call-get_family_profile");
  });
});
