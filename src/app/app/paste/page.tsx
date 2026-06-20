/**
 * /app/paste — Paste & Personalize.
 *
 * The parent drops in something they found in the wild (a reel, an article, a screenshot
 * of advice); Compass reads it, checks it against trusted guidance, and returns ONE next
 * step fit to their child. The whole surface is interactive, so the screen is a client
 * component (see PastePersonalize).
 */

import PastePersonalize from "@/components/PastePersonalize";

export const metadata = {
  title: "Compass — Paste & Personalize",
};

export default function PastePage() {
  return <PastePersonalize />;
}
