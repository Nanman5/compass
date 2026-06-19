# Project Hub — Design Spec

*Status: approved · Date: 2026-06-19 · Authors: Hernan L., Shondalle C., Katlyn V.*

---

## 1. Summary

A self-hosted, "Linktree-but-own" landing page that exposes the school consulting
deliverable and links to its resources (live demo, source repo, concept doc, video/slides).

It is a **single static `index.html`** — no build, no dependencies, no `node_modules` —
deployable identically to GitHub Pages, Vercel, or a homeserver. It lives in its **own
sibling repo** (`compass-hub/`), independent of the `compass` demo's lifecycle.

The page is **super-personalizable** through one inline `SITE` config object: title,
subtitle, authors, accent color, and the card list all render from it. Editing a link or
renaming the project means editing that object and nothing else.

## 2. Goals & Non-Goals

### Goals
- One-stop hub linking the deliverable's resources, shareable as a single URL.
- Maximum portability / self-hostability: a single file that works on GH Pages, Vercel,
  a homeserver, or even `file://` — no external network requests at runtime.
- Easy to re-edit: all content in one inline config object, no build step to regenerate.
- Polished, dark, dramatic "project showcase" aesthetic with an editorial nod to Compass.

### Non-Goals (YAGNI)
- No framework, bundler, or `node_modules`.
- No runtime JSON fetch (data is inline so it works from `file://` and offline).
- No CMS, analytics, auth, theme-switcher, or multi-page routing.
- Not coupled to the `compass` repo build or deploy.

## 3. Audience & Success Criteria

**Audience:** the course instructor (Dr. Walker), classmates, and anyone the team shares
the link with to review the deliverable.

**Success criteria:**
- A visitor lands and within seconds understands what the project is, who made it, and can
  reach the demo / repo / doc / video in one click each.
- The team can change any link or label by editing a single object, then re-deploy by
  copying one file.
- The same `index.html` deploys unchanged to GH Pages, Vercel, and a homeserver.

## 4. Structure & Location

```
compass-hub/                 # new repo, sibling to compass/ (NOT inside it)
├── index.html               # the entire site (markup + styles + SITE config)
├── README.md                # deploy notes (GH Pages / Vercel / homeserver)
└── .nojekyll                # so GitHub Pages serves files verbatim
```

`index.html` is fully self-contained: inline `<style>`, inline SVG icons, inline SVG
favicon via data-URI, and the `SITE` config in an inline `<script>` that renders the cards.

## 5. Content Model — the `SITE` config

A single plain-JS object at the top of the inline `<script>`. The page renders entirely
from it; this is the only thing a maintainer edits.

```js
const SITE = {
  title: "AI & Cloud-Powered Family Support Prototypes",
  subtitle: "Consulting for Dr. Walker's Family Life Class",
  authors: ["Hernan L.", "Shondalle C.", "Katlyn V."],
  accent: "#e8643c",                 // single source of the accent color
  cards: [
    { icon: "play",  label: "Live Demo",      note: "Compass — the working prototype", href: "#TODO-demo-url"  },
    { icon: "code",  label: "GitHub Repo",    note: "Source code",                     href: "#TODO-repo-url"  },
    { icon: "doc",   label: "Concept Doc",    note: "Design spec & rationale",         href: "#TODO-doc-url"   },
    { icon: "video", label: "Video / Slides", note: "Walkthrough & presentation",      href: "#TODO-video-url" },
  ],
};
```

- `accent` is applied via a CSS custom property (`--accent`) set on `:root` from JS, so one
  line restyles glows, borders, and hovers.
- `icon` maps to one of a small inline SVG set: `play`, `code`, `doc`, `video` (and a
  fallback for unknown names). Adding a card with a known icon name requires no other change.
- `href` values are clearly marked `#TODO-*` placeholders for the team to fill in. A card
  whose href still starts with `#TODO` renders with a subtle "coming soon" state rather than
  a dead link.

## 6. Layout & Visual Design

**Layout:** hero + card grid.
- **Hero**: large serif display `title`, sans `subtitle`, and an author byline
  (`authors.join(" · ")`). A soft radial accent-glow sits behind the title.
- **Grid**: the `cards` rendered as a responsive grid — 2 columns on desktop, 1 column on
  mobile. Each card shows its inline SVG icon, `label`, and `note`.

**Aesthetic — dark & dramatic, editorial:**
- Near-black background (`#0a0b10`) with a subtle radial accent-glow and faint grain/noise
  for depth (CSS gradients only — no image assets).
- **Serif display** headline (high contrast) + clean sans body. System font stacks only
  (e.g. `ui-serif, Georgia, …` and `ui-sans-serif, system-ui, …`) so there is **no font CDN
  dependency** and it renders offline.
- **Cards**: glassy surface (subtle translucent fill + 1px border + slight backdrop blur),
  rounded corners. Hover/focus: gentle lift (`translateY`) + accent-tinted glow/border.
- **Motion**: a soft staggered fade-up on load; smooth hover transitions. Nothing flashy.

## 7. Correctness, Accessibility & Sharing

- **Responsive**, mobile-first; grid collapses to one column on narrow screens.
- **Keyboard accessible**: cards are real `<a>` elements, visibly focusable; focus ring uses
  the accent.
- **`prefers-reduced-motion: reduce`** disables entrance animation and transitions.
- **Color contrast**: body and labels meet WCAG AA against the dark background.
- **Meta**: `<title>`, description, and Open Graph + Twitter Card tags (text-based) derived
  from the project title/subtitle so shared links preview cleanly. An optional OG image is
  out of scope for v1 (documented as a future nicety in the README).
- **Self-contained**: no external requests at runtime (no CDN fonts, no analytics), so it
  works on a homeserver or from `file://` with zero setup.

## 8. Deployment

The same `index.html` deploys three ways (documented in `README.md`):
- **GitHub Pages**: push the repo, enable Pages on the default branch; `.nojekyll` ensures
  files are served verbatim.
- **Vercel**: import the repo; zero config (static output, no framework).
- **Homeserver**: serve the folder with `python3 -m http.server`, nginx, or caddy.

## 9. Risks & Mitigations

- **Placeholder links shipped live** → `#TODO-*` hrefs render in a visible "coming soon"
  state and are listed in the README so they aren't forgotten.
- **Single-file growth** → if the file ever grows unwieldy, the config object can later move
  to a separate `site.config.js`; not needed for v1 and explicitly deferred (YAGNI).
- **Author name finalization** → bylines come from the `authors` array; trivial to update.

## 10. Testing / Verification

Since there is no build or logic beyond rendering the config:
- Open `index.html` locally and visually verify hero, byline, and all four cards render,
  icons show, and hover/focus states work.
- Resize to mobile width and confirm the grid collapses to one column.
- Toggle reduced-motion and confirm animations are suppressed.
- Take a screenshot and review it before declaring done (per the team's visual-review rule).
