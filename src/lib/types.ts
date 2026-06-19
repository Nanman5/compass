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

export type AgeBand = "0-1" | "2-3" | "4-5" | "6-8";

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

/* ─────────────────────────────── Evidence corpus (RAG, global, read-only) */

export interface EvidenceSnippet {
  id: string;
  title: string;
  source: string; // e.g. "AAP 2026 screen-time guidance"
  text: string;
  tags: string[]; // for simple keyword retrieval, e.g. ["screen-time","bedtime"]
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

export interface CoachTurnInput {
  familyId: string;
  message: string;
}

export interface CoachTurnResult {
  /** The ONE concrete next step, personalized to the child. */
  nextStep: string;
  /** The "when to put the screen away" note — Compass's soul. */
  screenNote: string;
  /** Evidence citations used. */
  citations: { title: string; source: string }[];
  /** New learnings written to this family's memory this turn. */
  learnings: string[];
  /** Full agent trajectory for observability / the demo's behind-the-scenes panel. */
  trajectory: TrajectoryStep[];
  /** Tokens/latency/model for the trace footer. */
  meta: { provider: string; model: string; steps: number; ms: number };
}
