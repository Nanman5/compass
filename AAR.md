# After-Action Report — Compass

**Project:** Compass — a parenting companion for the digital age
**Course deliverable:** "AI & Cloud-Powered Family Support Prototypes" — Dr. Walker's Family Life Class (2026)
**Team:** Hernan L. (IT) · Shondalle C. · Katlyn V. (Family Life)
**Live prototype:** https://guideling.xyz · **Presentation hub:** https://nanman5.github.io/compass-hub/ · **Source:** https://github.com/Nanman5/compass

---

## 1. Executive Summary & Project Overview

Our Family Life partner, a mother in the class, described a very specific tension: parents of young children are drowning in conflicting advice online, while the phone delivering that advice pulls their attention away from the child in front of them. We built Compass, a web app on Google Cloud where a parent describes a real moment ("bedtime is a battle") and an AI coach — grounded in peer-reviewed research and a persistent memory of that specific child — hands back one small step to try today. Unlike the apps that created the problem, Compass is deliberately designed to be used *less*: no feed, no streaks, and it only brings up screens when screens are actually part of the situation. The proof-of-concept is live, working, and met her core need — she asked for "a healthy balance, so technology strengthens family relationships instead of replacing real connection," and that sentence became the product's operating principle.

## 2. Consulting & Needs Assessment (The "Listen" Phase)

**Key insights discovered.** We interviewed our partner with a prepared guide but let her language lead. Three textbook themes surfaced as real pain points:

- **Technology's double-edged role in family life** — her biggest one. She said tech and social media "now play a major role in family life" and her worries were "mental health, communication, and protecting children online." The same tools that help parents also distract them and bury them in contradictory advice.
- **Generational change in discipline.** "I don't spank my kids… that's probably what's changed for me as a mom." Whatever we built had to be non-judgmental and evidence-based, never punitive.
- **Socioeconomic barriers / the digital divide.** She noted tech "helps families access educational resources… but can widen the gap." That insight ended up written directly into our AI's rules (see §4).

We were also honest about scope: disability supports, racial/ethnic socialization, and bullying/online safety came up and matter, but we documented them as future work rather than pretending one week could cover them.

**The translation challenge.** The hard part wasn't the code — it was turning "I want balance" into requirements. Our translations: *"tech shouldn't replace real connection"* became design constraints (one step per answer, no engagement mechanics, suggestions that are mostly screen-free); *"protecting children online"* became data minimization (we store a first name and an age band, 0–8 — never a birth date, photo, or location — and the app supports the parent rather than monitoring the child); *"advice I can trust"* became a retrieval system where every answer cites real studies, and the server rejects any citation the model didn't actually retrieve — so the AI cannot invent a source.

**Consulting takeaway.** An IT consultant is a translator, not a coder-for-hire. The most valuable hour of the project was the one where I wasn't building anything — just listening until her own words became the spec. The second lesson was honesty about boundaries: saying "that's out of scope for v1, and here's why" built more trust than promising everything.

## 3. Technical Execution & AI Collaboration

| Application Component | Specific Technology / Cloud Service Used | Exact Role in Your Prototype |
|---|---|---|
| **Frontend UI** | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4 | The client: onboarding chat, the coach (with the agent's actions streamed live to the screen), Paste-&-Personalize, voice surfaces, Weekly Drop, and the memory/transparency page |
| **Backend Logic** | Next.js route handlers on Node.js 20; a bounded agent tool-loop; hand-built Google OAuth 2.0 | Runs the coach agent (≤6 tool rounds: read profile → retrieve evidence → search studies → write memory), enforces per-family authorization on every route, streams results |
| **Database & Storage** | Google Cloud Firestore (production), local JSON store (dev) behind one shared interface | Persistent per-family memory: child profile, learned facts, and past interactions — every read/write hard-scoped by `familyId` so one family can never reach another's data |
| **AI/LLM Integration** | Gemini 3.5 Flash (primary) + OpenAI GPT-4o-mini (automatic fallback) behind one client; OpenAI Realtime + Gemini Live (voice, with fallback); gpt-image-2 (weekly infographics); Europe PMC API (live peer-reviewed research) | Powers the coach, onboarding extraction, screenshot/video reading, three voice personas, and evidence grounding with server-validated citations |
| **Hosting & Deployment** | Google Cloud Run + Cloud Build (Docker), deployed from source | Auto-scaling serverless container; API keys live only in Cloud Run env vars and short-lived voice tokens are minted server-side, so no secret ever reaches the browser |

**LLM co-pilot reflection.** I used AI in two distinct roles and learned to keep them separate. For *divergence* (feature ideas, wireframe directions), Grok and Gemini were genuinely useful — the "designed to be used less" stance and the paste-a-reel-and-fact-check-it flow both came out of those sessions. For *implementation*, I worked with an AI coding agent, and the prompts that worked best were contract-first: I'd define the TypeScript interfaces and the rules ("memory is scoped per family; every write takes a familyId") before asking for any code, so the AI filled in a shape I controlled instead of improvising one.

**Technical roadblocks.** The AI absolutely introduced bugs, and debugging them was most of the real engineering:

- **Rigid logic the AI wrote:** the coach's original prompt forced it to produce "one next step" for *any* input — so typing "hey" made it fabricate advice out of the child's profile, which felt broken and a little creepy. The fix was teaching the system to classify the message first and just answer like a person when there's nothing to coach, and to only mention screens when screens are actually involved (the early version bolted a "put your phone away" note onto every single answer, which read as preachy).
- **Cross-provider hallucinated assumptions:** AI-generated tool schemas worked on OpenAI but made Gemini return 400 errors, because Gemini rejects JSON-Schema keys OpenAI requires; and Gemini 3 refused replayed conversation history until we round-tripped its `thoughtSignature` field. Both took reading real error logs, not re-prompting.
- **A physical-world bug no LLM predicted:** on a phone, the voice agent kept interrupting *itself* — speaker audio leaked into the mic and tripped the voice detector. Fixed with echo cancellation plus tuned detection thresholds.
- **Security gaps AI code doesn't volunteer:** an audit found most API routes trusted whatever family ID the client sent. We added an authorization layer to every route and tests that prove one family cannot read or write another's memory.

The pattern across all of them: never trust generated code by default. Typed contracts, 50 unit tests, and reading actual logs caught what re-prompting never would have.

## 4. Ethical AI, Privacy, & Bias Mitigation

**Algorithmic bias.** Our partner's "widen the gap" insight is written into the coach's system prompt as a hard rule: never assume resources, family structure, or interests from demographics, and when context suggests limited means, prefer free or low-cost options (the library, the park, a cardboard box) — the exact opposite of defaulting to paid enrichment. The prompt is also family-structure-neutral (no two-parent or gender-role assumptions), and because answers must come from retrieved research rather than the model's instincts, there's less room for its cultural defaults to leak in.

**Data privacy & guardrails.** The architecture practices data minimization by design: first name or nickname and an age *band* only — no birth date, photos, or location — and Compass supports the parent; it never monitors the child (COPPA-minded). Every route verifies the caller may access the requested family; memory is isolated per family in Firestore; pasted links are screened so the server can't be tricked into reaching internal systems; sign-in tokens are cryptographically verified; and the memory page gives parents full transparency with one-tap erasure. At production scale we'd add, GDPR/HIPAA-style: recorded parental consent, encryption-at-rest key management, a formal retention policy (right-to-erasure already works), data-processing agreements with OpenAI and Google, and a clinical review of the advice boundary (the prompt already routes anything medical to "see your pediatrician").

## 5. Lessons Learned & Portfolio Value

**What went well.** I'm proudest that the working prototype is genuinely agentic rather than a thin ChatGPT wrapper — you can watch the agent read the child's profile, search real studies, and write back to memory in real time on screen — and that our partner's one sentence about balance survived all the way into the code as testable behavior: the app answers, points you back at your child, and gets out of the way.

**What I would do better next time.** With two more weeks and budget: semantic (vector) retrieval over a much larger evidence library, plus an evaluation harness that scores advice quality and bias automatically instead of by eyeball; a validation interview — putting the working app in our partner's hands and measuring against her needs, which we ran out of time for; and taking on one scoped-out theme properly, most likely online safety. Consulting-wise, I'd interview two or three families instead of one, because one voice — however good — is one perspective.

**Portfolio impact.** This project is my proof that I can carry a problem across the whole gap: sit with a non-technical domain expert, translate a human need into typed requirements, build a multi-tenant cloud application around an AI agent (Cloud Run, Firestore, OAuth, dual-provider LLM with fallback), harden it (authorization on every route, SSRF screening, verified tokens), and make the ethics — bias rules, data minimization, transparency — engineering features rather than a slide. That bridge between complex code and human needs is exactly the job.

---

*Evidence, not authority · technology with intention · privacy by design.*
