"use client";

/**
 * /app/help — "Help Me Now": a calm crisis CHAT (primary), with the voice experience one
 * visible tap away ("Talk it out loud").
 *
 * Resolves the family identity (signed-in Google account → g:<sub>, else the guest familyId
 * saved during onboarding) so the coach can personalize to this child.
 */

import { useEffect, useState } from "react";

import HelpNowChat from "@/components/HelpNowChat";

export default function HelpPage() {
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
        // Guest scope: reuse the browser's demo id, or mint one (same key all surfaces use).
        try {
          fid = localStorage.getItem("compass.familyId") || "";
          if (!fid) {
            fid = `demo-${crypto.randomUUID()}`;
            localStorage.setItem("compass.familyId", fid);
          }
        } catch {
          /* ignore */
        }
      }
      if (!cancelled) setFamilyId(fid || `demo-${crypto.randomUUID()}`);
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

  return (
    <div className="fixed inset-0">
      <HelpNowChat familyId={familyId} />
    </div>
  );
}
