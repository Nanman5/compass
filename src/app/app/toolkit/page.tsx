/**
 * /app/toolkit — the Toolkit tab: a clean directory of every Compass tool.
 *
 * Server component shell that sets the page title and renders ToolkitGrid, which provides the
 * AppShell chrome (aurora + sidebar + bottom nav) and the grid of tool cards.
 */

import ToolkitGrid from "@/components/ToolkitGrid";

export const metadata = {
  title: "Compass — Your toolkit",
};

export default function ToolkitPage() {
  return <ToolkitGrid />;
}
