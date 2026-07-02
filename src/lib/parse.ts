/**
 * Compass — shared defensive parsing for LLM output.
 *
 * Every surface that asks a model for JSON tolerates the same real-world mess: markdown
 * fences, stray prose around the object, or plain valid JSON. This is the single home for
 * that logic — coach, onboarding, personalize, and weekly all parse through here.
 */

/** Find the first balanced top-level `{...}` object in free text; null if none. */
export function firstBalancedObject(text: string): string | null {
  const start = text.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}" && --depth === 0) return text.slice(start, i + 1);
  }
  return null;
}

/**
 * Pull the first JSON object out of a model response that may be fenced (```json ... ```)
 * or wrapped in prose. Returns the parsed object, or null when nothing parseable is there.
 */
export function extractJsonObject(text: string): Record<string, unknown> | null {
  if (!text) return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : firstBalancedObject(text);
  if (!candidate) return null;
  try {
    const parsed = JSON.parse(candidate);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/** Coerce to a trimmed string ("" if absent/not a string). */
export function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}
