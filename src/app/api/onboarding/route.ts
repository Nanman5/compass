/**
 * POST /api/onboarding — drive the conversational onboarding flow.
 *
 * The client manages a demo family session id and the running `messages` transcript.
 * On the first call it omits `state`; we seed a fresh OnboardingState. On subsequent
 * calls it sends the prior `state` (familyId + messages + done) and the parent's new
 * `message`. When the flow completes, we persist the distilled ChildProfile to this
 * family's semantic memory before returning.
 *
 * Body: { familyId: string, message?: string, state?: OnboardingState }
 * Returns: OnboardingTurnResult + the updated `state` (so the client can continue).
 *
 * Server-only (reads secrets + writes memory).
 */

import { NextResponse } from "next/server";

import { familyAccessError } from "@/lib/authz";
import { budgetExceededError, COST } from "@/lib/budget";
import { memory } from "@/lib/memory";
import { onboardingTurn, startOnboarding } from "@/lib/onboarding";
import type { OnboardingState } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { familyId, message, state } = (body ?? {}) as {
    familyId?: unknown;
    message?: unknown;
    state?: unknown;
  };

  if (typeof familyId !== "string" || familyId.trim().length === 0) {
    return NextResponse.json({ error: "familyId is required" }, { status: 400 });
  }

  const denied = await familyAccessError(familyId);
  if (denied) return denied;

  const overBudget = await budgetExceededError(familyId, COST.chatTurn);
  if (overBudget) return overBudget;

  // Resume the prior conversation if the client sent one, else seed a fresh one.
  const onboardingState: OnboardingState = isOnboardingState(state)
    ? { ...state, familyId } // pin familyId from the trusted request param
    : startOnboarding(familyId);

  // First contact (no message): return the opening question without an LLM round-trip
  // would require a prompt; instead we let the client send an initial "hi"/empty message.
  // We require a message to advance a turn.
  if (typeof message !== "string" || message.trim().length === 0) {
    return NextResponse.json(
      { error: "message is required to advance onboarding" },
      { status: 400 },
    );
  }

  try {
    const result = await onboardingTurn(onboardingState, message);
    console.info(`[chat] onboarding turn (family=${familyId}, done=${result.done})`);

    // On completion, seed semantic memory with the distilled profile.
    if (result.done && result.profile) {
      await memory.saveProfile(result.profile);
      console.info(`[chat] saved profile: ${result.profile.childName} (${result.profile.ageBand})`);
    }

    return NextResponse.json({
      ...result,
      // Return the updated state so the client can continue statelessly next turn.
      state: onboardingState,
    });
  } catch (err) {
    console.error("[onboarding] turn failed:", err);
    return NextResponse.json(
      { error: "Onboarding turn failed" },
      { status: 500 },
    );
  }
}

/** Narrow an untrusted value to an OnboardingState shape. */
function isOnboardingState(value: unknown): value is OnboardingState {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.familyId === "string" &&
    Array.isArray(v.messages) &&
    typeof v.done === "boolean"
  );
}
