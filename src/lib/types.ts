/**
 * Compass — shared contract (the glue between the data, LLM, and agent layers).
 *
 * This file is the SINGLE SOURCE OF TRUTH for cross-module interfaces. The memory,
 * evidence, LLM-client, onboarding, and coach modules all implement / consume these
 * types. Do not duplicate these shapes elsewhere — import from "@/lib/types".
 *
 * Design rules (from docs/superpowers/specs/2026-06-19-compass-mvp-design.md):
 *  - Memory is scoped PER FAMILY (multi-tenant). Every read/write takes a familyId.
 *  - Memory is typed: semantic (profile + learnings) vs episodic (interactions).
 *  - The Coach is an agentic tool-loop, not a single LLM call.
 *  - Every coach turn records a trajectory for the "behind the scenes" panel.
 */

/* ─────────────────────────────── Memory: semantic (the child profile) */

export const AGE_BANDS = ["0-1", "2-3", "4-5", "6-8"] as const;
export type AgeBand = (typeof AGE_BANDS)[number];

export interface ChildProfile {
  familyId: string;
  /** First name or nickname only — COPPA data minimization, no full PII. */
  childName: string;
  ageBand: AgeBand;
  /** Evidence-based temperament read (adaptability / sensory sensitivity / persistence),
   *  captured as plain descriptors, e.g. ["sensitive", "spirited", "go-with-the-flow"]. */
  temperament: string[];
  interests: string[]; // e.g. ["dinosaurs", "drawing"]
  struggles: string[]; // current pain points, e.g. ["bedtime", "tantrums"]
  /** Free-form family context the parent shared (languages, household, values, needs). */
  context: string;

  /* ── Evidence-based dimensions (optional; gathered only when natural). ───────── */
  /** Care structure — coparental consistency matters (TICS). e.g. "just me", "co-parenting". */
  familyStructure?: string;
  /** The "5 Cs" screen context — only what the parent volunteers. */
  mediaContext?: {
    /** Crowding-out: routines screens most displace (sleep, meals, play, time together). */
    crowdsOut?: string;
    /** Calm: whether screens are the go-to for soothing / falling asleep. */
    calmUse?: string;
    /** Communication: co-viewing / talking about content (mediation level). */
    mediation?: string;
  };
  /** Parent's own device distraction around the child (DISRUPT), normalized & non-judgmental. */
  parentDistraction?: string;

  createdAt: string; // ISO
  updatedAt: string; // ISO
}

/** A single learned fact appended over time — sharpens future guidance. */
export interface Learning {
  id: string;
  familyId: string;
  fact: string;
  source: string; // provenance, e.g. "coach-turn", "onboarding"
  confidence: number; // 0..1
  sensitivity: "low" | "medium" | "high";
  createdAt: string;
}

/* ─────────────────────────────── Memory: episodic (interactions / Win Logger) */

export interface Episode {
  id: string;
  familyId: string;
  situation: string; // what the parent described
  suggestion: string; // the concrete next step Compass gave
  outcome?: string; // later: "how did it go" (Win Logger)
  createdAt: string;
}

/** Everything Compass remembers about one family (always fetched scoped). */
export interface FamilyMemory {
  profile: ChildProfile | null;
  learnings: Learning[];
  episodes: Episode[];
}

/**
 * Per-family memory store. Local-first implementation (JSON under .data/), written
 * with a DynamoDB-shaped single-table mental model (PK=FAMILY#<id>, SK=PROFILE|LEARNING#|EPISODE#)
 * so it can later swap to a real DynamoDB impl behind the same interface.
 * EVERY method is scoped by familyId — a caller can never reach another family's data.
 */
export interface MemoryStore {
  getFamilyMemory(familyId: string): Promise<FamilyMemory>;
  getProfile(familyId: string): Promise<ChildProfile | null>;
  saveProfile(profile: ChildProfile): Promise<ChildProfile>;
  addLearning(input: Omit<Learning, "id" | "createdAt">): Promise<Learning>;
  addEpisode(input: Omit<Episode, "id" | "createdAt">): Promise<Episode>;
  updateEpisodeOutcome(familyId: string, episodeId: string, outcome: string): Promise<void>;
  /** Data autonomy / transparency: parent can wipe what Compass remembers. */
  deleteFamily(familyId: string): Promise<void>;
}

/* ─────────────────────────────── Family directory (co-parenting / shared access)

   A family is a shared space, NOT one account. Identity (a Google `sub`) is decoupled
   from the tenant (`familyId`) by a membership layer, so two parents can point at the
   SAME family memory. Invites are the consent gate: an existing member mints a code,
   the co-parent redeems it, and a membership is created. This directory lives ALONGSIDE
   the per-family memory store (it never holds child data — only which adults can reach it). */

export type FamilyRole = "owner" | "member";

/** Links one adult (Google `sub`) to one family. The join that enables co-parenting. */
export interface Membership {
  userSub: string;
  familyId: string;
  role: FamilyRole;
  /** Adult display name/email (NOT the child's) — lets the UI show "who has access". */
  name?: string;
  email?: string;
  createdAt: string; // ISO
}

/** A short-lived, shareable code that grants membership to `familyId` when redeemed. */
export interface Invite {
  code: string; // human-typeable, e.g. "K7QMRT94" → normalized uppercase alphanumerics
  familyId: string;
  createdBySub: string;
  createdAt: string; // ISO
  expiresAt: string; // ISO
  redeemedBySub?: string;
  redeemedAt?: string;
}

/**
 * Directory of WHO can reach each family. Separate from MemoryStore (which holds the
 * child data) so the tenant boundary stays clean: this maps adults↔families and nothing
 * else. Local-first (JSON) in dev, Firestore in prod — same interface, like MemoryStore.
 */
export interface FamilyDirectory {
  /** The family this adult belongs to (null until they create/join one). */
  getMembershipByUser(userSub: string): Promise<Membership | null>;
  /** Everyone with access to a family — powers the "shared with" list. */
  listMembers(familyId: string): Promise<Membership[]>;
  /** Upsert a membership (re-joining moves the adult to a new family). */
  putMembership(membership: Membership): Promise<void>;
  createInvite(invite: Invite): Promise<void>;
  getInvite(code: string): Promise<Invite | null>;
  markInviteRedeemed(code: string, userSub: string, redeemedAt: string): Promise<void>;
}

/* ─────────────────────────────── Evidence corpus (RAG, global, read-only) */

export interface EvidenceSnippet {
  id: string;
  title: string;
  source: string; // e.g. "AAP 2026 screen-time guidance"
  text: string;
  tags: string[]; // for simple keyword retrieval, e.g. ["screen-time","bedtime"]
  /** Link to the source guidance (verified live) so citations can point somewhere real. */
  url?: string;
}

export interface EvidenceIndex {
  /** Simple, explainable retrieval (keyword/score). Returns top matches with citations. */
  retrieve(query: string, limit?: number): EvidenceSnippet[];
  all(): EvidenceSnippet[];
}

/* ─────────────────────────────── LLM client (provider-agnostic) */

export type ChatRole = "system" | "user" | "assistant" | "tool";

export interface ChatMessage {
  role: ChatRole;
  content: string;
  /** When role==="tool": which tool call this responds to. */
  toolCallId?: string;
  name?: string;
  /** When role==="assistant": the tool calls this turn requested. Required in the transcript —
   *  OpenAI rejects a role:"tool" message whose preceding assistant turn lacks the matching
   *  tool_calls, and Gemini expects the model's functionCall parts in history. */
  toolCalls?: ToolCall[];
}

/** A tool the model may call (JSON-schema parameters), provider-agnostic. */
export interface ToolDef {
  name: string;
  description: string;
  parameters: Record<string, unknown>; // JSON Schema
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  /** Gemini 3.x: opaque signature that MUST be replayed with the functionCall in history. */
  thoughtSignature?: string;
}

export interface LlmResponse {
  text: string;
  toolCalls: ToolCall[];
}

export interface LlmGenerateOptions {
  system?: string;
  messages: ChatMessage[];
  tools?: ToolDef[];
  temperature?: number;
  /** Force a JSON object response (used by onboarding extraction). */
  json?: boolean;
  /** Per-call model override (must match the resolved provider). Falls back to client default. */
  model?: string;
}

export interface LlmClient {
  /** Which provider actually served the request (for the trajectory/observability). */
  readonly provider: "gemini" | "openai";
  readonly model: string;
  generate(opts: LlmGenerateOptions): Promise<LlmResponse>;
}

/* ─────────────────────────────── Onboarding */

export interface OnboardingState {
  familyId: string;
  messages: ChatMessage[]; // running conversation
  done: boolean;
}

export interface OnboardingTurnResult {
  /** Assistant's next question or closing message. */
  reply: string;
  done: boolean;
  /** Present only when done: the distilled profile seeded into semantic memory. */
  profile?: ChildProfile;
}

/* ─────────────────────────────── Coach (agentic tool-loop) */

/** One step in the agent's trajectory — rendered in the "behind the scenes" panel. */
export interface TrajectoryStep {
  kind: "tool_call" | "tool_result" | "thinking" | "final";
  tool?: string;
  args?: Record<string, unknown>;
  /** Short human-readable summary of what happened (e.g. citations, learnings). */
  summary: string;
}

/** One prior turn of the on-screen conversation, replayed for context. */
export interface CoachHistoryTurn {
  role: "parent" | "compass";
  text: string;
}

export interface CoachTurnInput {
  familyId: string;
  message: string;
  /** Recent visible conversation (oldest first) so follow-ups keep their context. */
  history?: CoachHistoryTurn[];
  /** Live observer — called as each trajectory step happens (powers the streaming UI). */
  onStep?: (step: TrajectoryStep) => void;
}

/** One evidence citation, enriched so the UI can link out and preview it. */
export interface Citation {
  title: string;
  source: string;
  /** Link to the study/guidance when we have one (live research results do). */
  url?: string;
  /** One-to-two-sentence gist, shown as a hover preview. */
  summary?: string;
}

export interface CoachTurnResult {
  /** "step" = a coached next step; "chat" = a conversational reply (greeting, small talk,
   *  or a message that isn't a struggle yet — nothing is fabricated, nothing is logged). */
  kind: "step" | "chat";
  /** kind==="chat": the short conversational reply. */
  reply?: string;
  /** The ONE concrete next step, personalized to the child. */
  nextStep: string;
  /** The "when to put the screen away" note — Compass's soul. */
  screenNote: string;
  /** Evidence citations used. */
  citations: Citation[];
  /** New learnings written to this family's memory this turn. */
  learnings: string[];
  /** Full agent trajectory for observability / the demo's behind-the-scenes panel. */
  trajectory: TrajectoryStep[];
  /** Tokens/latency/model for the trace footer. */
  meta: { provider: string; model: string; steps: number; ms: number };
}

/* ─────────────────────────────── Weekly Drop (persisted, synthesized briefing)

   A Drop is NOT "one article handed over". It's a synthesis: we pull SEVERAL real studies
   around THIS family's current situation (their struggles + recent episodes/learnings),
   weave them into one relevant briefing for the parent, attach the real sources (so nothing
   is fabricated), and generate an infographic. Every drop is saved per family + ISO week so
   the family can revisit past drops. Shared by the API (server) and the UI (client). */

export type DropItemKind = "study" | "tip" | "activity";

export interface DropItem {
  kind: DropItemKind;
  title: string;
  body: string;
  /** STUDY item only: the primary real source label + a link to read it. */
  source?: string;
  url?: string;
}

/** One real study woven into the synthesis (shown in the drop's "Sources" list). */
export interface DropSource {
  title: string;
  source: string; // e.g. "Journal of Pediatric Psychology · 2025" or curated authors
  url?: string; // DOI / Europe PMC; curated studies may have none
}

export interface WeeklyDrop {
  familyId: string;
  weekKey: string; // stable "this week" key, e.g. "2026-W26"
  childName: string;
  /** The synthesized through-line for this family right now (the headline to present). */
  headline: string;
  /** 1–2 sentence synthesis across the sources, tied to the family's situation. */
  summary: string;
  items: DropItem[]; // study (synthesized insight) + tip + activity
  sources: DropSource[]; // ALL the real studies pulled & woven in
  /** Generated infographic as a data URL. Kept on the live/in-memory drop; the durable
   *  Firestore copy omits it (1 MB doc limit) — the local dev store keeps it. */
  heroImage?: string;
  createdAt: string; // ISO
}

/** Per-family archive of weekly drops. Local JSON in dev, Firestore in prod (same interface). */
export interface DropStore {
  saveDrop(drop: WeeklyDrop): Promise<void>;
  getDrop(familyId: string, weekKey: string): Promise<WeeklyDrop | null>;
  /** Most-recent first, capped by `limit` — powers the "past drops" archive. */
  listDrops(familyId: string, limit?: number): Promise<WeeklyDrop[]>;
}
