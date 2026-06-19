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
          <div>
            <p className="eyebrow">Support for the moments that matter most</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/decor/heart_divider.svg" alt="" aria-hidden className="mt-1 w-72 h-auto" />
          </div>
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
    <div className="relative pt-10">
      {/* cut-out family illustration (transparent bg) floating on the cream page */}
      <Image
        src="/img/hero-cutout.png"
        alt="A parent hugging their two young children on a cozy couch"
        width={1401}
        height={902}
        priority
        className="relative z-0 w-[94%] ml-auto h-auto"
      />

      {/* hand-drawn SVG decorations (user-provided) floating around the scene */}
      {/* eslint-disable @next/next/no-img-element */}
      <img src="/decor/hanging_plant.svg" alt="" aria-hidden className="absolute -top-4 right-0 w-16 md:w-20 z-20" />
      <img src="/decor/frame_doing_great.svg" alt="" aria-hidden className="absolute top-0 right-[33%] w-20 md:w-24 rotate-[-5deg] z-20" />
      <img src="/decor/frame_botanical.svg" alt="" aria-hidden className="absolute top-8 right-[14%] w-16 md:w-20 rotate-[4deg] z-20" />
      <img src="/decor/star.svg" alt="" aria-hidden className="absolute left-[3%] top-[14%] w-8 z-20" />
      <img src="/decor/star.svg" alt="" aria-hidden className="absolute left-[12%] bottom-[16%] w-5 opacity-80 z-20" />
      <img src="/decor/star.svg" alt="" aria-hidden className="absolute right-[44%] top-[6%] w-4 opacity-70 z-20" />
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
    title: "Tell us about your family",
    body: "A 5–10 minute guided chat learns your child's age, temperament, interests, and what you're struggling with right now.",
  },
  {
    n: 2,
    title: "Get the one next step",
    body: "Compass turns generic advice into a single concrete action for your child — and tells you when tech helps and when to put the screen away.",
  },
  {
    n: 3,
    title: "It grows with you",
    body: "After you try it, a quick “how did it go?” Compass remembers what works, sharpens its guidance each week, and shows your progress.",
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

/* ─────────────────────────────────────────── Footer: croppable landscape + CSS overlays */
const SIGNS = ["Understand", "Connect", "Guide", "Grow"];

function Signpost() {
  return (
    <div className="relative w-[230px] h-[250px] select-none">
      {/* wooden post with rounded cap */}
      <div
        className="absolute left-6 top-3 bottom-7 w-5 rounded-t-[10px]"
        style={{
          background: "linear-gradient(90deg,#7d5a3a 0%,#a87c52 38%,#c49c6e 52%,#8a6440 100%)",
          boxShadow: "0 8px 14px -8px rgba(62,58,52,0.55)",
        }}
      />
      {/* rocks at the base */}
      <div className="absolute left-2 bottom-1 flex items-end gap-1">
        <span className="block w-6 h-3.5 rounded-full bg-[#a7a392]" />
        <span className="block w-9 h-5 rounded-full bg-[#8f8b7b]" />
        <span className="block w-5 h-3 rounded-full bg-[#b1ad9c]" />
      </div>
      {/* sign planks */}
      <div className="absolute left-[34px] top-4 flex flex-col gap-2.5">
        {SIGNS.map((word) => (
          <div
            key={word}
            className="relative pl-5 pr-9 py-2 text-[0.98rem]"
            style={{
              fontFamily: "var(--font-display)",
              color: "#1e4d4a",
              fontWeight: 600,
              background: "linear-gradient(180deg,#f4e7cb 0%,#ead7af 70%,#dcc699 100%)",
              border: "1.5px solid #b7935f",
              clipPath:
                "polygon(0 0, calc(100% - 15px) 0, 100% 50%, calc(100% - 15px) 100%, 0 100%)",
              boxShadow: "0 6px 12px -7px rgba(62,58,52,0.6)",
            }}
          >
            {/* mounting nails */}
            <span className="absolute left-1.5 top-1.5 w-1 h-1 rounded-full bg-[#8a6c43]" />
            <span className="absolute left-1.5 bottom-1.5 w-1 h-1 rounded-full bg-[#8a6c43]" />
            {word}
          </div>
        ))}
      </div>
    </div>
  );
}

function ClosingBand() {
  return (
    <footer className="relative w-full overflow-hidden">
      {/* croppable landscape background (no signpost/text baked in) */}
      <Image
        src="/img/footer-bg.png"
        alt=""
        width={1536}
        height={512}
        priority
        sizes="100vw"
        className="block w-full h-[210px] md:h-[300px] object-cover object-center"
      />
      {/* left wash for text legibility */}
      <div
        className="hidden md:block absolute inset-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(90deg, rgba(251,247,240,0.9) 0%, rgba(251,247,240,0.5) 28%, rgba(251,247,240,0) 52%)",
        }}
      />

      {/* DESKTOP overlay: text left, CSS signpost right */}
      <div className="hidden md:flex absolute inset-0 items-center">
        <div className="mx-auto w-full max-w-6xl px-5 flex items-center justify-between gap-6">
          <div className="max-w-md">
            <h2 className="text-3xl lg:text-4xl font-semibold leading-tight">
              You don&apos;t have to have
              <br />
              all the answers.
            </h2>
            <p className="mt-1 text-2xl text-coral-deep" style={{ fontFamily: "var(--font-display)" }}>
              We&apos;ll walk with you.
            </p>
            <Link href="/app" className="btn btn-primary mt-5">
              Start your journey
            </Link>
            <p className="mt-2 text-sm font-semibold text-teal">Free to try. Cancel anytime.</p>
          </div>
          <Signpost />
        </div>
      </div>

      {/* MOBILE: text stacked below the landscape strip */}
      <div className="md:hidden px-5 py-8" style={{ background: "linear-gradient(180deg,#e3ecdf,#d3e0cf)" }}>
        <h2 className="text-3xl font-semibold leading-tight">
          You don&apos;t have to have all the answers.
        </h2>
        <p className="mt-2 text-2xl text-coral-deep" style={{ fontFamily: "var(--font-display)" }}>
          We&apos;ll walk with you.
        </p>
        <Link href="/app" className="btn btn-primary mt-5">
          Start your journey
        </Link>
        <p className="mt-2 text-sm font-semibold text-teal">Free to try. Cancel anytime.</p>
      </div>
    </footer>
  );
}
