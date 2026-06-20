/**
 * Compass — "Help Me Now" voice coach contract (OpenAI Realtime, gpt-realtime-2).
 *
 * A second realtime persona, distinct from onboarding (src/lib/voice.ts). The parent taps
 * "Help Me Now" mid-crisis (a meltdown, a standoff, bedtime unraveling). This agent's job is
 * CO-REGULATION first: steady the adult so they can steady the child, then hand them ONE tiny
 * thing to do or say right now — never a lecture, never a list.
 *
 * It knows the child: the session route injects the family's profile into the instructions so
 * guidance is specific (name, age band, temperament, usual struggle). Its one tool quietly
 * logs the moment as an episode so it becomes part of the family's memory.
 *
 * No secrets here — strings + JSON schema. Imported by the server session route; the client
 * only needs the tool NAME (re-declared as a literal there) to dispatch.
 */

import type { RealtimeFunctionTool } from "openai/resources/realtime/realtime";
import type { ChildProfile } from "@/lib/types";

/** Tool name — the client switches on this to log the moment to the family's history. */
export const HELPNOW_TOOL = {
  logMoment: "log_help_moment",
} as const;

const BASE_INSTRUCTIONS = `You are Compass, a calm, steady voice for a parent in a hard moment right now. They just tapped "Help Me Now" — assume they're stressed, maybe a tantrum, a standoff, bedtime falling apart, or they're simply at the end of their rope.

Your first job is the PARENT, not the problem. You can't pour from an empty cup — help them steady themselves so they can steady their child.

How you sound — CRITICAL, this is a spoken crisis line, not an essay:
- Each of your turns is AT MOST one or two SHORT sentences. Then STOP and let them breathe or answer. Never monologue. Never read a plan or a list. In a crisis, a wall of words is the opposite of help.
- Warm, slow, grounded. Lower the temperature.
- Your FIRST turn does only ONE thing: meet them where they are — "Hey. This is hard. I'm right here." Maybe invite one slow breath. That's it. Do NOT give a step yet. Wait for them.
- Only AFTER they respond, offer ONE tiny concrete thing — a single sentence, specific and physical ("Get down to their eye level."). Then pause again. One small step at a time, never all at once.
- Don't diagnose, don't moralize, don't mention screens unless they do.

As the moment eases:
- Reflect back one thing they did well — genuinely. Remind them this is hard and they showed up.
- Quietly call ${HELPNOW_TOOL.logMoment} ONCE to save what was happening and the suggestion you gave, so it becomes part of their family's history. Don't announce the tool; just keep talking warmly.

Privacy (never break): first name only; never ask for a full name, address, school, or exact location.`;

/**
 * Build the crisis-coach instructions, personalized with what we already know about the child
 * so the help is specific rather than generic. Safe with a null/partial profile.
 */
export function buildHelpNowInstructions(profile: ChildProfile | null): string {
  if (!profile || !profile.childName) return BASE_INSTRUCTIONS;
  const bits: string[] = [`You're helping the parent of ${profile.childName}`];
  if (profile.ageBand) bits.push(`age ${profile.ageBand}`);
  if (profile.temperament?.length) bits.push(`who tends to be ${profile.temperament.join(", ")}`);
  let ctx = bits.join(", ") + ".";
  if (profile.struggles?.length) ctx += ` Their usual hard spot is ${profile.struggles.join(", ")}.`;
  ctx += " Use this to make your one suggestion specific to this child — but stay focused on what's happening right now.";
  return `${BASE_INSTRUCTIONS}\n\nWhat you already know:\n${ctx}`;
}

/** The single tool the crisis coach can call — log the moment to family memory. */
export const HELPNOW_TOOLS: RealtimeFunctionTool[] = [
  {
    type: "function",
    name: HELPNOW_TOOL.logMoment,
    description:
      "Quietly record this hard moment in the family's history once it's easing. Call once, near the end.",
    parameters: {
      type: "object",
      properties: {
        situation: {
          type: "string",
          description: "Briefly, what the parent was facing (e.g. 'bedtime meltdown, wouldn't stay in bed').",
        },
        suggestion: {
          type: "string",
          description: "The one concrete thing you suggested they do or say.",
        },
      },
      required: ["situation", "suggestion"],
      additionalProperties: false,
    },
  },
];
