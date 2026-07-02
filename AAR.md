# After-Action Report (AAR) — Compass

> **Project:** Compass — a parenting companion for the digital age
> **Group deliverable:** *"AI & Cloud-Powered Family Support Prototypes"* — Dr. Walker's Family Life Class (2026)
> **Team:** Hernan L. (IT) · Shondalle C. · Katlyn V. (Family Life)
>
> **Presentation hub:** https://nanman5.github.io/compass-hub/  ·  **Live prototype:** https://guideling.xyz  ·  **Source:** https://github.com/Nanman5/compass

---

## 1. Executive Summary & Project Overview

Parents of young children (ages 0–8) don't suffer from *too little* advice — they drown in *too much conflicting* advice, while the phone itself pulls their attention away from the child in front of them. Our Family Life partner, a mother in the class, framed the goal as *"finding a healthy balance, so technology strengthens family relationships instead of replacing real connection."* We built **Compass**, a cloud/AI parenting companion: a parent describes a real moment ("bedtime is a battle") and gets back **one small, evidence-based step** made for their specific child — and, unlike engagement-driven apps, it is deliberately built to be used *less* (no feed, no scroll, no streaks). Running on Google Cloud with a persistent per-family memory, the proof-of-concept met the partner's core need: it turns her idea of *balance* into the product's guiding principle — **technology with intention**.

---

## 2. Consulting & Needs Assessment (The "Listen" Phase)

We interviewed our Family Life partner (herself a mother) with a structured guide, treating it as a *listening* exercise — letting her language define the problem before we wrote any requirement.

**Key insights (textbook themes as pain points):**

- **Technology's double-edged role — the biggest pain point.** She said technology and social media *"now play a major role in family life,"* with parents focused on *"mental health, communication, and protecting children online."* The theme: tech **cuts both ways** — the same tools that help also distract and bury parents in *conflicting* advice.
- **Generational shift in discipline.** *"I don't spank my kids… that's probably what's changed for me as a mom."* → guidance must be **non-judgmental, non-punitive, and evidence-based.**
- **Digital divide / socioeconomic access.** Tech *"helps families access educational resources… but can widen the gap."* → this shaped our anti-bias design. *Scoped out of v1 as future work (honest boundaries):* disability supports, racial/ethnic socialization, and bullying / online-safety.

> **The single biggest pain point, in her words, was the need for *balance*** — for technology to *strengthen* family relationships instead of *replacing* real connection.

**The Translation Challenge (human need → technical requirement):**

| Partner's human need | Translated requirement | Where it lives in the build |
|---|---|---|
| *"a healthy balance… tech shouldn't replace real connection"* | Give the family's time **back**, not capture it | The whole product stance: no feed / scroll / streaks / notifications; one step per turn; screen-free activities + a *tell-it-together* bedtime story; a required "put the screen away" cue on every answer (`screenNote`, `coach.ts`) |
| *"protecting children online," "mental health"* | Don't be another **surveillance / data-harvesting** tool | COPPA-minded `ChildProfile` (first name + age **band** only; no DOB/photo/location); supports the adult, never tracks the child; pediatrician referral on red flags |
| *"I don't spank… norms have changed"* | **Non-judgmental, non-punitive, evidence-based** guidance | Anti-bias + evidence-not-authority guardrails in the Coach prompt |
| *"educational resources… but can widen the gap"* | **Anti-bias:** prefer free / low-cost options to bridge the gap | Explicit prompt rule; advice grounded in evidence, not assumed resources |
| *advice should be trustworthy, not opinion* | **Evidence-grounded** answers with **non-fabricatable** citations | RAG over curated evidence + live Europe PMC search; citations validated against retrieved sources |

**Consulting takeaway:** an IT consultant is a **translator, not a coder-for-hire.** The real work was listening until the partner's own words ("balance," "real connection") became the spec — and being honest about what a v1 could and couldn't cover.

---

## 3. Technical Execution & AI Collaboration

| Application Component | Technology / Cloud Service | Role in the Prototype |
|---|---|---|
| **Frontend UI** | Next.js 16 (App Router) + React 19 + TypeScript, Tailwind CSS v4 | The immersive client: onboarding chat, the "one next step" Coach, Paste-&-Personalize, voice, the Weekly Drop, and the Memory page |
| **Backend Logic** | Next.js Route Handlers on Node.js 20; agentic Coach tool-loop; hand-built OAuth 2.0 | Bounded tool-loop (≤6 steps), provider-agnostic LLM client, memory scoped by `familyId`, co-parent invites |
| **Database & Storage** | Google Cloud Firestore (prod, via ADC); local JSON in dev — one shared interface | Multi-tenant per-family memory (profile + learnings + episodes) + the Weekly-Drop archive; every read/write **hard-scoped by `familyId`** |
| **AI / LLM Integration** | Gemini `gemini-3.5-flash` + OpenAI `gpt-4o-mini` behind one client with health-check + **automatic fallback**; OpenAI `gpt-realtime-2` over WebRTC (voice); OpenAI `gpt-image-2` + Gemini image fallback (Weekly-Drop infographics); Gemini + Google Search (live grounding); Europe PMC (studies) | Powers the Coach, onboarding, Paste-&-Personalize (vision), voice personas, the synthesized Weekly Drop + its artwork, and evidence grounding with validated citations |
| **Hosting & Deployment** | Google Cloud Run (Docker: Node 20 + ffmpeg + yt-dlp) + Cloud Build, from source | Auto-scaling serverless container; server-minted **ephemeral voice tokens**; ADC so **no API keys in code** |

**More than a "ChatGPT wrapper" — three load-bearing ideas:** (1) **persistent, per-family memory** the Coach reads before and writes after every answer, isolated by `familyId`; (2) an **agentic tool-loop** (≤6 rounds calling real functions), with every step shown in a "Behind the scenes" trajectory; (3) **evidence, not authority** — grounded in curated + live peer-reviewed research, with citations validated against retrieved sources so the model can't invent one.

**LLM co-pilot reflection.** We used three AI tools in distinct roles: **Claude** — the thinking partner (interrogating insights, wireframing flows, naming principles, shaping the data contract and architecture); **Grok** — surprisingly, the source of our best *feature* ideas (the "designed to be used less" stance, the tell-it-together story, the paste-a-reel-and-check-it flow), which we then pressure-tested; **Codex** — the coding agent that scaffolded files and made edits once a direction was set. Best pattern: **diverge with Grok, converge with Claude, implement with Codex**, plus contract-first prompting (define the TypeScript interfaces first).

**Technical roadblocks (AI code that failed, and the fix):** (1) Gemini 400'd on our tool schemas because it rejects JSON-Schema keys (`additionalProperties`) that OpenAI *requires* → a recursive key-stripper at the Gemini boundary. (2) The two providers use different wire formats → dedicated per-provider mappers behind one shape. (3) On a phone the voice agent interrupted *itself* (speaker echo tripping the mic's voice detector) → near-field noise reduction + a higher detection threshold. (4) The model sometimes skipped steps or invented citations → server-side safety nets (auto-logging, central citation tracking, tolerant JSON parsing). The throughline: we never trusted AI code by default — typed contracts, unit tests, and debugging over blind acceptance.

---

## 4. Ethical AI, Privacy & Bias Mitigation

**Algorithmic bias** is a hard guardrail written into the Coach prompt: no stereotyping by class / race / gender; when resources look limited, **prefer free or low-cost options** (the opposite of pushing expensive enrichment on a low-income family); **family-structure-neutral** (no two-parent or gender defaults); and **evidence over authority**, so advice comes from retrieved research rather than the model's cultural assumptions.

**Data privacy & guardrails:** COPPA-minded **data minimization** (first name + age band only — no DOB / photo / location; supports the parent, never monitors the child); **hard multi-tenant isolation** by a server-derived `familyId`; **consent-gated** co-parent sharing plus full transparency with **one-tap erase**; and **no secrets in the client** (ephemeral voice tokens; Firestore via ADC).

**At production scale (HIPAA-/GDPR-inspired):** parental-consent records and age-gating; encryption in transit + at rest with key management; a retention / deletion policy (we already support right-to-erasure) and Data Subject Access Requests; Data Processing Agreements with subprocessors (OpenAI, Google); PII review of stored "learnings" (the schema already tags `sensitivity`); and a clinical-safety review with clear "not medical advice — see your pediatrician" boundaries (already in the prompt).

---

## 5. Lessons Learned & Portfolio Value

**What went well.** The prototype is **genuinely agentic and grounded, not a thin wrapper** — a shared typed contract, a bounded tool-loop with an observable trajectory, isolated multi-tenant memory, dual-LLM fallback, and live voice over WebRTC. Best of all, the partner's insight about **balance** became the product's DNA: Compass answers, points the parent back to the child, and gets out of the way.

**What we'd do better (extra two weeks + budget):** vector / semantic evidence retrieval and an evaluation harness scoring advice quality and bias; Firestore security rules + auth hardening; a full accessibility pass; and taking on one scoped-out theme (most likely **bullying / online-safety**). On the consulting side: a second interview to *validate* the prototype with the partner, across more diverse families.

**Portfolio impact.** This project shows the core skill of a cloud professional: **bridging complex code and real human needs** — sitting with a domain expert, extracting a messy human problem, and translating it (typed contract, guardrails, agentic grounded AI) into a multi-tenant app on managed cloud (Cloud Run, Firestore, OAuth). It pairs technical depth with ethical engineering (COPPA minimization, anti-bias prompting, privacy-by-design).

---

> **Three principles:** *evidence, not authority · technology with intention · privacy by design.*
