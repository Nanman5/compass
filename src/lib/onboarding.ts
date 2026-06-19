/**
 * Compass — conversational onboarding (prompt-chain + structured extraction).
 *
 * A short, warm, guided chat (4–6 questions, ONE at a time) that learns the child:
 * name/nickname, age band, temperament, interests, current struggle, and family
 * context. When the assistant has enough, it sets `done` and a final LLM call with
 * `json: true` distills the running conversation into a structured `ChildProfile`.
 *
 * COPPA data minimization (spec §8): we collect a first name / nickname and an age
 * BAND only. We never ask for or store DOB, full legal name, photos, or precise
 * location. The system prompt below instructs the model to stay inside that line.
 *
 * Persistence is NOT done here — `onboardingTurn` returns the distilled profile and
 * the API layer (src/app/api/onboarding/route.ts) writes it to `memory`. This keeps
 * onboarding a pure prompt-chain function that is easy to test.
 */

import { getLlm } from "@/lib/llm";
import type {
  AgeBand,
  ChatMessage,
  ChildProfile,
  OnboardingState,
  OnboardingTurnResult,
} from "@/lib/types";

/** Age bands we accept (must match `AgeBand` in types.ts). */
const AGE_BANDS: readonly AgeBand[] = ["0-1", "2-3", "4-5", "6-8"];

/**
 * The onboarding system prompt. Warm, brief, ONE question per turn, and bounded by
 * COPPA. The model decides when it has enough and signals completion with a sentinel
 * token so the prose reply stays clean for the parent.
 */
const ONBOARDING_SYSTEM = `You are Compass, a warm, calm parenting companion. You are onboarding a parent of a child aged 2–8 so you can personalize future guidance to THEIR child.

Your job in this conversation:
- Ask 4 to 6 short, friendly questions, ONE question per turn. Never stack multiple questions.
- Cover, over the conversation: the child's first name or nickname; their age band; their temperament (a couple of words); their interests; the current struggle the parent wants help with; and any family context (languages spoken, household, values, constraints) the parent wants to share.
- Keep every message to 1–2 sentences. Be gentle and human, not clinical. Acknowledge what they just said before asking the next thing.

Hard privacy rules (COPPA — never break these):
- Collect a FIRST NAME or NICKNAME only. If a parent gives a full legal name, only keep the first name.
- Ask for an AGE BAND, never a date of birth or exact age. The valid bands are: 0-1, 2-3, 4-5, 6-8.
- Never ask for photos, home address, school name, or precise location.

Completion:
- When you have enough to build a useful profile (you have at minimum: name/nickname, age band, and the current struggle), write a brief warm closing message telling the parent you're ready, and append the exact sentinel on its own line at the very end: [[ONBOARDING_COMPLETE]]
- Do not include the sentinel until you are actually done.`;

/**
 * The extraction prompt — a second "link" in the chain. Given the full transcript it
 * returns ONLY a JSON object matching `ChildProfile` (minus the server-managed fields).
 */
const EXTRACTION_SYSTEM = `You extract a structured child profile from an onboarding conversation.

Return ONLY a JSON object (no prose, no markdown fences) with exactly these keys:
{
  "childName": string,        // first name or nickname ONLY — never a full legal name
  "ageBand": "0-1" | "2-3" | "4-5" | "6-8",
  "temperament": string[],    // short descriptors, e.g. ["sensitive","high-energy"]
  "interests": string[],      // e.g. ["dinosaurs","drawing"]
  "struggles": string[],      // current pain points, e.g. ["bedtime"]
  "context": string           // free-form family context the parent shared; "" if none
}

Rules:
- Use ONLY information the parent actually gave. Do not invent temperament, interests, or struggles.
- If the age band is ambiguous, choose the closest valid band; default to "2-3" if truly unknown.
- childName must be a first name or nickname only. If the parent never gave one, use "their child".
- Arrays may be empty. Keep entries short and lowercase where natural.`;

/** Seed a fresh onboarding conversation for a family. */
export function startOnboarding(familyId: string): OnboardingState {
  if (typeof familyId !== "string" || familyId.trim().length === 0) {
    throw new Error("startOnboarding: familyId is required");
  }
  return {
    familyId,
    messages: [{ role: "system", content: ONBOARDING_SYSTEM }],
    done: false,
  };
}

/** The sentinel the model appends once it has gathered enough. */
const COMPLETE_SENTINEL = "[[ONBOARDING_COMPLETE]]";

/**
 * Advance the onboarding conversation by one turn.
 *
 * Appends the parent's message, asks the model for the next question (or closing),
 * and — if the model signalled completion — runs the structured-extraction call to
 * distill a `ChildProfile`. The caller persists the profile and the updated `messages`.
 *
 * NOTE: this returns a result; it does NOT mutate `state.messages` in place beyond
 * pushing the new turns, so the API can return `state.messages` to the client to
 * continue the conversation statelessly.
 */
export async function onboardingTurn(
  state: OnboardingState,
  userMessage: string,
): Promise<OnboardingTurnResult> {
  if (typeof userMessage !== "string" || userMessage.trim().length === 0) {
    throw new Error("onboardingTurn: userMessage is required");
  }

  const llm = await getLlm();

  // Record the parent's turn into the running transcript.
  state.messages.push({ role: "user", content: userMessage });

  // The system prompt lives in `state.messages[0]`; pass the rest as the chat history.
  const [system, ...history] = splitSystem(state.messages);
  const response = await llm.generate({
    system,
    messages: history,
    temperature: 0.6,
  });

  const rawReply = response.text ?? "";
  const done = rawReply.includes(COMPLETE_SENTINEL);
  // Strip the sentinel before showing the message to the parent.
  const reply = rawReply.replace(COMPLETE_SENTINEL, "").trim();

  // Record the assistant's turn (without the sentinel) so the transcript stays clean.
  state.messages.push({ role: "assistant", content: reply });
  state.done = done;

  if (!done) {
    return { reply, done: false };
  }

  // Final link in the chain: distill the transcript into a structured profile.
  const profile = await extractProfile(llm, state);
  return { reply, done: true, profile };
}

/**
 * Run the structured-extraction call and coerce the result into a valid `ChildProfile`.
 * Defensive parsing: the model is asked for clean JSON, but we still validate/normalize
 * (age band, name, array shapes) so a malformed response can never poison memory.
 */
async function extractProfile(
  llm: Awaited<ReturnType<typeof getLlm>>,
  state: OnboardingState,
): Promise<ChildProfile> {
  const transcript = state.messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join("\n");

  const response = await llm.generate({
    system: EXTRACTION_SYSTEM,
    messages: [{ role: "user", content: `Conversation:\n${transcript}` }],
    temperature: 0,
    json: true,
  });

  const parsed = safeParseJson(response.text);
  const now = new Date().toISOString();

  return {
    familyId: state.familyId,
    childName: normalizeName(parsed.childName),
    ageBand: normalizeAgeBand(parsed.ageBand),
    temperament: normalizeStringArray(parsed.temperament),
    interests: normalizeStringArray(parsed.interests),
    struggles: normalizeStringArray(parsed.struggles),
    context: typeof parsed.context === "string" ? parsed.context.trim() : "",
    createdAt: now,
    updatedAt: now,
  };
}

/* ───────────────────────────────────────── helpers (parsing / normalization) */

/** Split a message list into [systemString, ...nonSystemMessages]. */
function splitSystem(messages: ChatMessage[]): [string | undefined, ...ChatMessage[]] {
  const system = messages.find((m) => m.role === "system")?.content;
  const rest = messages.filter((m) => m.role !== "system");
  return [system, ...rest];
}

/** Tolerant JSON parse: strips markdown fences and falls back to {} on failure. */
function safeParseJson(text: string): Record<string, unknown> {
  if (!text) return {};
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
  try {
    const value = JSON.parse(cleaned);
    return typeof value === "object" && value !== null
      ? (value as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function normalizeName(value: unknown): string {
  if (typeof value !== "string" || value.trim().length === 0) return "their child";
  // Keep only the first token to enforce first-name-only (COPPA defense-in-depth).
  return value.trim().split(/\s+/)[0];
}

function normalizeAgeBand(value: unknown): AgeBand {
  if (typeof value === "string" && (AGE_BANDS as readonly string[]).includes(value)) {
    return value as AgeBand;
  }
  return "2-3"; // safe default for the 2–8 product band
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is string => typeof v === "string")
    .map((v) => v.trim())
    .filter((v) => v.length > 0)
    .slice(0, 8); // cap to keep memory lean (Bible: fewer, better facts)
}
