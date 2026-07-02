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

import { familyAccessError } from "@/lib/authz";
import { memory } from "@/lib/memory";
import {
  asTrimmed,
  normalizeAgeBand,
  normalizeMediaContext,
  normalizeName,
  normalizeStringArray,
} from "@/lib/profilefields";
import type { ChildProfile } from "@/lib/types";

export const runtime = "nodejs";

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

  const denied = await familyAccessError(familyId);
  if (denied) return denied;

  const now = new Date().toISOString();
  const familyStructure = asTrimmed(b.familyStructure);
  const parentDistraction = asTrimmed(b.parentDistraction);
  const mediaContext = normalizeMediaContext(b.mediaContext);
  const profile: ChildProfile = {
    familyId,
    childName: normalizeName(b.childName),
    ageBand: normalizeAgeBand(b.ageBand),
    temperament: normalizeStringArray(b.temperament),
    interests: normalizeStringArray(b.interests),
    struggles: normalizeStringArray(b.struggles),
    context: asTrimmed(b.context),
    ...(familyStructure ? { familyStructure } : {}),
    ...(mediaContext ? { mediaContext } : {}),
    ...(parentDistraction ? { parentDistraction } : {}),
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
