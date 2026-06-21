"use client";

/**
 * /app/weekly — the live "This week's drop".
 *
 * Resolves this browser's familyId (signed-in Google account → "g:<sub>", else the
 * per-browser demo id in localStorage, matching onboarding), fetches GET /api/weekly,
 * and renders the magazine-style drop. Client component because it owns the familyId
 * resolution + fetch lifecycle (loading / error / loaded).
 *
 * The shared AppShell provides the aurora background, desktop sidebar, and mobile tab bar;
 * the readable drop layout lives in WeeklyDrop.tsx.
 */

import { useCallback, useEffect, useState } from "react";

import AppShell from "@/components/AppShell";
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
    <AppShell active="drop">
      {phase.state === "loading" && <WeeklyDropSkeleton />}
      {phase.state === "error" && <WeeklyDropError onRetry={() => void load()} />}
      {phase.state === "ready" && <WeeklyDropCard data={phase.data} />}
    </AppShell>
  );
}
