/**
 * HeroDecor — hand-drawn SVG decorations for the Compass landing hero.
 *
 * A small kit of warm, storybook-feeling ornaments that float around the
 * cut-out family illustration on the cream hero: scattered sparkle stars, a
 * hanging plant, two framed wall pictures, squiggles, an open-outline heart,
 * and a rough eyebrow underline. Everything is pure inline SVG (no images,
 * no deps), thin strokes, rounded linecaps, slightly imperfect by hand.
 *
 * All pieces are decorative (aria-hidden). Framed text uses the brand display
 * serif via var(--font-display), rendered as <text> inside the SVG.
 *
 * Brand palette used here:
 *   cream #fbf7f0 · deep teal #1e4d4a · soft teal #2f6360 · coral #e1785c
 *   sage #8fb09a · gold #e6b566 · ink #3e3a34 · wood #a9805c
 *   frame interior (cream-card) #fdfbf6
 */

const PALETTE = {
  cream: "#fbf7f0",
  teal: "#1e4d4a",
  softTeal: "#2f6360",
  coral: "#e1785c",
  sage: "#8fb09a",
  gold: "#e6b566",
  ink: "#3e3a34",
  wood: "#a9805c",
  card: "#fdfbf6",
} as const;

/* ── DoodleStar ─────────────────────────────────────────────────────────── */

type DoodleStarProps = {
  size?: number;
  className?: string;
  color?: string;
  /** "four" = sparkle with long N/S/E/W points; "five" = classic 5-point. */
  variant?: "four" | "five";
};

/**
 * A cute sparkle star. The four-point variant has long, slightly convex
 * cardinal points (the default twinkle); the five-point variant is an
 * occasional classic star. Hand-drawn — the path is intentionally a touch
 * irregular so it never reads as a perfect geometric mark.
 */
export function DoodleStar({
  size = 24,
  className,
  color = PALETTE.gold,
  variant = "four",
}: DoodleStarProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      {variant === "five" ? (
        <path
          d="M12 2.2 14.6 9 21.6 9.3 16.2 13.8 18 20.6 12 16.7 6 20.6 7.8 13.8 2.4 9.3 9.4 9 12 2.2Z"
          fill={color}
        />
      ) : (
        <path
          d="M12 1c.6 6.4 3.6 9.4 10 11-6.4 1.6-9.4 4.6-11 11-1.6-6.4-4.6-9.4-11-11 6.4-1.6 9.4-4.6 11-11Z"
          fill={color}
        />
      )}
    </svg>
  );
}

/* ── Sparkles ───────────────────────────────────────────────────────────── */

type SparklesProps = { className?: string };

/**
 * A pre-arranged little constellation of sparkle stars at mixed sizes,
 * opacities and brand colors (gold + sage). Meant to be dropped near the
 * family's head so they twinkle around it.
 */
export function Sparkles({ className }: SparklesProps) {
  return (
    <svg
      width={96}
      height={72}
      viewBox="0 0 96 72"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      {/* big gold twinkle */}
      <path
        d="M24 6c.5 5.3 3 7.8 8.3 9.1-5.3 1.3-7.8 3.8-9.1 9.1-1.3-5.3-3.8-7.8-9.1-9.1C19.4 13.8 21.9 11.3 24 6Z"
        fill={PALETTE.gold}
      />
      {/* medium sage twinkle */}
      <path
        d="M70 22c.4 4 2.3 5.9 6.3 6.9-4 1-5.9 2.9-6.9 6.9-1-4-2.9-5.9-6.9-6.9C62.5 27.9 64.4 26 66 22Z"
        transform="translate(4 0)"
        fill={PALETTE.sage}
        opacity="0.85"
      />
      {/* small gold twinkle */}
      <path
        d="M50 50c.3 2.9 1.6 4.2 4.5 4.9-2.9.7-4.2 2-4.9 4.9-.7-2.9-2-4.2-4.9-4.9C47.7 54.2 49 52.9 50 50Z"
        fill={PALETTE.gold}
        opacity="0.9"
      />
      {/* tiny sage dot-star */}
      <path
        d="M14 48c.2 2.1 1.2 3.1 3.3 3.6-2.1.5-3.1 1.5-3.6 3.6-.5-2.1-1.5-3.1-3.6-3.6C11.8 51.1 12.8 50.1 14 48Z"
        fill={PALETTE.sage}
        opacity="0.7"
      />
    </svg>
  );
}

/* ── HangingPlant ───────────────────────────────────────────────────────── */

type HangingPlantProps = { className?: string };

/**
 * A wall-hung plant for the top-right corner: a top ring with two thin cords
 * dropping to a woven terracotta pot, and several pothos-style vines trailing
 * down with rounded sage leaves. Asymmetric on purpose so it feels placed by
 * hand rather than mirrored.
 */
export function HangingPlant({ className }: HangingPlantProps) {
  return (
    <svg
      width={132}
      height={158}
      viewBox="0 0 132 158"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      {/* top ring + hanging cords */}
      <circle cx="66" cy="8" r="4.5" stroke={PALETTE.wood} strokeWidth="2.4" />
      <path
        d="M64 12 C50 30 44 52 47 84"
        stroke={PALETTE.wood}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M68 12 C82 30 88 52 85 84"
        stroke={PALETTE.wood}
        strokeWidth="2"
        strokeLinecap="round"
      />

      {/* leaves spilling above & over the pot */}
      <g fill={PALETTE.sage}>
        <path d="M50 70c-9-3-15-11-13-19 8 1 14 8 13 19Z" />
        <path d="M82 70c9-3 15-11 13-19-8 1-14 8-13 19Z" opacity="0.92" />
        <path d="M66 56c-4-8-3-18 3-23 5 6 4 16-3 23Z" />
        <path d="M58 60c-7-5-10-14-6-21 6 4 9 13 6 21Z" opacity="0.9" />
        <path d="M74 60c7-5 10-14 6-21-6 4-9 13-6 21Z" opacity="0.86" />
      </g>
      {/* leaf veins, drawn loosely */}
      <g stroke={PALETTE.softTeal} strokeWidth="1" strokeLinecap="round" opacity="0.5" fill="none">
        <path d="M44 54c2 6 5 10 9 14" />
        <path d="M88 54c-2 6-5 10-9 14" />
        <path d="M66 35c0 7 0 14 1 20" />
      </g>

      {/* woven terracotta pot */}
      <path
        d="M44 86 H88 L83 116 C83 121 73 124 66 124 C59 124 49 121 49 116 Z"
        fill={PALETTE.coral}
        opacity="0.92"
      />
      <path d="M44 86 H88" stroke={PALETTE.wood} strokeWidth="3" strokeLinecap="round" />
      {/* weave lines */}
      <g stroke={PALETTE.card} strokeWidth="1.4" opacity="0.55">
        <path d="M52 96 H80" />
        <path d="M53 105 H79" />
      </g>

      {/* trailing vines below the pot */}
      <g fill="none" stroke={PALETTE.softTeal} strokeWidth="1.6" strokeLinecap="round">
        <path d="M58 122 C54 134 56 146 50 154" opacity="0.8" />
        <path d="M74 122 C79 132 76 142 80 150" opacity="0.7" />
      </g>
      <g fill={PALETTE.sage}>
        <path d="M50 154c-4-1-6-5-5-8 3 1 6 4 5 8Z" />
        <path d="M55 140c-4 0-7-3-7-6 4-1 7 2 7 6Z" opacity="0.9" />
        <path d="M80 150c4-1 6-4 5-7-3 0-6 3-5 7Z" opacity="0.88" />
        <path d="M77 134c4 0 7-3 7-6-4-1-7 2-7 6Z" opacity="0.85" />
      </g>
    </svg>
  );
}

/* ── FramedNote ─────────────────────────────────────────────────────────── */

type FramedNoteProps = { className?: string };

/**
 * A small framed wall picture (wood border, cream-card interior, faint drop
 * shadow) holding the handwritten-feeling line "You're doing great" in the
 * italic display serif, with a tiny coral heart beneath. Text is rendered as
 * <text> so it inherits the brand serif and stays crisp at any size.
 */
export function FramedNote({ className }: FramedNoteProps) {
  return (
    <svg
      width={160}
      height={132}
      viewBox="0 0 160 132"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      {/* soft drop shadow */}
      <rect x="9" y="13" width="148" height="116" rx="9" fill={PALETTE.ink} opacity="0.08" />
      {/* frame shell */}
      <rect
        x="6"
        y="8"
        width="148"
        height="116"
        rx="8"
        fill={PALETTE.card}
        stroke={PALETTE.wood}
        strokeWidth="5"
      />

      <text
        x="80"
        y="46"
        textAnchor="middle"
        fill={PALETTE.teal}
        style={{ fontFamily: "var(--font-display)", fontStyle: "italic" }}
        fontSize="21"
      >
        You&rsquo;re
      </text>
      <text
        x="80"
        y="74"
        textAnchor="middle"
        fill={PALETTE.teal}
        style={{ fontFamily: "var(--font-display)", fontStyle: "italic" }}
        fontSize="21"
      >
        doing great
      </text>

      {/* tiny coral heart */}
      <path
        d="M80 102s-5-3.3-5-6.6A2.6 2.6 0 0 1 80 93a2.6 2.6 0 0 1 5 1.9C85 98.7 80 102 80 102Z"
        fill={PALETTE.coral}
      />
    </svg>
  );
}

/* ── FramedLeaf ─────────────────────────────────────────────────────────── */

type FramedLeafProps = { className?: string };

/**
 * A companion framed wall picture with a minimalist sage sprig line sketch —
 * a single stem with a few rounded leaves. Same frame shell as FramedNote, no
 * text, so the pair reads as a little gallery wall.
 */
export function FramedLeaf({ className }: FramedLeafProps) {
  return (
    <svg
      width={150}
      height={130}
      viewBox="0 0 150 130"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <rect x="9" y="13" width="135" height="111" rx="9" fill={PALETTE.ink} opacity="0.08" />
      <rect
        x="6"
        y="8"
        width="135"
        height="111"
        rx="8"
        fill={PALETTE.card}
        stroke={PALETTE.wood}
        strokeWidth="5"
      />

      {/* stem */}
      <path
        d="M74 100 C70 78 72 56 80 36"
        stroke={PALETTE.softTeal}
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
      {/* leaves along the sprig */}
      <g fill={PALETTE.sage}>
        <path d="M73 84c-9-1-15-7-14-14 8-1 14 6 14 14Z" />
        <path d="M75 70c8-2 14-9 12-16-8 0-13 8-12 16Z" opacity="0.92" />
        <path d="M75 58c-8-2-13-9-11-16 8 0 13 8 11 16Z" opacity="0.9" />
        <path d="M80 42c7-3 11-10 9-17-7 2-11 10-9 17Z" opacity="0.88" />
      </g>
      <g stroke={PALETTE.softTeal} strokeWidth="0.9" strokeLinecap="round" opacity="0.45" fill="none">
        <path d="M62 73c4 3 8 5 11 6" />
        <path d="M86 57c-4 3-8 5-11 6" />
      </g>
    </svg>
  );
}

/* ── Squiggle ───────────────────────────────────────────────────────────── */

type SquiggleProps = { className?: string; color?: string };

/**
 * A loopy hand-drawn flourish — a short line that loops once on its way
 * across. Doubles as an underline accent and as a floating doodle. Soft teal
 * by default, rounded caps.
 */
export function Squiggle({ className, color = PALETTE.softTeal }: SquiggleProps) {
  return (
    <svg
      width={84}
      height={28}
      viewBox="0 0 84 28"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M3 18 C14 8 22 8 30 16 C37 23 32 8 24 9 C18 10 26 22 40 20 C56 17 66 12 81 17"
        stroke={color}
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ── HeartDoodle ────────────────────────────────────────────────────────── */

type HeartDoodleProps = { className?: string; size?: number };

/**
 * A tiny open-outline heart, coral stroke (not filled), slightly imperfect —
 * sits next to an eyebrow line for a warm aside.
 */
export function HeartDoodle({ className, size = 18 }: HeartDoodleProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M12 20s-7-4.6-7-9.3A3.7 3.7 0 0 1 12 8a3.7 3.7 0 0 1 7 2.7C19 15.4 12 20 12 20Z"
        stroke={PALETTE.coral}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ── Underline ──────────────────────────────────────────────────────────── */

type UnderlineProps = { className?: string; color?: string };

/**
 * A rough, slightly wavy underline stroke that tapers at the ends — for
 * underlining an eyebrow word. Coral by default.
 */
export function Underline({ className, color = PALETTE.coral }: UnderlineProps) {
  return (
    <svg
      width={120}
      height={14}
      viewBox="0 0 120 14"
      fill="none"
      aria-hidden="true"
      className={className}
      preserveAspectRatio="none"
    >
      <path
        d="M4 8 C28 3 52 3 76 6 C92 8 104 7 116 5"
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}
