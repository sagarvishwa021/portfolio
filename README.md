# Sagar Vishwakarma — Writer Portfolio

A **single-page**, zero-build static portfolio for **Sagar Vishwakarma** — email
copywriter, short-form video scriptwriter and long-form business writer. No
bundler, no npm install, no CI step: pushing the repo *is* the deploy.

Layout follows the hand-drawn wireframes in the source document: a wordmark bar,
intro with a round profile photo, a sticky tab strip, then featured writing
samples and four tabbed sections.

| Tab | Section | Contents |
|---|---|---|
| — | Profile | Hero + seven featured writing samples |
| Work Samples | `#work` | Reqx email case study + four video scripts |
| Resume | `#resume` | Preview, PDF + Word downloads, experience, skills, education |
| About Me | `#about` | Narrative bio, 3:4 photo |
| Contact | `#contact` | Email, phone, four social profiles as icons |

The tab strip is sticky: it rides up with the hero, pins to the top, and the
active tab updates automatically as you scroll. A tab lights when its section
**dominates the screen** — the scroll-spy picks whichever section has the largest
visible area between the pinned strip and the foot of the viewport, with
hysteresis (35% to light, 10% to release) so nothing flickers at either end. The
featured writing samples count as Work Samples, so there is no stretch of page
with no tab lit. Each tab is a small photo card —
the picture is shown at full strength with the label on its own solid bar
beneath, so the photograph never has to be dimmed to keep text readable. The
active tab gets a wider card, a taller picture and an accent rule. Nothing about
the size change is transitioned: animating width/height/font-size forces layout
every frame and makes the switch feel laggy, so only paint and composite
properties animate. A test enforces both the ban and a 110px height budget for
the whole strip.

```
index.html              the generated page (committed — Pages serves this)
src/pages/*.html        section fragments        ─┐ edit these,
src/partials/*.html     shared markup             │ then run the generator
tools/build.mjs         page generator (dev only)─┘
assets/css/style.css    hand-written CSS, design tokens on :root
assets/js/main.js       vanilla JS, progressive enhancement only
assets/img/             portrait, about photo, case images, tab imagery, resume preview
assets/Sagar-Vishwakarma-Resume.pdf / .docx
tests/                  two zero-dependency suites
.nojekyll               stops GitHub Pages running Jekyll over assets/
```

## Editing content

```bash
node tools/build.mjs           # regenerate index.html
node tools/build.mjs --check   # fail if the committed page is stale
```

The generator keeps the head, header, tab strip and footer in one place.
**It is a dev tool, not a deploy step** — the HTML is committed and GitHub Pages
never runs it. `tests/check.mjs` runs `--check`, so stale output fails the build.

## Run locally

```bash
python3 -m http.server 8000
# → http://localhost:8000
```

## Test

Two zero-dependency suites. Both exit non-zero on failure; no `npm install`.

```bash
node tests/check.mjs           # static analysis   — 55 checks
node tests/browser-check.mjs   # real browser      — 38 checks
```

**`check.mjs`** reads the source files: one `<h1>` and no skipped heading
levels, GitHub Pages path safety, every asset and anchor resolving, image/ARIA
completeness, SEO head tags and JSON-LD, the tab strip's shape (four tabs, no
numbering, each pointing at a real section in document order), the static strip
ground and per-tab imagery, the reveal failsafe, content completeness against
the source doc and CV, the reel-to-script mapping, and it recomputes WCAG
contrast for every colour token pair in both themes.

**`browser-check.mjs`** drives headless Chrome over CDP (Node's built-in
WebSocket — no Playwright/Puppeteer) and asserts what a static scan cannot see:
no horizontal scroll at 375/768/1024/1440, the scroll-reveal completing, the tab
strip pinning after the hero and staying on screen, **scrolling each section
activating its tab**, tab clicks landing clear of the sticky strip, per-tab
images actually applied, the dialog lifecycle (open → focus → Esc → focus
restored → scroll unlocked), the bilingual toggle, theme toggle and persistence,
OS dark mode, reduced motion, the JS-disabled path, `main.js` failing to load,
44px touch targets, and contrast on **every rendered text node** against its
composited background in both themes.

It auto-discovers Chrome and exits 0 with a `SKIP` if none is installed.

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

## Audit notes

A full pass over the code found and fixed:

- **`aria-hidden="true"` on a focusable link** (axe `aria-hidden-focus`) — each
  script poster was an `<a>` hidden from the accessibility tree while still
  reachable. Rebuilt so the poster is the card's single, properly-named link.
- **Duplicate outbound links** — every script card linked the same reel twice,
  cluttering a screen reader's link list. Now one link per card.
- **211 KB of eagerly-fetched images** — the four 9:16 posters were CSS
  backgrounds, which are always downloaded. They are now `<img loading="lazy">`.
  First load dropped from ~356 KB to **145 KB**.
- **A duplicate `id="scripts"`** on both the section and its heading — invalid
  HTML that silently breaks the in-page anchor and the `aria-labelledby`.
- **20% of the stylesheet was dead** — 70 rules left behind by the restructures
  (the old pager, contents list, multi-page frames). 40.6 KB → 32.7 KB.
- **A fixed 350 ms guess** before moving focus after a tab jump; on a long scroll
  it fired mid-flight. Now waits for `scrollend`, with an rAF idle fallback.

Each fix has a test: no duplicate ids, every `aria-labelledby` resolves, no
`aria-hidden` around anything focusable, below-the-fold images are lazy, one reel
link per card, and the stylesheet parses with balanced braces.

One thing investigated and **not** changed: `centreTab` uses `offsetLeft` to
scroll the tab strip, which looked wrong because `offsetParent` is the sticky
`.tabs` rather than the `.tabs-scroll` element being scrolled. Measured both ways
in the browser — identical values, because the two share a left edge. The simpler
original was kept.

## Imagery

Sagar's own photographs (portrait, About) come from the source document. The
case-study, tab and script-card imagery is from **Unsplash**, whose licence
permits free commercial use with no attribution required. Every image was
reviewed before use, and `tests/check.mjs` fails the build on any unreferenced
file in `assets/img`.

A stock analytics dashboard showing invented figures (24,689 sent / 42.8% open)
was deliberately **not** used — it sat next to the "Results" heading and read as
if it were Reqx campaign data.

The four script cards are illustrated by their subject — an excavation, a whale,
a studio microphone, cracked earth — not by frames from the reels, which would
misrepresent them. Each card links to the actual reel.

## Figures on the page

Every number is traceable to a source, and a test enforces it:

- **45 → 18 days, 60%, 72 hrs** on the Results strip are quoted from the email
  samples printed directly above them.
- **25M+ views, 20,000+ followers** come from the CV.
- The campaign's own **open and response rates were never supplied**, so they do
  not appear. `tests/check.mjs` fails the build if a Results tile claims an open
  or response rate, or carries any number that does not appear in the copy above
  the strip — both cases are mutation-tested.

## Published articles

All seven Accodigit pieces run **520–850 words with 5–7 subheads** — blog length,
not long-form. The site's own headings and intros say "published pieces", and a
test fails the build if they drift back to claiming long-form. Quoted CV text is
left verbatim; that is Sagar's own wording.

The seven pieces are linked from the home page, each with its published title and
verbatim opening hook. All are bylined **Sagar Vishwakarma** on
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
