#!/usr/bin/env node
/* Page generator — a DEV tool, not a deploy step.
   Assembles the six pages from src/partials + src/pages so the shared head,
   header, nav and footer cannot drift apart across files.

     node tools/build.mjs           write the pages
     node tools/build.mjs --check   fail if the committed output is stale

   The generated .html files are committed; GitHub Pages serves them directly
   and never runs this. */

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");

/* Page order mirrors the source document's tab order:
   Profile (1st) → Email Copywriter (2nd) → Video Scriptwriter (3rd)
   → Resume (4th) → About me (5th) → Contact (6th). */
const PAGES = [
  { key: "index",   file: "index.html",   nav: null,            // home = the wordmark, not a tab
    title: "Sagar Vishwakarma — Writer",
    desc: "Sagar Vishwakarma writes B2B cold email sequences, short-form video scripts and long-form articles. Featured writing samples, resume and contact.",
    body: ["_hero"], dialog: false },

  { key: "work",    file: "work.html",    nav: "Work Samples",
    title: "Work Samples — Sagar Vishwakarma",
    desc: "Email copywriting for Reqx Technologies and short-form video scriptwriting with 25M+ views — case study, annotated samples, and four scripts in Hinglish and English.",
    body: ["_work", "_scripts"], dialog: true },

  { key: "resume",  file: "resume.html",  nav: "Resume",
    title: "Resume — Sagar Vishwakarma",
    desc: "Sagar Vishwakarma's resume — experience, skills and education. Download as Word or PDF.",
    body: ["_resume"], dialog: false },

  { key: "about",   file: "about.html",   nav: "About Me",
    title: "About Me — Sagar Vishwakarma",
    desc: "How a school news report in the 7th standard turned into a career writing B2B email, video scripts and long-form articles.",
    body: ["_about"], dialog: false },

  { key: "contact", file: "contact.html", nav: "Contact",
    title: "Contact — Sagar Vishwakarma",
    desc: "Get in touch with Sagar Vishwakarma — email, phone, LinkedIn, Instagram, YouTube and Facebook.",
    body: ["_contact"], dialog: false },
];

/* Only these four appear as tabs; the Profile page is reached via the wordmark. */
const TABS = PAGES.filter((p) => p.nav);

/* Tab strip — four tabs, matching the wireframes. No numbering; the active tab
   is enlarged and filled rather than merely tinted. Sticky, so on the Profile
   page it rides up with the hero and then pins. */
const tabs = (current) => `<nav class="tabs" id="nav" aria-label="Sections" data-bg="${current}">
  <div class="tabs-scroll">
    <div class="tabs-inner">
${TABS.map((p) => `      <a href="${p.file}"${p.key === current ? ' aria-current="page"' : ""}>${p.nav}</a>`).join("\n")}
    </div>
  </div>
</nav>`;

const dialogHtml = read("src/partials/script-dialog.html").trimEnd();

/* On the Profile page the tab strip is injected here — after the hero, before
   the rest — so it scrolls up with the hero and then pins. */
const SPLIT = '\n\n<section class="section" id="featured"';


const JSONLD = `{
  "@context": "https://schema.org",
  "@type": "Person",
  "name": "Sagar Vishwakarma",
  "alternateName": "Sagar",
  "jobTitle": "Copywriter & Video Scriptwriter",
  "email": "mailto:Sagarvishwa5901@gmail.com",
  "description": "B2B email copywriter, short-form video scriptwriter and long-form business writer.",
  "knowsAbout": ["Email copywriting", "B2B cold outreach", "Video scriptwriting", "Long-form articles"],
  "worksFor": { "@type": "Organization", "name": "Accodigit", "url": "https://accodigit.com/" },
  "sameAs": [
    "https://www.linkedin.com/in/gagarmesagarr/",
    "https://www.instagram.com/gagarmesagarr",
    "https://youtube.com/@gagarmesagarr",
    "https://www.facebook.com/profile.php?id=61570788022715"
  ]
}`;

function render(page) {
  const body = page.body.map((b) => read(`src/pages/${b}.html`).trimEnd()).join("\n\n");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${page.title}</title>
<meta name="description" content="${page.desc}">
<meta name="author" content="Sagar Vishwakarma">
<link rel="canonical" href="https://example.github.io/${page.file === "index.html" ? "" : page.file}">

<meta property="og:type" content="profile">
<meta property="og:title" content="${page.title}">
<meta property="og:description" content="${page.desc}">
<meta property="og:image" content="assets/img/og-cover.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${page.title}">
<meta name="twitter:description" content="${page.desc}">
<meta name="twitter:image" content="assets/img/og-cover.png">

<meta name="theme-color" content="#FCFAF5" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#14130F" media="(prefers-color-scheme: dark)">

<link rel="icon" href="assets/img/favicon.svg" type="image/svg+xml">

<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,300..700;1,6..72,300..600&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="assets/css/style.css">

<!-- Applied before paint so the theme never flashes -->
<script>
  // .js gates the scroll-reveal styles so a no-JS visitor never sees a blank page.
  // The failsafe drops the gate if main.js never gets to run (404, blocked, throws),
  // which would otherwise leave everything below the fold invisible.
  document.documentElement.classList.add("js");
  window.__revealFailsafe = setTimeout(function () {
    document.documentElement.classList.remove("js");
  }, 3000);
  try {
    var t = localStorage.getItem("theme");
    if (t === "dark" || t === "light") document.documentElement.setAttribute("data-theme", t);
  } catch (e) {}
</script>

<script type="application/ld+json">
${JSONLD}
</script>
</head>

<body>
<a class="skip-link" href="#main">Skip to content</a>

<header class="site-header">
  <div class="wrap">
    <a class="wordmark" href="index.html"><span class="wm-name">Sagar Vishwakarma</span> <span class="wm-sep">/</span> <span class="wm-role">Writer</span></a>
    <button type="button" class="icon-btn theme-toggle" id="themeToggle"
            aria-pressed="false" aria-label="Switch to dark theme">
      <svg class="sun" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true">
        <circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>
      </svg>
      <svg class="moon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>
      </svg>
    </button>
  </div>
</header>

<main id="main">
${page.key === "index" ? body.replace(SPLIT, "\n\n" + tabs(page.key) + SPLIT) : tabs(page.key) + "\n\n" + body}
</main>

${pager(page)}

<footer class="site-footer">
  <div class="wrap">
    <span>&copy; 2026 Sagar</span>
    <span><a href="contact.html">Get in touch</a></span>
  </div>
</footer>
${page.dialog ? "\n" + dialogHtml + "\n" : ""}
<div class="visually-hidden" role="status" aria-live="polite" id="liveRegion"></div>

<script src="assets/js/main.js" defer onerror="document.documentElement.classList.remove('js')"></script>
</body>
</html>
`;
}

/* Prev/next strip — the doc's page order made walkable. */
function pager(page) {
  const i = TABS.findIndex((p) => p.key === page.key);
  if (i === -1) return "";
  const prev = TABS[i - 1], next = TABS[i + 1];
  const arrow = (d) => d === "prev"
    ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>'
    : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
  return `<nav class="pager" aria-label="Page">
  <div class="wrap">
    ${prev ? `<a class="pager-link pager-prev" href="${prev.file}">
      ${arrow("prev")}
      <span><span class="pager-dir">Previous</span><span class="pager-name">${prev.nav}</span></span>
    </a>` : `<span></span>`}
    ${next ? `<a class="pager-link pager-next" href="${next.file}">
      <span><span class="pager-dir">Next</span><span class="pager-name">${next.nav}</span></span>
      ${arrow("next")}
    </a>` : `<span></span>`}
  </div>
</nav>`;
}

const check = process.argv.includes("--check");
let stale = 0;
for (const page of PAGES) {
  const out = render(page);
  const path = join(ROOT, page.file);
  let existing = null;
  try { existing = readFileSync(path, "utf8"); } catch {}
  if (check) {
    if (existing !== out) { stale++; console.log(`STALE  ${page.file}`); }
    else console.log(`ok     ${page.file}`);
  } else {
    writeFileSync(path, out);
    console.log(`wrote  ${page.file}  ${(out.length / 1024).toFixed(1)} KB`);
  }
}
if (check) {
  console.log(stale ? `\n${stale} page(s) stale — run: node tools/build.mjs` : "\nall pages up to date");
  process.exit(stale ? 1 : 0);
}
