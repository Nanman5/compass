"use client";

/**
 * AppGate — wraps /app with Google sign-in.
 *
 * On load it asks /api/auth/me. Signed in → the onboarding runs with a per-user familyId
 * ("g:<sub>") so memory is tied to the Google account; a small chip offers sign-out.
 * Not signed in → a warm sign-in screen with "Continue with Google" (and a guest option
 * so the demo still works without auth). The guest choice is remembered in localStorage.
 */

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";

import OnboardingChat from "@/components/OnboardingChat";

interface AuthUser {
  sub: string;
  email: string;
  name: string;
  picture: string;
}

type Status = "loading" | "signin" | "signedin" | "guest";

const GUEST_KEY = "compass.guest";
const MARK = "/brand/compass-mark-color.png";

export default function AppGate() {
  const [status, setStatus] = useState<Status>("loading");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [configured, setConfigured] = useState(true);
  const [authNote, setAuthNote] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const auth = params.get("auth");
    if (auth === "unconfigured") setAuthNote("Google sign-in isn't wired up yet.");
    else if (auth === "failed" || auth === "denied") setAuthNote("That didn't go through — let's try again.");

    (async () => {
      try {
        const res = await fetch("/api/auth/me");
        const data = await res.json();
        setConfigured(Boolean(data.configured));
        if (data.user) {
          setUser(data.user);
          setStatus("signedin");
          return;
        }
      } catch {
        /* fall through to sign-in */
      }
      setStatus(localStorage.getItem(GUEST_KEY) === "1" ? "guest" : "signin");
    })();
  }, []);

  const continueAsGuest = useCallback(() => {
    localStorage.setItem(GUEST_KEY, "1");
    setStatus("guest");
  }, []);

  const signOut = useCallback(async () => {
    await fetch("/api/auth/signout", { method: "POST" }).catch(() => {});
    localStorage.removeItem(GUEST_KEY);
    setUser(null);
    setStatus("signin");
  }, []);

  if (status === "loading") return <Splash />;

  if (status === "signin") {
    return <SignIn configured={configured} note={authNote} onGuest={continueAsGuest} />;
  }

  return (
    <>
      <OnboardingChat familyId={user ? `g:${user.sub}` : undefined} />
      {user && <UserChip user={user} onSignOut={signOut} />}
    </>
  );
}

/* ───────────────────────────────────────── splash */

function Splash() {
  return (
    <div className="fixed inset-0 grid place-items-center overflow-hidden bg-cream">
      <Aurora />
      <Image src={MARK} alt="Compass" width={56} height={56} priority className="compass-breathe relative z-10" />
    </div>
  );
}

/* ───────────────────────────────────────── sign-in */

function SignIn({
  configured,
  note,
  onGuest,
}: {
  configured: boolean;
  note: string | null;
  onGuest: () => void;
}) {
  return (
    <div className="fixed inset-0 grid place-items-center overflow-hidden bg-cream px-5">
      <Aurora />
      <div className="glass relative z-10 w-full max-w-sm rounded-3xl p-8 text-center">
        <Image src={MARK} alt="Compass" width={52} height={52} priority className="mx-auto" />
        <h1 className="mt-4 text-2xl font-semibold text-teal">Welcome to Compass</h1>
        <p className="mt-1.5 text-sm leading-relaxed text-ink/70">
          A calm, private companion for the everyday of parenting.
        </p>

        {note && <p className="mt-4 text-sm font-semibold text-coral-deep">{note}</p>}

        <a
          href="/api/auth/google"
          aria-disabled={!configured}
          className={`mt-6 flex w-full items-center justify-center gap-3 rounded-full bg-white px-5 py-3 text-[0.95rem] font-semibold text-ink shadow-[var(--shadow-card)] transition hover:shadow-[var(--shadow-soft)] ${
            configured ? "" : "pointer-events-none opacity-50"
          }`}
        >
          <GoogleG />
          Continue with Google
        </a>

        <button
          onClick={onGuest}
          className="mt-3 text-sm font-semibold text-teal/70 underline underline-offset-2 hover:text-teal"
        >
          Continue as guest
        </button>

        <p className="mt-6 text-xs leading-relaxed text-muted">
          We only use your name and email to save your family&apos;s profile. Nothing is shared.
        </p>
      </div>
    </div>
  );
}

/* ───────────────────────────────────────── signed-in chip */

function UserChip({ user, onSignOut }: { user: AuthUser; onSignOut: () => void }) {
  return (
    <div className="glass fixed right-4 top-4 z-50 flex items-center gap-2 rounded-full py-1 pl-1 pr-1">
      {user.picture ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={user.picture} alt="" className="h-8 w-8 rounded-full" referrerPolicy="no-referrer" />
      ) : (
        <span className="grid h-8 w-8 place-items-center rounded-full bg-teal text-xs font-bold text-cream">
          {(user.name || user.email || "?").slice(0, 1).toUpperCase()}
        </span>
      )}
      <button
        onClick={onSignOut}
        className="rounded-full px-3 py-1 text-xs font-semibold text-teal/80 hover:text-teal"
        title={`Signed in as ${user.email}`}
      >
        Sign out
      </button>
    </div>
  );
}

/* ───────────────────────────────────────── shared aurora */

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

function GoogleG() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}
