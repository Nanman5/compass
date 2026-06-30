/**
 * Compass — agent UI-control tools (shared across realtime personas).
 *
 * Feature: the spoken agents don't just talk, they can DRIVE THE SCREEN. These are
 * provider-agnostic realtime function tools any persona can be given; the client's
 * tool-executor switches on the NAME (re-declared as literals there) and renders the
 * matching UI — a scene backdrop, a calm countdown timer, etc.
 *
 * No secrets here — strings + JSON schema. Imported by the realtime session route.
 */

import type { RealtimeFunctionTool } from "openai/resources/realtime/realtime";

/** Tool names — the client matches on these to mutate the UI. */
export const UI_TOOL = {
  showScene: "show_scene",
  startTimer: "start_timer",
} as const;

export const UI_TOOLS: RealtimeFunctionTool[] = [
  {
    type: "function",
    name: UI_TOOL.showScene,
    description:
      "Paint the screen to match the moment — a backdrop the parent (and child) can look at. Call it whenever the scene or mood shifts; keep it gentle and vivid.",
    parameters: {
      type: "object",
      properties: {
        emoji: {
          type: "string",
          description: "One to three emoji that depict the scene right now, e.g. '🌙✨' or '🐉🔥'.",
        },
        caption: {
          type: "string",
          description: "A SHORT evocative line for the scene (max ~8 words), e.g. 'Deep in the glowing forest'.",
        },
      },
      required: ["emoji", "caption"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: UI_TOOL.startTimer,
    description:
      "Put a calm, visible countdown on screen — for slow breaths, a wind-down, or a transition warning. Use a small number of seconds. Announce it warmly in your own words too.",
    parameters: {
      type: "object",
      properties: {
        seconds: { type: "number", description: "How long, in seconds (e.g. 20 for a few slow breaths)." },
        label: { type: "string", description: "A short label, e.g. 'Three slow breaths' or 'Two more minutes'." },
      },
      required: ["seconds", "label"],
      additionalProperties: false,
    },
  },
];
