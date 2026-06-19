/**
 * /app — the Compass product demo.
 *
 * For this milestone the demo opens ONE feature end-to-end: the conversational
 * onboarding. The Coach, Win Logger, and Memory surfaces are shown as "coming soon"
 * once onboarding completes (see OnboardingChat). The screen is a client component
 * because the whole experience is interactive and stateful.
 */

import OnboardingChat from "@/components/OnboardingChat";

export const metadata = {
  title: "Compass — Let's get to know your family",
};

export default function AppPage() {
  return <OnboardingChat />;
}
