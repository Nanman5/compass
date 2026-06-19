import Link from "next/link";
import Image from "next/image";
import { CompassWordmark } from "@/components/CompassStar";
import { Icon, type IconName } from "@/components/Icon";

const NAV = ["Features", "How it works", "For families", "Pricing", "Resources"];

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-cream">
      <SiteNav />
      <main className="flex-1">
        <Hero />
        <ValueStrip />
        <HowItWorks />
        <OneApp />
        <PasteSection />
        <WeeklyDrop />
        <VoiceCoach />
        <Testimonial />
        <Pricing />
      </main>
      <SiteFooter />
    </div>
  );
}

/* ─────────────────────────────────────────── Nav */
function SiteNav() {
  return (
    <header className="sticky top-0 z-30 bg-cream/85 backdrop-blur border-b border-teal/10">
      <nav className="mx-auto max-w-6xl px-5 h-16 flex items-center justify-between">
        <CompassWordmark />
        <ul className="hidden lg:flex items-center gap-7 text-sm font-semibold text-teal/80">
          {NAV.map((item) => (
            <li key={item} className="hover:text-teal transition-colors cursor-pointer">
              {item}
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-3">
          <Link href="/app" className="hidden sm:inline text-sm font-semibold text-teal/80 hover:text-teal">
            Log in
          </Link>
          <Link href="/app" className="btn btn-primary text-sm px-5 py-2.5">
            Try Compass
          </Link>
        </div>
      </nav>
    </header>
  );
}

/* ─────────────────────────────────────────── Hero */
function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="mx-auto max-w-6xl px-5 pt-14 pb-20 grid lg:grid-cols-2 gap-12 items-center">
        <div>
          <p className="eyebrow">Support for the moments that matter most</p>
          <h1 className="mt-5 text-5xl sm:text-6xl leading-[1.02] font-semibold">
            More confidence.
            <br />
            Calmer parenting.
          </h1>
          <p className="mt-6 text-lg text-ink/75 max-w-md leading-relaxed">
            Compass gives you personalized guidance, practical tools, and encouragement —
            so you can respond with confidence, not second-guessing.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href="/app" className="btn btn-primary">
              Try Compass
            </Link>
            <Link href="#features" className="btn btn-ghost">
              Explore features
            </Link>
          </div>
          <p className="mt-4 text-sm text-muted">Free to try. Cancel anytime.</p>
        </div>

        <HeroScene />
      </div>
    </section>
  );
}

function HeroScene() {
  return (
    <div className="relative pt-10">
      {/* cut-out family illustration. Slightly inset (w-[84%] ml-auto) so the decorations
          have a clear margin to live in and never sit on top of the artwork. */}
      <Image
        src="/img/hero-cutout.png"
        alt="A parent hugging their two young children on a cozy couch"
        width={1401}
        height={902}
        preload
        className="relative z-0 ml-auto h-auto w-[84%]"
      />

      {/* Hand-drawn decorations that ACCOMPANY the illustration: they sit in the negative
          space (left gutter + top corner), never over the family, and gently float — each
          with its own duration/delay so they bob out of sync, like the original. */}
      {/* eslint-disable @next/next/no-img-element */}
      <span className="float pointer-events-none absolute -top-3 right-1 z-20" style={{ animationDuration: "9s" }}>
        <img src="/decor/hanging_plant.svg" width={308} height={630} alt="" aria-hidden className="h-auto w-12 md:w-14" />
      </span>
      <span className="float pointer-events-none absolute left-0 top-2 z-20" style={{ animationDuration: "8s", animationDelay: ".5s" }}>
        <img src="/decor/frame_doing_great.svg" width={308} height={420} alt="" aria-hidden className="h-auto w-16 -rotate-6 md:w-20" />
      </span>
      <span className="float pointer-events-none absolute left-3 top-[42%] z-20" style={{ animationDuration: "7s", animationDelay: ".2s" }}>
        <img src="/decor/star.svg" width={82} height={80} alt="" aria-hidden className="h-auto w-7" />
      </span>
      <span className="float pointer-events-none absolute -left-1 bottom-10 z-20" style={{ animationDuration: "10s", animationDelay: ".8s" }}>
        <img src="/decor/star.svg" width={82} height={80} alt="" aria-hidden className="h-auto w-4 opacity-80" />
      </span>
      <span className="float pointer-events-none absolute left-[34%] top-0 z-20" style={{ animationDuration: "8.5s", animationDelay: "1.1s" }}>
        <img src="/decor/star.svg" width={82} height={80} alt="" aria-hidden className="h-auto w-3.5 opacity-70" />
      </span>
      {/* eslint-enable @next/next/no-img-element */}
    </div>
  );
}

/* ─────────────────────────────────────────── Value strip */
const VALUES = [
  {
    title: "Personalized guidance",
    body: "Advice that fits your child, your values, and your everyday life.",
    img: "/img/value-guidance.png",
    tint: "#d7e6da", // mint
  },
  {
    title: "Practical next steps",
    body: "Small, doable actions you can try right away — no overwhelm.",
    img: "/img/value-steps.png",
    tint: "#f6dcd2", // soft coral
  },
  {
    title: "Grow with your child",
    body: "Tools and insights that evolve as your child does too.",
    img: "/img/value-grow.png",
    tint: "#f6e7c4", // soft gold
  },
];

function ValueStrip() {
  return (
    <section className="mx-auto max-w-6xl px-5 -mt-8 pb-10">
      <div className="relative">
        {/* diffused radiance — soft blurred colored aura bleeding out from behind the card */}
        <div
          aria-hidden="true"
          className="absolute -inset-7 -z-10 rounded-[3rem]"
          style={{
            background: "linear-gradient(120deg, #e6b566, #e1785c 50%, #8fb09a)",
            filter: "blur(38px)",
            opacity: 0.6,
          }}
        />
        <div className="relative rounded-[1.8rem] bg-cream-card border border-teal/10 shadow-[var(--shadow-card)] grid sm:grid-cols-3 sm:divide-x divide-teal/10 overflow-hidden">
          {VALUES.map((v) => (
            <div key={v.title} className="p-6 sm:p-7">
              <div
                className="w-14 h-14 rounded-full overflow-hidden grid place-items-center"
                style={{ background: v.tint }}
              >
                <Image
                  src={v.img}
                  alt=""
                  width={128}
                  height={128}
                  className="w-full h-full object-cover"
                />
              </div>
              <h3 className="mt-4 text-lg font-semibold">{v.title}</h3>
              <p className="mt-1.5 text-sm text-ink/70 leading-relaxed">{v.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────── How it works */
const STEPS = [
  {
    n: 1,
    title: "Tell us about your child",
    body: "Share their age, interests, and what's on your mind in a warm guided chat.",
  },
  {
    n: 2,
    title: "Get personalized guidance",
    body: "Compass turns your answers into tailored ideas, tips, and encouragement.",
  },
  {
    n: 3,
    title: "Try it in real life",
    body: "One small idea at a time. Log how it went and Compass gets sharper.",
  },
];

function HowItWorks() {
  return (
    <section id="how" className="py-16">
      <div className="mx-auto max-w-6xl px-5">
        <h2 className="text-center text-3xl sm:text-4xl font-semibold">How Compass works</h2>

        {/* hand-drawn heart divider centered under the heading, as in the target */}
        <div className="mt-3 flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/decor/heart_divider.svg" width={800} height={210} alt="" aria-hidden className="w-52 h-auto opacity-80" />
        </div>

        <ol className="mt-10 grid md:grid-cols-3 gap-8">
          {STEPS.map((s) => (
            <li key={s.n} className="relative text-center">
              <span className="mx-auto w-9 h-9 shrink-0 rounded-full bg-sage-soft/70 text-teal grid place-items-center text-sm font-bold">
                {s.n}
              </span>
              <h3 className="mt-4 text-xl font-semibold">{s.title}</h3>
              <p className="mt-2 text-ink/70 leading-relaxed max-w-xs mx-auto">{s.body}</p>
            </li>
          ))}
        </ol>

        <p className="mt-10 text-center text-sage font-semibold italic" style={{ fontFamily: "var(--font-display)" }}>
          Real support for real life.
        </p>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────── One app for the whole journey (6-card grid)

   Each feature gets a tinted chip with a line icon. Tints rotate sage → coral →
   gold across the grid to echo the value strip and the brand palette. */
const FEATURES: { icon: IconName; tint: string; ink: string; title: string; body: string }[] = [
  {
    icon: "chat",
    tint: "#d7e6da",
    ink: "#2f6360",
    title: "Conversational onboarding",
    body: "A 5–10 minute guided chat that learns your family — your child's age, temperament, interests, and what you're working through.",
  },
  {
    icon: "note",
    tint: "#f6dcd2",
    ink: "#cf6147",
    title: "Paste & personalize",
    body: "Drop in any article, reel, or screenshot. Compass extracts the real advice, checks it against trusted evidence, and turns it into one concrete next step.",
  },
  {
    icon: "feed",
    tint: "#f6e7c4",
    ink: "#c08a36",
    title: "Weekly drop",
    body: "Each week, a personalized feed of studies, tips, and activities matched to your child right now — so you don't have to go searching.",
  },
  {
    icon: "mic",
    tint: "#d7e6da",
    ink: "#2f6360",
    title: "“Help Me Now” voice coach",
    body: "An always-available voice shortcut for the moment of chaos. Just talk to it — it knows your child and responds instantly.",
  },
  {
    icon: "calendar",
    tint: "#f6dcd2",
    ink: "#cf6147",
    title: "Planned activities calendar",
    body: "Plan and schedule activities ahead, with reminders so good intentions actually turn into action.",
  },
  {
    icon: "loop",
    tint: "#f6e7c4",
    ink: "#c08a36",
    title: "Win logger + improvement loop",
    body: "After you try something, a quick “How did it go?” Compass remembers what worked and sharpens its advice over time.",
  },
];

function OneApp() {
  return (
    <section id="features" className="py-16 sm:py-20 bg-cream-deep/60 border-y border-teal/10">
      <div className="mx-auto max-w-6xl px-5">
        <p className="eyebrow text-center">Everything in one companion</p>
        <h2 className="mt-2 text-center text-3xl sm:text-5xl font-semibold">One app for the whole journey</h2>
        <p className="mt-4 text-center text-ink/70 max-w-xl mx-auto leading-relaxed">
          Six tools that learn your family and grow with you — teaching you to use technology with intention.
        </p>

        <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map((f) => (
            <article
              key={f.title}
              className="rounded-[1.4rem] bg-cream-card border border-teal/10 p-6 shadow-[var(--shadow-card)]"
            >
              <div
                className="w-12 h-12 rounded-2xl grid place-items-center"
                style={{ background: f.tint, color: f.ink }}
              >
                <Icon name={f.icon} size={24} />
              </div>
              <h3 className="mt-5 text-lg font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-ink/70 leading-relaxed">{f.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────── Paste & personalize

   Text + checklist on the left; a faux "paste" interaction card on the right
   showing a pasted screenshot turning into Compass's one next step. */
const PASTE_CHECKS = [
  "Extracts the real, usable advice",
  "Checks it against trusted research",
  "Translates it for your child's age & temperament",
];

function PasteSection() {
  return (
    <section className="py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-5 grid lg:grid-cols-2 gap-12 items-center">
        <div>
          <p className="eyebrow">Paste &amp; personalize</p>
          <h2 className="mt-3 text-3xl sm:text-4xl font-semibold leading-tight">
            Turn the endless scroll into one clear step
          </h2>
          <p className="mt-5 text-ink/75 leading-relaxed max-w-md">
            Saw a reel, an article, a screenshot of advice? Drop it in. Compass reads it,
            checks it against trusted evidence, and hands back the one thing worth trying
            for <em>your</em> child today.
          </p>
          <ul className="mt-7 space-y-3">
            {PASTE_CHECKS.map((c) => (
              <li key={c} className="flex items-center gap-3 text-ink/80">
                <span className="w-6 h-6 shrink-0 rounded-full bg-sage-soft/70 text-teal grid place-items-center">
                  <Icon name="check" size={14} />
                </span>
                {c}
              </li>
            ))}
          </ul>
        </div>

        <PasteCard />
      </div>
    </section>
  );
}

function PasteCard() {
  return (
    <Image
      src="/img/feature-paste.png"
      alt="Compass reading a pasted Instagram screenshot and handing back one concrete next step for Maya, age 4: a 2-minute feelings check-in before screen time ends."
      width={1536}
      height={1024}
      className="h-auto w-full"
    />
  );
}

/* ─────────────────────────────────────────── Weekly drop

   A generated "This week for <child>" card on the left; descriptive copy on the right. */
function WeeklyDrop() {
  return (
    <section className="py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-5 grid lg:grid-cols-2 gap-12 items-center">
        {/* the weekly-feed card */}
        <Image
          src="/img/feature-weekly.png"
          alt="Compass's weekly drop for Maya — a study, a tip, and an activity matched to her this week."
          width={1536}
          height={1024}
          className="h-auto w-full"
        />

        <div>
          <p className="eyebrow text-sage">Weekly drop</p>
          <h2 className="mt-3 text-3xl sm:text-4xl font-semibold leading-tight">
            Fresh, relevant guidance — without the searching
          </h2>
          <p className="mt-5 text-ink/75 leading-relaxed max-w-md">
            Every week, Compass brings you studies, tips, and activities matched to your
            child right now. No doomscrolling for answers. Just what&apos;s useful, when it&apos;s
            useful.
          </p>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────── Voice coach

   Text on the left; a dark "voice moment" card on the right (the only dark
   surface on the page) showing the Help Me Now exchange. */
function VoiceCoach() {
  return (
    <section className="py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-5 grid lg:grid-cols-2 gap-12 items-center">
        <div>
          <p className="eyebrow">&ldquo;Help Me Now&rdquo; voice coach</p>
          <h2 className="mt-3 text-3xl sm:text-4xl font-semibold leading-tight">
            For the moment of chaos, just talk
          </h2>
          <p className="mt-5 text-ink/75 leading-relaxed max-w-md">
            Hands full and your kid is melting down? Tap once and talk. Compass knows your
            child, responds instantly, and can act — pulling an activity, setting a timer,
            or logging the moment.
          </p>
        </div>

        {/* the voice moment */}
        <Image
          src="/img/feature-voice.png"
          alt="The Help Me Now voice coach: a parent says 'he won't put the tablet down and dinner's burning' and Compass offers a calm 3-2-1 handoff."
          width={1536}
          height={1024}
          className="h-auto w-full"
        />
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────── Testimonial */
function Testimonial() {
  return (
    <section className="py-16 sm:py-24">
      <div className="mx-auto max-w-5xl px-5">
        {/* the testimonial, centered on a warm gradient card */}
        <figure
          className="relative mt-12 rounded-[1.6rem] border border-teal/10 px-8 py-10 sm:px-14 sm:py-12 text-center shadow-[var(--shadow-soft)]"
          style={{ background: "linear-gradient(135deg,#fdfbf6 0%,#fbf1e6 60%,#f6ead8 100%)" }}
        >
          {/* eslint-disable @next/next/no-img-element */}
          <img src="/decor/star.svg" width={82} height={80} alt="" aria-hidden className="absolute left-6 top-5 w-6 h-auto opacity-80" />
          <img src="/decor/star.svg" width={82} height={80} alt="" aria-hidden className="absolute right-7 bottom-6 w-4 h-auto opacity-60" />
          {/* eslint-enable @next/next/no-img-element */}

          <span className="block text-5xl text-coral leading-none select-none" style={{ fontFamily: "var(--font-display)" }}>
            &ldquo;
          </span>
          <blockquote
            className="mt-1 text-xl sm:text-2xl leading-snug text-teal italic max-w-xl mx-auto"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Compass helps me pause, breathe, and choose what&apos;s best. I feel more calm — and my
            kids do too.
          </blockquote>
          <figcaption className="mt-6 flex items-center justify-center gap-3">
            <Image
              src="/img/testimonial-mei.png"
              alt="Mei, a Compass beta tester, with her child"
              width={96}
              height={96}
              className="w-10 h-10 rounded-full object-cover border-2 border-cream-card"
            />
            <span className="text-sm font-bold text-ink">Mei, mom of two</span>
          </figcaption>
        </figure>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────── Pricing */
const EXPLORE_FEATURES = ["Conversational onboarding", "3 personalized steps a week", "Weekly drop preview"];
const FAMILY_FEATURES = [
  "Everything in Explore",
  "Unlimited paste & personalize",
  "“Help Me Now” voice coach",
  "Activity calendar + win logger",
];

function Pricing() {
  return (
    <section id="pricing" className="py-16 sm:py-24">
      <div className="mx-auto max-w-4xl px-5">
        <p className="eyebrow text-center">Pricing</p>
        <h2 className="mt-2 text-center text-3xl sm:text-4xl font-semibold">Start free. Stay if it helps.</h2>
        <p className="mt-3 text-center text-ink/70">Free to try. Cancel anytime.</p>

        <div className="mt-10 grid sm:grid-cols-2 gap-5 items-start">
          {/* Explore — free */}
          <div className="rounded-[1.5rem] bg-cream-card border border-teal/10 p-7 shadow-[var(--shadow-card)]">
            <h3 className="text-xl font-semibold">Explore</h3>
            <p className="mt-1 text-sm text-muted">Get to know Compass</p>
            <p className="mt-5">
              <span className="text-4xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>$0</span>
              <span className="text-muted text-sm"> /forever</span>
            </p>
            <ul className="mt-6 space-y-3">
              {EXPLORE_FEATURES.map((f) => (
                <li key={f} className="flex items-center gap-3 text-sm text-ink/80">
                  <Icon name="check" size={16} className="text-sage shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <Link href="/app" className="btn btn-ghost w-full mt-7">
              Start free
            </Link>
          </div>

          {/* Family — paid, highlighted on deep teal */}
          <div className="relative rounded-[1.5rem] bg-teal text-cream p-7 shadow-[var(--shadow-soft)]">
            <span className="absolute top-6 right-6 rounded-full bg-gold px-3 py-1 text-[0.7rem] font-bold uppercase tracking-wide text-teal">
              Popular
            </span>
            <h3 className="text-xl font-semibold text-cream">Family</h3>
            <p className="mt-1 text-sm text-cream/70">The full companion</p>
            <p className="mt-5">
              <span className="text-4xl font-semibold text-cream" style={{ fontFamily: "var(--font-display)" }}>$9</span>
              <span className="text-cream/70 text-sm"> /month</span>
            </p>
            <ul className="mt-6 space-y-3">
              {FAMILY_FEATURES.map((f) => (
                <li key={f} className="flex items-center gap-3 text-sm text-cream/90">
                  <Icon name="check" size={16} className="text-gold shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <Link href="/app" className="btn btn-primary w-full mt-7">
              Start 14-day free trial
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────── Footer */
const FOOTER_COLS: { heading: string; links: string[] }[] = [
  { heading: "Product", links: ["Features", "How it works", "Pricing"] },
  { heading: "Company", links: ["About", "For partners", "Careers"] },
  { heading: "Support", links: ["Help center", "Privacy", "Terms"] },
];

function SiteFooter() {
  return (
    <footer className="border-t border-teal/10 bg-cream">
      <div className="mx-auto max-w-6xl px-5 py-14">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div className="max-w-xs">
            <CompassWordmark />
            <p className="mt-4 text-sm text-muted leading-relaxed">
              A parenting companion for the digital age. Technology with intention.
            </p>
          </div>
          {FOOTER_COLS.map((col) => (
            <div key={col.heading}>
              <p className="text-[0.7rem] font-bold uppercase tracking-wide text-teal/70">{col.heading}</p>
              <ul className="mt-4 space-y-2.5 text-sm text-ink/70">
                {col.links.map((l) => (
                  <li key={l} className="hover:text-teal transition-colors cursor-pointer">
                    {l}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 pt-6 border-t border-teal/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-sm text-muted">
          <p>© 2026 Compass. Made with care for families.</p>
          <p>hello@compass.family</p>
        </div>
      </div>
    </footer>
  );
}
