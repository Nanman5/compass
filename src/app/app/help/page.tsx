"use client";

/**
 * /app/help — the "Help Me Now" crisis voice coach.
 *
 * Resolves the family identity (signed-in Google account → g:<sub>, else the guest familyId
 * saved during onboarding) so the coach can personalize to this child, then mounts the
 * full-screen voice experience.
 */

import { useEffect, useState } from "react";

import HelpMeNow from "@/components/HelpMeNow";

export default function HelpPage() {
  const [familyId, setFamilyId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let fid = "";
      try {
        const res = await fetch("/api/auth/me");
        const data = await res.json();
        if (data?.user?.sub) fid = `g:${data.user.sub}`;
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
          I&apos;m right here…
        </p>
      </div>
    );
  }

  return <HelpMeNow familyId={familyId} />;
}
