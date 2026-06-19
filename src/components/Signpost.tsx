/**
 * Signpost — a hand-illustrated wooden directional signpost for the landing footer.
 *
 * A weathered post planted in a little mound of grass and stones, with four
 * arrow-tipped planks stacked and pointing right: Understand · Connect · Guide · Grow.
 * Built to read as carved, dimensional wood (top-left light) in a warm watercolor
 * storybook scene — not a flat vector. Depth comes from linearGradients across the
 * post and each plank, light/dark beveled edges, grain strokes, and soft shadows.
 * Decorative (aria-hidden).
 */
export default function Signpost({ className }: { className?: string }) {
  // The four planks, top → bottom. Each is hung with a hair of rotation so the
  // row feels hand-mounted rather than machined.
  const planks: { label: string; y: number; rotate: number }[] = [
    { label: "Understand", y: 92, rotate: -1.4 },
    { label: "Connect", y: 138, rotate: 1.2 },
    { label: "Guide", y: 184, rotate: -0.9 },
    { label: "Grow", y: 230, rotate: 1.6 },
  ];

  // Plank geometry (local coordinates, before per-plank rotation).
  const PLANK_X = 44; // left edge
  const PLANK_W = 150; // body width before the arrow tip
  const PLANK_H = 34;
  const TIP = 22; // length of the pointed chevron tip

  return (
    <svg
      viewBox="0 0 240 300"
      fill="none"
      className={className}
      aria-hidden={true}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        {/* Post: light on the left edge, mid body, dark on the right — a round timber. */}
        <linearGradient id="sp-post" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#d8b388" />
          <stop offset="0.22" stopColor="#b98a5c" />
          <stop offset="0.78" stopColor="#a2754b" />
          <stop offset="1" stopColor="#8a6440" />
        </linearGradient>
        {/* Rounded weathered top cap with visible end-grain (lit from top-left). */}
        <radialGradient id="sp-cap" cx="0.38" cy="0.32" r="0.85">
          <stop offset="0" stopColor="#e3c298" />
          <stop offset="0.55" stopColor="#bb8e60" />
          <stop offset="1" stopColor="#8f6743" />
        </radialGradient>
        {/* Plank face: warm cream wood, lit top-left, settling darker toward the tip. */}
        <linearGradient id="sp-plank" x1="0" y1="0" x2="1" y2="0.35">
          <stop offset="0" stopColor="#f3e8cf" />
          <stop offset="0.45" stopColor="#efe2c6" />
          <stop offset="1" stopColor="#e0caa0" />
        </linearGradient>
        {/* Vertical sheen across the plank height to round the face. */}
        <linearGradient id="sp-plankV" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.35" />
          <stop offset="0.25" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="0.85" stopColor="#a07b4a" stopOpacity="0" />
          <stop offset="1" stopColor="#a07b4a" stopOpacity="0.35" />
        </linearGradient>
        {/* Stones — domed pebbles, lit top-left. */}
        <radialGradient id="sp-stoneA" cx="0.36" cy="0.3" r="0.85">
          <stop offset="0" stopColor="#f3efe6" />
          <stop offset="0.5" stopColor="#b4b1a3" />
          <stop offset="1" stopColor="#8d8a7d" />
        </radialGradient>
        <radialGradient id="sp-stoneB" cx="0.36" cy="0.3" r="0.85">
          <stop offset="0" stopColor="#eceadf" />
          <stop offset="0.5" stopColor="#a9a698" />
          <stop offset="1" stopColor="#827f72" />
        </radialGradient>
        {/* Grass blade gradient. */}
        <linearGradient id="sp-grass" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#789a7f" />
          <stop offset="1" stopColor="#8fb09a" />
        </linearGradient>
        {/* Soft blur for cast shadows. */}
        <filter id="sp-soft" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="2.4" />
        </filter>
      </defs>

      {/* ---- Ground shadow under the whole piece ---- */}
      <ellipse
        cx="118"
        cy="276"
        rx="74"
        ry="13"
        fill="#5c5340"
        opacity="0.18"
        filter="url(#sp-soft)"
      />

      {/* ---- Grass mound + tufts behind the base ---- */}
      <ellipse cx="116" cy="270" rx="58" ry="16" fill="#7fa389" opacity="0.55" />
      <g fill="url(#sp-grass)" stroke="#5f7e69" strokeWidth="0.6">
        <path d="M70 270 Q66 250 60 244 Q70 252 74 270 Z" />
        <path d="M80 271 Q80 246 76 238 Q88 250 88 271 Z" />
        <path d="M150 271 Q150 248 156 240 Q152 256 158 271 Z" />
        <path d="M162 270 Q166 250 174 246 Q166 256 170 270 Z" />
        <path d="M96 272 Q94 256 90 250 Q102 258 102 272 Z" opacity="0.9" />
      </g>

      {/* ---- The post ---- */}
      {/* Soft shadow the post throws to the lower-right on the ground. */}
      <path
        d="M104 250 L132 262 L130 268 L100 256 Z"
        fill="#5c5340"
        opacity="0.16"
        filter="url(#sp-soft)"
      />
      {/* Post body (slight taper, planted into the mound). */}
      <path
        d="M101 64 L116 64 L120 266 L99 266 Z"
        fill="url(#sp-post)"
      />
      {/* Left highlight edge + right shadow edge to carve the cylinder. */}
      <path d="M101 64 L106 64 L108 266 L99 266 Z" fill="#e2c096" opacity="0.45" />
      <path d="M112 64 L116 64 L120 266 L116 266 Z" fill="#6f4f31" opacity="0.5" />
      {/* Vertical grain lines down the post. */}
      <path d="M107 70 L110 260" stroke="#8a6440" strokeWidth="0.8" opacity="0.45" />
      <path d="M111 72 L114 258" stroke="#7a5536" strokeWidth="0.7" opacity="0.4" />

      {/* Weathered rounded top cap with end-grain rings. */}
      <ellipse cx="108.5" cy="64" rx="9.5" ry="5.2" fill="url(#sp-cap)" />
      <ellipse
        cx="108.5"
        cy="63.6"
        rx="6"
        ry="3.1"
        fill="none"
        stroke="#8a6440"
        strokeWidth="0.7"
        opacity="0.5"
      />
      <ellipse
        cx="108.5"
        cy="63.4"
        rx="2.6"
        ry="1.3"
        fill="none"
        stroke="#7a5536"
        strokeWidth="0.6"
        opacity="0.55"
      />

      {/* ---- The four planks ---- */}
      {planks.map(({ label, y, rotate }) => {
        const cx = PLANK_X + (PLANK_W + TIP) / 2;
        const cy = y + PLANK_H / 2;
        // Plank outline: rounded left corners, body, then a chevron tip on the right.
        const right = PLANK_X + PLANK_W;
        const tipX = right + TIP;
        const d = [
          `M${PLANK_X + 6} ${y}`,
          `L${right} ${y}`,
          `L${tipX} ${cy}`, // arrow point
          `L${right} ${y + PLANK_H}`,
          `L${PLANK_X + 6} ${y + PLANK_H}`,
          `Q${PLANK_X} ${y + PLANK_H} ${PLANK_X} ${y + PLANK_H - 6}`,
          `L${PLANK_X} ${y + 6}`,
          `Q${PLANK_X} ${y} ${PLANK_X + 6} ${y}`,
          "Z",
        ].join(" ");

        return (
          <g key={label} transform={`rotate(${rotate} ${cx} ${cy})`}>
            {/* Shadow the plank casts down onto the post / next plank. */}
            <path
              d={d}
              fill="#5c4631"
              opacity="0.22"
              filter="url(#sp-soft)"
              transform="translate(2.5 4)"
            />
            {/* Plank face. */}
            <path d={d} fill="url(#sp-plank)" />
            {/* Rounded vertical sheen for face curvature. */}
            <path d={d} fill="url(#sp-plankV)" />
            {/* Carved-edge bevels: light top, dark bottom + dark along the arrow tip. */}
            <path
              d={`M${PLANK_X + 6} ${y + 1.5} L${right + 1} ${y + 1.5}`}
              stroke="#fff7e6"
              strokeWidth="1.6"
              opacity="0.7"
              strokeLinecap="round"
            />
            <path
              d={`M${PLANK_X + 6} ${y + PLANK_H - 1.5} L${right} ${y + PLANK_H - 1.5}`}
              stroke="#a07b4a"
              strokeWidth="1.8"
              opacity="0.55"
              strokeLinecap="round"
            />
            <path
              d={`M${right} ${y + PLANK_H} L${tipX} ${cy}`}
              stroke="#8a6440"
              strokeWidth="1.6"
              opacity="0.5"
              strokeLinecap="round"
            />
            {/* Outline to seat it as a solid plank. */}
            <path d={d} fill="none" stroke="#b7935f" strokeWidth="1.1" opacity="0.8" />
            {/* Wood grain streaks along the plank. */}
            <path
              d={`M${PLANK_X + 10} ${y + 12} Q${cx} ${y + 9} ${tipX - 8} ${y + 13}`}
              stroke="#cdae7c"
              strokeWidth="0.8"
              opacity="0.5"
              fill="none"
            />
            <path
              d={`M${PLANK_X + 10} ${y + 24} Q${cx} ${y + 27} ${right} ${y + 24}`}
              stroke="#cdae7c"
              strokeWidth="0.7"
              opacity="0.4"
              fill="none"
            />
            {/* Two nail heads where the plank meets the post. */}
            <circle cx={108} cy={y + 8} r="2.1" fill="#5e4630" />
            <circle cx={107.4} cy={y + 7.4} r="0.7" fill="#c9ad84" opacity="0.8" />
            <circle cx={108} cy={y + PLANK_H - 8} r="2.1" fill="#5e4630" />
            <circle cx={107.4} cy={y + PLANK_H - 8.6} r="0.7" fill="#c9ad84" opacity="0.8" />
            {/* The word, in the brand serif, deep teal. */}
            <text
              x={PLANK_X + PLANK_W / 2 + 8}
              y={cy + 5.5}
              textAnchor="middle"
              fontSize="17"
              fontWeight={600}
              fill="#1e4d4a"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {label}
            </text>
          </g>
        );
      })}

      {/* ---- Stones at the base (drawn last so they overlap the post foot) ---- */}
      <ellipse cx="92" cy="266" rx="16" ry="10" fill="url(#sp-stoneA)" />
      <ellipse
        cx="88"
        cy="262"
        rx="6"
        ry="3"
        fill="#f3efe6"
        opacity="0.6"
      />
      <ellipse cx="138" cy="270" rx="13" ry="8" fill="url(#sp-stoneB)" />
      <ellipse cx="135" cy="266" rx="5" ry="2.4" fill="#f3efe6" opacity="0.55" />
      <ellipse cx="118" cy="274" rx="10" ry="6" fill="url(#sp-stoneA)" opacity="0.95" />
      <ellipse cx="116" cy="271" rx="4" ry="2" fill="#f3efe6" opacity="0.5" />

      {/* A few foreground grass blades poking up over the stones. */}
      <g fill="url(#sp-grass)" stroke="#5f7e69" strokeWidth="0.6">
        <path d="M104 270 Q102 256 98 250 Q110 258 110 270 Z" />
        <path d="M126 271 Q128 258 134 252 Q128 262 132 271 Z" opacity="0.9" />
      </g>
    </svg>
  );
}
