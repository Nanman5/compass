/**
 * Compass — live-web grounding via Google (Gemini + Google Search).
 *
 * Gives the spoken agents a way to check the LIVE web: a realtime function tool (look_it_up)
 * whose handler hits Gemini with the google_search tool, so answers are grounded in current
 * results with real sources — not the model guessing. Server-only (reads GEMINI_API_KEY); the
 * tool schema below is just strings, re-declared by name on the client to dispatch.
 */

import "server-only";

import type { RealtimeFunctionTool } from "openai/resources/realtime/realtime";

const GROUNDING_MODEL = process.env.GROUNDING_GEMINI_MODEL || "gemini-2.5-flash";

export const GROUNDING_TOOL = { lookItUp: "look_it_up" } as const;

export const GROUNDING_TOOLS: RealtimeFunctionTool[] = [
  {
    type: "function",
    name: GROUNDING_TOOL.lookItUp,
    description:
      "Look something up on the LIVE web (Google Search) and get a short, source-backed answer. Use it when the parent asks for current, real-world info — latest guidance, a specific fact, what an expert/source actually says — that you shouldn't guess at. Then answer briefly in your own warm words.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "What to look up, phrased as a clear search question." },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
];

export interface GroundedAnswer {
  answer: string;
  sources: { title: string; uri: string }[];
}

/** Ask Gemini, grounded in live Google Search. Returns the answer + the sources it used. */
export async function groundedSearch(query: string): Promise<GroundedAnswer> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("Grounding isn't configured (no GEMINI_API_KEY).");

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GROUNDING_MODEL}:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: query }] }],
        tools: [{ google_search: {} }],
      }),
      signal: AbortSignal.timeout(20_000),
    },
  );
  if (!res.ok) throw new Error(`grounding request failed (${res.status})`);

  const data = (await res.json()) as {
    candidates?: {
      content?: { parts?: { text?: string }[] };
      groundingMetadata?: { groundingChunks?: { web?: { title?: string; uri?: string } }[] };
    }[];
  };
  const cand = data.candidates?.[0];
  const answer = (cand?.content?.parts ?? [])
    .map((p) => p.text ?? "")
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  const sources = (cand?.groundingMetadata?.groundingChunks ?? [])
    .map((c) => ({ title: c.web?.title ?? "", uri: c.web?.uri ?? "" }))
    .filter((s) => s.title || s.uri)
    .slice(0, 5);

  return { answer, sources };
}
