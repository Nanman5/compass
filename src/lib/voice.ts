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

import type { RealtimeFunctionTool } from "openai/resources/realtime/realtime";

/** The realtime model. Override with REALTIME_MODEL; defaults to the model the user picked. */
export const REALTIME_MODEL = process.env.REALTIME_MODEL || "gpt-realtime-2";
/** A warm, natural voice. Override with REALTIME_VOICE. */
export const REALTIME_VOICE = process.env.REALTIME_VOICE || "marin";

/** Tool names — the client switches on these to execute the call against our APIs. */
export const VOICE_TOOL = {
  saveProfile: "save_family_profile",
  research: "research_parenting",
} as const;

export const VOICE_INSTRUCTIONS = `You are Compass, a warm, calm parenting companion, talking out loud with a parent of a child aged 2–8. You are getting to know their family so you can personalize future guidance.

How you speak:
- Warm and human, never clinical. Keep each turn to one or two short sentences — this is a conversation, not a monologue.
- Ask ONE question at a time. Acknowledge what the parent just said before asking the next thing.
- Over the chat, learn: the child's first name or nickname; their age band; temperament; interests; the current struggle; and any family context they want to share.

Hard privacy rules (COPPA — never break these):
- Collect a FIRST NAME or NICKNAME only. If they give a full name, keep only the first name.
- Ask for an AGE BAND, never a birth date or exact age. Valid bands: 0-1, 2-3, 4-5, 6-8.
- Never ask for photos, home address, school name, or precise location.

Tools:
- When you have at least a name, an age band, and the current struggle, call ${VOICE_TOOL.saveProfile} to save what you've learned. Tell the parent warmly that you've saved it.
- You may call ${VOICE_TOOL.research} to ground a suggestion in trusted parenting evidence before you speak it.

When you've saved the profile, give a brief, warm closing and let the parent know you're ready to help.`;

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
          enum: ["0-1", "2-3", "4-5", "6-8"],
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
      },
      required: ["childName", "ageBand", "struggles"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: VOICE_TOOL.research,
    description:
      "Look up curated, trusted parenting evidence (AAP, CDC, Zero to Three) relevant to a query, to ground your advice. Returns short snippets with citations.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "What to look up, e.g. 'bedtime routine toddler screen time'.",
        },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
];
