/**
 * /app/coach — "Your one next step".
 *
 * The Coach surface: a parent describes an in-the-moment struggle and Compass returns a
 * single concrete next step (plus when to put the screen away), grounded in cited evidence,
 * with a collapsible "Behind the scenes" panel of the agent's trajectory. The screen is a
 * client component (CoachExperience) because the whole experience is interactive and
 * stateful — this server file just sets metadata and mounts it.
 */

import CoachExperience from "@/components/CoachExperience";

export const metadata = {
  title: "Compass — Your one next step",
};

export default function CoachPage() {
  return <CoachExperience />;
}
