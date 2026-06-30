# 🧭 Compass — Demo Prep Kit

> Kit para presentar la demo de Compass en clase (en inglés). Estúdialo la noche antes
> y úsalo como chuleta. Lo que está en **inglés** son las frases que vas a *decir*;
> lo que está en español son tus notas/guía.

---

## 1. El pitch (memorízalo — 30 segundos, en inglés)

> "**Compass is a parenting companion for the digital age.** It helps parents of kids aged 2 to 8
> with one problem: instead of *doom-scrolling* for advice, you get **one small, concrete thing to
> try right now** — personalized to your child and checked against real research. And it
> **remembers your family**, so the advice gets sharper the more you use it."

Frase de cierre potente:
> *"Every piece of advice comes with a 'when to put the screen away' note — that's our principle:
> **technology with intention.**"*

---

## 2. El stack (qué decir y por qué)

| Capa | Tecnología | Cómo lo dices en inglés |
|---|---|---|
| **Framework** | Next.js 16 (App Router) + React 19 + TypeScript | "Full-stack React framework, server and client in one." |
| **Styling** | Tailwind CSS v4 (custom design system) | "Utility-first CSS — custom cream/teal palette, Fraunces + Nunito Sans fonts." |
| **AI / LLM** | Google **Gemini** + **OpenAI**, behind one interface | "Provider-agnostic — I can swap models, with automatic fallback." |
| **Voice** | OpenAI **Realtime API** over **WebRTC** | "Live voice conversation, low latency." |
| **Database** | Google Cloud **Firestore** (Native mode) | "Multi-tenant NoSQL store, scoped per family." |
| **Research** | **Europe PMC** REST API | "Live search of peer-reviewed medical literature." |
| **Auth** | Standard **OAuth 2.0** (Google) + signed cookie | "No third-party auth library — I built the OAuth flow myself." |
| **Hosting** | Google Cloud **Run** + **Cloud Build** | "Deployed from source, containerized, auto-scaling." |
| **Testing** | Vitest (29 tests) | "Unit-tested core logic." |

**Si solo recuerdas una línea:**
> *"Next.js 16 and React 19 on the front, two LLM providers behind one interface, Firestore for
> memory, deployed on Google Cloud Run."*

---

## 3. Cómo funciona por dentro (la parte que impresiona)

Tres ideas hacen que esto sea **más que un wrapper de ChatGPT**. Si entiendes estas tres, dominas el Q&A.

### a) Memory — "the soul of the product"
Cada familia tiene una memoria persistente: el perfil del niño + *learnings* (hechos aprendidos) +
*episodes* (situación → sugerencia → resultado). **Antes** de cada respuesta el coach carga esa
memoria; **después** escribe lo nuevo. Está *hard-scoped by `familyId`* — una familia nunca puede
ver los datos de otra.

> "It's a typed, per-family memory. The coach reads it before every answer and writes back after —
> so guidance personalizes over time."

### b) The agentic Coach — a tool-loop, not a single call
El coach **no** es una sola llamada al LLM. Es un *bounded tool-loop*: el modelo decide qué
herramientas llamar, hasta 6 pasos. Tiene herramientas reales:
- `get_family_profile` — lee la memoria de esa familia
- `retrieve_evidence` — RAG sobre evidencia curada
- `find_studies` — búsqueda en vivo de estudios peer-reviewed
- `record_learning` / `log_interaction` — escribe en memoria

Cada paso se graba en un **trajectory** que se muestra en un panel "Behind the scenes" → **prueba
visible** de que es agéntico y está fundamentado.

> "The coach runs a tool-loop: it reads the family profile, retrieves evidence, searches studies,
> then commits a single next step. Every step is recorded so you can see the reasoning."

### c) Evidence, not authority
La IA chequea los consejos contra **estudios clínicos curados** + búsqueda en vivo de Europe PMC
(solo peer-reviewed). El contenido pegado/encontrado se trata **como evidencia a ponderar, nunca
como órdenes**, y las citas se **validan contra las fuentes que sí se recuperaron** — el modelo no
puede inventar una referencia.

> "The model can't fabricate a citation — references are validated against sources actually retrieved."

---

## 4. Vocabulario clave (inglés + qué significa + cómo defenderlo)

Estas son las palabras que debes pronunciar con soltura. Te las van a preguntar.

| Término (inglés) | Qué significa / cómo lo explicas |
|---|---|
| **Agentic** *(a-JEN-tik)* | "The AI decides which tools to call and loops until it has an answer — it acts, not just responds." |
| **Tool-loop** | "The model calls real functions, gets results, and calls again — bounded to 6 steps and a cost ceiling." |
| **RAG** (Retrieval-Augmented Generation) | "Before answering, it retrieves real evidence and grounds the answer in it." |
| **Grounded / grounding** | "The advice is backed by retrieved sources, not the model's opinion." |
| **Multi-tenant** | "Many families share one database, but each is isolated — scoped by familyId." |
| **Provider-agnostic** | "One interface wraps both Gemini and OpenAI — I can swap or fall back." |
| **Ephemeral token** | "For voice, the API key never reaches the browser — the server mints a short-lived secret." |
| **COPPA-minded** | "Children's privacy law — I only store a first name and an age *band*, never a birth date or photo." |
| **Data minimization** | "I collect the least data possible to do the job." |
| **OAuth 2.0 Authorization Code flow** | "Standard 'Sign in with Google' — I built it without a library." |
| **Semantic vs. episodic memory** | "Semantic = durable facts (the profile). Episodic = events (situation → suggestion → outcome)." |
| **Peer-reviewed** | "Research checked by other scientists before publishing — the only studies I trust." |

---

## 5. El flujo del demo (paso a paso — qué clickear y qué decir)

Sigue **este orden**: cuenta una historia, de problema a magia a confianza.

**0. Antes de empezar** — ten la app abierta en `localhost:3000` o el link live. Guest mode funciona
sin login (menciónalo: *"guests can use the whole app — no sign-up wall"*).

1. **Landing page** → *"This is the problem: parents drowning in conflicting advice online."*

2. **Onboarding (chat o voz)** → *"It gets to know my child through a warm conversation — name,
   age band, temperament, what we're working on. No forms."* Si te animas, usa **voz** aquí: es el "wow".

3. **Coach — "Your one next step"** *(EL CORAZÓN — dedícale más tiempo)*
   Escribe algo real: *"bedtime is a battle"*. → Sale **un solo paso concreto**.
   **Abre el panel "Behind the scenes"** → *"Here's the proof it's agentic: it read my profile,
   retrieved evidence, found studies, then committed one step — with the screen-away note."*

4. **Paste & personalize** → pega un link de un reel o un screenshot. → *"It reads text, links, even
   images via vision, checks them against evidence, and turns them into one step that fits my child —
   or tells me honestly when it's not real parenting advice."*

5. **Help me now (voz)** → *"An in-the-moment voice coach. It calms the parent first, then gives one
   tiny thing to try."* (Demo corto, suena increíble.)

6. **What Compass remembers (Memory)** → *"Full transparency. Everything stored, in plain language.
   One tap to add context or erase it all."* → Cierra con privacy.

7. **Cierre** → *"Three principles: **evidence, not authority** · **technology with intention** ·
   **privacy by design.**"*

> ⚠️ **Plan B:** si el internet falla o el voice no conecta, ten **screenshots** de cada paso listos.
> La parte de voz depende de red — no la dejes como única demostración.

---

## 6. Preguntas que te van a hacer (Q&A)

- **"Isn't this just a ChatGPT wrapper?"**
  → *"No. Three things: it's an **agentic tool-loop** with real functions, it's **grounded in
  peer-reviewed evidence** with validated citations, and it has **persistent per-family memory**
  that personalizes over time."*

- **"How do you protect children's privacy?"**
  → *"COPPA-minded: first name only, age band not birth date, never a photo or location. And it
  supports the *parent* — it never monitors the child. Data is hard-scoped by familyId, and any
  family can erase everything in one tap."*

- **"What if the AI gives wrong advice?"**
  → *"It weighs evidence instead of asserting authority, it refuses content that isn't real
  parenting advice, and it can't fabricate citations — they're validated against retrieved sources."*

- **"Why two LLM providers?"**
  → *"Resilience and flexibility. One interface, a health-check, and automatic fallback if one
  provider fails."*

- **"Where's the data stored?"**
  → *"Google Cloud Firestore in production, using Application Default Credentials — no API keys in
  the code. A local JSON store for dev."*

- **"How does the live voice work?"**
  → *"OpenAI's Realtime API over WebRTC. The server mints an ephemeral token so the API key never
  reaches the browser."*

---

## 7. Tips finales

- **Practica en voz alta una vez** las palabras difíciles: *agentic, ephemeral, multi-tenant,
  peer-reviewed, COPPA, Firestore, Europe PMC.*
- **Lidera con el problema**, no con el stack. La gente recuerda *"one small thing to try right now"*,
  no *"Next.js 16"*.
- Si te quedas en blanco, vuelve siempre a los **tres principios**: evidence not authority ·
  technology with intention · privacy by design.
- Ten el **link live** y **screenshots** como respaldo.
- Tu frase más fuerte para terminar:
  > *"It's not about more screen time or less — it's about technology with intention."*
