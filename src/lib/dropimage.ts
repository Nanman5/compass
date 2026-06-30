/**
 * Compass — weekly-drop infographic generation (OpenAI gpt-image-2, Gemini fallback).
 *
 * Generates ONE warm, on-brand illustrated "infographic" header for a family's weekly drop and
 * returns it as a `data:` URL the UI renders directly. Tries OpenAI's image model first (with
 * OPENAI_API_KEY); if that's unavailable (missing key, model error, billing cap, timeout) it
 * falls back to Gemini's image model (GEMINI_API_KEY) so the demo still gets a generated image.
 * If BOTH fail it returns null and the drop falls back to the static illustration.
 *
 * Server-only. Models/size/quality are env-overridable.
 */

import "server-only";

import OpenAI from "openai";

import type { ChildProfile } from "@/lib/types";

const OPENAI_IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || "gpt-image-2";
const OPENAI_IMAGE_SIZE = (process.env.OPENAI_IMAGE_SIZE ||
  "1536x1024") as OpenAI.Images.ImageGenerateParams["size"];
const OPENAI_IMAGE_QUALITY = (process.env.OPENAI_IMAGE_QUALITY ||
  "low") as OpenAI.Images.ImageGenerateParams["quality"];
const GEMINI_IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image";
/** Image generation is slow; cap it so a slow render can't hold the weekly request open. */
const TIMEOUT_MS = 60_000;

/** A calm, on-brand brief for the drop's illustrated header (no relied-upon text). */
export function buildInfographicPrompt(profile: ChildProfile, headline?: string): string {
  const focus = profile.struggles[0] || "everyday family routines";
  const interest = profile.interests[0];
  const theme = headline?.trim() ? headline.trim() : `${focus} and intentional screen-time`;
  return [
    "A soft, warm editorial illustration in a calm cream, sage-green and teal palette with",
    "gentle coral accents, hand-painted children's-storybook style.",
    "Wide horizontal banner composition, the subject centered, the soft background filling the",
    "whole frame edge to edge (no plain white border).",
    `Theme: a young child and a caring parent, about ${theme}.`,
    interest ? `Subtly nod to the child's love of ${interest}.` : "",
    "Cozy, hopeful, non-clinical. No words, no letters, no charts, no logos — illustration only.",
  ]
    .filter(Boolean)
    .join(" ");
}

/**
 * Generate the drop's infographic. Returns a `data:image/...;base64,...` URL, or null only if
 * BOTH providers fail (no keys / model error / billing cap / timeout) so the caller degrades
 * gracefully to the static illustration.
 */
export async function generateDropImage(
  profile: ChildProfile,
  headline?: string,
): Promise<string | null> {
  const prompt = buildInfographicPrompt(profile, headline);
  return (await generateWithOpenAI(prompt)) ?? (await generateWithGemini(prompt));
}

/** OpenAI gpt-image-2 → data URL, or null on any failure. */
async function generateWithOpenAI(prompt: string): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  try {
    const client = new OpenAI({ apiKey });
    const res = await client.images.generate(
      {
        model: OPENAI_IMAGE_MODEL,
        prompt,
        size: OPENAI_IMAGE_SIZE,
        quality: OPENAI_IMAGE_QUALITY,
        n: 1,
      },
      { signal: AbortSignal.timeout(TIMEOUT_MS) },
    );
    const b64 = res.data?.[0]?.b64_json;
    if (!b64) return null;
    console.info(`[dropimage] generated via OpenAI (${OPENAI_IMAGE_MODEL}, ~${kb(b64)}KB)`);
    return `data:image/png;base64,${b64}`;
  } catch (err) {
    console.warn(
      "[dropimage] OpenAI image failed; trying Gemini:",
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/** Gemini image model → data URL, or null on any failure. Raw REST (mirrors grounding.ts). */
async function generateWithGemini(prompt: string): Promise<string | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_IMAGE_MODEL}:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      },
    );
    if (!res.ok) {
      console.warn(`[dropimage] Gemini image returned ${res.status}`);
      return null;
    }
    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { inlineData?: { mimeType?: string; data?: string } }[] } }[];
    };
    const inline = data.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)?.inlineData;
    if (!inline?.data) return null;
    console.info(`[dropimage] generated via Gemini (${GEMINI_IMAGE_MODEL}, ~${kb(inline.data)}KB)`);
    return `data:${inline.mimeType || "image/png"};base64,${inline.data}`;
  } catch (err) {
    console.warn(
      "[dropimage] Gemini image failed; using static illustration:",
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/** Rough KB from a base64 string, for logging. */
function kb(b64: string): number {
  return Math.round((b64.length * 0.75) / 1024);
}
