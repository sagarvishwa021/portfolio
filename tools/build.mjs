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
/* One scrolling document. Each entry is a section; the four with a `nav` label
   become tabs that auto-highlight as you scroll past them. */
const SECTIONS = [
  { key: "work",    id: "work",    nav: "Work Samples", body: ["_work", "_scripts"] },
  { key: "resume",  id: "resume",  nav: "Resume",       body: ["_resume"] },
  { key: "about",   id: "about",   nav: "About Me",     body: ["_about"] },
  { key: "contact", id: "contact", nav: "Contact",      body: ["_contact"] },
];
const TABS = SECTIONS;
const TITLE = "Sagar Vishwakarma — Writer";
const DESC = "Sagar Vishwakarma writes B2B cold email sequences, short-form video scripts and researched business explainers. Featured writing samples, work, resume and contact.";

/* Tab strip — four tabs, matching the wireframes. No numbering; the active tab
   is enlarged and filled rather than merely tinted. Sticky, so on the Profile
   page it rides up with the hero and then pins. */
const tabs = () => `<nav class="tabs" id="nav" aria-label="Sections">
  <div class="tabs-scroll">
    <div class="tabs-inner">
${TABS.map((p) => `      <a href="#${p.id}" data-tab="${p.key}"><span class="t-photo"></span><span class="t-label">${p.nav}<span class="t-bar"></span></span></a>`).join("\n")}
    </div>
  </div>
</nav>`;

const dialogHtml = read("src/partials/script-dialog.html").trimEnd();

const JSONLD = `{
  "@context": "https://schema.org",
  "@type": "Person",
  "name": "Sagar Vishwakarma",
  "alternateName": "Sagar",
  "jobTitle": "Copywriter & Video Scriptwriter",
  "email": "mailto:Sagarvishwa5901@gmail.com",
  "description": "B2B email copywriter, short-form video scriptwriter and writer of researched business explainers.",
  "knowsAbout": ["Email copywriting", "B2B cold outreach", "Video scriptwriting", "Long-form articles"],
  "worksFor": { "@type": "Organization", "name": "Accodigit", "url": "https://accodigit.com/" },
  "sameAs": [
    "https://www.linkedin.com/in/gagarmesagarr/",
    "https://www.instagram.com/gagarmesagarr",
    "https://youtube.com/@gagarmesagarr",
    "https://www.facebook.com/profile.php?id=61570788022715"
  ]
}`;

function render() {
  const hero = read("src/pages/_hero.html").trimEnd();
  /* The featured writing samples are Work Samples too; without this the spy
     has a tall untagged gap and no tab is lit while the reader is in it. */
  const featured = read("src/pages/_featured.html").trimEnd()
    .replace(/<section class="section"/g, '<section class="section" data-spy="work"');
  /* Tag every top-level <section> with the tab that owns it. A group can span
     more than one section (Work Samples covers email copy AND scriptwriting),
     and an untagged gap would leave the scroll-spy with nothing to report. */
  const body = SECTIONS.map((sec) =>
    sec.body
      .map((b) => read(`src/pages/${b}.html`).trimEnd()
        .replace(/<section class="section"/g, `<section class="section" data-spy="${sec.key}"`))
      .join("\n\n")
  ).join("\n\n");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${TITLE}</title>
<meta name="description" content="${DESC}">
<meta name="author" content="Sagar Vishwakarma">
<link rel="canonical" href="https://example.github.io/">

<meta property="og:type" content="profile">
<meta property="og:title" content="${TITLE}">
<meta property="og:description" content="${DESC}">
<meta property="og:image" content="assets/img/og-cover.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${TITLE}">
<meta name="twitter:description" content="${DESC}">
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
    <a class="wordmark" href="#top"><span class="wm-name">Sagar Vishwakarma</span> <span class="wm-sep">/</span> <span class="wm-role">Writer</span></a>
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
${hero}

${tabs()}

${featured}

${body}
</main>

<footer class="site-footer">
  <div class="wrap">
    <span>&copy; 2026 Sagar Vishwakarma</span>
    <span><a href="#contact">Get in touch</a></span>
  </div>
</footer>

${dialogHtml}

<div class="visually-hidden" role="status" aria-live="polite" id="liveRegion"></div>

<script src="assets/js/main.js" defer onerror="document.documentElement.classList.remove('js')"></script>
</body>
</html>
`;
}

const check = process.argv.includes("--check");
let stale = 0;
const out = render();
const path = join(ROOT, "index.html");
let existing = null;
try { existing = readFileSync(path, "utf8"); } catch {}
if (check) {
  if (existing !== out) { stale = 1; console.log("STALE  index.html"); }
  else console.log("ok     index.html");
  console.log(stale ? "\nrun: node tools/build.mjs" : "\nup to date");
  process.exit(stale);
} else {
  writeFileSync(path, out);
  console.log(`wrote  index.html  ${(out.length / 1024).toFixed(1)} KB`);
}
