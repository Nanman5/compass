"use client";

/**
 * /app/weekly — the live "This week's drop" + the saved-drops archive.
 *
 * Resolves this browser's familyId (signed-in Google account → "g:<sub>", else the per-browser
 * demo id in localStorage, matching onboarding), fetches GET /api/weekly for the current drop
 * and GET /api/weekly/history for past weeks, and renders the magazine-style drop with a
 * "Past drops" switcher. Client component because it owns the familyId resolution + fetch
 * lifecycle and the active-week selection.
 *
 * The shared AppShell provides the aurora background, desktop sidebar, and mobile tab bar;
 * the readable drop layout lives in WeeklyDrop.tsx.
 */

import { useCallback, useEffect, useMemo, useState } from "react";

import AppShell from "@/components/AppShell";
import {
  PastDrops,
  WeeklyDropCard,
  WeeklyDropError,
  WeeklyDropSkeleton,
  WeeklyNeedsContext,
  type WeeklyDropData,
} from "@/components/WeeklyDrop";

/** Same key OnboardingChat uses, so the drop reads the family memory built during onboarding. */
const FAMILY_ID_KEY = "compass.familyId";

type Phase = "loading" | "error" | "needsContext" | "ready";

/**
 * Resolve the family id the same way the rest of the app does: a signed-in account uses the
 * server-resolved SHARED familyId (so co-parents line up); otherwise the per-browser demo id.
 */
async function resolveFamilyId(): Promise<string> {
  try {
    const res = await fetch("/api/auth/me");
    const data = await res.json();
    if (data?.familyId) return data.familyId as string;
  } catch {
    /* fall through to the local demo id */
  }
  const existing = localStorage.getItem(FAMILY_ID_KEY);
  if (existing) return existing;
  const id = `demo-${crypto.randomUUID()}`;
  localStorage.setItem(FAMILY_ID_KEY, id);
  return id;
}

/** Keep the first occurrence of each week (the current full drop wins over its archived copy). */
function dedupeByWeek(list: WeeklyDropData[]): WeeklyDropData[] {
  const seen = new Set<string>();
  const out: WeeklyDropData[] = [];
  for (const d of list) {
    if (!d?.weekKey || seen.has(d.weekKey)) continue;
    seen.add(d.weekKey);
    out.push(d);
  }
  return out;
}

export default function WeeklyPage() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [archive, setArchive] = useState<WeeklyDropData[]>([]);
  const [activeWeekKey, setActiveWeekKey] = useState("");
  const [brewing, setBrewing] = useState(false); // easter-egg: a fresh drop is being made

  const load = useCallback(async (fresh = false) => {
    try {
      const familyId = await resolveFamilyId();
      const url = `/api/weekly?familyId=${encodeURIComponent(familyId)}${fresh ? "&fresh=1" : ""}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`weekly fetch failed: ${res.status}`);
      const data = (await res.json()) as WeeklyDropData & { needsContext?: boolean };
      if (data?.needsContext) {
        setPhase("needsContext");
        return;
      }
      if (!data || !Array.isArray(data.items) || data.items.length === 0) {
        throw new Error("weekly response was empty");
      }

      // Past drops (best-effort — a failure here shouldn't block the current drop).
      let history: WeeklyDropData[] = [];
      try {
        const h = await fetch(`/api/weekly/history?familyId=${encodeURIComponent(familyId)}`);
        if (h.ok) history = ((await h.json())?.drops as WeeklyDropData[]) ?? [];
      } catch {
        /* ignore */
      }

      setArchive(dedupeByWeek([data, ...history]));
      setActiveWeekKey(data.weekKey);
      setPhase("ready");
    } catch {
      setPhase("error");
    }
  }, []);

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  // Event-handler reset (not in an effect) so retry shows the skeleton again.
  const retry = useCallback(() => {
    setPhase("loading");
    setArchive([]);
    void load();
  }, [load]);

  // Easter egg: type "drop" anywhere on this page to brew a brand-new drop on the spot
  // (skips the weekly cache + regenerates, infographic and all). Handy for a live demo.
  useEffect(() => {
    let buf = "";
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea") return;
      const k = (e.key || "").toLowerCase();
      if (k.length !== 1 || !/[a-z]/.test(k)) return;
      buf = (buf + k).slice(-4);
      clearTimeout(timer);
      timer = setTimeout(() => (buf = ""), 1500);
      if (buf === "drop") {
        buf = "";
        setBrewing(true);
        setPhase("loading");
        setArchive([]);
        void load(true).finally(() => setTimeout(() => setBrewing(false), 1600));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      clearTimeout(timer);
    };
  }, [load]);

  const active = useMemo(
    () => archive.find((d) => d.weekKey === activeWeekKey) ?? archive[0],
    [archive, activeWeekKey],
  );

  return (
    <AppShell active="drop">
      {brewing && (
        <div className="pointer-events-none fixed left-1/2 top-6 z-50 -translate-x-1/2 rounded-full bg-teal px-4 py-2 text-sm font-semibold text-white shadow-[var(--shadow-soft)]">
          ✨ Brewing a fresh drop…
        </div>
      )}
      {phase === "loading" && <WeeklyDropSkeleton />}
      {phase === "error" && <WeeklyDropError onRetry={retry} />}
      {phase === "needsContext" && <WeeklyNeedsContext />}
      {phase === "ready" && active && (
        <>
          <WeeklyDropCard data={active} />
          <PastDrops drops={archive} activeWeekKey={active.weekKey} onSelect={setActiveWeekKey} />
        </>
      )}
    </AppShell>
  );
}
