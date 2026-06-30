"use client";

/**
 * AppGate — wraps /app with Google sign-in.
 *
 * On load it asks /api/auth/me, which resolves the account's SHARED familyId (via
 * membership). Signed in → onboarding runs with that familyId, so co-parents who joined
 * the same family land on the same child's memory. Not signed in → a warm sign-in screen
 * (with a guest option so the demo works without auth).
 *
 * Co-parent join: an invite link is /app?join=CODE. We stash the code (so it survives the
 * Google round-trip), and once signed in we redeem it before rendering — the second parent
 * is dropped straight into the shared family.
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
const PENDING_JOIN_KEY = "compass.pendingJoin";
const MARK = "/brand/compass-mark-color.png";

export default function AppGate() {
  const [status, setStatus] = useState<Status>("loading");
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [configured, setConfigured] = useState(true);
  const [authNote, setAuthNote] = useState<string | null>(null);
  const [joinNote, setJoinNote] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const auth = params.get("auth");
    if (auth === "unconfigured") setAuthNote("Google sign-in isn't wired up yet.");
    else if (auth === "failed" || auth === "denied") setAuthNote("That didn't go through — let's try again.");

    // Invite deep-link: stash the code so it survives the Google sign-in redirect, then
    // strip it from the URL so a refresh doesn't re-trigger.
    const joinCode = params.get("join");
    if (joinCode) {
      localStorage.setItem(PENDING_JOIN_KEY, joinCode);
      params.delete("join");
      const qs = params.toString();
      window.history.replaceState({}, "", window.location.pathname + (qs ? `?${qs}` : ""));
    }

    (async () => {
      try {
        const res = await fetch("/api/auth/me");
        const data = await res.json();
        setConfigured(Boolean(data.configured));
        if (data.user) {
          // Redeem a pending invite before we render, so a joining co-parent lands on the
          // shared family rather than a fresh empty one.
          const pending = localStorage.getItem(PENDING_JOIN_KEY);
          let resolvedFamily: string | null = data.familyId ?? null;
          if (pending) {
            localStorage.removeItem(PENDING_JOIN_KEY);
            try {
              const jr = await fetch("/api/family/join", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ code: pending }),
              });
              const jd = await jr.json();
              if (jr.ok && jd.familyId) {
                resolvedFamily = jd.familyId;
                setJoinNote(jd.alreadyMember ? null : "You're in — this is your shared family now.");
              } else if (jd?.error) {
                setJoinNote(jd.error);
              }
            } catch {
              setJoinNote("Couldn't join right now — you can enter the code from Memory.");
            }
          }
          setFamilyId(resolvedFamily);
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

  if (status === "loading") return <Splash />;

  if (status === "signin") {
    return <SignIn configured={configured} note={authNote} onGuest={continueAsGuest} />;
  }

  // Account control (sign out / sign in) now lives inside the app shell chrome
  // (mobile header + desktop rail), so there's no floating overlay to collide with content.
  return (
    <>
      {joinNote && <JoinToast text={joinNote} onClose={() => setJoinNote(null)} />}
      <OnboardingChat familyId={familyId ?? undefined} />
    </>
  );
}

/* ───────────────────────────────────────── co-parent join toast */

function JoinToast({ text, onClose }: { text: string; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 6000);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div className="fixed inset-x-0 top-4 z-50 flex justify-center px-4">
      <div className="glass flex items-center gap-3 rounded-full px-5 py-2.5 text-sm font-semibold text-teal shadow-[var(--shadow-soft)]">
        <span>{text}</span>
        <button onClick={onClose} aria-label="Dismiss" className="text-teal/50 hover:text-teal">
          ✕
        </button>
      </div>
    </div>
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
  const [showCode, setShowCode] = useState(false);
  const [code, setCode] = useState("");

  // Joining a co-parent: stash the code so it's redeemed right after Google sign-in.
  const joinWithGoogle = () => {
    const trimmed = code.trim();
    if (trimmed) localStorage.setItem(PENDING_JOIN_KEY, trimmed);
    window.location.href = "/api/auth/google";
  };

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

        {/* Co-parent path: someone shared an invite code with you. */}
        <div className="mt-5 border-t border-teal/10 pt-4">
          {showCode ? (
            <div className="text-left">
              <label htmlFor="invite" className="text-xs font-semibold text-teal/80">
                Your co-parent&apos;s invite code
              </label>
              <input
                id="invite"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="e.g. K7QMRT94"
                autoCapitalize="characters"
                className="mt-1.5 w-full rounded-xl border border-teal/20 bg-cream-card/70 px-4 py-2.5 text-sm font-semibold uppercase tracking-wide text-teal placeholder:normal-case placeholder:tracking-normal placeholder:text-muted/60 focus:border-teal focus:outline-none"
              />
              <button
                onClick={joinWithGoogle}
                disabled={!configured || code.trim().length === 0}
                className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-full bg-coral px-5 py-2.5 text-sm font-bold text-cream shadow-[var(--shadow-card)] transition hover:bg-coral-deep disabled:cursor-not-allowed disabled:opacity-40"
              >
                <GoogleG />
                Sign in &amp; join
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowCode(true)}
              className="text-sm font-semibold text-coral hover:text-coral-deep"
            >
              Have an invite code?
            </button>
          )}
        </div>

        <p className="mt-6 text-xs leading-relaxed text-muted">
          We only use your name and email to save your family&apos;s profile. Nothing is shared.
        </p>
      </div>
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
