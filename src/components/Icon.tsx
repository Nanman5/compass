/**
 * Icon — a tiny set of hand-tuned line icons used across the landing's feature
 * cards and list rows. Stroke-based, 24×24, currentColor so each icon inherits
 * the color of its tinted chip. Decorative by default (aria-hidden); pass a
 * `title` only if an icon ever needs to be meaningful on its own.
 *
 * Kept inline (no binary assets) so the marks live in the design system and
 * recolor with the brand palette. Add new glyphs here as sections need them.
 */

export type IconName =
  | "chat" // conversational onboarding
  | "note" // paste & personalize
  | "feed" // weekly drop
  | "mic" // voice coach
  | "calendar" // planned activities
  | "loop" // win logger + improvement loop
  | "book" // study
  | "bulb" // tip
  | "shield" // activity
  | "check"; // checklist rows

const PATHS: Record<IconName, React.ReactNode> = {
  chat: <path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 9.5 9.5 0 0 1-3.6-.7L3 21l1.7-5.4A8.38 8.38 0 0 1 4 11.5 8.5 8.5 0 0 1 12.5 3 8.38 8.38 0 0 1 21 11.5Z" />,
  note: (
    <>
      <path d="M14 3v4a1 1 0 0 0 1 1h4" />
      <path d="M19 8.5V19a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5.5Z" />
      <path d="M9 13h6M9 17h4" />
    </>
  ),
  feed: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 9h18M8 4v16" />
    </>
  ),
  mic: (
    <>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 9h18M8 3v4M16 3v4" />
      <path d="m9.5 15 2 2 3.5-3.5" />
    </>
  ),
  loop: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12 2.5 2.5L16 9" />
    </>
  ),
  book: <path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H11a2 2 0 0 1 2 2v15a2 2 0 0 0-2-2H5.5A1.5 1.5 0 0 1 4 16.5Zm9 .5a2 2 0 0 1 2-2h3.5A1.5 1.5 0 0 1 20 4.5v12a1.5 1.5 0 0 1-1.5 1.5H15a2 2 0 0 0-2 2Z" />,
  bulb: (
    <>
      <path d="M9 18h6M10 21h4" />
      <path d="M12 3a6 6 0 0 0-3.6 10.8c.5.4.8 1 .9 1.7l.1.5h5.2l.1-.5c.1-.7.4-1.3.9-1.7A6 6 0 0 0 12 3Z" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3 5 6v5c0 4.5 3 7.6 7 9 4-1.4 7-4.5 7-9V6l-7-3Z" />
      <path d="m9.5 12 1.8 1.8L15 10" />
    </>
  ),
  check: <path d="m20 6-11 11-5-5" />,
};

export function Icon({
  name,
  size = 24,
  className,
  title,
}: {
  name: IconName;
  size?: number;
  className?: string;
  title?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      {title ? <title>{title}</title> : null}
      {PATHS[name]}
    </svg>
  );
}
