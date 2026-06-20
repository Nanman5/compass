/**
 * /app/wins — the Win Logger.
 *
 * Lists the steps a parent has tried (their episodic memory) and invites a gentle
 * "how did it go?" reflection on the ones not yet logged. The whole surface is
 * interactive and per-family, so the work lives in a client component.
 */

import WinLogger from "@/components/WinLogger";

export const metadata = {
  title: "Compass — How did it go?",
};

export default function WinsPage() {
  return <WinLogger />;
}
