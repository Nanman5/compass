"use client";

/**
 * AppShell — the shared chrome for the signed-in product: a calm cream canvas with the
 * ambient aurora, a left icon rail on desktop (lg+) and a fixed bottom tab bar on mobile.
 * Mobile-first: the bottom bar is the primary navigation; the sidebar is the desktop
 * enhancement. The five destinations mirror the product's main surfaces.
 *
 * Home lives inside the onboarding flow's shell, so the nav pieces (BottomNav / Sidebar) are
 * exported separately and reused there; standalone tab pages wrap their content in <AppShell>.
 */

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";

export type TabKey = "home" | "today" | "drop" | "checkin" | "toolkit";

const MARK = "/brand/compass-mark-color.png";

const TABS: { key: TabKey; label: string; href: string }[] = [
  { key: "home", label: "Home", href: "/app" },
  { key: "today", label: "Today", href: "/app/today" },
  { key: "drop", label: "Drop", href: "/app/weekly" },
  { key: "checkin", label: "Check-in", href: "/app/wins" },
  { key: "toolkit", label: "Toolkit", href: "/app/toolkit" },
];

function TabIcon({ kind }: { kind: TabKey }) {
  const c = { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", "aria-hidden": true } as const;
  switch (kind) {
    case "home":
      return (
        <svg {...c}><path d="M4 11l8-7 8 7M6 10v9h12v-9" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
      );
    case "today":
      return (
        <svg {...c}><rect x="4" y="5" width="16" height="15" rx="2.5" stroke="currentColor" strokeWidth="1.7" /><path d="M4 9.5h16M8 3.5v3M16 3.5v3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>
      );
    case "drop":
      return (
        <svg {...c}><path d="M7 4h10v16l-5-3.2L7 20V4z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
      );
    case "checkin":
      return (
        <svg {...c}><path d="M12 20s-6.5-4.2-6.5-9A3.5 3.5 0 0 1 12 8a3.5 3.5 0 0 1 6.5 3c0 4.8-6.5 9-6.5 9z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /></svg>
      );
    case "toolkit":
      return (
        <svg {...c}><rect x="3.5" y="7" width="17" height="12" rx="2.5" stroke="currentColor" strokeWidth="1.7" /><path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M3.5 12.5h17" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>
      );
  }
}

/** Account state shared by the header (mobile) and the rail (desktop). */
interface MeUser {
  name?: string;
  email?: string;
  picture?: string;
}
function useAccount() {
  const [user, setUser] = useState<MeUser | null>(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let alive = true;
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        if (alive) {
          setUser(d?.user ?? null);
          setLoaded(true);
        }
      })
      .catch(() => alive && setLoaded(true));
    return () => {
      alive = false;
    };
  }, []);
  const signOut = async () => {
    try {
      await fetch("/api/auth/signout", { method: "POST" });
    } catch {
      /* ignore */
    }
    try {
      localStorage.removeItem("compass.guest");
    } catch {
      /* ignore */
    }
    window.location.href = "/";
  };
  return { user, loaded, signOut };
}

function Avatar({ user }: { user: MeUser }) {
  if (user.picture) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={user.picture} alt="" referrerPolicy="no-referrer" className="h-8 w-8 rounded-full" />;
  }
  return (
    <span className="grid h-8 w-8 place-items-center rounded-full bg-teal text-xs font-bold text-cream">
      {(user.name || user.email || "?").slice(0, 1).toUpperCase()}
    </span>
  );
}

/** Desktop-only left icon rail. Fixed to the viewport's left edge so the page content can
 *  stay centered in the FULL viewport (the rail floats in the left margin on wide screens). */
export function Sidebar({ active }: { active: TabKey }) {
  const { user, loaded, signOut } = useAccount();
  return (
    <nav className="fixed left-0 top-0 z-30 hidden h-dvh w-24 flex-col items-center gap-1 border-r border-teal/10 bg-cream-card/60 py-6 backdrop-blur-sm lg:flex">
      <Link href="/app" className="mb-5">
        <Image src={MARK} alt="Compass" width={32} height={32} />
      </Link>
      {TABS.map((t) => {
        const on = t.key === active;
        return (
          <Link
            key={t.key}
            href={t.href}
            aria-current={on ? "page" : undefined}
            className={`flex w-[4.25rem] flex-col items-center gap-1 rounded-2xl py-2.5 transition ${
              on ? "bg-teal/[0.08] text-teal" : "text-teal/55 hover:bg-teal/[0.05] hover:text-teal"
            }`}
          >
            <TabIcon kind={t.key} />
            <span className="text-[0.62rem] font-semibold">{t.label}</span>
          </Link>
        );
      })}
      {/* account at the foot of the rail */}
      {loaded && (
        <div className="mt-auto flex flex-col items-center gap-1.5 pt-3">
          {user ? (
            <>
              <Avatar user={user} />
              <button onClick={signOut} className="text-[0.6rem] font-semibold text-teal/55 transition hover:text-teal">
                Sign out
              </button>
            </>
          ) : (
            <a href="/api/auth/google" className="text-[0.6rem] font-semibold text-teal/55 transition hover:text-teal">
              Sign in
            </a>
          )}
        </div>
      )}
    </nav>
  );
}

/** In-flow account control for the mobile header (scrolls with content — never overlaps). */
function MobileAccount() {
  const { user, loaded, signOut } = useAccount();
  if (!loaded) return <span className="h-8 w-8" />;
  if (!user) {
    return (
      <a href="/api/auth/google" className="text-sm font-semibold text-teal/70 transition hover:text-teal">
        Sign in
      </a>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <Avatar user={user} />
      <button onClick={signOut} className="text-xs font-semibold text-teal/70 transition hover:text-teal">
        Sign out
      </button>
    </div>
  );
}

/** Mobile-only fixed bottom tab bar. */
export function BottomNav({ active }: { active: TabKey }) {
  return (
    <nav
      className="glass fixed inset-x-0 bottom-0 z-40 flex items-stretch justify-around rounded-none border-t border-teal/10 px-1 pb-[env(safe-area-inset-bottom)] pt-1 lg:hidden"
    >
      {TABS.map((t) => {
        const on = t.key === active;
        return (
          <Link
            key={t.key}
            href={t.href}
            aria-current={on ? "page" : undefined}
            className={`flex flex-1 flex-col items-center gap-0.5 rounded-xl py-2 transition ${
              on ? "text-teal" : "text-teal/45"
            }`}
          >
            <TabIcon kind={t.key} />
            <span className="text-[0.6rem] font-semibold">{t.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * Full-page shell for standalone tab pages. `pad=false` lets a page (e.g. an article with a
 * bleed image) control its own padding.
 */
export default function AppShell({
  active,
  children,
  maxWidth = "max-w-2xl",
}: {
  active: TabKey;
  children: ReactNode;
  maxWidth?: string;
}) {
  return (
    <div className="relative min-h-dvh w-full overflow-x-hidden bg-cream">
      <div className="aurora" aria-hidden="true">
        <div className="blob blob-coral" />
        <div className="blob blob-teal" />
        <div className="blob blob-gold" />
        <div className="blob blob-rose" />
      </div>

      <Sidebar active={active} />

      {/* Reserve the rail's width on desktop (lg:pl-24) so content can never slip under the
          fixed sidebar, then center the content within the remaining space. */}
      <div className="relative z-10 lg:pl-24">
        <main className={`mx-auto w-full ${maxWidth} px-4 pb-28 pt-4 sm:px-6 lg:pb-14 lg:pt-6`}>
          {/* mobile header: logo + account, in normal flow so it scrolls (no fixed overlay) */}
          <div className="mb-5 flex items-center justify-between lg:hidden">
            <Link href="/app" className="flex items-center gap-2">
              <Image src={MARK} alt="" width={24} height={24} />
              <span className="text-lg font-semibold tracking-tight text-teal" style={{ fontFamily: "var(--font-display)" }}>
                Compass
              </span>
            </Link>
            <MobileAccount />
          </div>
          {children}
        </main>
      </div>

      <BottomNav active={active} />
    </div>
  );
}
