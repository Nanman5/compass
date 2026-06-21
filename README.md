# Compass

**A parenting companion for the digital age.** Compass gives parents of children aged 2–8
personalized, evidence-grounded guidance — one concrete next step at a time — and remembers
each family so its advice gets sharper the more you use it.

🌐 **Live:** https://compass-544537517865.us-central1.run.app

---

## What it does

Compass is built around a single idea: *less doom-scrolling for advice, more one small thing
to try right now — fit to your child, checked against real research.*

| Feature | What it does |
| --- | --- |
| **Onboarding** | A warm, conversational chat (text **or** live voice) that gets to know your child — name, age, temperament, interests, what you're working on — without feeling like a form. |
| **Help me now** | An in-the-moment voice coach for hard moments. It co-regulates *you* first, then offers one tiny thing to try, and quietly logs the moment. |
| **Your one next step** | Describe a struggle → an agentic coach returns a single concrete action, grounded in trusted guidance, with its reasoning visible. |
| **Paste & personalize** | Drop in a reel, an article link, or a screenshot of advice. Compass reads it (text, link, or image via vision), checks it against trusted evidence, and turns it into one step that fits your child — or tells you honestly when it isn't real parenting advice. |
| **This week's drop** | A study, a tip, and an activity tailored to your child right now. |
| **Win logger** | A gentle "how did it go?" after you try a step, so guidance grows around what actually works. |
| **What Compass remembers** | Full transparency: everything stored for your family, in plain language, with one tap to add context or erase it all. |

Every surface shares one principle — **technology with intention**: each piece of guidance
includes a "when to put the screen away" note.

---

## How it works

### Memory (the soul of the product)
Compass keeps a per-family memory — the child's profile, durable *learnings*, and *episodes*
(situation → suggestion → outcome). Before every answer, the coach loads this memory; after
each interaction it writes back. Over time the guidance personalizes to your child. The store
is multi-tenant and **hard-scoped by `familyId`** — one family can never reach another's data.

- **Production:** Google Cloud **Firestore** (Native mode), via the server SDK + Application
  Default Credentials (no keys in code).
- **Dev / tests:** a local JSON store.
- Both implement the same `MemoryStore` interface; the backend is chosen by `MEMORY_BACKEND`.

### Provider-agnostic LLM
A small client wraps **Google Gemini** and **OpenAI** behind one interface, with health-check
fallback and per-call model overrides. The agentic coach drives a tool loop
(read profile → retrieve evidence → find studies → record learning → log interaction).

### Evidence, not authority
The coach and Paste flow check advice against a **curated set of 10 clinical studies** plus a
quality-filtered **live search of Europe PMC** (peer-reviewed only). Pasted/found content is
always treated as evidence to weigh — never as instructions — and citations are validated
against sources actually retrieved, so the model can't fabricate a reference.

### Voice
Onboarding and "Help me now" run over the **OpenAI Realtime API** (WebRTC). Ephemeral client
secrets are minted server-side so the API key never reaches the browser; the agents call tools
(save profile / log moment) over the data channel.

### Auth
"Continue with Google" uses a standard OAuth 2.0 Authorization Code flow (no third-party auth
library), with an HMAC-signed, httpOnly session cookie. Guests can use the whole app without
signing in.

---

## Tech stack

- **Next.js 16** (App Router, Turbopack) · **React 19** · **TypeScript**
- **Tailwind CSS v4** (custom cream / teal / coral design system; Fraunces + Nunito Sans)
- **Google Gemini** + **OpenAI** (chat, vision, Realtime voice)
- **Google Cloud Firestore** (persistence) · **Cloud Run** (hosting) · **Cloud Build**
- **Europe PMC** REST API (live research)
- **Vitest** (29 tests)

---

## Getting started

```bash
npm install
npm run dev          # http://localhost:3000
```

Create `.env.local` (not committed):

```bash
# LLM providers
GEMINI_API_KEY=...
OPENAI_API_KEY=...

# Google OAuth (a dedicated, non-Firebase GCP project)
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
APP_BASE_URL=http://localhost:3000
AUTH_SECRET=...               # any long random string

# Memory backend: omit for the local JSON store; set to use Firestore
# MEMORY_BACKEND=firestore
# FIRESTORE_PROJECT_ID=your-gcp-project
```

```bash
npm test             # run the test suite (Vitest)
npx tsc --noEmit     # typecheck
npm run build        # production build
```

> **Note:** this project tracks a current release of Next.js whose conventions differ from
> older versions — see `AGENTS.md`.

---

## Project structure

```
src/
  app/
    page.tsx               Landing page
    app/                   The product
      page.tsx             Onboarding → dashboard (home)
      coach/  paste/  weekly/  wins/  memory/  help/
    api/
      onboarding/  coach/  personalize/  weekly/  memory/  learnings/
      episodes/  research/  evidence/  profile/
      realtime/session/    Mints ephemeral Realtime voice tokens
      auth/{google,callback/google,me,signout}/
  lib/
    memory.ts              MemoryStore interface + local JSON store
    memory.firestore.ts    Firestore-backed store (production)
    llm.ts                 Provider-agnostic Gemini/OpenAI client
    coach.ts               Agentic coach tool loop
    onboarding.ts          Goal-driven onboarding prompt chain
    voice.ts  helpnow.ts   Realtime voice personas + tools
    ingest.ts              Link / image / video → advice text
    research.ts            Europe PMC live search
    studies.ts             Curated clinical studies
    evidence.ts            Evidence retrieval
    auth.ts                Google OAuth + session cookie
  components/              UI (onboarding chat, dashboard, feature panels, voice)
```

---

## Deployment

Deployed to **Google Cloud Run** from source via Cloud Build:

```bash
gcloud run deploy compass --source . --region us-central1
```

Runtime configuration (API keys, OAuth, `MEMORY_BACKEND=firestore`) is supplied as Cloud Run
environment variables; the service account is granted `roles/datastore.user` for Firestore.

---

## Privacy by design

- **COPPA-minded:** first name or nickname only, age *band* not birth date; never asks for
  photos, address, school, or precise location.
- **Anti-surveillance:** Compass supports the *parent* — it never monitors or profiles the child.
- **Your data, your call:** every family can see exactly what's stored and erase it in one tap.
