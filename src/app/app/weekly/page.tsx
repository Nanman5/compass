"use client";

/**
 * /app/weekly — the live Weekly Drop.
 *
 * Resolves this browser's familyId (signed-in Google account → "g:<sub>", else the
 * per-browser demo id in localStorage, matching onboarding), fetches GET /api/weekly,
 * and renders the "This week for {child}" card. Client component because it owns the
 * familyId resolution + fetch lifecycle (loading / error / loaded).
 *
 * Visuals live in WeeklyDrop.tsx; this file is just the page shell + ambient aurora.
 */

import { useCallback, useEffect, useState } from "react";

import {
  WeeklyDropCard,
  WeeklyDropError,
  WeeklyDropSkeleton,
  type WeeklyDropData,
} from "@/components/WeeklyDrop";

/** Same key OnboardingChat uses, so the drop reads the family memory built during onboarding. */
const FAMILY_ID_KEY = "compass.familyId";

type Phase = { state: "loading" } | { state: "error" } | { state: "ready"; data: WeeklyDropData };

/**
 * Resolve the family id the same way the rest of the app does:
 *   signed-in Google account → "g:<sub>"; otherwise the stable per-browser demo id.
 */
async function resolveFamilyId(): Promise<string> {
  try {
    const res = await fetch("/api/auth/me");
    const data = await res.json();
    if (data?.user?.sub) return `g:${data.user.sub}`;
  } catch {
    /* fall through to the local demo id */
  }
  const existing = localStorage.getItem(FAMILY_ID_KEY);
  if (existing) return existing;
  const id = `demo-${crypto.randomUUID()}`;
  localStorage.setItem(FAMILY_ID_KEY, id);
  return id;
}

export default function WeeklyPage() {
  const [phase, setPhase] = useState<Phase>({ state: "loading" });

  const load = useCallback(async () => {
    setPhase({ state: "loading" });
    try {
      const familyId = await resolveFamilyId();
      const res = await fetch(`/api/weekly?familyId=${encodeURIComponent(familyId)}`);
      if (!res.ok) throw new Error(`weekly fetch failed: ${res.status}`);
      const data = (await res.json()) as WeeklyDropData;
      if (!data || !Array.isArray(data.items) || data.items.length === 0) {
        throw new Error("weekly response was empty");
      }
      setPhase({ state: "ready", data });
    } catch {
      setPhase({ state: "error" });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden bg-cream px-5 py-12">
      <Aurora />
      <div className="relative z-10 flex w-full justify-center">
        {phase.state === "loading" && <WeeklyDropSkeleton />}
        {phase.state === "error" && <WeeklyDropError onRetry={() => void load()} />}
        {phase.state === "ready" && <WeeklyDropCard data={phase.data} />}
      </div>
    </main>
  );
}

/** Ambient drifting color fields behind the glass card (shared look with /app). */
function Aurora() {
  return (
    <div className="aurora" aria-hidden="true">
      <div className="blob blob-coral" />
      <div className="blob blob-teal" />
      <div className="blob blob-gold" />
      <div className="blob blob-rose" />
    </div>
  );
}
