"use client";

/**
 * /app/memory — "What Compass remembers".
 *
 * A calm transparency surface: everything Compass has stored for THIS family —
 * the child profile, the learnings (with dates), and recent episodes — plus a
 * "Forget everything" control that wipes it after confirmation.
 *
 * Client component: it resolves the same per-browser/per-account familyId the
 * onboarding uses (signed-in → `g:<sub>`, else the local demo id) and reads
 * GET /api/memory?familyId= directly, so what's shown is exactly what's stored.
 *
 * Style mirrors /app: cream base + drifting aurora + wet-glass surfaces (globals.css).
 */

import { useEffect, useState } from "react";

import FamilyAccess from "@/components/FamilyAccess";
import MemoryPanel from "@/components/MemoryPanel";

const FAMILY_ID_KEY = "compass.familyId";

/** Stable per-browser demo family id — mirrors OnboardingChat so memory lines up. */
function getGuestFamilyId(): string {
  const existing = localStorage.getItem(FAMILY_ID_KEY);
  if (existing) return existing;
  const id = `demo-${crypto.randomUUID()}`;
  localStorage.setItem(FAMILY_ID_KEY, id);
  return id;
}

export default function MemoryPage() {
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [signedIn, setSignedIn] = useState(false);

  // Resolve the family scope once on mount: a signed-in user gets the server-resolved
  // SHARED familyId (so co-parents line up); guests fall back to the local demo id.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let id: string | null = null;
      try {
        const res = await fetch("/api/auth/me");
        const data = await res.json();
        if (data?.familyId) {
          id = data.familyId;
          if (!cancelled) setSignedIn(Boolean(data.user));
        }
      } catch {
        /* fall through to the local demo id */
      }
      if (!id) id = getGuestFamilyId();
      if (!cancelled) setFamilyId(id);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return <MemoryPanel familyId={familyId} topSlot={signedIn ? <FamilyAccess /> : null} />;
}
