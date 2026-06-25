"use client";

/**
 * SmoothScroll — buttery, inertia-based scrolling for the marketing landing.
 *
 * Wraps Lenis around the window scroll: the wheel/trackpad gets a gentle ease instead of
 * the browser's abrupt jump, and same-page anchor links (#features…) glide rather than snap
 * (offset for the sticky header). Mounted ONLY on the landing, so /app's locked-shell inner
 * scroll panes are never touched. Touch devices keep native scrolling (Lenis default), which
 * feels better on a phone and sidesteps momentum quirks.
 */

import { useEffect } from "react";

import Lenis from "lenis";

export default function SmoothScroll() {
  useEffect(() => {
    // Respect reduced-motion: don't hijack scroll for users who asked for less motion.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const lenis = new Lenis({ lerp: 0.1, smoothWheel: true });

    let rafId = 0;
    const loop = (time: number) => {
      lenis.raf(time);
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);

    // A long, eased glide so jumping to a section feels like a soft fade, not a snap.
    // easeInOutCubic: slow to leave, slow to arrive — the "cool, smooth" feel.
    const easeInOutCubic = (t: number) =>
      t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    const glideTo = (target: HTMLElement) =>
      lenis.scrollTo(target, { offset: -72, duration: 1.25, easing: easeInOutCubic });

    // Smooth same-page anchor jumps, accounting for the ~64px sticky header.
    const onClick = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement | null)?.closest('a[href^="#"]');
      const href = anchor?.getAttribute("href");
      if (!href || href === "#") return;
      const target = document.querySelector(href);
      if (!target) return;
      e.preventDefault();
      history.pushState(null, "", href);
      glideTo(target as HTMLElement);
    };
    document.addEventListener("click", onClick);

    // If the page loads already pointing at a section (e.g. a shared #pricing link),
    // glide to it once instead of the browser's hard jump.
    const initialHash = window.location.hash;
    if (initialHash && initialHash !== "#") {
      const target = document.querySelector(initialHash);
      if (target) requestAnimationFrame(() => glideTo(target as HTMLElement));
    }

    return () => {
      document.removeEventListener("click", onClick);
      cancelAnimationFrame(rafId);
      lenis.destroy();
    };
  }, []);

  return null;
}
