"use client";

/**
 * /app/today — the "Today" tab: a calm daily snapshot.
 *
 * Resolves this browser's familyId the same way the rest of the app does (signed-in
 * Google account → "g:<sub>", else the per-browser demo id in localStorage, matching
 * onboarding), reads GET /api/memory?familyId=, and hands the { profile, episodes } to
 * TodaySnapshot, which shapes them into four warm sections. Client component because it
 * owns familyId resolution + the fetch lifecycle.
 *
 * Resilient by design: even with no data (or a failed fetch) it renders a gentle,
 * generic snapshot rather than an error screen — the tab should always feel calm.
 */

import { useEffect, useState } from "react";

import AppShell from "@/components/AppShell";
import TodaySnapshot, { type SnapshotMemory } from "@/components/TodaySnapshot";

/** Same key OnboardingChat uses, so the snapshot reads the memory built during onboarding. */
const FAMILY_ID_KEY = "compass.familyId";

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
  try {
    const existing = localStorage.getItem(FAMILY_ID_KEY);
    if (existing) return existing;
    const id = `demo-${crypto.randomUUID()}`;
    localStorage.setItem(FAMILY_ID_KEY, id);
    return id;
  } catch {
    return "guest";
  }
}

const EMPTY: SnapshotMemory = { profile: null, episodes: [] };

export default function TodayPage() {
  // Start from an empty (but valid) snapshot so the first paint is already calm and
  // on-brand; we fill it in once the family's memory loads.
  const [memory, setMemory] = useState<SnapshotMemory>(EMPTY);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const familyId = await resolveFamilyId();
        const res = await fetch(`/api/memory?familyId=${encodeURIComponent(familyId)}`);
        if (!res.ok) return; // keep the gentle empty snapshot
        const data = await res.json();
        if (cancelled) return;
        setMemory({
          profile: data?.profile ?? null,
          episodes: Array.isArray(data?.episodes) ? data.episodes : [],
        });
      } catch {
        /* keep the gentle empty snapshot */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AppShell active="today">
      <TodaySnapshot memory={memory} />
    </AppShell>
  );
}
