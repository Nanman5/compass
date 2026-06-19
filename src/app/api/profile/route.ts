/**
 * POST /api/profile — the voice agent's "save info" tool.
 *
 * Persists the child profile the agent gathered during the spoken onboarding into this
 * family's semantic memory. Defensive: we validate/normalize every field (COPPA name
 * minimization, age-band whitelist, array caps) before writing, exactly like the typed
 * onboarding extraction, so a malformed tool call can never poison memory.
 *
 * Body: { familyId, childName, ageBand, temperament?, interests?, struggles?, context? }
 * Returns: { ok: true, profile }
 * Server-only.
 */

import { NextResponse } from "next/server";

import { memory } from "@/lib/memory";
import type { AgeBand, ChildProfile } from "@/lib/types";

export const runtime = "nodejs";

const AGE_BANDS: readonly AgeBand[] = ["0-1", "2-3", "4-5", "6-8"];

export async function POST(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const b = (body ?? {}) as Record<string, unknown>;
  const familyId = typeof b.familyId === "string" ? b.familyId.trim() : "";
  if (familyId.length === 0) {
    return NextResponse.json({ error: "familyId is required" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const profile: ChildProfile = {
    familyId,
    childName: normalizeName(b.childName),
    ageBand: normalizeAgeBand(b.ageBand),
    temperament: normalizeStringArray(b.temperament),
    interests: normalizeStringArray(b.interests),
    struggles: normalizeStringArray(b.struggles),
    context: typeof b.context === "string" ? b.context.trim() : "",
    createdAt: now,
    updatedAt: now,
  };

  try {
    const saved = await memory.saveProfile(profile);
    console.info(`[voice] tool save_family_profile → ${saved.childName} (${saved.ageBand}), family=${familyId}`);
    return NextResponse.json({ ok: true, profile: saved });
  } catch (err) {
    console.error("[profile] save failed:", err);
    return NextResponse.json({ error: "Failed to save profile" }, { status: 500 });
  }
}

function normalizeName(value: unknown): string {
  if (typeof value !== "string" || value.trim().length === 0) return "their child";
  // First token only — COPPA defense-in-depth.
  return value.trim().split(/\s+/)[0];
}

function normalizeAgeBand(value: unknown): AgeBand {
  if (typeof value === "string" && (AGE_BANDS as readonly string[]).includes(value)) {
    return value as AgeBand;
  }
  return "2-3";
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is string => typeof v === "string")
    .map((v) => v.trim())
    .filter((v) => v.length > 0)
    .slice(0, 8);
}
