/**
 * Compass — voice onboarding contract (OpenAI Realtime, gpt-realtime-2).
 *
 * Shared between the ephemeral-token route (which configures the realtime session with
 * these instructions + tools) and, by name, the client tool-executor. The agent runs a
 * spoken version of the onboarding: warm, one question at a time, COPPA-minimized, and
 * it can call two basic tools — save the child's profile, and look up trusted evidence.
 *
 * NOT marked "server-only": it holds no secrets, only strings/JSON-schema. But it is
 * imported by the server route; the client only needs the tool NAMES (below) to dispatch.
 */

import { AGE_BANDS } from "@/lib/types";

import type { RealtimeFunctionTool } from "openai/resources/realtime/realtime";

/** The realtime model. Override with REALTIME_MODEL; defaults to the model the user picked. */
export const REALTIME_MODEL = process.env.REALTIME_MODEL || "gpt-realtime-2";
/** A warm, natural voice. Override with REALTIME_VOICE. */
export const REALTIME_VOICE = process.env.REALTIME_VOICE || "marin";

/** Tool names — the client switches on these to execute the call against our APIs.
 *  Onboarding's ONLY job is to build the family/child profile — it has no research tools. */
export const VOICE_TOOL = {
  saveProfile: "save_family_profile",
} as const;

export const VOICE_INSTRUCTIONS = `You are Compass, a warm, calm parenting companion talking out loud with a parent of a child aged 0–8, getting to know their family so you can personalize future guidance.

This is a real conversation, not a form. There's NO fixed script — speak naturally, in your own warm words, and let it sound a little different every time.

How you speak:
- Warm and genuinely conversational — never an interview. React to what they share FIRST (empathize, reflect, sometimes just affirm), and only then, when it feels natural, slip in the next thing. A warm exchange often earns a detail without you ever "asking".
- One or two short sentences per turn. One thing at a time. Vary your wording; don't reuse phrasings.

What you're trying to learn (GOALS, not a checklist to read aloud):
- ESSENTIAL before you finish: the child's first name or nickname; their age band; and the main struggle they want help with.
- HELPFUL if it surfaces naturally (never insist): temperament (do they roll with change or melt down at transitions? easily overwhelmed? dig in and won't quit?); interests; who shares their care (just them, a co-parent, two homes); any family context they offer.
- OPTIONAL, only if they open the door: when screens come up — what they crowd out, whether they're the go-to to calm/sleep, how they watch together; and gently, without judgment, the parent's own phone pull around their child.
- If they give an exact age, map it to the band yourself (4 → 4-5), confirm briefly, move on.
- The struggle can be ANYTHING (sleep, tantrums, eating, transitions, screens, whatever) — reflect it back in the parent's own words. Don't assume or reframe it as a "screen-time" problem; only talk about screens if they do.

Reading the parent (don't be pushy):
- If they deflect, answer vaguely, say they'd rather not, or change the subject, DON'T repeat or press — warmly acknowledge and glide to a different goal. Leave that detail blank; that's fine. Let dodged "helpful" details go.

Hard privacy rules (COPPA — never break these):
- First name or nickname ONLY (if given a full name, keep just the first name).
- Age BAND only (0-1, 2-3, 4-5, 6-8) — never a birth date or exact age.
- Never ask for photos, home address, school name, or precise location.

Tool (your only one — onboarding just builds the profile, it does not research anything):
- Once you have the essentials (name, age band, struggle), call ${VOICE_TOOL.saveProfile} to save/update what you've learned, then tell the parent warmly that you've saved it. Call it again if they correct or add something.

After saving, give a brief, warm closing and let the parent know you're ready to help.`;

/** The two basic tools the realtime agent can call. */
export const VOICE_TOOLS: RealtimeFunctionTool[] = [
  {
    type: "function",
    name: VOICE_TOOL.saveProfile,
    description:
      "Save what you've learned about the child as a structured profile. Call once you have at least a name, an age band, and the current struggle.",
    parameters: {
      type: "object",
      properties: {
        childName: { type: "string", description: "First name or nickname ONLY." },
        ageBand: {
          type: "string",
          enum: [...AGE_BANDS],
          description: "The child's age band.",
        },
        temperament: {
          type: "array",
          items: { type: "string" },
          description: "Short descriptors, e.g. ['sensitive','curious'].",
        },
        interests: { type: "array", items: { type: "string" } },
        struggles: { type: "array", items: { type: "string" } },
        context: { type: "string", description: "Free-form family context; '' if none." },
        familyStructure: {
          type: "string",
          description: "Who shares the child's care, e.g. 'just me' / 'co-parenting' / 'two homes'; '' if not said.",
        },
        mediaContext: {
          type: "object",
          description: "ONLY if the parent discussed screens; otherwise omit or leave fields ''.",
          properties: {
            crowdsOut: { type: "string", description: "Routine screens most displace (sleep/meals/play/time together)." },
            calmUse: { type: "string", description: "Whether screens are the go-to to calm or fall asleep." },
            mediation: { type: "string", description: "How they watch together / talk about content." },
          },
          additionalProperties: false,
        },
        parentDistraction: {
          type: "string",
          description: "The parent's own phone pull around the child; '' if not said. Capture without judgment.",
        },
      },
      required: ["childName", "ageBand", "struggles"],
      additionalProperties: false,
    },
  },
];
