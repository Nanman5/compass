/**
 * CompassStar — Compass's signature mark.
 * An 8-point compass rose: four long cardinal rays + four short diagonals,
 * in the brand's coral / gold / teal. Used as the logo and as a recurring
 * section marker. Decorative by default (aria-hidden).
 */
export function CompassStar({
  size = 28,
  className,
  title,
}: {
  size?: number;
  className?: string;
  title?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      className={className}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      {title ? <title>{title}</title> : null}
      {/* diagonal short rays (gold) */}
      <path
        d="M24 24 L33 15 L24 13 L15 15 Z M24 24 L33 33 L35 24 L33 15 Z M24 24 L15 33 L24 35 L33 33 Z M24 24 L15 15 L13 24 L15 33 Z"
        fill="#e6b566"
        opacity="0.9"
      />
      {/* cardinal long rays (coral N/S, teal E/W) */}
      <path d="M24 1 L27.5 24 L24 24 L20.5 24 Z" fill="#e1785c" />
      <path d="M24 47 L20.5 24 L24 24 L27.5 24 Z" fill="#e1785c" />
      <path d="M47 24 L24 20.5 L24 24 L24 27.5 Z" fill="#1e4d4a" />
      <path d="M1 24 L24 27.5 L24 24 L24 20.5 Z" fill="#1e4d4a" />
      {/* center */}
      <circle cx="24" cy="24" r="3.4" fill="#1e4d4a" />
      <circle cx="24" cy="24" r="1.4" fill="#fbf7f0" />
    </svg>
  );
}

/** Wordmark: star + "Compass" in the display serif. */
export function CompassWordmark({ size = 26 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2">
      <CompassStar size={size} />
      <span
        style={{ fontFamily: "var(--font-display)" }}
        className="text-[1.35rem] font-semibold text-teal tracking-tight"
      >
        Compass
      </span>
    </span>
  );
}
