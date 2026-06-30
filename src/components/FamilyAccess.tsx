"use client";

/**
 * FamilyAccess — co-parent sharing for the signed-in family (lives atop /app/memory).
 *
 * A family is a shared space, not one account. This card shows who currently has access,
 * lets a member invite their co-parent (a short code + shareable link), and lets someone
 * who was given a code join from here. It speaks only to /api/family[/invite|/join] and
 * never touches child data — just the adults who can reach it.
 *
 * Style mirrors MemoryPanel: wet-glass surface, sage section glyph, calm copy.
 */

import { useCallback, useEffect, useState } from "react";

interface Member {
  name: string;
  email: string;
  role: "owner" | "member";
  you: boolean;
}

interface FamilyData {
  familyId: string;
  role: "owner" | "member";
  members: Member[];
}

interface InviteData {
  code: string;
  url: string;
  expiresAt: string;
}

export default function FamilyAccess() {
  const [family, setFamily] = useState<FamilyData | null>(null);
  const [invite, setInvite] = useState<InviteData | null>(null);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState<"code" | "link" | null>(null);

  // join-with-a-code (for a co-parent who signed in without using the link)
  const [joinOpen, setJoinOpen] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  const loadFamily = useCallback(async () => {
    try {
      const res = await fetch("/api/family");
      if (res.ok) setFamily((await res.json()) as FamilyData);
    } catch {
      /* leave the card hidden if we can't load */
    }
  }, []);

  useEffect(() => {
    void loadFamily();
  }, [loadFamily]);

  const createInvite = useCallback(async () => {
    setCreating(true);
    try {
      const res = await fetch("/api/family/invite", { method: "POST" });
      if (res.ok) setInvite((await res.json()) as InviteData);
    } finally {
      setCreating(false);
    }
  }, []);

  const copy = useCallback(async (text: string, which: "code" | "link") => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      setTimeout(() => setCopied(null), 1800);
    } catch {
      /* clipboard blocked — the value is still visible to copy by hand */
    }
  }, []);

  const join = useCallback(async () => {
    const code = joinCode.trim();
    if (!code || joining) return;
    setJoining(true);
    setJoinError(null);
    try {
      const res = await fetch("/api/family/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (res.ok) {
        // We've switched families — reload so every surface picks up the shared memory.
        window.location.reload();
      } else {
        setJoinError(data?.error || "Couldn't join with that code.");
      }
    } catch {
      setJoinError("Couldn't join right now.");
    } finally {
      setJoining(false);
    }
  }, [joinCode, joining]);

  if (!family) return null;

  return (
    <section className="mb-10">
      {/* heading (mirrors MemoryPanel's SectionHeading) */}
      <div className="mb-4 flex items-center gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-sage-soft/45 text-teal">
          <PeopleGlyph />
        </span>
        <h2 className="text-xl font-semibold text-teal">Co-parent access</h2>
        <span className="ml-1 h-px flex-1 bg-teal/12" />
      </div>

      <div className="glass rounded-[1.5rem] p-6 sm:p-7">
        <p className="text-[0.96rem] leading-relaxed text-ink/75">
          Compass is for your whole family. Invite a co-parent and you&apos;ll both see — and
          shape — the same picture of your child. Consistency between caregivers is one of the
          things that helps most.
        </p>

        {/* who's in */}
        <ul className="mt-5 space-y-2.5">
          {family.members.map((m, i) => (
            <li key={`${m.email}-${i}`} className="flex items-center gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-teal/10 text-sm font-bold text-teal">
                {initials(m.name)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[0.95rem] font-semibold text-ink">
                  {m.name}
                  {m.you && <span className="ml-2 text-xs font-semibold text-teal/55">You</span>}
                </p>
                {m.email && <p className="truncate text-xs text-muted">{m.email}</p>}
              </div>
              <span className="shrink-0 rounded-full bg-teal/[0.06] px-2.5 py-0.5 text-xs font-semibold text-teal/70">
                {m.role === "owner" ? "Owner" : "Co-parent"}
              </span>
            </li>
          ))}
        </ul>

        {/* invite */}
        <div className="mt-6 border-t border-teal/12 pt-5">
          {!invite ? (
            <button
              onClick={() => void createInvite()}
              disabled={creating}
              className="btn btn-primary px-6 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
            >
              {creating ? "Creating…" : "Invite a co-parent"}
            </button>
          ) : (
            <div className="space-y-3">
              <p className="text-[0.7rem] font-bold uppercase tracking-wide text-muted">
                Share this with your co-parent
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded-xl border border-teal/15 bg-cream-card/70 px-4 py-3 text-center text-lg font-bold tracking-[0.18em] text-teal">
                  {formatCode(invite.code)}
                </code>
                <button
                  onClick={() => void copy(invite.code, "code")}
                  className="shrink-0 rounded-xl border border-teal/20 px-4 py-3 text-sm font-semibold text-teal transition hover:bg-teal/5"
                >
                  {copied === "code" ? "Copied" : "Copy"}
                </button>
              </div>
              <button
                onClick={() => void copy(invite.url, "link")}
                className="text-sm font-semibold text-coral hover:text-coral-deep"
              >
                {copied === "link" ? "Link copied ✓" : "Copy invite link instead"}
              </button>
              <p className="text-xs leading-relaxed text-muted">
                They sign in with their own Google account and enter this code — no new profile,
                they join straight into your child&apos;s space. The code lasts 7 days.
              </p>
            </div>
          )}
        </div>

        {/* join (for a co-parent who signed in without the link) */}
        <div className="mt-5 border-t border-teal/12 pt-4">
          {!joinOpen ? (
            <button
              onClick={() => setJoinOpen(true)}
              className="text-sm font-semibold text-teal/70 hover:text-teal"
            >
              Have a code from your co-parent?
            </button>
          ) : (
            <div>
              <label htmlFor="join-code" className="text-xs font-semibold text-teal/80">
                Enter your co-parent&apos;s invite code
              </label>
              <div className="mt-1.5 flex items-center gap-2">
                <input
                  id="join-code"
                  value={joinCode}
                  onChange={(e) => {
                    setJoinCode(e.target.value);
                    if (joinError) setJoinError(null);
                  }}
                  placeholder="e.g. K7QMRT94"
                  autoCapitalize="characters"
                  className="flex-1 rounded-xl border border-teal/20 bg-cream-card/70 px-4 py-2.5 text-sm font-semibold uppercase tracking-wide text-teal placeholder:normal-case placeholder:tracking-normal placeholder:text-muted/60 focus:border-teal focus:outline-none"
                />
                <button
                  onClick={() => void join()}
                  disabled={joining || joinCode.trim().length === 0}
                  className="shrink-0 rounded-xl bg-coral px-5 py-2.5 text-sm font-bold text-cream transition hover:bg-coral-deep disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {joining ? "Joining…" : "Join"}
                </button>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-muted">
                Joining moves you into their shared family — you&apos;ll see their child&apos;s
                profile and history.
              </p>
              {joinError && <p className="mt-2 text-sm font-semibold text-coral-deep">{joinError}</p>}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────────────────────── helpers */

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "·";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Group an 8-char code into "K7QM RT94" for readability. */
function formatCode(code: string): string {
  return code.length === 8 ? `${code.slice(0, 4)} ${code.slice(4)}` : code;
}

function PeopleGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="9" cy="8" r="3" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
      <path d="M16 5.2a3 3 0 0 1 0 5.6M18 20a6.5 6.5 0 0 0-3-5.5" />
    </svg>
  );
}
