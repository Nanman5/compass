/**
 * GET /api/weekly?familyId= — this family's Weekly Drop (a synthesized briefing).
 *
 * A drop is NOT "grab one article and hand it over". It is a synthesis built AROUND this
 * family's situation:
 *   1. read the family's memory (profile + recent episodes + learnings),
 *   2. pull SEVERAL real, peer-reviewed studies relevant to that situation (live Europe PMC,
 *      curated library as fallback),
 *   3. ask the LLM to weave them into one relevant briefing for the parent — a headline, a
 *      short synthesis, and three items (a STUDY insight, a TIP, an ACTIVITY),
 *   4. generate an on-brand infographic (gpt-image-2) in parallel,
 *   5. save the whole drop per family + ISO week so it can be revisited.
 *
 * Citations are never fabricated: the real `sources[]` are attached server-side. Everything is
 * defensive — a missing profile yields "needs context", and any LLM/image/network failure
 * degrades gracefully (study from the pulled research, static illustration) so it's never empty.
 *
 * Server-only (reads secrets via getLlm / OpenAI; reads per-family memory; writes the archive).
 */

import { type NextRequest, NextResponse } from "next/server";

import { familyAccessError } from "@/lib/authz";
import { drops } from "@/lib/drops";
import { generateDropImage } from "@/lib/dropimage";
import { evidence } from "@/lib/evidence";
import { getLlm } from "@/lib/llm";
import { memory } from "@/lib/memory";
import { extractJsonObject } from "@/lib/parse";
import { searchResearch } from "@/lib/research";
import { studies } from "@/lib/studies";
import type {
  ChildProfile,
  DropItem,
  DropItemKind,
  DropSource,
  EvidenceSnippet,
  FamilyMemory,
  WeeklyDrop,
} from "@/lib/types";

export const runtime = "nodejs";

const KINDS = ["study", "tip", "activity"] as const;

/** One real study pulled for the synthesis (and the drop's Sources list). */
interface PulledStudy {
  title: string;
  source: string;
  url?: string;
  finding: string;
}

/** The LLM's synthesized output (before we attach the real sources + image). */
interface Synthesis {
  headline: string;
  summary: string;
  items: DropItem[];
}

/**
 * The drop is a WEEKLY ritual, not a per-load reroll: once generated for a family in a given
 * ISO week it's cached and served unchanged until the next week. In-memory (per server
 * instance, holds the generated image too) on top of the durable archive in `drops`.
 */
const weeklyCache = new Map<string, WeeklyDrop>();

/** Stable key for "this calendar week", e.g. "2026-W26". */
function isoWeekKey(d: Date): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = date.getUTCDay() || 7; // Mon=1..Sun=7
  date.setUTCDate(date.getUTCDate() + 4 - day); // nearest Thursday
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${week}`;
}

export async function GET(req: NextRequest): Promise<Response> {
  const familyId = req.nextUrl.searchParams.get("familyId");
  if (typeof familyId !== "string" || familyId.trim().length === 0) {
    return NextResponse.json({ error: "familyId is required" }, { status: 400 });
  }

  const denied = await familyAccessError(familyId);
  if (denied) return denied;

  // Load the whole family memory (profile + episodes + learnings) — the drop is built on it.
  let mem: FamilyMemory = { profile: null, learnings: [], episodes: [] };
  try {
    mem = await memory.getFamilyMemory(familyId);
  } catch (err) {
    console.error("[weekly] failed to load memory:", err);
  }
  const profile = mem.profile;

  // First week / not enough context yet: invite them to keep interacting.
  if (!profile || !profile.childName?.trim()) {
    return NextResponse.json({ needsContext: true });
  }

  const weekKey = isoWeekKey(new Date());
  const cacheKey = `${familyId}:${weekKey}`;

  // `fresh=1` forces a brand-new drop (the demo's manual trigger): skip both caches and
  // regenerate, overwriting what's stored for this week.
  const fresh = req.nextUrl.searchParams.get("fresh") === "1";

  // Serve this week's drop if we already have it (in-memory first, then the durable archive).
  if (!fresh) {
    const cached = weeklyCache.get(cacheKey);
    if (cached) return NextResponse.json(cached);
    const stored = await drops.getDrop(familyId, weekKey).catch(() => null);
    if (stored) {
      weeklyCache.set(cacheKey, stored);
      return NextResponse.json(stored);
    }
  }

  // ── Generate this week's drop ───────────────────────────────────────────────
  // Pull several real studies for this family's focus (a focused query lands real, linkable
  // hits); the SITUATION (recent episodes/learnings) is fed to the synthesis prompt instead,
  // so the drop reads around this family without polluting the literature search.
  const pulled = await pullStudies(buildResearchQuery(profile));
  const snippets = evidence.retrieve(buildEvidenceQuery(profile), 5);

  // Synthesize (LLM) and render the infographic (gpt-image-2) concurrently — independent work.
  const [synth, heroImage] = await Promise.all([
    synthesizeDrop(profile, mem, pulled, snippets).catch((err) => {
      console.error("[weekly] synthesis failed; using fallback:", err);
      return null;
    }),
    generateDropImage(profile).catch(() => null),
  ]);

  const childName = profile.childName.trim();
  const sources: DropSource[] = pulled.map((p) => ({ title: p.title, source: p.source, url: p.url }));
  const baseItems = synth?.items ?? fallbackItems(profile, pulled, snippets);
  // Carry the primary real source onto the featured STUDY item for its citation line.
  const items = baseItems.map((it) =>
    it.kind === "study" && sources[0]
      ? { ...it, source: it.source ?? sources[0].source, url: it.url ?? sources[0].url }
      : it,
  );

  const drop: WeeklyDrop = {
    familyId,
    weekKey,
    childName,
    headline: synth?.headline || `This week for ${childName}`,
    summary:
      synth?.summary ||
      `A few small, evidence-based reads chosen for ${childName}, drawn from real research.`,
    items,
    sources,
    ...(heroImage ? { heroImage } : {}),
    createdAt: new Date().toISOString(),
  };

  // Cache for the rest of the week + persist to the archive (best-effort).
  if (weeklyCache.size > 500) weeklyCache.clear();
  weeklyCache.set(cacheKey, drop);
  await drops.saveDrop(drop).catch((err) => console.error("[weekly] failed to persist drop:", err));

  return NextResponse.json(drop);
}

/* ─────────────────────────────── real-study pull (Europe PMC → curated) */

/** Europe PMC abstracts often begin with a structured section label ("Background", "Methods"…);
 *  drop a leading one so a distilled first sentence reads cleanly. */
function stripSectionLabel(text: string): string {
  return text
    .replace(
      /^\s*(background|objectives?|introduction|aims?|purpose|methods?|results?|conclusions?|importance)\b[:.\s-]*/i,
      "",
    )
    .trim();
}

/** A developmental-stage term that helps the medical-literature search land on relevant work. */
function ageTerm(band: ChildProfile["ageBand"]): string {
  switch (band) {
    case "0-1":
      return "infant";
    case "2-3":
      return "toddler";
    case "4-5":
      return "preschool";
    case "6-8":
      return "school-age children";
    default:
      return "young children";
  }
}

/**
 * A FOCUSED literature query for this family: their struggles + developmental stage. Kept
 * clean — struggles only (interests like "dinosaurs" or free-text episode prose would AND
 * against the medical corpus and return nothing) — so the search lands real, linkable hits.
 * The family's *situation* and interests are woven in later, at synthesis time.
 */
function buildResearchQuery(profile: ChildProfile): string {
  const focus = profile.struggles.filter(Boolean).slice(0, 3).join(" ");
  return `${focus || "sleep behavior screen time"} ${ageTerm(profile.ageBand)} parenting`
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200); // keep the query bounded for the search API
}

/**
 * Pull SEVERAL real, peer-reviewed studies to weave into the drop. Live Europe PMC first
 * (fresh, quality-gated, linkable), topped up with the curated library, deduped by title and
 * capped. Returns [] only if everything fails (then the synthesis falls back to evidence).
 */
async function pullStudies(query: string): Promise<PulledStudy[]> {
  const live = await searchResearch(query, { limit: 6, sort: "relevance" });
  const liveStudies: PulledStudy[] = live
    .filter((r) => r.abstract)
    .slice(0, 4)
    .map((r) => ({
      title: r.title,
      source: [r.journal, r.year].filter(Boolean).join(" · ") || "Peer-reviewed study",
      url: r.url,
      finding: stripSectionLabel(r.abstract),
    }));

  const curated: PulledStudy[] = studies.retrieve(query, 2).map((s) => ({
    title: s.title,
    source: s.authors,
    finding: s.findings,
  }));

  // Prefer live, then curated; dedupe by (lowercased) title; cap at 4 for a focused synthesis.
  const seen = new Set<string>();
  const out: PulledStudy[] = [];
  for (const s of [...liveStudies, ...curated]) {
    const key = s.title.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
    if (out.length >= 4) break;
  }
  return out;
}

/* ─────────────────────────────── LLM synthesis */

/** Build the evidence retrieval query from the child's struggles + interests (or a default). */
function buildEvidenceQuery(profile: ChildProfile): string {
  const terms = [...profile.struggles, ...profile.interests, ...profile.temperament, profile.context]
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

/** Recent situation (what the parent has actually been describing) so the synthesis fits them. */
function describeSituation(mem: FamilyMemory): string {
  const episodes = mem.episodes.slice(-4).map((e) => `- ${e.situation}${e.outcome ? ` (went: ${e.outcome})` : ""}`);
  const learnings = mem.learnings.slice(-5).map((l) => `- ${l.fact}`);
  const lines: string[] = [];
  if (episodes.length) lines.push("Recent moments:", ...episodes);
  if (learnings.length) lines.push("What we've learned about them:", ...learnings);
  return lines.length ? lines.join("\n") : "(no recent history yet — keep it broadly useful)";
}

/** The real studies, numbered, for the model to synthesize across (not copy one). */
function describeStudies(pulled: PulledStudy[]): string {
  if (pulled.length === 0) return "(no studies retrieved — synthesize from the EVIDENCE instead)";
  return pulled.map((s, i) => `[${i + 1}] ${s.title} (${s.source})\n${s.finding}`).join("\n\n");
}

/** Format retrieved practical evidence as a grounding block with attributions. */
function describeEvidence(snippets: EvidenceSnippet[]): string {
  if (snippets.length === 0) return "(none — rely on well-established guidance)";
  return snippets.map((s, i) => `[${i + 1}] ${s.title} (${s.source})\n${s.text}`).join("\n\n");
}

const SYNTH_SYSTEM_PROMPT = `You are Compass, a warm, evidence-based parenting companion.
You write ONE family's weekly "drop": a short briefing SYNTHESIZED across several real studies
and tailored to THIS family's current situation. You do not just repeat one article — you weave
the research together into something relevant to present to this parent.

You produce:
- "headline": the through-line for this family right now (3-7 words).
- "summary": 1-2 warm sentences synthesizing ACROSS the studies, tied to their situation.
- three "items": a STUDY (the key synthesized insight from the research), a TIP (one small,
  practical adjustment to try this week), and an ACTIVITY (a free/very low-cost thing to do
  together this week).

Rules:
- Synthesize across the FEATURED STUDIES; combine them. Never invent statistics, studies, or a
  source, and don't add numbers that aren't in the studies. Do NOT put citations in the text —
  sources are attached separately.
- Ground the TIP and ACTIVITY in the studies and the EVIDENCE; keep them concrete to THIS child.
- Activities and tips must be FREE or low-cost. Never assume a budget, a two-parent household,
  or any cultural/ability default. Warm, plain, encouraging — no jargon, no shaming.
- Each item "title" is 3-7 words; each item "body" is ONE sentence (max ~18 words).
- Output ONLY valid JSON.`;

async function synthesizeDrop(
  profile: ChildProfile,
  mem: FamilyMemory,
  pulled: PulledStudy[],
  snippets: EvidenceSnippet[],
): Promise<Synthesis | null> {
  const userPrompt = `CHILD PROFILE
${describeChild(profile)}

THIS FAMILY'S SITUATION (synthesize around this)
${describeSituation(mem)}

FEATURED STUDIES (weave these together — do not copy just one)
${describeStudies(pulled)}

EVIDENCE (practical grounding for the tip + activity)
${describeEvidence(snippets)}

Write this week's synthesized drop. Return JSON exactly in this shape:
{
  "headline": "...",
  "summary": "...",
  "items": [
    { "kind": "study",    "title": "...", "body": "..." },
    { "kind": "tip",      "title": "...", "body": "..." },
    { "kind": "activity", "title": "...", "body": "..." }
  ]
}`;

  const llm = await getLlm();
  const res = await llm.generate({
    system: SYNTH_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
    json: true,
    temperature: 0.7,
  });

  return parseSynthesis(res.text);
}

/* ─────────────────────────────── defensive parsing */

function parseSynthesis(text: string): Synthesis | null {
  const o = extractJsonObject(text);
  if (!o) return null;
  const items = parseItems(o.items);
  if (!items) return null;
  return {
    headline: cleanText(o.headline, 80) ?? "",
    summary: cleanText(o.summary, 300) ?? "",
    items,
  };
}

/** Parse the model's items into exactly three well-formed items, or null on any problem. */
function parseItems(raw: unknown): DropItem[] | null {
  if (!Array.isArray(raw)) return null;
  const byKind = new Map<DropItemKind, DropItem>();
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const r = item as { kind?: unknown; title?: unknown; body?: unknown };
    const kind = normalizeKind(r.kind);
    const title = cleanText(r.title);
    const body = cleanText(r.body);
    if (kind && title && body && !byKind.has(kind)) byKind.set(kind, { kind, title, body });
  }
  const items = KINDS.map((k) => byKind.get(k)).filter((x): x is DropItem => Boolean(x));
  return items.length === 3 ? items : null;
}

function normalizeKind(value: unknown): DropItemKind | null {
  if (typeof value !== "string") return null;
  const v = value.trim().toLowerCase();
  return (KINDS as readonly string[]).includes(v) ? (v as DropItemKind) : null;
}

/** Trim, collapse whitespace, and bound length so a runaway response can't break layout. */
function cleanText(value: unknown, max = 160): string | null {
  if (typeof value !== "string") return null;
  const t = value.replace(/\s+/g, " ").trim();
  if (!t) return null;
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

/* ─────────────────────────────── fallback items (never-empty) */

/**
 * A never-empty set of items derived from the real pulled study + practical evidence. Used when
 * the LLM synthesis fails — the surface should always feel alive, and the study item still
 * carries its REAL source/link when we pulled one.
 */
function fallbackItems(
  profile: ChildProfile,
  pulled: PulledStudy[],
  snippets: EvidenceSnippet[],
): DropItem[] {
  const who = profile.childName?.trim() || "your child";
  const study = pulled[0];
  const evidenceStudy = snippets[0];

  const studyItem: DropItem = study
    ? { kind: "study", title: shortTitle(study.title), body: firstSentence(study.finding), source: study.source, url: study.url }
    : {
        kind: "study",
        title: evidenceStudy ? shortTitle(evidenceStudy.title) : "Everyday talk builds big brains",
        body: evidenceStudy
          ? firstSentence(evidenceStudy.text)
          : "Talking, reading, and playing daily are the strongest free drivers of early development.",
        source: evidenceStudy?.source,
      };

  const activitySnippet =
    snippets.find((s) => s.tags.includes("free") || s.tags.includes("low-cost") || s.tags.includes("play")) ??
    snippets[1];

  return [
    studyItem,
    {
      kind: "tip",
      title: "One small change this week",
      body: profile.struggles?.[0]
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

/** Keep titles short enough for a single line. */
function shortTitle(title: string): string {
  return title.length > 48 ? `${title.slice(0, 45)}…` : title;
}
