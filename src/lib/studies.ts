/**
 * Compass — curated clinical studies library (the agent's high-trust research base).
 *
 * Hand-vetted RCTs, longitudinal cohorts, psychometric scales and usability studies that
 * ground Compass's product and guidance decisions. This is the FAST, offline, always-trusted
 * layer of research; for anything beyond it the agent falls back to a live, quality-filtered
 * search (see `@/lib/research`, Europe PMC). Distinct from `@/lib/evidence`, which holds the
 * practical in-the-moment parenting tips the Coach turns into a next step.
 *
 * Keyword retrieval (tags weigh most), mirroring the evidence index — explainable, no network.
 */

export interface Study {
  id: string;
  title: string;
  authors: string;
  design: string;
  /** Key results, with effect sizes / coefficients where reported. */
  findings: string;
  /** One-line implication for Compass's product or guidance. */
  takeaway: string;
  tags: string[];
}

export const STUDIES: Study[] = [
  {
    id: "DB_001_OLIIKI_RCT",
    title: "Oliiki app and parental self-efficacy",
    authors: "Outhwaite, L. A. — UCL (IOE, CEPEO)",
    design: "Pilot parallel RCT, 1:1, 4-week intervention. 88→79 parents of infants 0–6 months (10.2% attrition).",
    findings:
      "Treatment used the Oliiki app (1,026 age-personalized daily activities across 8 early-brain domains); active control got 3 unscaffolded activities/week by email. Primary outcome PMPSE (parental self-efficacy, α=0.91). Controlling for baseline, treatment had significantly higher self-efficacy at post-test; higher self-reported app use correlated with larger gains.",
    takeaway:
      "Personalized daily activities WITH scientific scaffolding raise parental self-efficacy; dose matters. Limitation: WEIRD/high-SES sample (93% cohabiting, 87% higher-ed, 85% White British) — weak external validity.",
    tags: ["rct", "self-efficacy", "app", "infant", "0-6 months", "activities", "personalization", "scaffolding", "oliiki"],
  },
  {
    id: "DB_002_AFINI_CLUSTER_RCT",
    title: "Afini chatbot vs home visits in rural Peru",
    authors: "Cluster-RCT, Cajamarca/San Marcos/Cajabamba (Andean Peru)",
    design: "3-arm cluster-RCT. 2,461 caregiver–child dyads (infants 3–9 mo), 164 rural clusters: control / Cuna Más home visits / Afini chatbot.",
    findings:
      "Outcome: child global development at 2.5y (GSED long form). Both intervention arms beat control: home visits d=0.17, Afini chatbot d=0.11. The chatbot (low-bandwidth messaging, free data tiers) achieved this at ~1/15 the cost per dyad of the in-person program. Validated a Nurturing-Care Beliefs & Behaviors scale (beliefs α=0.84, stimulation α=0.82).",
    takeaway:
      "A low-bandwidth conversational chatbot nearly matches in-person home visits at 1/15 the cost and shifts caregiver beliefs — strong case for lightweight, scalable, low-resource design.",
    tags: ["rct", "cluster-rct", "chatbot", "low-bandwidth", "scalability", "cost-effective", "rural", "infant", "child-development", "beliefs", "afini", "equity"],
  },
  {
    id: "DB_003_PARENTBOT_NUS_RCT",
    title: "Parentbot-PDA: structured content beats social/gamified features",
    authors: "Chua, Choolani, Shorey — National University of Singapore",
    design: "2-arm parallel RCT, 118 couples (236 participants), perinatal (3rd trimester → 1 month postpartum).",
    findings:
      "App had chatbot, structured education, mindfulness videos, peer forums, gratitude diaries. Parental self-efficacy higher in treatment (MD=1.22, d=0.14). Crucially, after covariate adjustment ONLY active reading of structured educational content predicted clinical gains: anxiety β=-0.48, parent–child bonding β=-0.10 (PIBQ), perceived support β=0.31, satisfaction β=0.57. Forums, gratitude templates and poster activities showed NULL effects.",
    takeaway:
      "Invest in high-quality STRUCTURED educational content; community forums, gratitude journals and gamification had no clinical effect. Don't dilute the product with social/gamified features.",
    tags: ["rct", "self-efficacy", "structured-content", "anxiety", "bonding", "perinatal", "gamification", "forums", "design", "parentbot"],
  },
  {
    id: "DB_004_TECHNOFERENCE_LONGITUDINAL",
    title: "Technoference: the transactional parent↔child loop",
    authors: "McDaniel, B. T. & Radesky, J. S. — Illinois State / U. Michigan",
    design: "Prospective longitudinal cohort, 4 waves (baseline, 1, 3, 6 mo). 170 two-caregiver families (children ~3.04y).",
    findings:
      "Measured technoference (phone/tablet/TV interruptions), child behavior (CBCL internalizing/externalizing), parent stress. Confirmed bidirectional transactional loops: problematic parent phone use → more technoference → child acting-out (tantrums, hyperactivity) → higher parenting stress → compensatory passive digital withdrawal. Introduced the DISRUPT scale (4 items: cognitive salience + loss of control of phone use around kids).",
    takeaway:
      "Technoference is a self-amplifying loop — profile the PARENT's distraction (DISRUPT), and target parent device habits + screen-free zones, not just the child.",
    tags: ["longitudinal", "technoference", "disrupt", "parent-distraction", "behavior", "tantrums", "stress", "cbcl", "transactional"],
  },
  {
    id: "DB_005_EPISTEMIC_TRUST_AGENCY",
    title: "Children's epistemic trust in AI/robots",
    authors: "Brink, K. A. & Wellman, H. M. — U. Michigan",
    design: "Lab experiments, 104 three-year-olds; selective word-learning from social robots vs inanimate machines.",
    findings:
      "3-year-olds apply reliability monitoring to technology just like to humans: they selectively trust the previously-accurate social robot over an inaccurate one (p<.01), and this is amplified when they attribute psychological agency (mind/feelings) to it. No selective learning from inanimate machines lacking social-contingency cues.",
    takeaway:
      "Kids over-trust agentic, socially-expressive AI — so Compass must model epistemic humility: cite sources, express uncertainty, never over-assert, and escalate red flags to a pediatrician.",
    tags: ["experimental", "epistemic-trust", "over-trust", "ai", "voice-assistant", "agency", "safety", "preschool", "hallucination"],
  },
  {
    id: "DB_006_USEIT_MHEALTH_RCT",
    title: "UseIt! mHealth (PMT+CBT) for disruptive behavior",
    authors: "UseIt! mHealth trial",
    design: "3-arm parallel RCT, 324 parents (coach app / self-directed app / mindfulness control), 6-month follow-up.",
    findings:
      "Platform combined Parent Management Training + CBT with problem-solving tools and real-time behavior diaries. The mHealth arms significantly increased parenting knowledge and consistent-limit behaviors and produced a robust reduction in child disruptive symptoms vs active control. Real-time digital logging mitigated retrospective recall bias.",
    takeaway:
      "PMT/CBT delivered via app + REAL-TIME logging reduces disruptive behavior; in-the-moment capture beats end-of-week recall.",
    tags: ["rct", "pmt", "cbt", "disruptive-behavior", "limits", "real-time-logging", "win-logger", "mhealth", "useit"],
  },
  {
    id: "DB_007_INCREDIBLE_YEARS_RCT",
    title: "Incredible Years: coercion reduction predicts long-term outcomes",
    authors: "Trillingsgaard, Webster-Stratton — U. Washington / Aarhus (Spain & Denmark)",
    design: "Clinical replication RCT + long-term cohort follow-up (mean 10.25y). 66/78 families followed up.",
    findings:
      "Post-treatment: large shifts clinical→normal on stress (48.1% mothers, 61.5% fathers); ≥30% reduction in coercion/hostile phrases (61% mothers, 70.2% fathers); +30% praise (72.7% mothers, 63.2% fathers); 66% of children reduced defiance ≥30%. At 8–12y follow-up, the key predictor preventing adolescent delinquency was LOW post-treatment coercive mother–child interaction.",
    takeaway:
      "Reducing coercive interactions (more praise, fewer hostile commands) is the durable lever — aligns directly with autonomy-supportive (SDT) guidance over controlling language.",
    tags: ["rct", "long-term", "coercion", "praise", "autonomy-support", "sdt", "discipline", "delinquency", "incredible-years"],
  },
  {
    id: "DB_008_DOLPHIN_HYBRID",
    title: "DOLPHIN: multilingual image-a-day support (India)",
    authors: "DOLPHIN program (India)",
    design: "Hybrid inductive-confirmative design (lit review + focus groups + cross-translation). 600+ parents accessed the platform.",
    findings:
      "Attachment- and neuroscience-based daily activities for the first 2 years, delivered as 'one instructive interactive image per day for 2 years', translated and back-translation-validated into 3 regional Indian languages. High acceptance/usability, reported empowerment in nurturing routines and affective/cognitive stimulation, and mitigation of socio-educational barriers.",
    takeaway:
      "A multilingual, low-literacy-friendly 'image-a-day' format scales preventive support across diverse, multi-ethnic populations.",
    tags: ["hybrid", "multilingual", "low-literacy", "image-a-day", "attachment", "usability", "equity", "inclusive", "dolphin"],
  },
  {
    id: "DB_009_PAUSE_STEPS_QUAL",
    title: "Pause / STEPS: why in-crisis screen UIs fail",
    authors: "Hodson, Woods, Donohoe et al. — OPTIMA Trial, King's College London",
    design: "Qualitative real-time usability + clinical vignettes. 11 mothers of 33 children aged 2–10.",
    findings:
      "Two critical barriers to phone-based crisis support: (1) Cognitive load — navigating a phone UI mid-tantrum is unusable under stress; the adult can't process long text. (2) Social interruption — holding a phone in front of the child reads as a relational wall / parental avoidance and INTENSIFIES the acting-out. Parents improvised: smart-speaker audio guides and smartwatch cues to avoid holding the phone.",
    takeaway:
      "Crisis support ('Help Me Now') must be voice/audio-first with NO visual menus — calm the parent first, then a short auditory cue; support speaker/smartwatch output.",
    tags: ["qualitative", "usability", "crisis", "tantrum", "help-me-now", "voice-first", "cognitive-load", "pause", "steps"],
  },
  {
    id: "DB_010_PREVALENCE_2025",
    title: "Prevalence: technoference & early device adoption",
    authors: "Radesky, Hiniker, Common Sense Media, Uzundağ et al. (2014–2025)",
    design: "Pooled observational + population statistics.",
    findings:
      "73% of caregivers actively used a phone during family restaurant meals; 35% were absorbed ≥1 min per 5-min block at playgrounds. 96% of urban children live with a smartphone; 41% of homes have a smart speaker, 21% of caregivers report kids interacting directly with it. 40% of 2-year-olds own a personal tablet, rising to 58% by age 4. Background TV fills 25% of waking time at 8 mo, 21% at 10 mo, 17% at 18 mo.",
    takeaway:
      "Technoference and early device ownership are normative — normalize them (anti-guilt) and target background media + screen-free zones rather than shaming.",
    tags: ["prevalence", "statistics", "technoference", "background-media", "device-ownership", "smart-speaker", "anti-guilt", "norms"],
  },
];

/** Lowercase alphanumeric tokens (length > 1), deduped — the unit of query + index. */
function tokenize(input: string): string[] {
  return input
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1);
}

class KeywordStudyIndex {
  private readonly indexed: { study: Study; tokens: Set<string>; tagTokens: Set<string> }[];

  constructor(corpus: Study[]) {
    this.indexed = corpus.map((study) => ({
      study,
      tagTokens: new Set(study.tags.flatMap(tokenize)),
      tokens: new Set([
        ...tokenize(study.title),
        ...tokenize(study.findings),
        ...tokenize(study.takeaway),
      ]),
    }));
  }

  retrieve(query: string, limit = 3): Study[] {
    const queryTokens = new Set(tokenize(query));
    if (queryTokens.size === 0) return [];
    return this.indexed
      .map(({ study, tokens, tagTokens }) => {
        let score = 0;
        for (const token of queryTokens) {
          if (tagTokens.has(token)) score += 3;
          else if (tokens.has(token)) score += 1;
        }
        return { study, score };
      })
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((s) => s.study);
  }

  all(): Study[] {
    return [...STUDIES];
  }
}

export const studies = new KeywordStudyIndex(STUDIES);
