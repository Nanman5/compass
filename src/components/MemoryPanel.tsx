"use client";

/**
 * MemoryPanel — the "What Compass remembers" transparency surface (/app/memory).
 *
 * Renders everything stored for one family in a calm, trustworthy layout:
 *   • the child profile (every field that's present, including the optional
 *     evidence-based notes),
 *   • the learnings Compass has accumulated, each with the date it was learned,
 *   • the recent episodes as situation → suggestion → outcome,
 *   • and a "Forget everything" control that confirms, then DELETEs the family's
 *     memory and drops to a gentle empty state.
 *
 * It only reads/clears via the existing /api/memory endpoint and is fully scoped
 * to the `familyId` it's given — it can never reach another family's data.
 *
 * Style: cream base + drifting aurora + wet-glass surfaces (see globals.css), the
 * same visual language as the onboarding chat.
 */

import Link from "next/link";

import { useCallback, useEffect, useState } from "react";

import { CompassStar } from "@/components/CompassStar";
import { Icon } from "@/components/Icon";
import type { ChildProfile, Episode, FamilyMemory, Learning } from "@/lib/types";

/* ───────────────────────────────────────── helpers */

/** Human-friendly date, e.g. "Jun 19, 2026" — defensive against bad ISO strings. */
function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** True when the family has nothing stored yet — drives the empty state. */
function isEmpty(m: FamilyMemory): boolean {
  return !m.profile && m.learnings.length === 0 && m.episodes.length === 0;
}

type LoadState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; memory: FamilyMemory };

/* ───────────────────────────────────────── shell */

export default function MemoryPanel({ familyId }: { familyId: string | null }) {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [confirming, setConfirming] = useState(false);
  const [forgetting, setForgetting] = useState(false);

  const load = useCallback(async (id: string) => {
    setState({ kind: "loading" });
    try {
      const res = await fetch(`/api/memory?familyId=${encodeURIComponent(id)}`);
      const data = (await res.json()) as FamilyMemory & { error?: string };
      if (!res.ok) throw new Error(data.error || "Couldn't reach Compass");
      setState({ kind: "ready", memory: data });
    } catch (err) {
      setState({ kind: "error", message: err instanceof Error ? err.message : "Something went wrong" });
    }
  }, []);

  useEffect(() => {
    if (familyId) void load(familyId);
  }, [familyId, load]);

  const forget = useCallback(async () => {
    if (!familyId) return;
    setForgetting(true);
    try {
      const res = await fetch(`/api/memory?familyId=${encodeURIComponent(familyId)}`, { method: "DELETE" });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || "Couldn't clear your memory");
      }
      setState({ kind: "ready", memory: { profile: null, learnings: [], episodes: [] } });
      setConfirming(false);
    } catch (err) {
      setState({ kind: "error", message: err instanceof Error ? err.message : "Something went wrong" });
    } finally {
      setForgetting(false);
    }
  }, [familyId]);

  const ready = state.kind === "ready" ? state.memory : null;
  const empty = ready ? isEmpty(ready) : false;

  return (
    <div className="relative min-h-full w-full overflow-x-hidden bg-cream">
      {/* living ambient backdrop */}
      <div className="aurora" aria-hidden="true">
        <div className="blob blob-coral" />
        <div className="blob blob-teal" />
        <div className="blob blob-gold" />
        <div className="blob blob-rose" />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-3xl px-4 pb-20 pt-10 sm:px-6 sm:pt-14">
        <PanelHeader />

        {(state.kind === "loading" || familyId === null) && <SkeletonState />}

        {state.kind === "error" && (
          <ErrorState
            message={state.message}
            onRetry={familyId ? () => void load(familyId) : undefined}
          />
        )}

        {ready && empty && <EmptyState />}

        {ready && !empty && (
          <div className="msg-in space-y-10">
            {ready.profile && <ProfileSection profile={ready.profile} />}
            {familyId && (
              <AddContextSection
                familyId={familyId}
                childName={ready.profile?.childName}
                onAdded={() => void load(familyId)}
              />
            )}
            {ready.learnings.length > 0 && (
              <LearningsSection learnings={ready.learnings} childName={ready.profile?.childName} />
            )}
            {ready.episodes.length > 0 && <EpisodesSection episodes={ready.episodes} />}

            <ForgetSection
              confirming={confirming}
              forgetting={forgetting}
              onOpen={() => setConfirming(true)}
              onCancel={() => setConfirming(false)}
              onConfirm={() => void forget()}
            />
          </div>
        )}
      </div>
    </div>
  );
}

/* ───────────────────────────────────────── header */

function PanelHeader() {
  return (
    <header className="mb-9 text-center">
      <Link
        href="/app"
        className="mb-7 inline-flex items-center gap-1.5 text-sm font-semibold text-teal/70 transition hover:text-teal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Back to Compass
      </Link>
      <div className="flex flex-col items-center gap-2.5">
        <div className="compass-breathe">
          <CompassStar size={46} />
        </div>
        <p className="eyebrow">Held just for you</p>
        <h1 className="text-3xl font-semibold leading-tight text-teal sm:text-4xl">
          What I remember about your family
        </h1>
        <p className="max-w-md text-[0.98rem] leading-relaxed text-ink/70">
          This is everything I&apos;m holding — for your family alone, so my guidance fits your
          child. The more we share, the better I understand them. You can clear it all anytime.
        </p>
      </div>
    </header>
  );
}

/* ───────────────────────────────────────── section scaffolding */

function SectionHeading({ icon, label, count }: { icon: SectionIcon; label: string; count?: number }) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-sage-soft/45 text-teal">
        <SectionGlyph kind={icon} />
      </span>
      <h2 className="text-xl font-semibold text-teal">{label}</h2>
      {typeof count === "number" && (
        <span className="rounded-full bg-teal/10 px-2.5 py-0.5 text-xs font-bold text-teal/70">
          {count}
        </span>
      )}
      <span className="ml-1 h-px flex-1 bg-teal/12" />
    </div>
  );
}

/* ───────────────────────────────────────── profile */

function ProfileSection({ profile }: { profile: ChildProfile }) {
  // Soft facets for glanceability — the warm sentence above is the soul; these are details.
  const facets: { label: string; value: string }[] = [];
  if (profile.ageBand) facets.push({ label: "Age", value: profile.ageBand });
  if (profile.interests.length) facets.push({ label: "Loves", value: profile.interests.join(", ") });
  if (profile.temperament.length) facets.push({ label: "Temperament", value: profile.temperament.join(", ") });
  if (profile.familyStructure) facets.push({ label: "Care", value: profile.familyStructure });

  const mc = profile.mediaContext;
  const notes: { label: string; value: string }[] = [];
  if (mc?.crowdsOut) notes.push({ label: "Screens crowd out", value: mc.crowdsOut });
  if (mc?.calmUse) notes.push({ label: "Screens to calm", value: mc.calmUse });
  if (mc?.mediation) notes.push({ label: "Watching together", value: mc.mediation });
  if (profile.parentDistraction) notes.push({ label: "Your own phone pull", value: profile.parentDistraction });

  return (
    <section>
      <SectionHeading icon="profile" label="Your child" />
      <div className="glass overflow-hidden rounded-[1.5rem] p-6 sm:p-7">
        {/* the woven portrait — Compass speaking warmly. This is the soul of the card. */}
        <p
          className="text-[1.16rem] font-medium leading-relaxed text-ink sm:text-[1.22rem]"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {wovenPortrait(profile)}
        </p>

        {facets.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-2">
            {facets.map((f) => (
              <span
                key={f.label}
                className="rounded-full bg-teal/[0.06] px-3 py-1.5 text-[0.85rem] text-ink/80"
              >
                <span className="text-teal/55">{f.label} · </span>
                {f.value}
              </span>
            ))}
          </div>
        )}

        {profile.context && (
          <p className="mt-5 border-t border-teal/12 pt-4 text-[0.95rem] leading-relaxed text-ink/80">
            {profile.context}
          </p>
        )}

        {notes.length > 0 && (
          <div className="mt-5 border-t border-teal/12 pt-4">
            <p className="mb-2.5 text-[0.68rem] font-bold uppercase tracking-wide text-muted">
              What you&apos;ve shared about screens
            </p>
            <dl className="space-y-2">
              {notes.map((n) => (
                <div key={n.label} className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
                  <dt className="shrink-0 text-[0.88rem] font-semibold text-teal/75">{n.label}</dt>
                  <dd className="text-[0.9rem] leading-relaxed text-ink/75">{n.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        <p className="mt-5 border-t border-teal/12 pt-3.5 text-xs text-muted">
          {profile.createdAt ? `We first met ${formatDate(profile.createdAt)}` : "Getting to know each other"}
          {profile.updatedAt && profile.updatedAt !== profile.createdAt
            ? ` · last updated ${formatDate(profile.updatedAt)}`
            : ""}
        </p>
      </div>
    </section>
  );
}

/** Weave the stored facts into a warm, first-person sentence — Compass describing the child. */
function wovenPortrait(p: ChildProfile): string {
  const name = p.childName || "your little one";
  const parts: string[] = [];

  let opener = `This is ${name}`;
  if (p.ageBand) opener += `, around ${p.ageBand}`;
  if (p.interests.length) opener += `, who lights up around ${joinNatural(p.interests)}`;
  parts.push(opener + ".");

  if (p.temperament.length) {
    parts.push(`${name} tends to be ${joinNatural(p.temperament)}.`);
  }

  if (p.struggles.length) {
    parts.push(`${careSubject(p.familyStructure)} working through ${joinNatural(p.struggles)} right now.`);
  } else if (p.familyStructure) {
    parts.push(`${careSubject(p.familyStructure)} in this together.`);
  }

  return parts.join(" ");
}

/** "You and a co-parent are" / "You're" — the subject for the "working through…" clause. */
function careSubject(care?: string): string {
  const c = (care || "").toLowerCase();
  if (c.includes("co-parent") || c.includes("two home") || c.includes("partner") || c.includes("together")) {
    return "You and a co-parent are";
  }
  return "You're";
}

/** ["a","b","c"] → "a, b and c". */
function joinNatural(arr: string[]): string {
  const a = arr.filter(Boolean);
  if (a.length <= 1) return a[0] ?? "";
  if (a.length === 2) return `${a[0]} and ${a[1]}`;
  return `${a.slice(0, -1).join(", ")} and ${a[a.length - 1]}`;
}

/* ───────────────────────────────────────── add context (parent-authored) */

function AddContextSection({
  familyId,
  childName,
  onAdded,
}: {
  familyId: string;
  childName?: string;
  onAdded: () => void;
}) {
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const who = childName ? childName : "your family";

  const save = useCallback(async () => {
    const fact = text.trim();
    if (!fact || saving) return;
    setSaving(true);
    setJustSaved(false);
    try {
      const res = await fetch("/api/learnings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ familyId, fact }),
      });
      if (res.ok) {
        setText("");
        setJustSaved(true);
        onAdded();
      }
    } finally {
      setSaving(false);
    }
  }, [text, saving, familyId, onAdded]);

  return (
    <section>
      <SectionHeading icon="learning" label="Tell me more" />
      <div className="glass rounded-2xl p-5">
        <p className="text-sm leading-relaxed text-ink/70">
          Anything you tell me here, I&apos;ll use next time I help you — like {who} just started
          preschool, has a new sibling, or what tends to calm them.
        </p>
        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (justSaved) setJustSaved(false);
          }}
          rows={2}
          maxLength={600}
          placeholder={`Something about ${who}…`}
          className="mt-3 w-full resize-none rounded-xl border border-teal/15 bg-cream-card/70 px-4 py-3 text-[0.95rem] text-ink outline-none transition focus:border-teal/40 focus:ring-2 focus:ring-sage/40"
        />
        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="text-xs text-teal/70">
            {justSaved ? "Added — Compass will remember this." : " "}
          </span>
          <button
            onClick={() => void save()}
            disabled={!text.trim() || saving}
            className="btn btn-primary px-6 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Saving…" : "Add context"}
          </button>
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────────────────────── learnings */

function LearningsSection({ learnings, childName }: { learnings: Learning[]; childName?: string }) {
  // Newest first — most recent learnings are the most relevant to surface.
  const sorted = [...learnings].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const who = childName || "your family";
  return (
    <section>
      <SectionHeading icon="learning" label={`What I'm learning about ${who}`} count={sorted.length} />
      {/* a living thread — each thing remembered, strung along one quiet line */}
      <ol className="relative ml-1.5 space-y-3.5 border-l border-teal/15 pl-6">
        {sorted.map((l) => (
          <li key={l.id} className="relative">
            <span
              aria-hidden="true"
              className="absolute -left-[1.65rem] top-2 h-3 w-3 rounded-full bg-coral ring-4 ring-cream"
            />
            <div className="glass rounded-2xl px-5 py-4">
              <p className="text-[0.98rem] leading-relaxed text-ink">{l.fact}</p>
              <p className="mt-1.5 text-xs text-muted">
                {provenance(l.source)} · {formatDate(l.createdAt)}
                {l.sensitivity === "high" ? " · sensitive" : ""}
              </p>
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-4 pl-6 text-[0.88rem] italic leading-relaxed text-teal/70">
        The more we talk, the better I understand {who}.
      </p>
    </section>
  );
}

/** Soft, first-person provenance — how Compass came to know each thing. */
function provenance(source: string): string {
  const s = source.toLowerCase();
  if (s.includes("parent")) return "you told me";
  if (s.includes("onboard")) return "from when we met";
  if (s.includes("coach")) return "from our chats";
  if (s.includes("help")) return "from a hard moment";
  return "I noticed";
}

/* ───────────────────────────────────────── episodes */

function EpisodesSection({ episodes }: { episodes: Episode[] }) {
  const sorted = [...episodes].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return (
    <section>
      <SectionHeading icon="episode" label="Moments we've worked through" count={sorted.length} />
      <ul className="space-y-4">
        {sorted.map((e) => (
          <li key={e.id} className="glass rounded-2xl p-5 sm:p-6">
            <div className="mb-3 flex items-center justify-between gap-3">
              <span className="text-[0.68rem] font-bold uppercase tracking-wide text-coral">Moment</span>
              <span className="text-xs text-muted">{formatDate(e.createdAt)}</span>
            </div>
            <EpisodeRow label="You described" value={e.situation} />
            <EpisodeRow label="Compass suggested" value={e.suggestion} accent />
            {e.outcome && <EpisodeRow label="How it went" value={e.outcome} />}
          </li>
        ))}
      </ul>
    </section>
  );
}

function EpisodeRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex gap-3 py-1.5">
      <span
        aria-hidden="true"
        className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${accent ? "bg-coral" : "bg-sage"}`}
      />
      <div className="min-w-0">
        <p className="text-[0.68rem] font-bold uppercase tracking-wide text-muted">{label}</p>
        <p className={`mt-0.5 text-[0.96rem] leading-relaxed ${accent ? "text-teal" : "text-ink/85"}`}>
          {value}
        </p>
      </div>
    </div>
  );
}

/* ───────────────────────────────────────── forget everything */

function ForgetSection({
  confirming,
  forgetting,
  onOpen,
  onCancel,
  onConfirm,
}: {
  confirming: boolean;
  forgetting: boolean;
  onOpen: () => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <section className="border-t border-teal/12 pt-8">
      {!confirming ? (
        <div className="flex flex-col items-center gap-3 text-center">
          <p className="max-w-md text-sm leading-relaxed text-ink/65">
            Want a clean slate? You can permanently erase everything Compass remembers about your
            family. This can&apos;t be undone.
          </p>
          <button
            onClick={onOpen}
            className="inline-flex items-center gap-2 rounded-full border-[1.5px] border-coral/40 px-5 py-2.5 text-sm font-bold text-coral-deep transition hover:border-coral hover:bg-coral/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral"
          >
            <TrashIcon />
            Forget everything
          </button>
        </div>
      ) : (
        <div className="glass mx-auto max-w-md rounded-3xl p-6 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-coral/12 text-coral-deep">
            <TrashIcon size={22} />
          </span>
          <h3 className="mt-3 text-lg font-semibold text-teal">Forget everything?</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-ink/70">
            This permanently erases your child&apos;s profile, every learning, and all saved
            moments. Compass will start over from scratch.
          </p>
          <div className="mt-5 flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-center">
            <button
              onClick={onCancel}
              disabled={forgetting}
              className="btn btn-ghost disabled:opacity-50"
            >
              Keep my memory
            </button>
            <button
              onClick={onConfirm}
              disabled={forgetting}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-coral px-6 py-[0.85rem] text-[0.98rem] font-bold text-cream shadow-[0_12px_26px_-14px_rgba(225,120,92,0.9)] transition hover:bg-coral-deep active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal disabled:cursor-not-allowed disabled:opacity-60"
            >
              {forgetting ? "Forgetting…" : "Yes, forget everything"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

/* ───────────────────────────────────────── empty / loading / error states */

function EmptyState() {
  return (
    <div className="msg-in glass mx-auto max-w-md rounded-[1.6rem] p-9 text-center">
      <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-sage-soft/40">
        <CompassStar size={34} />
      </span>
      <h2 className="mt-5 text-xl font-semibold text-teal">We&apos;re just getting started</h2>
      <p className="mt-2 text-[0.96rem] leading-relaxed text-ink/70">
        I don&apos;t know your family yet. Once we talk and you try a few steps, everything I
        come to understand about your child will live here — and you can clear it anytime.
      </p>
      <Link href="/app" className="btn btn-primary mt-6">
        Let&apos;s begin
      </Link>
    </div>
  );
}

function SkeletonState() {
  return (
    <div className="space-y-10" aria-hidden="true">
      <section>
        <div className="mb-4 h-7 w-40 rounded-full bg-teal/8" />
        <div className="glass rounded-[1.5rem] p-7">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="h-3 w-20 rounded-full bg-teal/10" />
                <div className="h-4 w-32 rounded-full bg-teal/6" />
              </div>
            ))}
          </div>
        </div>
      </section>
      <section>
        <div className="mb-4 h-7 w-56 rounded-full bg-teal/8" />
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="glass h-20 rounded-2xl" />
          ))}
        </div>
      </section>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="glass mx-auto max-w-md rounded-3xl p-8 text-center">
      <h2 className="text-lg font-semibold text-teal">Couldn&apos;t load your memory</h2>
      <p className="mt-2 text-sm leading-relaxed text-coral-deep">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-4 text-sm font-bold text-teal underline underline-offset-2 hover:text-teal-soft"
        >
          Try again
        </button>
      )}
    </div>
  );
}

/* ───────────────────────────────────────── icons */

type SectionIcon = "profile" | "learning" | "episode";

function SectionGlyph({ kind }: { kind: SectionIcon }) {
  if (kind === "learning") return <Icon name="bulb" size={18} />;
  if (kind === "episode") return <Icon name="loop" size={18} />;
  // profile — a small person glyph (not in the shared Icon set)
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="8" r="3.4" />
      <path d="M5.5 20a6.5 6.5 0 0 1 13 0" />
    </svg>
  );
}

function TrashIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 7h16M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2m-9 0 1 13a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2l1-13" />
    </svg>
  );
}

/* helpers */
function joinOrDash(arr: string[]): string {
  return arr.length ? arr.join(", ") : "—";
}
