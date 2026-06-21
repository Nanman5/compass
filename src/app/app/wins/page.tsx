/**
 * /app/wins — the daily Check-in.
 *
 * A gentle, once-a-day reflection: how the day felt, the root win worth keeping, and an
 * optional note. Each check-in is recorded as an episode so it becomes part of the family's
 * history. The surface is interactive and per-family, so the work lives in a client component
 * (which supplies its own <AppShell active="checkin">).
 */

import WinLogger from "@/components/WinLogger";

export const metadata = {
  title: "Compass — How did today go?",
};

export default function WinsPage() {
  return <WinLogger />;
}
