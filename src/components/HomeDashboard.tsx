"use client";

/**
 * HomeDashboard — the "Home" tab: a warm welcome back with the child's snapshot, a gentle
 * nudge, and one primary action. Mobile-first single column; on desktop the shared Sidebar
 * appears at the left and the bottom tab bar is replaced by it.
 */

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

import AppShell from "@/components/AppShell";
import type { ChildProfile } from "@/lib/types";

const BANNER = "/img/dashboard-banner.png";

export default function HomeDashboard({
  profile,
  returning,
  onRestart,
}: {
  profile: ChildProfile;
  returning?: boolean;
  onRestart?: () => void;
}) {
  const name = profile.childName || "your little one";
  const ageLine = [profile.ageBand && `${profile.ageBand} years`, profile.temperament[0]]
    .filter(Boolean)
    .join(" · ");
  const traits = [...profile.interests, ...profile.struggles].filter(Boolean).slice(0, 3);
  const lovesLine = traits.length
    ? `Loves ${traits.join(", ")}.`
    : "We're still getting to know them, little by little.";

  return (
    <AppShell active="home" maxWidth="max-w-2xl lg:max-w-4xl">
      <div className="space-y-6">
            {/* top row */}
            <div className="flex items-center gap-2">
              <Image src="/brand/compass-mark-color.png" alt="" width={26} height={26} />
              <span
                className="text-lg font-semibold tracking-tight text-teal"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Compass
              </span>
            </div>

            {/* greeting */}
            <div>
              <p className="eyebrow">{returning ? "Welcome back" : "You're all set"}</p>
              <h1 className="mt-1 text-[2rem] font-semibold leading-[1.08] text-teal sm:text-[2.4rem]">
                {returning ? "Good to see you again" : `${name}'s space is ready`}
              </h1>
              <p className="mt-2 text-[0.98rem] leading-relaxed text-ink/70">
                Here&apos;s your space — pick up wherever you left off.
              </p>
            </div>

            {/* banner */}
            <div className="relative aspect-[16/10] overflow-hidden rounded-[1.5rem] shadow-[var(--shadow-soft)] sm:aspect-[5/2]">
              <Image src={BANNER} alt="" fill priority className="object-cover" />
            </div>

            {/* child + reminder — stacked on mobile, side-by-side on desktop */}
            <div className="grid gap-4 lg:grid-cols-2">
              {/* your child */}
              <div className="glass flex flex-col rounded-[1.4rem] p-5">
                <div className="flex items-center gap-3">
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-sage-soft/60 text-base font-bold text-teal">
                    {name.slice(0, 1).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-[1.02rem] font-semibold text-teal">Your child, {name}</h3>
                    {ageLine && <p className="text-[0.82rem] text-ink/60">{ageLine}</p>}
                  </div>
                </div>
                <p className="mt-3 flex-1 text-[0.9rem] leading-relaxed text-ink/75">{lovesLine}</p>
                <Link
                  href="/app/memory"
                  className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-teal/80 transition hover:text-teal"
                >
                  View {name}&apos;s profile
                  <Arrow />
                </Link>
              </div>

              {/* gentle reminder */}
              <div
                className="flex items-center gap-3 rounded-[1.4rem] p-5"
                style={{ background: "linear-gradient(115deg, #fdfbf6 0%, #eef2ec 100%)" }}
              >
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-sage-soft/60 text-teal">
                  <LeafIcon />
                </span>
                <div>
                  <p className="text-[0.95rem] font-semibold text-teal">Today&apos;s gentle reminder</p>
                  <p className="text-[0.88rem] leading-relaxed text-ink/70">
                    Small moments today build big confidence tomorrow.
                  </p>
                </div>
              </div>
            </div>

            {/* primary CTA */}
            <Link href="/app/coach" className="btn btn-primary w-full">
              Pick up where you left off
              <Arrow strong />
            </Link>

            {onRestart && (
              <div className="pt-1 text-center">
                <RestartOnboarding name={name} onRestart={onRestart} />
              </div>
            )}
      </div>
    </AppShell>
  );
}

/** Quiet "start onboarding over" affordance with a one-tap confirm, since it overwrites. */
function RestartOnboarding({ name, onRestart }: { name: string; onRestart: () => void }) {
  const [confirming, setConfirming] = useState(false);
  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="text-xs font-semibold text-teal/55 underline underline-offset-2 transition hover:text-teal"
      >
        Things changed? Redo {name}&apos;s onboarding
      </button>
    );
  }
  return (
    <div className="mx-auto flex max-w-sm flex-col items-center gap-2.5 rounded-2xl border border-teal/15 bg-cream-card/70 px-5 py-4">
      <p className="text-sm leading-relaxed text-ink/75">
        This starts a fresh conversation and overwrites {name}&apos;s current profile. Your saved
        learnings stay.
      </p>
      <div className="flex gap-2.5">
        <button onClick={() => setConfirming(false)} className="btn btn-ghost px-5 py-2 text-sm">
          Keep it
        </button>
        <button onClick={onRestart} className="btn btn-primary px-5 py-2 text-sm">
          Start fresh
        </button>
      </div>
    </div>
  );
}

function Arrow({ strong }: { strong?: boolean }) {
  return (
    <svg width={strong ? 18 : 15} height={strong ? 18 : 15} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 12h13M13 6l6 6-6 6" stroke="currentColor" strokeWidth={strong ? 2.2 : 2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LeafIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M19 5c0 8-5.4 13-13 13 0-8 5.4-13 13-13Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M7 17C10 13 13 10 17 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
