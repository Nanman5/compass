/**
 * GET /api/weekly?familyId= — this family's Weekly Drop.
 *
 * Returns three pieces of guidance tailored to THIS child, in the spirit of the
 * landing's "This week for Maya" card:
 *   • a STUDY    — a research-grounded insight
 *   • a TIP      — a small, practical adjustment to try this week
 *   • an ACTIVITY — a free / low-cost thing to do together this week
 *
 * Pipeline (server-only): load the child profile from per-family memory → retrieve
 * relevant evidence from the global corpus → ask the LLM (JSON mode) to distill the
 * three items for this specific child. Everything is defensive: a missing profile
 * yields a sensible generic drop, and any LLM / parse failure falls back to a set
 * derived from the retrieved evidence so the surface is never empty.
 *
 * Server-only (reads secrets via getLlm; reads per-family memory).
 */

import { type NextRequest, NextResponse } from "next/server";

import { evidence } from "@/lib/evidence";
import { getLlm } from "@/lib/llm";
import { memory } from "@/lib/memory";
import type { ChildProfile, EvidenceSnippet } from "@/lib/types";

export const runtime = "nodejs";

/** The kinds of items in a weekly drop, in display order. */
const KINDS = ["study", "tip", "activity"] as const;
type Kind = (typeof KINDS)[number];

interface WeeklyItem {
  kind: Kind;
  title: string;
  body: string;
}

interface WeeklyDrop {
  childName: string;
  items: WeeklyItem[];
}

export async function GET(req: NextRequest): Promise<Response> {
  const familyId = req.nextUrl.searchParams.get("familyId");
  if (typeof familyId !== "string" || familyId.trim().length === 0) {
    return NextResponse.json({ error: "familyId is required" }, { status: 400 });
  }

  // Load the child profile (may be null for a brand-new / guest family).
  let profile: ChildProfile | null = null;
  try {
    profile = await memory.getProfile(familyId);
  } catch (err) {
    console.error("[weekly] failed to load profile:", err);
  }

  // Retrieve evidence relevant to THIS child (or a general set if no profile yet).
  const snippets = evidence.retrieve(buildEvidenceQuery(profile), 5);

  // Ask the LLM to distill three personalized items; fall back gracefully on any failure.
  let items: WeeklyItem[] | null = null;
  try {
    items = await generateItems(profile, snippets);
  } catch (err) {
    console.error("[weekly] generation failed; using fallback:", err);
  }

  const drop: WeeklyDrop = {
    childName: profile?.childName?.trim() || "your child",
    items: items && items.length === 3 ? items : fallbackItems(profile, snippets),
  };

  return NextResponse.json(drop);
}

/* ─────────────────────────────── LLM generation */

/** Build the evidence retrieval query from the child's struggles + interests (or a default). */
function buildEvidenceQuery(profile: ChildProfile | null): string {
  if (!profile) return "screen-time bedtime tantrums free play enrichment reading";
  const terms = [
    ...profile.struggles,
    ...profile.interests,
    ...profile.temperament,
    profile.context,
  ]
    .filter(Boolean)
    .join(" ");
  return terms.trim() || "screen-time bedtime free play enrichment reading";
}

/** A compact profile summary the model can condition on (only non-empty fields). */
function describeChild(profile: ChildProfile): string {
  const parts: string[] = [`Name: ${profile.childName}`, `Age band: ${profile.ageBand}`];
  if (profile.temperament.length) parts.push(`Temperament: ${profile.temperament.join(", ")}`);
  if (profile.interests.length) parts.push(`Interests: ${profile.interests.join(", ")}`);
  if (profile.struggles.length) parts.push(`Current struggles: ${profile.struggles.join(", ")}`);
  if (profile.context?.trim()) parts.push(`Family context: ${profile.context.trim()}`);
  return parts.join("\n");
}

/** Format retrieved evidence as a grounding block with attributions. */
function describeEvidence(snippets: EvidenceSnippet[]): string {
  if (snippets.length === 0) return "(no specific evidence retrieved — rely on well-established guidance)";
  return snippets
    .map((s, i) => `[${i + 1}] ${s.title} (${s.source})\n${s.text}`)
    .join("\n\n");
}

const SYSTEM_PROMPT = `You are Compass, a warm, evidence-based parenting companion.
You write a short weekly "drop" for ONE family: three items tailored to their child —
a STUDY (a research-grounded insight), a TIP (one small, practical adjustment to try this
week), and an ACTIVITY (a free or very low-cost thing to do together this week).

Rules:
- Ground every item in the provided evidence; never invent statistics or studies.
- Be concrete and specific to THIS child (use their age, interests, and struggles).
- Activities and tips must be FREE or low-cost. Never assume a budget, a two-parent
  household, or any cultural/ability default.
- Warm, plain, encouraging — no jargon, no shaming.
- Each "title" is 3-7 words. Each "body" is ONE sentence (max ~16 words).
- Output ONLY valid JSON.`;

async function generateItems(
  profile: ChildProfile | null,
  snippets: EvidenceSnippet[],
): Promise<WeeklyItem[] | null> {
  const childBlock = profile ? describeChild(profile) : "(no profile yet — write a warm, broadly useful drop for a young child)";

  const userPrompt = `CHILD PROFILE
${childBlock}

EVIDENCE (use only this)
${describeEvidence(snippets)}

Write this week's drop. Return JSON exactly in this shape:
{
  "items": [
    { "kind": "study",    "title": "...", "body": "..." },
    { "kind": "tip",      "title": "...", "body": "..." },
    { "kind": "activity", "title": "...", "body": "..." }
  ]
}`;

  const llm = await getLlm();
  const res = await llm.generate({
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
    json: true,
    temperature: 0.7,
  });

  return parseItems(res.text);
}

/* ─────────────────────────────── defensive parsing */

/** Parse the model's JSON into exactly three well-formed items, or null on any problem. */
function parseItems(text: string): WeeklyItem[] | null {
  const parsed = safeJsonParse(extractJsonObject(text));
  if (!parsed || typeof parsed !== "object") return null;

  const rawItems = (parsed as { items?: unknown }).items;
  if (!Array.isArray(rawItems)) return null;

  // Index by kind so order/duplicates from the model don't matter.
  const byKind = new Map<Kind, WeeklyItem>();
  for (const raw of rawItems) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as { kind?: unknown; title?: unknown; body?: unknown };
    const kind = normalizeKind(r.kind);
    const title = cleanText(r.title);
    const body = cleanText(r.body);
    if (kind && title && body && !byKind.has(kind)) {
      byKind.set(kind, { kind, title, body });
    }
  }

  // Require all three kinds; otherwise let the caller fall back.
  const items = KINDS.map((k) => byKind.get(k)).filter((x): x is WeeklyItem => Boolean(x));
  return items.length === 3 ? items : null;
}

function normalizeKind(value: unknown): Kind | null {
  if (typeof value !== "string") return null;
  const v = value.trim().toLowerCase();
  return (KINDS as readonly string[]).includes(v) ? (v as Kind) : null;
}

/** Trim, collapse whitespace, and bound length so a runaway response can't break layout. */
function cleanText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const t = value.replace(/\s+/g, " ").trim();
  if (!t) return null;
  return t.length > 160 ? `${t.slice(0, 157)}…` : t;
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/** Pull the first {...} object out of a response that may be fenced or chatty. */
function extractJsonObject(text: string): string {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  return start !== -1 && end > start ? text.slice(start, end + 1) : text;
}

/* ─────────────────────────────── fallback drop */

/**
 * A never-empty drop derived from the retrieved evidence (and, when present, the child's
 * name/interests). Used when there's no profile yet or the LLM call/parse fails — the
 * surface should always feel alive and on-brand.
 */
function fallbackItems(profile: ChildProfile | null, snippets: EvidenceSnippet[]): WeeklyItem[] {
  const name = profile?.childName?.trim();
  const who = name ? `${name}` : "your child";

  // Prefer to seed from real retrieved evidence; otherwise use evergreen defaults.
  const study = snippets[0];
  const activitySnippet =
    snippets.find((s) => s.tags.includes("free") || s.tags.includes("low-cost") || s.tags.includes("play")) ??
    snippets[1];

  return [
    {
      kind: "study",
      title: study ? shortTitle(study.title) : "Everyday talk builds big brains",
      body: study
        ? `${firstSentence(study.text)} — ${study.source}.`
        : "Talking, reading, and playing daily are the strongest free drivers of early development.",
    },
    {
      kind: "tip",
      title: "One small change this week",
      body: profile?.struggles?.[0]
        ? `Pick one calm moment around ${profile.struggles[0]} and give a two-minute warning before any change.`
        : "Give a concrete two-minute warning before transitions to head off meltdowns.",
    },
    {
      kind: "activity",
      title: "A free thing to do together",
      body: activitySnippet?.tags.includes("library")
        ? `Visit the library this week — free books and a story time ${who} can settle into.`
        : `Set up a no-cost play invitation for ${who}: a cardboard box, water and a scoop, or a leaf-collecting walk.`,
    },
  ];
}

/** First sentence of a snippet, trimmed for a one-line body. */
function firstSentence(text: string): string {
  const m = text.match(/^[^.]+\./);
  const s = (m ? m[0] : text).trim();
  return s.length > 130 ? `${s.slice(0, 127)}…` : s;
}

/** Keep evidence titles short enough for a single line. */
function shortTitle(title: string): string {
  return title.length > 48 ? `${title.slice(0, 45)}…` : title;
}
