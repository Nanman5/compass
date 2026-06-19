import Link from "next/link";
import Image from "next/image";
import { CompassStar, CompassWordmark } from "@/components/CompassStar";

const NAV = ["Features", "How it works", "For families", "For partners", "Pricing"];

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-cream">
      <SiteNav />
      <main className="flex-1">
        <Hero />
        <ValueStrip />
        <HowItWorks />
        <Testimonial />
        <ClosingBand />
      </main>
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
          <p className="eyebrow flex items-center gap-2">
            Support for the moments that matter most <HeartDoodle />
          </p>
          <h1 className="mt-4 text-5xl sm:text-6xl leading-[1.02] font-semibold">
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
            <Link href="#how" className="btn btn-ghost">
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
    <div className="relative">
      <div
        className="aspect-[3/2] rounded-[2rem] border border-teal/10 overflow-hidden bg-cream-deep"
        style={{ boxShadow: "var(--shadow-soft)" }}
      >
        <Image
          src="/img/hero-family.png"
          alt="A parent hugging their two young children on a cozy couch"
          width={1536}
          height={1024}
          priority
          className="w-full h-full object-cover"
        />
      </div>

      {/* floating note */}
      <div className="absolute -top-3 right-4 rotate-[6deg] bg-cream-card rounded-xl px-4 py-3 shadow-[var(--shadow-card)] border border-teal/10">
        <span style={{ fontFamily: "var(--font-display)" }} className="italic text-teal text-sm">
          You&apos;re doing great
        </span>
      </div>
      {/* doodle stars */}
      <CompassStar size={22} className="absolute -left-2 top-10 opacity-80" />
      <CompassStar size={16} className="absolute left-6 bottom-6 opacity-60" />
    </div>
  );
}

/* ─────────────────────────────────────────── Value strip */
const VALUES = [
  {
    title: "Personalized guidance",
    body: "Advice that fits your child, your values, and your everyday life.",
    img: "/img/value-guidance.png",
  },
  {
    title: "Practical next steps",
    body: "Small, doable actions you can try right away — no overwhelm.",
    img: "/img/value-steps.png",
  },
  {
    title: "Grow with your child",
    body: "Tools and insights that evolve as your child does too.",
    img: "/img/value-grow.png",
  },
];

function ValueStrip() {
  return (
    <section className="mx-auto max-w-6xl px-5 -mt-6 pb-8">
      <div className="grid sm:grid-cols-3 gap-4">
        {VALUES.map((v) => (
          <div
            key={v.title}
            className="bg-cream-card rounded-2xl border border-teal/10 p-6 shadow-[var(--shadow-card)]"
          >
            <div className="w-14 h-14 rounded-2xl overflow-hidden border border-teal/10">
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
    </section>
  );
}

/* ─────────────────────────────────────────── How it works */
const STEPS = [
  {
    n: 1,
    title: "Tell us about your child",
    body: "Share their age, interests, and what's on your mind.",
  },
  {
    n: 2,
    title: "Get personalized guidance",
    body: "Compass turns your answers into tailored ideas, tips, and encouragement.",
  },
  {
    n: 3,
    title: "See what works, and grow",
    body: "Log how it went. Compass remembers and sharpens its advice over time.",
  },
];

function HowItWorks() {
  return (
    <section id="how" className="py-16 bg-cream-deep/50 border-y border-teal/10">
      <div className="mx-auto max-w-6xl px-5">
        <h2 className="text-center text-3xl sm:text-4xl font-semibold">How Compass works</h2>
        <p className="text-center mt-2 text-coral font-semibold">Real support for real life.</p>

        <ol className="mt-12 grid md:grid-cols-3 gap-8">
          {STEPS.map((s) => (
            <li key={s.n} className="relative text-center md:text-left">
              <div className="flex items-center gap-3 justify-center md:justify-start">
                <span className="w-8 h-8 shrink-0 rounded-full bg-teal text-cream grid place-items-center text-sm font-bold">
                  {s.n}
                </span>
                <CompassStar size={18} className="opacity-70" />
              </div>
              <h3 className="mt-4 text-xl font-semibold">{s.title}</h3>
              <p className="mt-2 text-ink/70 leading-relaxed">{s.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────── Testimonial */
function Testimonial() {
  return (
    <section className="py-20">
      <figure className="mx-auto max-w-3xl px-6 text-center">
        <CompassStar size={28} className="mx-auto opacity-80" />
        <blockquote
          style={{ fontFamily: "var(--font-display)" }}
          className="mt-6 text-2xl sm:text-3xl leading-snug text-teal italic"
        >
          “Compass helps me pause, breathe, and choose what&apos;s best.
          I feel more calm — and my kids do too.”
        </blockquote>
        <figcaption className="mt-7 flex items-center justify-center gap-3">
          <Image
            src="/img/testimonial-mei.png"
            alt="Mei, a Compass beta tester, with her child"
            width={96}
            height={96}
            className="w-12 h-12 rounded-full object-cover border-2 border-cream-card shadow-[var(--shadow-card)]"
          />
          <span className="text-left">
            <span className="block text-sm font-bold text-ink">Mei · mom of two</span>
            <span className="mt-0.5 inline-flex items-center gap-1.5 rounded-full bg-sage-soft/60 px-2 py-0.5 text-[0.7rem] font-bold uppercase tracking-wide text-teal">
              <span className="w-1.5 h-1.5 rounded-full bg-coral" /> Compass beta tester
            </span>
          </span>
        </figcaption>
      </figure>
    </section>
  );
}

/* ─────────────────────────────────────────── Closing band + footer (merged) */
function ClosingBand() {
  return (
    <footer style={{ background: "linear-gradient(180deg, #e3ecdf 0%, #d3e0cf 100%)" }}>
      <div className="mx-auto max-w-6xl px-5 pt-14 pb-8 grid md:grid-cols-2 gap-10 items-center">
        <div>
          <h2 className="text-3xl sm:text-4xl font-semibold leading-tight">
            You don&apos;t have to have
            <br />
            all the answers.
          </h2>
          <p className="mt-2 text-2xl text-coral" style={{ fontFamily: "var(--font-display)" }}>
            We&apos;ll walk with you.
          </p>
          <Link href="/app" className="btn btn-primary mt-7">
            Start your journey
          </Link>
          <p className="mt-3 text-sm text-teal/80">Free to try. Cancel anytime.</p>
        </div>

        {/* illustration shown at its natural 3:2 — no crop, all four signs visible */}
        <div className="rounded-[1.75rem] overflow-hidden border border-teal/10 shadow-[var(--shadow-soft)]">
          <Image
            src="/img/footer-journey.png"
            alt="A winding path toward a sunrise, with a signpost reading Understand, Connect, Guide, Grow"
            width={1536}
            height={1024}
            className="w-full h-auto"
          />
        </div>
      </div>

      {/* merged footer row */}
      <div className="mx-auto max-w-6xl px-5 py-6 border-t border-teal/15 flex flex-col sm:flex-row items-center justify-between gap-3">
        <CompassWordmark size={22} />
        <p className="text-xs text-teal/70">
          A parenting companion for the digital age · concept prototype
        </p>
      </div>
    </footer>
  );
}

/* small inline doodle */
function HeartDoodle() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 20s-7-4.6-7-9.3A3.7 3.7 0 0112 8a3.7 3.7 0 017 2.7C19 15.4 12 20 12 20z"
        stroke="#e1785c"
        strokeWidth="1.6"
        fill="none"
      />
    </svg>
  );
}
