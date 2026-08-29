# Build Prompt — Sagar's Writer Portfolio (one-page static site)

Paste this whole file as your instruction. All body copy lives in `content-raw.md`
in the same folder — read it first and use it **verbatim**, except for the copy
corrections listed in §10.

---

## 1. Goal

Build a **single-page, zero-build, fully static** portfolio site for **Sagar**, a
writer working in two lanes: **B2B email copywriting** and **short-form video
scriptwriting** (Hinglish, India-focused). It must deploy to **GitHub Pages** by
pushing the repo — no bundler, no npm install, no CI build step required.

The site's job: convince a hiring manager or founder, in one scroll, that this
person writes clearly and thinks structurally. The writing *is* the product, so
the design must serve reading, not decorate around it.

---

## 2. Hard constraints

- **One HTML page.** `index.html` at repo root. Everything reachable by scroll or
  in-page disclosure. No client-side router, no multi-page nav.
- **No build step.** No npm, no Tailwind CDN, no PostCSS, no framework.
  Hand-written CSS in `assets/css/style.css`, hand-written vanilla JS in
  `assets/js/main.js`. Both plain `<link>` / `<script defer>`.
- **No external runtime dependencies** except Google Fonts. No CDN JS libraries
  (no GSAP, no jQuery, no Alpine). Animation is CSS + a tiny
  `IntersectionObserver`.
- **Relative paths only** — `assets/css/style.css`, never `/assets/...`. GitHub
  Pages project sites serve from `/<repo>/`, and absolute paths silently 404 there.
- **Works with JS disabled.** Every piece of content must be readable without JS.
  JS only enhances (see §7).
- Total page weight excluding images: **under 100 KB**.

---

## 3. File structure

```
.
├── index.html
├── assets/
│   ├── css/style.css
│   ├── js/main.js
│   ├── img/               # WebP + JPG fallback, see §9
│   └── Sagar-Vishwakarma-Resume.pdf   # placeholder if not supplied
├── .nojekyll              # REQUIRED — stops Jekyll eating assets/ and _-prefixed files
├── robots.txt
├── sitemap.xml
├── README.md              # deploy instructions, how to swap content
└── tests/
    ├── check.mjs          # see §11
    └── README.md
```

`.nojekyll` must be an empty file at repo root. Without it GitHub Pages runs
Jekyll and can strip files; it also speeds up the deploy.

---

## 4. Design direction

**Style: warm editorial / type-led minimalism.** Reject the default
"dark-hero + gradient + glass card" portfolio look — it reads as a template and
actively undercuts a writer. The reference feel is a well-set literary magazine:
paper ground, high-contrast ink, generous measure, one accent used sparingly.

Sourced from `ui-ux-pro-max` (`--domain typography` → *News Editorial*;
`--domain color` → *Notes & Writing App*, "warm ink + amber accent on cream").
The palette below is **adapted** from that row — the raw `#FFFBEB` was too yellow
and the amber failed body-text contrast — and every pair is verified in §4.3.

### 4.1 Typography

Three faces, each with one job. Do not add a fourth.

```
Newsreader   — headings, hero, all long-form prose.  Designed for long-form reading.
Inter        — UI: nav, buttons, labels, toggles, captions.
JetBrains Mono — micro-labels only: section numbers, tags, metrics, "EN / HINGLISH".
```

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,300..700;1,6..72,300..600&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
```

Type scale — fluid, `clamp()`, no fixed px containers:

| Token | Size | Face | Use |
|---|---|---|---|
| `--fs-hero` | `clamp(2.75rem, 7vw, 5.5rem)` | Newsreader 300, `line-height:1.02`, `letter-spacing:-0.03em` | "Hi! I'm Sagar." |
| `--fs-h2` | `clamp(2rem, 4vw, 3rem)` | Newsreader 400 | section titles |
| `--fs-h3` | `clamp(1.35rem, 2.2vw, 1.75rem)` | Newsreader 500 | sub-heads, card titles |
| `--fs-lead` | `clamp(1.15rem, 1.8vw, 1.375rem)` | Newsreader 300, `line-height:1.55` | hero sub, section intros |
| `--fs-body` | `1.0625rem` (17px) | Newsreader 400, `line-height:1.7` | all prose |
| `--fs-ui` | `0.9375rem` | Inter 500 | nav, buttons |
| `--fs-label` | `0.75rem`, `letter-spacing:0.12em`, uppercase | JetBrains Mono 500 | eyebrows, tags |

**Measure: `max-width: 68ch` on every prose block.** This is the single most
important rule on the page. Full-width paragraphs will destroy it.

### 4.2 Tokens

Define on `:root` (light = default), redefine under
`@media (prefers-color-scheme: dark)` **and** `[data-theme="dark"]`, plus
`[data-theme="light"]` to let the toggle win both directions.

```css
:root{
  --paper:#FCFAF5; --card:#FFFFFF; --ink:#171614; --ink-muted:#57534E;
  --accent:#B45309;        /* accent used for TEXT + links */
  --accent-deco:#D97706;   /* decorative only: rules, underline swashes, marks */
  --rule:#E7E2D7; --ring:#B45309;
  --space-1:.5rem; --space-2:1rem; --space-3:1.5rem; --space-4:2.5rem;
  --space-5:4rem;  --space-6:6rem;  --space-7:9rem;   /* spacious: section rhythm */
  --maxw:68ch; --maxw-wide:1140px;
  --dur:220ms; --ease:cubic-bezier(.22,.61,.36,1);
}
[data-theme="dark"], @media (prefers-color-scheme: dark) → :root:not([data-theme="light"]){
  --paper:#14130F; --card:#1B1A15; --ink:#F2EEE5; --ink-muted:#A8A29E;
  --accent:#FBBF24; --accent-deco:#FBBF24; --rule:#2A2823; --ring:#FBBF24;
}
```

Set `background:var(--paper); color:var(--ink)` explicitly on `body`, and
`color-scheme: light dark` on `:root` so form controls and scrollbars follow.

### 4.3 Contrast — already verified, do not substitute colors

| Pair | Ratio | Level |
|---|---|---|
| `--ink` on `--paper` (light) | 17.34 | AAA |
| `--ink-muted` on `--paper` (light) | 7.31 | AAA |
| `--accent` `#B45309` on `--paper` | 4.81 | AA (body text OK) |
| `--accent-deco` `#D97706` on `--paper` | 3.05 | **large text / UI only — never body copy** |
| `--ink` on `--paper` (dark) | 16.05 | AAA |
| `--ink-muted` on `--paper` (dark) | 7.37 | AAA |
| `--accent` `#FBBF24` on `--paper` (dark) | 11.13 | AAA |
| `--ink-muted` on `--card` (dark) | 6.91 | AA |

If you change any hex, re-verify at 4.5:1 minimum for body text and say so.

### 4.4 Layout

- Ground grid `--maxw-wide: 1140px`, centered, `padding-inline: clamp(1.25rem, 5vw, 4rem)`.
- Prose columns sit at `--maxw` (68ch), **left-aligned within the wide container**,
  not centered — asymmetry is what makes it read editorial rather than "landing page".
- Section rhythm: `padding-block: var(--space-7)` desktop, `--space-5` mobile.
- Section separators: a `1px` `--rule` hairline, **not** cards or boxes.
- Cards (script items, email samples) are the only boxed elements: `--card`
  background, `1px --rule` border, `border-radius: 4px` (sharp, not pill),
  no drop shadow. Shadows are what make this look cheap; use the hairline instead.
- Each section gets a mono eyebrow: `01 — PROFILE`, `02 — EMAIL COPYWRITING`, etc.

---

## 5. Page structure (top to bottom)

Content source is `content-raw.md`; tab names there map to sections below.

**Header** — sticky, `backdrop-filter: blur(8px)`, `background: color-mix(in srgb, var(--paper) 85%, transparent)`, hairline bottom border. Left: wordmark "Sagar". Right: anchor nav (Work · Scripts · About · Contact) + theme toggle. Collapses to a hamburger `<details>`/`<dialog>` under 720px. Height 64px — compensate with `scroll-margin-top: 80px` on every section, not body padding.

**1 · Hero** (from *Profile* tab)
- Mono eyebrow: `WRITER — EMAIL COPY & VIDEO SCRIPTS`
- H1: "Hi! I'm Sagar." at `--fs-hero`
- Lead paragraph: the "Good writing isn't about big words…" line — set at `--fs-lead`, max 60ch. This is the thesis; give it air.
- Supporting line: the "From B2B cold emails to long-form articles…" sentence.
- Two CTAs: primary "See featured work" (ink fill, paper text) → `#work`; secondary "Download resume" (ghost, `1px --rule`) → the PDF, with `download` attr.
- Right column: portrait image slot, `3:4` ratio (matches the `3:4` note in the doc). On mobile it stacks *below* the CTAs.
- **No hero animation beyond a 400ms fade-up.** No parallax, no typewriter effect.

**2 · Email Copywriting case study** (from *Email Copywriter* tab)
The most substantial asset — give it the most room. Sub-structure, each with an h3:
1. *About the Project* — the brief + the challenge para.
2. *Email Marketing Strategy* — plain-text deliverability + pain-point angle.
3. *Copywriting Strategy* — render the 3-part framework (Opener / Social Proof Follow-Up / Soft CTA) as a **numbered editorial list**, mono number + Newsreader body. Not three equal feature cards.
4. *Email Copy Samples* — two samples as `<article>` cards styled like an inbox message: mono `SUBJECT LINE` / `PREVIEW TEXT` labels, hairline divider, then body in Newsreader with preserved paragraph breaks. Add a "Copy" button per sample (see §7).
5. *Endless Email Optimisation* — prose.
6. *Results* — a 3-up metric strip. **The doc has no hard numbers here** (see §12); render `<!-- TODO -->` placeholders with the qualitative copy beneath, and mark them clearly so Sagar can fill them in.

**3 · Video Scriptwriting** (from *Video Scriptwriter* tab + 4 script tabs)
- Intro: the methodology paragraph (research → outline → hook → trim).
- Then a **2-column grid of 4 script cards**: Keeladi, Blue Whale, Kolaveri Di, Super El Nino.
- Each card: mono tag (`HISTORY`, `SCIENCE`, `MUSIC`, `CLIMATE`), title, a 1-line pull from the script's opening hook, and "Read script →".
- Clicking opens the full script in a **`<dialog>` modal** (native, no library) containing the bilingual toggle. This is the key call: putting 4 full bilingual scripts inline would add ~2,500 words of untranslated-looking text to the page and wreck the scroll. Disclosure keeps the one-pager scannable.
- **Progressive enhancement:** each script must also exist in the DOM inside a
  `<details>` element that the modal reads from, so with JS off the user can still
  expand and read every script. Do not fetch scripts.

**4 · About** (from *About me* tab) — Single 68ch prose column, portrait/secondary image at `1:1` (matches the doc's `1:1` note). Pull one line as a large Newsreader italic pull-quote — recommend *"It was the art of it that I actually fell in love with."* Ends with the "let's get in touch" line linking to `#contact`.

**5 · Contact** (from *Contact* tab) — Email as a large `mailto:` link, marked "(best way to reach me)". LinkedIn with real URL. Instagram / YouTube / Facebook as SVG icon links — **URLs are missing from the doc**, so use `href="#"` plus a visible `<!-- TODO: URL -->` comment and `aria-disabled`. Do **not** invent URLs.

**Footer** — hairline, `© 2026 Sagar`, "Built as a one-pager." Nothing else.

---

## 6. Icons

SVG only, inline, 20×20, `stroke-width:1.5`, `currentColor`. Use Lucide paths
(mail, linkedin, instagram, youtube, facebook, arrow-right, sun, moon, x, copy,
check). **No emoji as icons, ever.** Decorative icons get `aria-hidden="true"`;
icon-only links get a visible-to-AT `aria-label`.

---

## 7. Interaction spec (`assets/js/main.js`, vanilla, ~120 lines)

1. **Theme toggle** — cycles light/dark, persists to `localStorage` in a
   `try/catch` (private-mode browsers throw on access). Default = system. Apply
   the stored theme via an inline `<script>` in `<head>` **before** stylesheet
   paint to avoid a flash of wrong theme. Toggle button is a real `<button>` with
   `aria-pressed`.
2. **Bilingual script toggle** — two real `<button>`s (`EN` / `HINGLISH`) with
   `role="tab"` semantics, or simpler: a segmented control using
   `aria-pressed`. Toggling swaps which `<div lang="en">` / `<div lang="hi-Latn">`
   is visible. **Set `lang` correctly** — Hinglish is romanized Hindi, so
   `lang="hi-Latn"`; without it screen readers will mispronounce it as English.
   Remember the choice per session.
3. **Script modal** — native `<dialog>` + `showModal()`. Focus moves to the
   dialog heading on open, returns to the triggering card on close. Esc closes
   (free with `<dialog>`). Lock body scroll while open. Backdrop click closes.
4. **Scroll-spy nav** — `IntersectionObserver` with
   `rootMargin: "-45% 0px -50% 0px"`, sets `aria-current="true"` on the active
   anchor. Never use a `scroll` listener.
5. **Reveal on scroll** — `IntersectionObserver`, one-shot, adds `.is-in`;
   CSS animates `opacity` + `translateY(12px)` over 400ms. **Only `opacity` and
   `transform`** — never `width`/`height`/`top`. Unobserve after firing.
6. **Copy-email-sample button** — `navigator.clipboard.writeText()`, swaps the
   icon to a check for 1.6s, announces via a `role="status"` live region.
7. **Smooth scroll** — `html { scroll-behavior: smooth; }`, disabled under
   reduced motion.

**Reduced motion is mandatory:**
```css
@media (prefers-reduced-motion: reduce){
  *,*::before,*::after{animation-duration:.01ms!important;animation-iteration-count:1!important;
    transition-duration:.01ms!important;scroll-behavior:auto!important}
}
```
and reveal elements must render in their **final** state, not stay invisible —
this is the most common way this pattern breaks accessibility.

---

## 8. Accessibility (non-negotiable)

- One `<h1>`. Heading levels never skip. Sections are `<section aria-labelledby>`.
- Skip link to `#main` as the first focusable element.
- Visible focus everywhere: `:focus-visible{outline:2px solid var(--ring); outline-offset:3px}`. **Never `outline:none` without a replacement.**
- Every interactive target ≥ 44×44px (pad small icon buttons out).
- Alt text: descriptive for the portrait, `alt=""` for decorative.
- Colour is never the only signal — active nav gets an underline as well as colour.
- The whole page must be operable by keyboard alone, including modals and toggles.
- `<html lang="en">`, and `lang="hi-Latn"` on every Hinglish block.

---

## 9. Performance & SEO

- `<meta name="viewport" content="width=device-width, initial-scale=1">`.
- Images: WebP with `<picture>` + JPG fallback, explicit `width`/`height`
  attributes on every `<img>` (prevents CLS), `loading="lazy"` +
  `decoding="async"` on everything below the fold; the hero portrait is
  `loading="eager"` `fetchpriority="high"`.
- Any image not supplied → an inline SVG placeholder at the correct aspect ratio
  with a visible `TODO` label. **Never ship a broken image icon** and never
  hotlink a stock photo.
- Fonts: `display=swap` + `preconnect` (above). Nothing else preloaded.
- Meta: unique `<title>`, `<meta name="description">`, canonical, Open Graph
  (`og:title`, `og:description`, `og:image`, `og:type=profile`),
  `twitter:card=summary_large_image`.
- JSON-LD `Person` schema: name, jobTitle "Copywriter & Video Scriptwriter",
  email, `sameAs` for the social profiles that have real URLs.
- Targets: Lighthouse **≥95 on all four categories**, CLS < 0.05, no console
  errors or warnings.

---

## 10. Copy corrections to apply

Use `content-raw.md` verbatim **except** these — the doc has real defects:

1. **Email sample #2 states three conflicting metrics** for one result: preview
   text says 40%, the body says "45 days down to 18 days" (= 60%), then says
   "we cut their average time-to-hire by 60% reduction in total fill-time".
   Pick **one** consistent framing. Recommended: keep `45 days → 18 days`, state
   it as **60%**, fix the preview text to match, and rewrite the garbled clause as
   *"…we cut their average time-to-hire by 60%."*
2. Same sample: `"is a priority right now, Worth a quick 5-minute chat this week?"`
   → `"is a priority right now, is it worth a quick 5-minute chat this week?"`
   (stray capital + comma splice).
3. **Client naming is inconsistent** — the intro anonymises ("a specialized
   talent acquisition and recruitment firm") but the signatures name *Reqx
   Technologies Pvt Ltd*. Name them consistently throughout; the samples already
   make it public, so use "Reqx" in the intro too.
4. Normalise `Optimisation`/`optimised` to one spelling (doc is already
   British — keep British).

Leave everything else — voice, rhythm, word choice — exactly as written.

---

## 11. Testing — required before you report done

Write `tests/check.mjs`, runnable with **`node tests/check.mjs`** and zero
dependencies (Node ≥18, no npm install). It must parse `index.html` as text and
**exit non-zero** on any failure. Assertions:

- [ ] `index.html`, `assets/css/style.css`, `assets/js/main.js`, `.nojekyll` all exist
- [ ] Exactly one `<h1>`; no heading level is skipped
- [ ] `<html lang="en">` present; every Hinglish block carries `lang="hi-Latn"`
- [ ] **Zero absolute asset paths** — no `src="/` or `href="/` except external URLs and in-page `#` anchors (this is the #1 GitHub Pages failure mode)
- [ ] Every `<img>` has non-null `alt`, plus `width` and `height`
- [ ] Every referenced local asset path actually exists on disk
- [ ] Every in-page `href="#foo"` has a matching `id="foo"`
- [ ] Every icon-only link/button has `aria-label`
- [ ] No emoji characters inside `<svg>` or used as icons
- [ ] `prefers-reduced-motion` block present in CSS
- [ ] `:focus-visible` present; no bare `outline:none` without a sibling replacement
- [ ] `<meta name="viewport">`, `<title>`, `<meta name="description">`, OG tags, JSON-LD all present
- [ ] No `console.log` left in `main.js`
- [ ] All 4 script titles and both email subject lines appear in the HTML (content-completeness check against `content-raw.md`)
- [ ] A contrast assertion: re-compute the WCAG ratio for every `--ink`/`--paper`, `--ink-muted`/`--paper`, `--accent`/`--paper` pair parsed out of `style.css`, in both themes, and fail below 4.5:1

Print a `PASS/FAIL` line per assertion and a summary count.

**Then also, manually:**
- Serve locally with `python3 -m http.server 8000` and confirm it loads clean.
- Resize-test at **375 / 768 / 1024 / 1440px** — confirm zero horizontal scroll at every width.
- Tab through the entire page start to finish; confirm focus is always visible and modal focus is trapped and restored.
- Load once with JS disabled and confirm every script is still readable via `<details>`.
- Toggle OS dark mode and confirm the theme follows, then confirm the manual toggle overrides it in both directions.

**Do not report the build complete until `node tests/check.mjs` exits 0 and you
have actually run the manual checks.** Report the real output — if something
fails, say which assertion and why.

---

## 12. Missing assets — do not invent these

The source doc has gaps. Stub each one with a clearly-marked `TODO` and list them
in `README.md` under "Before going live":

1. **9 images** (`[IMAGE]` markers in the doc) — no files supplied. The doc's
   `1st Page: 1:1` and `5th Page: 3:4` tabs appear to be aspect-ratio notes;
   treat them as the About (1:1) and Hero (3:4) portrait ratios.
2. **YouTube URLs** for all 4 scripts — the section claims "most-viewed videos"
   but links to nothing. Leave the embed slots stubbed.
3. **Resume PDF** — the hero links to it; ship a placeholder path.
4. **Instagram / YouTube / Facebook URLs** — names only, no links.
5. **Real campaign metrics** for the Results strip — currently adjectives only
   ("well-above-industry-average"), which is the weakest point of the strongest
   section.

---

## 13. Deployment

`README.md` must document, in copy-pasteable form:

```bash
git init && git add . && git commit -m "Portfolio site"
git branch -M main
git remote add origin git@github.com:<user>/<repo>.git
git push -u origin main
# Settings → Pages → Source: "Deploy from a branch" → main / (root)
```

Note in the README that for a **user site** (`<user>.github.io`) the repo must be
named exactly that and it serves from `/`; for a **project site** it serves from
`/<repo>/`, which is precisely why all paths are relative. Mention the custom
domain path (`CNAME` file) as optional.

Do **not** add a GitHub Actions workflow — branch deploy is sufficient for a
no-build static site and one less thing to break.

---

## 14. Definition of done

- `node tests/check.mjs` exits 0, output pasted in the report
- Lighthouse ≥95 across Performance / Accessibility / Best Practices / SEO
- Zero horizontal scroll at 375, 768, 1024, 1440
- Full keyboard pass, JS-disabled pass, dark-mode pass all confirmed
- Every TODO stub listed in `README.md`
- Zero console errors

Report honestly: what passed, what you stubbed, what you could not verify.
