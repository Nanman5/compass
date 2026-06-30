"use client";

/**
 * /app/story — "Story Together": a shared, spoken story between parent and Compass.
 *
 * Resolves the family identity (server-resolved shared familyId for signed-in accounts, else
 * the guest familyId from onboarding) so the storyteller can make the child the hero, then
 * mounts the full-screen voice experience.
 */

import { useEffect, useState } from "react";

import Storytime from "@/components/Storytime";

export default function StoryPage() {
  const [familyId, setFamilyId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let fid = "";
      try {
        const res = await fetch("/api/auth/me");
        const data = await res.json();
        if (data?.familyId) fid = data.familyId as string;
      } catch {
        /* fall through to guest */
      }
      if (!fid) {
        try {
          fid = localStorage.getItem("compass.familyId") || "";
        } catch {
          /* ignore */
        }
      }
      if (!cancelled) setFamilyId(fid || "guest");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!familyId) {
    return (
      <div className="fixed inset-0 grid place-items-center overflow-hidden bg-cream">
        <div className="aurora" aria-hidden="true">
          <div className="blob blob-coral" />
          <div className="blob blob-teal" />
          <div className="blob blob-gold" />
        </div>
        <p className="relative z-10 text-sm font-semibold uppercase tracking-[0.16em] text-coral">
          Once upon a time…
        </p>
      </div>
    );
  }

  return <Storytime familyId={familyId} />;
}
