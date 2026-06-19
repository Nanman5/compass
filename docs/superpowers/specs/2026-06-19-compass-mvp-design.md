# Compass — MVP Prototype Design Spec

*Status: approved · Date: 2026-06-19 · Course deliverable: AI & Cloud-Powered Family Support Prototypes (Dr. Walker's Family Life class consulting project)*

---

## 1. Summary

Compass is an AI parenting companion for digital-native parents of kids ages 2–8. It learns
your family, turns generic parenting advice into one concrete next step for *your* child, and
teaches you to use technology with intention — including when to put the screen away.

This spec defines a **one-week proof-of-concept**: a Next.js web app (mobile-app aesthetic)
deployed on AWS Amplify, where the **full product vision is visible as an app shell** but **one
feature works truly end-to-end**: **Conversational Onboarding → an agentic Coach with
per-family memory.**

The Coach is built as a **real tool-loop agent** (not a single LLM call), following the
internal *Agent Bible* field manual: scoped/typed memory, bounded tool loop, guardrails,
and an observable trajectory.

## 2. Goals & Non-Goals

### Goals
- Demonstrate **personalization + persistent cloud memory** — the core of Cloud Essentials.
- Show a **genuinely agentic** Coach (dynamic tool choice, scoped memory, evidence grounding).
- Make memory **multi-tenant: isolated per family**, never one shared store for everyone.
- Tell a strong consulting story: cloud architecture, multi-provider selection, AI ethics
  (anti-bias, COPPA-aware privacy, anti-surveillance, data autonomy).
- Be **demo-safe**: runs locally first; cloud deploy is an enhancement, not a single point of failure.

### Non-Goals (this week)
- Building all 6 features end-to-end. Five are placeholder screens with mocked content.
- Real authentication hardening (Cognito is a stretch; demo uses a simple family session).
- The voice agent ("Help Me Now") being functional (provider chosen, integration deferred).
- Production scale, payments, or App/Play Store packaging.

## 3. Users & Success Criteria

**User:** digital-native millennial / Gen-Z parent, first-time or early, kids ages 2–8, feels
guilty about screen time, no time to research alternatives.

**Success metrics for the demo:**
- Parent gets a **concrete, actionable next step in < 30s** of describing a situation.
- The advice visibly **references the specific child** (age band, temperament, interests).
- Memory **persists across sessions** and **sharpens** — reopening the profile shows it grew.
- The "behind the scenes" panel shows the agent **chose tools and grounded advice in evidence**.
- Two different families get **different** advice for the same prompt (proves per-family scoping).

## 4. Product Surface

### 4.1 App shell (mobile-app aesthetic, web)
Visual style follows the concept brief: warm, gentle, illustrated; serif headings; palette of
deep teal/navy + coral/terracotta CTA + cream background + sage accents. The compass/star logo.

The **Coach** is the central companion (home surface) that Onboarding feeds into — it is the
functional end-to-end experience, not a separate nav item. Navigation exposes the brief's
**6 core features** so the full vision reads:
1. **Conversational Onboarding** — *functional (end-to-end)*; seeds the Coach.
2. **Paste & Personalize** — placeholder (mocked output).
3. **Weekly Drop** — placeholder (mocked feed).
4. **Help Me Now (Voice)** — placeholder (provider: OpenAI Realtime, deferred).
5. **Planned Activities Calendar** — placeholder.
6. **Win Logger** — surfaced live via the Coach's episodic memory; standalone view is placeholder.

### 4.2 The end-to-end flow
**Onboarding (prompt-chain + structured extraction):** a 4–6 turn guided chat learns the
child's age band, temperament, interests, current struggle, and family context. On completion
it distills a **structured child profile (JSON)** → seeds that family's **semantic memory**.

**Coach (agentic tool-loop):** the parent describes a situation ("bedtime is a battle"). The
agent loads the family profile + relevant memory, retrieves trusted evidence, reasons, and
returns **ONE concrete next step** tailored to the child **plus a "when to put the screen away"
note** (the product's soul). After the exchange it records new learnings → guidance sharpens.

## 5. Architecture

Multi-cloud by capability — a deliberate consulting decision:

```
Browser (Next.js, app-shell UI)
        │
        ▼
  Next.js API Routes  ──────────────┐
        │                           │
        ├──► Google Gemini API  ─────┘   (Coach agent: function calling / tool loop)
        │
        ├──► DynamoDB (AWS SDK)          (per-family memory: semantic + episodic)
        │
        └──► Evidence corpus (RAG)       (curated, read-only, global)

Hosting:  AWS Amplify Hosting (Next.js frontend + API routes)
Auth:     Cognito  (STRETCH; demo uses a simple family session id)
Voice:    OpenAI Realtime  (Help Me Now — deferred, exact model + key TBD)
```

**Why this stack (consulting rationale):**
- **AWS Amplify** — real cloud (CDN, managed deploy) without IAM/infra eating the week.
- **DynamoDB** — managed NoSQL; partition-by-tenant is natural and demonstrates cloud data design.
- **Google Gemini** — chosen LLM provider; native function calling; key already available.
- **OpenAI Realtime** — best-fit for low-latency voice; shows per-capability provider selection.

### 5.1 LLM client abstraction
A thin `llm` client wraps the provider so the Coach's agent loop is provider-agnostic. Default:
Gemini. This isolates provider details and keeps the agent loop testable.

> **Implementation note:** confirm the exact current Gemini model id at build time (do not
> hardcode from memory). OpenAI Realtime model name + API key to be supplied by owner.

## 6. The Coach Agent (Agent Bible compliant)

### 6.1 Architecture rung
**Rung 4 — tool-loop agent.** The model dynamically decides which tools to call and when to
stop. Not a single call (would be the "personality without state" anti-pattern), not a fixed
chain (the Coach's path varies by situation).

### 6.2 Tools

| Tool | Purpose | Input | Output | Risk | Approval |
|------|---------|-------|--------|------|----------|
| `get_family_profile` | Read this family's profile + recent memory | `familyId` | profile JSON + memory[] | private_read | never (own tenant) |
| `retrieve_evidence` | RAG over curated trusted parenting evidence | `query` | snippets + citations | public_read | never |
| `record_learning` | Append a validated semantic fact | `familyId, fact, confidence` | ack | db_write (scoped) | never (own tenant) |
| `log_interaction` | Append an episodic record (situation, suggestion, later: outcome) | `familyId, episode` | ack | db_write (scoped) | never (own tenant) |

Design rules: small deterministic tools, strict input schemas, every write scoped to the
caller's `familyId` (a tool can never touch another family's data), validated before write.

### 6.3 Bounds & stop conditions
- `max_steps`: ~6 tool calls per Coach turn.
- `max_cost`: per-turn token ceiling.
- Stop when: concrete next step produced & logged · blocked on missing input · step/cost limit.

### 6.4 Trajectory observability (demo centerpiece)
Every Coach turn logs a trace: `runId, familyId, model, tool calls + args hash, retrieved
citations, learnings written, tokens, latency`. A **"Behind the scenes" panel** renders this
live in the UI — proving the system is agentic and grounding the Cloud Essentials story.

## 7. Memory Model (scoped per family — hard requirement)

**Nothing is shared across families** except the read-only evidence corpus. Every read and
write filters by `familyId`. DynamoDB single-table, partitioned by tenant:

```
Table: CompassMemory
  PK = FAMILY#<familyId>
  SK = PROFILE                 (semantic: the child profile — single item)
     | LEARNING#<timestamp>    (semantic: incremental learned facts)
     | EPISODE#<timestamp>     (episodic: coach interactions + outcomes / Win Logger)
```

Every record carries: `source/provenance`, `timestamp`, `scope=familyId`, `confidence`,
`type` (semantic | episodic), `sensitivity` label. Memory operating rules from the Bible:
current user input beats old memory; never persist unvalidated external content; write fewer,
better, action-relevant facts.

**Evidence corpus (RAG):** small curated set of trusted guidance (e.g., the 2026 AAP
screen-time update emphasizing quality/context over rigid limits). Global, read-only, cited.

## 8. Ethics, Privacy & Security (consulting deliverable)

- **COPPA-aware data minimization:** child first name/nickname + *age band* only. No DOB, no
  photos, no precise location. Parent is the account holder.
- **Anti-bias guardrail:** system prompt explicitly instructs the agent to personalize
  **without stereotyping** by class, race, or gender. Example: low-income context → suggest
  **free/low-cost** enrichment (bridge gaps, don't reinforce them). Directly answers the
  assignment's bias question (Q10).
- **Anti-surveillance:** Compass supports the *parent*; it does not monitor the *child* (Q13).
- **Data autonomy / transparency:** the parent can view and delete what Compass remembers.
- **External content = evidence, not authority** (Bible §12) — foundational for the future
  Paste & Personalize feature; pasted content never overrides system/user instructions.
- **Least privilege:** IAM scoped to the single DynamoDB table; secrets out of model context.
- **Bounds:** rate/cost/loop limits on the agent.

## 9. Minimum Production Agent Spec (Agent Bible §3)

```yaml
name: compass-coach
owner: Hernán (consulting team) / Dr. Walker Family Life project
mission: Turn a parent's in-the-moment struggle into one concrete, personalized next step.
success_definition: Parent receives an actionable, child-specific step grounded in evidence;
  memory persists and sharpens across sessions.
scope:
  allowed:
    - read/write THIS family's memory
    - retrieve curated parenting evidence
    - produce one next step + a "when to put the screen away" note
  forbidden:
    - access another family's data
    - monitor or profile the child for surveillance
    - present external/pasted content as authority
    - store sensitive PII (DOB, photos, precise location)
inputs:
  channels: [web app chat]
  data_sources: [DynamoDB per-family memory, curated evidence corpus]
tools:
  - { name: get_family_profile, risk: private_read,  approval: never, rollback: read-only }
  - { name: retrieve_evidence,  risk: public_read,   approval: never, rollback: read-only }
  - { name: record_learning,    risk: db_write,      approval: never, rollback: delete record by SK }
  - { name: log_interaction,    risk: db_write,      approval: never, rollback: delete record by SK }
state:
  session_store: family session id (cookie) → familyId
  task_ledger: n/a (synchronous turns)
memory:
  semantic: DynamoDB PROFILE + LEARNING# items (per family)
  episodic: DynamoDB EPISODE# items (per family)
  procedural: this spec + system prompt
  rag_corpora: curated evidence corpus (global, read-only)
orchestration:
  mode: tool_loop
  max_steps: 6
  max_cost: per-turn token ceiling
  max_runtime: ~30s
stop_conditions: [next_step_produced_and_logged, blocked_missing_input, step_or_cost_limit]
verification: [unit tests for memory scoping + profile extraction, manual demo script, trajectory inspection]
observability:
  logs: per-turn trace (runId, familyId, model, tool calls, citations, tokens, latency)
security:
  sandbox: none (managed APIs only)
  credentials: env vars; IAM least-privilege to one table
  network: egress to Gemini + AWS only
maintenance:
  review_cadence: n/a for course demo (note as future work)
  stale_job_policy: n/a
```

## 10. Testing & Verification
- Unit: memory scoping (family A cannot read family B), profile extraction shape, learning merge.
- Manual demo script: onboard Family A → coach → show memory grew → onboard Family B → same
  prompt yields different, appropriately-personalized advice.
- Trajectory inspection via the Behind-the-scenes panel.

## 11. Deliverables (assignment)
1. Working prototype (local-first; deployed to AWS Amplify).
2. This design spec + a 1-page consulting summary (needs found → how addressed).
3. Reflection (consulting, critical thinking, AI ethics).
4. GitHub repo.

## 12. Build Order (high level)
1. Next.js project + app shell + Compass visual system (6 nav features, 5 placeholders).
2. DynamoDB memory layer (local DynamoDB or AWS) with per-family scoping + tests.
3. LLM client (Gemini) abstraction.
4. Onboarding flow → structured profile → seed semantic memory.
5. Coach agent: tool loop + 4 tools + evidence RAG + guardrail system prompt.
6. Behind-the-scenes trajectory panel.
7. Deploy to AWS Amplify; consulting docs + reflection.

*(Detailed implementation plan to be produced via the writing-plans step.)*
