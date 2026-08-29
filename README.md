# Sagar — Writer Portfolio

A **six-page**, zero-build static portfolio for **Sagar Vishwakarma**, an email
copywriter, short-form video scriptwriter and long-form business writer. No bundler, no npm install, no CI step — pushing
the repo *is* the deploy.

Page order mirrors the source document's tab structure exactly:

| # | Page | File |
|---|---|---|
| 01 | Profile | `index.html` |
| 02 | Email Copywriting | `email-copywriting.html` |
| 03 | Video Scriptwriting | `scriptwriting.html` |
| 04 | Resume + published articles | `resume.html` |
| 05 | About | `about.html` |
| 06 | Contact | `contact.html` |

```
*.html                  the six generated pages (committed — Pages serves these)
src/pages/*.html        page body fragments        ─┐ edit these,
src/partials/*.html     shared markup               │ then run the generator
tools/build.mjs         page generator (dev only)  ─┘
assets/css/style.css    hand-written CSS, design tokens on :root
assets/js/main.js       vanilla JS, progressive enhancement only
assets/img/             portrait, about photo, 4 case-study images, favicon, OG card
assets/Sagar-Vishwakarma-Resume.pdf   placeholder — replace with the real resume
tests/                  two zero-dependency suites
.nojekyll               stops GitHub Pages running Jekyll over assets/
```

## Editing content

Edit a fragment in `src/pages/`, then regenerate:

```bash
node tools/build.mjs           # rewrite the six pages
node tools/build.mjs --check   # fail if committed output is stale
```

The generator exists so the shared `<head>`, header, nav, pager and footer cannot
drift across six files. **It is a dev tool, not a deploy step** — the generated
HTML is committed and GitHub Pages never runs it. `tests/check.mjs` runs
`--check`, so stale output fails the build.

## Run locally

```bash
python3 -m http.server 8000
# → http://localhost:8000
```

## Test

Two zero-dependency suites. Both exit non-zero on failure; no `npm install`.

```bash
node tests/check.mjs           # static analysis   — 42 checks
node tests/browser-check.mjs   # real browser      — 31 checks
```

**`check.mjs`** reads the source files and runs most checks **once per page**:
one `<h1>` each, no skipped heading levels, unique titles, GitHub Pages path
safety, every internal link and asset resolving, image/ARIA completeness, SEO
head tags and JSON-LD. Site-wide it verifies the nav is byte-identical across all
six pages, each page marks itself `aria-current="page"`, the prev/next pager
chains 01→06 in document order, the generated output is in sync with `src/`,
content completeness against the source doc, and it recomputes WCAG contrast for
every colour token pair in both themes.

**`browser-check.mjs`** drives headless Chrome over CDP (Node's built-in
WebSocket — no Playwright/Puppeteer needed) and asserts what a static scan
cannot see — most of it swept across **all six pages**: no horizontal scroll at
375/768/1024/1440, every page fully revealing its content, the nav marking the
current page, the pager walking 01→06 by clicking through, the full dialog
lifecycle (open → focus → Esc → focus restored → scroll unlocked), the bilingual
toggle, theme toggle and persistence, OS dark-mode preference, reduced motion,
the JS-disabled path, `main.js` failing to load, 44px touch targets, and it
recomputes contrast on **every rendered text node** against its composited
background in both themes.

It auto-discovers Chrome (Playwright cache, Chrome, Chromium, Brave) and exits 0
with a `SKIP` notice if none is installed. Point it at a specific binary with
`--browser <path>`.

Both suites have been mutation-tested — deliberately broken inputs were verified
to fail them.

## Deploy to GitHub Pages

```bash
git init && git add . && git commit -m "Portfolio site"
git branch -M main
git remote add origin git@github.com:<user>/<repo>.git
git push -u origin main
```

Then **Settings → Pages → Source: "Deploy from a branch" → `main` / `(root)`**.

- **User site** (`<user>.github.io`): repo must be named exactly that; serves from `/`.
- **Project site** (any other repo name): serves from `/<repo>/`. Every asset path
  in this project is **relative** precisely so both work unchanged — do not
  convert them to `/assets/...`, it will 404 on a project site. `tests/check.mjs`
  enforces this.
- Custom domain: add a `CNAME` file containing the bare domain, then set it under
  Settings → Pages.

No GitHub Actions workflow is needed or included.

## Design system

Warm editorial / type-led. Palette and type direction sourced from
`ui-ux-pro-max` (*News Editorial*, *Notes & Writing App*) and adapted; every pair
below is verified and re-asserted by the test suite.

| Token | Light | Dark |
|---|---|---|
| `--paper` | `#FCFAF5` | `#14130F` |
| `--card` | `#FFFFFF` | `#1B1A15` |
| `--ink` | `#171614` | `#F2EEE5` |
| `--ink-muted` | `#57534E` | `#A8A29E` |
| `--accent` (text/links) | `#B45309` | `#FBBF24` |
| `--accent-deco` (decoration only) | `#D97706` | `#FBBF24` |
| `--rule` | `#E7E2D7` | `#2A2823` |

`--accent-deco` is **3.05:1** in light mode — legal for rules, borders and large
type, never for body text. The suite fails the build if it is used as a text colour.

Type: **Newsreader** (headings + all prose), **Inter** (UI), **JetBrains Mono**
(labels). Prose is capped at `68ch`.

## Behaviour notes

- **Everything works with JavaScript disabled.** Scripts live in `<details>`
  elements; JS upgrades them to a `<dialog>` modal and hides the disclosure.
  Scroll-reveal is gated behind a `.js` class set before first paint, so no-JS
  visitors never see a blank page.
- **The reveal gate is failsafe.** If `main.js` 404s, is blocked, or throws, the
  `.js` gate would otherwise leave everything below the fold invisible. The head
  script arms a 3s timer that drops the gate, and the `<script>` tag carries an
  `onerror` that drops it immediately. Both suites assert this — remove either
  guard and the build fails.
- Theme follows the OS by default; the toggle overrides it in both directions and
  persists to `localStorage` (wrapped in `try/catch` for private-mode browsers).
- The bilingual switch sets `lang="hi-Latn"` on the Hinglish blocks so screen
  readers don't read romanised Hindi as English.
- All motion is `opacity`/`transform` only and respects `prefers-reduced-motion`.

## Before going live

The source document was fully mined — all 16 tabs, all 6 embedded images, and the
hyperlink targets that a plaintext export drops. What remains:

- [ ] **YouTube URLs for the four scripts** — the doc calls them "most-viewed
      videos" but links to none. Channel is `youtube.com/@gagarmesagarr`.
- [ ] **Real campaign metrics** for the Results strip — still `——`. The dashboard
      image in the doc is stock art with invented numbers (24,689 sent / 42.8%
      open / 8.7% click), so it is captioned as illustrative rather than passed
      off as Reqx data.
- [ ] **Real resume PDF** → replace `assets/Sagar-Vishwakarma-Resume.pdf`
- [ ] Replace `https://example.github.io/` in the canonical tag, `robots.txt` and
      `sitemap.xml` with the real domain

Already in place: the hero portrait (1:1), the About photo (3:4), all four
case-study images, all four social profile links, and the seven published
Accodigit articles.

## Published articles

Seven long-form pieces are linked from the Resume page, each with its published
title and verbatim opening hook. All are bylined **Sagar Vishwakarma** on
`accodigit.com` — which is where the surname used across the site and in the
JSON-LD comes from. `tests/check.mjs` asserts all seven URLs are present, that
the card count matches, and that every external link carries
`rel="noopener"` + `target="_blank"`.

If you would rather they had their own page (`07 — Articles`, or promoted above
Resume), it is a small change: add an entry to `PAGES` in `tools/build.mjs`, move
the block into a new `src/pages/_articles.html`, and regenerate. The nav, pager,
sitemap and numbering all follow automatically.

## What the source document actually specifies

Worth recording, because a plaintext export of the doc hides most of it:

- **16 tabs, not 11.** `2nd`–`4th Page`, `6th Page`, `Other info` and `Resume`
  are present but empty.
- **The `1:1` and `3:4` notes are image aspect ratios**, and the numbered page
  tabs decode the intended page order: Profile (1st, 1:1) → Email Copywriter
  (2nd) → Video Scriptwriter (3rd) → Resume (4th) → About me (5th, 3:4) →
  Contact (6th). Verified against the embedded originals: the Profile image is
  1024x1024 and the About image is 1086x1448.
- **Six embedded images**, all stock photography — a portrait, a whiteboard, two
  desk shots, and a mocked-up analytics dashboard.
- **No UI design whatsoever.** Zero positioned objects, zero drawings, zero
  tables, and the only links in the entire document are the four social profiles.
  There are no mockups, wireframes, colours, fonts, or references anywhere in it.
  The visual direction in this build is therefore an original proposal, not a
  transcription of a design.

## Copy corrections already applied

The source doc had defects; these were fixed in the build and are asserted by the
test suite:

1. Email sample #2 quoted **three conflicting metrics** for one result (40% in the
   preview text, "45 days → 18 days" in the body, then "60% reduction in total
   fill-time"). Normalised to **60%** throughout, and the garbled clause rewritten.
2. `"is a priority right now, Worth a quick 5-minute chat"` → `"…is it worth a
   quick 5-minute chat"` (stray capital + comma splice).
3. Client was anonymised in the intro but named **Reqx Technologies** in the
   signatures — now named consistently.
4. `specialized` → `specialised` to match the doc's British spelling elsewhere.

Voice, rhythm and word choice are otherwise untouched. Full source content is
preserved verbatim in `content-raw.md`.
