/**
 * Compass — ChildProfile field normalizers (shared by the typed onboarding extraction and
 * the voice agent's save-profile route, so BOTH write paths enforce the same rules).
 *
 * These are the COPPA / memory-hygiene gates: first-name-only, age-band whitelist with a
 * safe default, capped string arrays. A malformed LLM response or tool call can never
 * poison memory because everything passes through here first.
 */

import { AGE_BANDS, type AgeBand, type ChildProfile } from "@/lib/types";

export function normalizeName(value: unknown): string {
  if (typeof value !== "string" || value.trim().length === 0) return "their child";
  // Keep only the first token to enforce first-name-only (COPPA defense-in-depth).
  return value.trim().split(/\s+/)[0];
}

export function normalizeAgeBand(value: unknown): AgeBand {
  if (typeof value === "string" && (AGE_BANDS as readonly string[]).includes(value)) {
    return value as AgeBand;
  }
  return "2-3"; // safe default within the product band
}

export function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is string => typeof v === "string")
    .map((v) => v.trim())
    .filter((v) => v.length > 0)
    .slice(0, 8); // cap to keep memory lean (Bible: fewer, better facts)
}

/** Coerce to a trimmed string ("" if absent). */
export function asTrimmed(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Build the 5C media context, dropping empty fields; null if nothing was volunteered. */
export function normalizeMediaContext(value: unknown): ChildProfile["mediaContext"] | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  const out: NonNullable<ChildProfile["mediaContext"]> = {};
  const crowdsOut = asTrimmed(v.crowdsOut);
  const calmUse = asTrimmed(v.calmUse);
  const mediation = asTrimmed(v.mediation);
  if (crowdsOut) out.crowdsOut = crowdsOut;
  if (calmUse) out.calmUse = calmUse;
  if (mediation) out.mediation = mediation;
  return Object.keys(out).length > 0 ? out : null;
}
