/**
 * Compass — curated parenting evidence corpus (RAG, global, read-only).
 *
 * Implements the `EvidenceIndex` contract from "@/lib/types". This is the ONLY data
 * that is shared across families (per the spec: "Nothing is shared across families
 * except the read-only evidence corpus"). Snippets are short, attributed to real,
 * trustworthy organizations (AAP, CDC, Zero to Three, etc.), and tagged for simple,
 * explainable keyword retrieval — no embeddings, no network calls.
 *
 * Anti-bias note (spec §8 / assignment Q10): enrichment snippets are deliberately
 * FREE / low-cost and never assume a budget, a two-parent household, or any racial,
 * cultural, or ability default. The goal is to bridge gaps, not reinforce them.
 */

import type { EvidenceIndex, EvidenceSnippet } from "@/lib/types";

const CORPUS: EvidenceSnippet[] = [
  {
    id: "aap-screen-2026",
    url: "https://www.aap.org/en/patient-care/media-and-children/",
    title: "Screen time: quality and context over rigid limits",
    source: "AAP 2026 screen-time guidance update",
    text: "The AAP's 2026 update moves away from a single magic-number limit toward what children watch, how it fits the family's routine, and whether an adult is engaged. Co-viewing and talking about content matter more than the clock. Media should not crowd out sleep, movement, meals, or unstructured play.",
    tags: ["screen-time", "media", "aap", "co-viewing", "quality", "limits", "guidelines"],
  },
  {
    id: "aap-media-plan",
    url: "https://www.healthychildren.org/English/fmp/Pages/MediaPlan.aspx",
    title: "A family media plan beats blanket bans",
    source: "AAP HealthyChildren.org — Family Media Plan",
    text: "Pediatricians recommend a shared, written family media plan over arbitrary bans: agree on screen-free zones (bedrooms, meals), screen-free times, and content the whole family is comfortable with. Predictable, consistent rules reduce daily negotiation and tantrums around devices.",
    tags: ["screen-time", "media", "boundaries", "tantrums", "routine", "consistency", "rules"],
  },
  {
    id: "ztt-bedtime-routine",
    url: "https://www.zerotothree.org/issue-areas/sleep/",
    title: "Consistent bedtime routines help young children settle",
    source: "Zero to Three — Healthy Sleep Habits",
    text: "A short, predictable wind-down sequence (bath, book, song, lights low) signals the brain that sleep is coming and lowers bedtime resistance. Keep the order and timing consistent each night; dim screens at least 30–60 minutes before bed because light delays the body's sleep cues.",
    tags: ["bedtime", "sleep", "routine", "wind-down", "screen-time", "toddler", "consistency"],
  },
  {
    id: "cdc-sleep-needs",
    url: "https://www.cdc.gov/sleep/about/index.html",
    title: "How much sleep young children need",
    source: "CDC — Sleep Recommendations for Children",
    text: "The CDC notes that children ages 3–5 typically need 10–13 hours of sleep per day (including naps) and ages 6–12 need 9–12 hours. Regular sleep and wake times, even on weekends, make falling asleep easier and improve mood, attention, and behavior the next day.",
    tags: ["sleep", "bedtime", "schedule", "behavior", "attention", "cdc"],
  },
  {
    id: "ztt-tantrum-coreg",
    url: "https://www.zerotothree.org/resource/toddler-tantrums-101-why-they-happen-and-what-you-can-do/",
    title: "Co-regulation: calm the child before you correct",
    source: "Zero to Three — Tantrums & Big Feelings",
    text: "A tantrum is a nervous system that is overwhelmed, not misbehavior to punish. Young children borrow an adult's calm to settle — get low, lower your voice, name the feeling ('you're so mad the screen turned off'), and wait. Teach the lesson only after the storm passes, never during it.",
    tags: ["tantrums", "co-regulation", "emotions", "meltdown", "calm", "discipline", "feelings", "screen-time"],
  },
  {
    id: "aap-discipline-positive",
    url: "https://www.healthychildren.org/English/family-life/family-dynamics/communication-discipline/Pages/Disciplining-Your-Child.aspx",
    title: "Positive discipline: connection plus clear, kind limits",
    source: "AAP — Effective Discipline Guidance",
    text: "The AAP advises discipline that teaches rather than shames: set a few clear, age-appropriate limits, follow through consistently, and praise the behavior you want to see. Spanking and harsh words are not recommended; they raise aggression and stress without teaching the skill you want.",
    tags: ["discipline", "limits", "behavior", "tantrums", "praise", "consistency", "aap"],
  },
  {
    id: "ztt-free-play",
    url: "https://www.zerotothree.org/resource/the-power-of-play/",
    title: "Free, child-led play is powerful enrichment",
    source: "Zero to Three — The Power of Play",
    text: "Unstructured, child-led play builds language, problem-solving, and self-control more than expensive toys or classes. Everyday materials — cardboard boxes, pots and pans, water, sticks, blankets for a fort — are excellent. The active ingredient is the child's imagination and your warm attention, not the price tag.",
    tags: ["play", "enrichment", "free", "low-cost", "development", "imagination", "screen-alternative"],
  },
  {
    id: "cdc-talk-read-play",
    url: "https://www.cdc.gov/act-early/index.html",
    title: "Free everyday ways to boost early development",
    source: "CDC — Learn the Signs. Act Early.",
    text: "Talking, reading, singing, and playing with your child every day are the strongest — and free — drivers of early brain development. Narrate daily routines, count stairs, name colors at the store, and let your child help cook or sort laundry. Public libraries offer free books and story times for families on any budget.",
    tags: ["enrichment", "free", "low-cost", "reading", "language", "development", "library", "screen-alternative"],
  },
  {
    id: "screen-swap-alternatives",
    url: "https://www.zerotothree.org/issue-areas/screen-sense/",
    title: "Low-cost swaps for screen time",
    source: "Zero to Three — Beyond Screens",
    text: "When you want to dial back screens, offer an easy, appealing alternative rather than just removing the device: a sensory bin (dried beans, a scoop), sidewalk chalk, a 'help me' kitchen task, dancing to music, or a nature walk to collect leaves. Having the swap ready prevents the power struggle.",
    tags: ["screen-time", "screen-alternative", "free", "low-cost", "play", "tantrums", "transitions"],
  },
  {
    id: "transitions-warnings",
    url: "https://www.healthychildren.org/English/family-life/Media/Pages/default.aspx",
    title: "Smooth transitions reduce screen-off meltdowns",
    source: "AAP HealthyChildren.org — Managing Media Transitions",
    text: "Abruptly turning off a screen often triggers a meltdown. Give a concrete warning ('two more minutes, then we turn it off'), use a visible timer, and pair the end with the next fun thing ('after this we read your dinosaur book'). Predictability gives the child a sense of control.",
    tags: ["screen-time", "transitions", "tantrums", "meltdown", "routine", "timer", "boundaries"],
  },
  {
    id: "identity-race-talk",
    url: "https://www.healthychildren.org/English/healthy-living/emotional-wellness/Building-Resilience/Pages/Talking-to-Children-About-Racial-Bias.aspx",
    title: "Talking with young children about race and identity",
    source: "AAP — Talking to Children About Racial Bias",
    text: "Children notice differences in skin color as toddlers; staying silent teaches that the topic is taboo. Use simple, honest, age-appropriate language, celebrate your family's heritage and others', read diverse books, and answer questions matter-of-factly. Affirming a child's racial and ethnic identity builds confidence and resilience.",
    tags: ["identity", "race", "ethnicity", "culture", "diversity", "bias", "self-esteem", "books"],
  },
  {
    id: "disability-strengths",
    url: "https://www.cdc.gov/child-development/index.html",
    title: "Raising a child with a disability: lead with strengths",
    source: "CDC — Supporting Children with Disabilities",
    text: "Build routines and supports around your child's individual strengths and needs rather than comparing to milestones charts. Visual schedules, predictable transitions, and clear, concrete language help many children, including those who are neurodivergent. You are the expert on your child; partner with providers and ask for accommodations early.",
    tags: ["disability", "neurodivergent", "autism", "adhd", "accommodations", "routine", "strengths", "transitions", "visual-schedule"],
  },
  {
    id: "gender-neutral-play",
    url: "https://www.zerotothree.org/resources/",
    title: "Let play be for every child",
    source: "Zero to Three — Gender and Early Childhood",
    text: "Offer a wide range of toys and activities — blocks, dolls, art, trucks, dress-up — to all children regardless of gender, and avoid steering by 'boy' or 'girl' labels. Diverse play builds a fuller set of skills (nurturing, spatial reasoning, language) and signals that your child's interests are welcome.",
    tags: ["gender", "play", "stereotypes", "bias", "interests", "development", "toys"],
  },
  {
    id: "outdoor-movement",
    url: "https://www.cdc.gov/physical-activity-basics/guidelines/children.html",
    title: "Daily active, outdoor play supports body and mood",
    source: "CDC — Physical Activity for Young Children",
    text: "Preschoolers should be active throughout the day, with plenty of free outdoor play. Movement supports motor skills, sleep, and mood, and outdoor time is a free, screen-free reset for the whole family — a park, a yard, or a walk around the block all count.",
    tags: ["outdoor", "physical-activity", "movement", "free", "screen-alternative", "sleep", "mood", "play"],
  },
];

/** Lowercase alphanumeric tokens, deduped — the unit of both queries and the index. */
function tokenize(input: string): string[] {
  return input
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1);
}

class KeywordEvidenceIndex implements EvidenceIndex {
  /** Pre-tokenized search field per snippet: tags weigh more than title/text. */
  private readonly indexed: { snippet: EvidenceSnippet; tokens: Set<string>; tagTokens: Set<string> }[];

  constructor(corpus: EvidenceSnippet[]) {
    this.indexed = corpus.map((snippet) => ({
      snippet,
      tagTokens: new Set(snippet.tags.flatMap(tokenize)),
      tokens: new Set([...tokenize(snippet.title), ...tokenize(snippet.text)]),
    }));
  }

  retrieve(query: string, limit = 4): EvidenceSnippet[] {
    const queryTokens = new Set(tokenize(query));
    if (queryTokens.size === 0) return [];

    const scored = this.indexed
      .map(({ snippet, tokens, tagTokens }) => {
        let score = 0;
        for (const token of queryTokens) {
          if (tagTokens.has(token)) score += 3; // tag overlap is the strongest signal
          else if (tokens.has(token)) score += 1; // title/text overlap is weaker
        }
        return { snippet, score };
      })
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score);

    return scored.slice(0, limit).map((s) => s.snippet);
  }

  all(): EvidenceSnippet[] {
    return [...CORPUS];
  }
}

/** Singleton evidence index (global, read-only). */
export const evidence: EvidenceIndex = new KeywordEvidenceIndex(CORPUS);
