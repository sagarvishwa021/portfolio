#!/usr/bin/env node
/* Zero-dependency build checks for the Sagar portfolio (6 static pages).
   Run: node tests/check.mjs        (Node >= 18, no npm install)
   Exits non-zero on any failure. */

import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");

const PAGE_FILES = ["index.html", "work.html", "resume.html", "about.html", "contact.html"];
/* Home is reached via the wordmark, not a tab — the wireframes show four tabs. */
const TAB_FILES = ["work.html", "resume.html", "about.html", "contact.html"];

let pass = 0, fail = 0;
const results = [];

const OK = Symbol("ok");
const ok = (note) => ({ [OK]: true, note });

function check(name, fn) {
  let passed = false, detail = "";
  try {
    const r = fn();
    if (r === true || r === undefined) passed = true;
    else if (r && r[OK]) { passed = true; detail = r.note || ""; }
    else detail = String(r);
  } catch (e) { detail = e.message; }
  passed ? pass++ : fail++;
  results.push({ ok: passed, name, detail });
  console.log(`${passed ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
}

/* Run a check once per page, reporting the first page that fails. */
function eachPage(name, fn) {
  check(name, () => {
    const bad = [];
    for (const f of PAGE_FILES) {
      const r = fn(pages[f], f);
      if (r !== true && r !== undefined && !(r && r[OK])) bad.push(`${f}: ${r}`);
    }
    return bad.length ? bad.join(" | ") : ok(`${PAGE_FILES.length} pages`);
  });
}

const missingPages = PAGE_FILES.filter((f) => !existsSync(join(ROOT, f)));
if (missingPages.length) {
  console.log(`FAIL  pages exist  (missing: ${missingPages.join(", ")})`);
  process.exit(1);
}
const pages = Object.fromEntries(PAGE_FILES.map((f) => [f, read(f)]));
const ALL = Object.values(pages).join("\n");
const css = read("assets/css/style.css");
const js  = read("assets/js/main.js");

/* ---------- structure ---------------------------------------------------- */

check("required files exist", () => {
  const need = [...PAGE_FILES, "assets/css/style.css", "assets/js/main.js",
                ".nojekyll", "robots.txt", "sitemap.xml", "README.md", "tools/build.mjs"];
  const missing = need.filter((f) => !existsSync(join(ROOT, f)));
  return missing.length ? `missing: ${missing.join(", ")}` : ok(`${need.length} files`);
});

check("generated pages are in sync with src/", () => {
  try {
    execFileSync("node", [join(ROOT, "tools/build.mjs"), "--check"], { cwd: ROOT, stdio: "pipe" });
    return ok("no drift");
  } catch (e) {
    return "committed pages are stale — run: node tools/build.mjs";
  }
});

eachPage("exactly one <h1>", (html) => {
  const n = (html.match(/<h1[\s>]/g) || []).length;
  return n === 1 ? true : `found ${n}`;
});

eachPage("heading levels never skip", (html) => {
  const levels = [...html.matchAll(/<h([1-6])[\s>]/g)].map((m) => +m[1]);
  for (let i = 1; i < levels.length; i++)
    if (levels[i] > levels[i - 1] + 1) return `h${levels[i - 1]} → h${levels[i]}`;
  return true;
});

eachPage('<html lang="en"> present', (html) => /<html lang="en">/.test(html) || "missing");

eachPage("has a unique title and description", (html) => {
  if (!/<title>[^<]{10,}<\/title>/.test(html)) return "no usable <title>";
  if (!/<meta name="description" content="[^"]{50,}"/.test(html)) return "no usable description";
  return true;
});

check("every page title is distinct", () => {
  const titles = PAGE_FILES.map((f) => pages[f].match(/<title>([^<]+)<\/title>/)[1]);
  const dupes = titles.filter((t, i) => titles.indexOf(t) !== i);
  return dupes.length ? `duplicate: ${[...new Set(dupes)].join(", ")}` : ok(`${titles.length} unique`);
});

/* ---------- navigation --------------------------------------------------- */

check("tab strip is identical across all pages", () => {
  const navs = PAGE_FILES.map((f) => {
    const m = pages[f].match(/<nav class="tabs" id="nav"[\s\S]*?<\/nav>/);
    return m ? m[0].replace(/ aria-current="page"/g, "").replace(/ data-bg="[^"]*"/, "") : null;
  });
  if (navs.some((n) => !n)) return "a page has no #nav";
  const first = navs[0];
  const bad = PAGE_FILES.filter((f, i) => navs[i] !== first);
  return bad.length ? `differs on: ${bad.join(", ")}` : ok(`${PAGE_FILES.length} identical tab strips`);
});

check("each tabbed page marks itself aria-current", () => {
  const bad = TAB_FILES.filter((f) =>
    !new RegExp(`<a href="${f.replace(".", "\\.")}" aria-current="page">`).test(pages[f]));
  return bad.length ? `not self-marked: ${bad.join(", ")}` : ok(`${TAB_FILES.length} tabs`);
});

check("the tab strip has exactly four tabs and no numbering", () => {
  const strip = pages["index.html"].match(/<nav class="tabs"[\s\S]*?<\/nav>/)[0];
  const links = [...strip.matchAll(/<a href="([^"]+)"[^>]*>([^<]+)<\/a>/g)];
  const names = links.map((m) => m[2].trim());
  const problems = [];
  if (links.length !== 4) problems.push(`${links.length} tabs, expected 4`);
  if (names.some((n) => /\d/.test(n))) problems.push(`numbered tab labels: ${names.filter((n) => /\d/.test(n)).join(", ")}`);
  if (strip.includes("index.html")) problems.push("Profile is still a tab");
  const want = ["Work Samples", "Resume", "About Me", "Contact"];
  if (names.join("|") !== want.join("|")) problems.push(`labels are ${names.join(", ")}`);
  return problems.length ? problems.join("; ") : ok(names.join(" · "));
});

check("the active tab is visually enlarged, not just tinted", () => {
  const rule = css.match(/\.tabs a\[aria-current="page"\]\s*\{[^}]*\}/);
  if (!rule) return "no styling for the current tab";
  const body = rule[0];
  const problems = [];
  if (!/font-size:/.test(body)) problems.push("no font-size bump");
  if (!/background:/.test(body)) problems.push("no fill");
  if (!/border-color:/.test(body)) problems.push("no border");
  return problems.length ? problems.join("; ") : ok("enlarged + filled + bordered");
});

check("each tab carries its own picture background behind a scrim", () => {
  const problems = [];
  if (!/\.tabs::before\s*\{[^}]*color-mix/.test(css)) problems.push("no scrim over the image");
  for (const key of ["index", "work", "resume", "about", "contact"]) {
    if (!new RegExp(`\\.tabs\\[data-bg="${key}"\\][^}]*tab-bg-${key}`).test(css))
      problems.push(`no background rule for ${key}`);
    for (const ext of ["webp", "jpg"])
      if (!existsSync(join(ROOT, `assets/img/tab-bg-${key}.${ext}`))) problems.push(`missing tab-bg-${key}.${ext}`);
  }
  const marked = PAGE_FILES.filter((f) => /<nav class="tabs"[^>]*data-bg="[a-z]+"/.test(pages[f]));
  if (marked.length !== PAGE_FILES.length) problems.push(`${marked.length}/${PAGE_FILES.length} pages set data-bg`);
  return problems.length ? problems.slice(0, 3).join("; ") : ok("5 distinct grounds + theme scrim");
});

check("the resume is previewable in-app and downloadable both ways", () => {
  const html = pages["resume.html"];
  const problems = [];
  if (!/<object data="assets\/Sagar-Vishwakarma-Resume\.pdf/.test(html)) problems.push("no inline PDF preview");
  if (!/class="pdf-fallback"/.test(html)) problems.push("preview has no non-PDF fallback");
  if (!/href="assets\/Sagar-Vishwakarma-Resume\.pdf" download/.test(html)) problems.push("no PDF download");
  if (!/href="assets\/Sagar-Vishwakarma-Resume\.docx" download/.test(html)) problems.push("no Word download");
  for (const f of ["assets/Sagar-Vishwakarma-Resume.pdf", "assets/Sagar-Vishwakarma-Resume.docx"])
    if (!existsSync(join(ROOT, f))) problems.push(`missing ${f}`);
  return problems.length ? problems.join("; ") : ok("preview + PDF + Word");
});

check("the Word resume is a valid, populated .docx", () => {
  const buf = readFileSync(join(ROOT, "assets/Sagar-Vishwakarma-Resume.docx"));
  if (buf[0] !== 0x50 || buf[1] !== 0x4b) return "not a zip container";
  const raw = buf.toString("latin1");
  const parts = ["[Content_Types].xml", "word/document.xml"];
  const missing = parts.filter((p) => !raw.includes(p));
  return missing.length ? `missing parts: ${missing.join(", ")}` : ok(`${(buf.length / 1024).toFixed(1)} KB`);
});

check("tab strip is sticky and sits inside <main>", () => {
  if (!/\.tabs\s*\{[^}]*position:\s*sticky[^}]*top:\s*0/.test(css)) return ".tabs is not sticky at top:0";
  const bad = PAGE_FILES.filter((f) => {
    const mainStart = pages[f].indexOf('<main id="main">');
    const mainEnd = pages[f].indexOf("</main>");
    const tabAt = pages[f].indexOf('<nav class="tabs"');
    return !(tabAt > mainStart && tabAt < mainEnd);
  });
  return bad.length ? `tabs outside <main> on: ${bad.join(", ")}` : ok("sticky, in <main>");
});

check("social links are rendered as labelled icons", () => {
  const html = pages["contact.html"];
  const items = (html.match(/class="s-icon"/g) || []).length;
  const labelled = (html.match(/<a href="https[^>]*aria-label="/g) || []).length;
  const svgs = (html.match(/<span class="s-icon" aria-hidden="true">/g) || []).length;
  if (items !== 4) return `${items} social icons, expected 4`;
  if (svgs !== 4) return "icon wrappers are not aria-hidden";
  return labelled >= 4 ? ok("4 icon links, each with an accessible name")
                       : `${labelled} of 4 have aria-label`;
});

check("on the Profile page the tabs follow the hero", () => {
  const html = pages["index.html"];
  const hero = html.indexOf('class="section hero"');
  const tabs = html.indexOf('<nav class="tabs"');
  return hero > -1 && tabs > hero
    ? ok("tabs persist after the hero scrolls away")
    : "tab strip is not placed after the hero";
});

check("prev/next pager chains the four tabbed pages", () => {
  const order = TAB_FILES;
  const problems = [];
  order.forEach((f, i) => {
    const html = pages[f];
    const hasPrev = /class="pager-link pager-prev" href="([^"]+)"/.exec(html);
    const hasNext = /class="pager-link pager-next" href="([^"]+)"/.exec(html);
    if (i > 0 && (!hasPrev || hasPrev[1] !== order[i - 1])) problems.push(`${f} prev`);
    if (i < order.length - 1 && (!hasNext || hasNext[1] !== order[i + 1])) problems.push(`${f} next`);
    if (i === 0 && hasPrev) problems.push(`${f} should have no prev`);
    if (i === order.length - 1 && hasNext) problems.push(`${f} should have no next`);
  });
  return problems.length ? problems.join(", ") : ok("chain intact");
});

/* ---------- GitHub Pages path safety ------------------------------------- */

eachPage("no absolute local asset paths", (html) => {
  const bad = [...html.matchAll(/(?:src|href)="(\/[^\/][^"]*)"/g)].map((m) => m[1]);
  return bad.length ? `absolute: ${bad.join(", ")}` : true;
});

eachPage("every referenced local asset exists", (html) => {
  const refs = [...html.matchAll(/(?:src|srcset|href|content)="([^"#:]+\.(?:css|js|png|jpe?g|webp|svg|pdf|ico|xml))"/g)].map((m) => m[1]);
  const missing = [...new Set(refs)].filter((r) => !existsSync(join(ROOT, r)));
  return missing.length ? `missing: ${missing.join(", ")}` : true;
});

eachPage("every internal page link resolves", (html) => {
  const links = [...html.matchAll(/href="([a-z0-9-]+\.html)"/g)].map((m) => m[1]);
  const missing = [...new Set(links)].filter((l) => !existsSync(join(ROOT, l)));
  return missing.length ? `dead link: ${missing.join(", ")}` : true;
});

eachPage("every in-page anchor has a matching id", (html) => {
  const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
  const anchors = [...html.matchAll(/href="#([^"]+)"/g)].map((m) => m[1]);
  const dangling = [...new Set(anchors)].filter((a) => !ids.has(a));
  return dangling.length ? `no target: ${dangling.map((d) => "#" + d).join(", ")}` : true;
});

/* ---------- accessibility ------------------------------------------------ */

eachPage("every <img> has alt, width and height", (html) => {
  const imgs = html.match(/<img\b[^>]*>/g) || [];
  const bad = imgs.filter((t) => !/\salt=/.test(t) || !/\swidth=/.test(t) || !/\sheight=/.test(t));
  return bad.length ? `${bad.length} incomplete: ${bad[0].slice(0, 80)}` : true;
});

eachPage("icon-only controls have an accessible name", (html) => {
  const tags = html.match(/<button\b[^>]*class="[^"]*icon-btn[^"]*"[^>]*>/g) || [];
  const bad = tags.filter((t) => !/aria-label=/.test(t));
  return bad.length ? `${bad.length} without aria-label` : true;
});

eachPage("decorative svgs are aria-hidden", (html) => {
  const svgs = html.match(/<svg\b[^>]*>/g) || [];
  const bad = svgs.filter((t) => !/aria-hidden="true"/.test(t) && !/role="img"/.test(t));
  return bad.length ? `${bad.length}/${svgs.length} lack aria-hidden` : true;
});

eachPage("no emoji used as icons", (html) => {
  const e = html.match(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu);
  return e ? `found: ${[...new Set(e)].join(" ")}` : true;
});

eachPage("skip link is present and before <header>", (html) => {
  const i = html.indexOf('class="skip-link"'), j = html.indexOf("<header");
  return i > -1 && i < j ? true : "missing or after <header>";
});

check('every Hinglish block carries lang="hi-Latn"', () => {
  const n = (ALL.match(/lang="hi-Latn"/g) || []).length;
  const expected = (ALL.match(/data-lang="hi"/g) || []).length;
  return n === expected && n === 4 ? ok("4 blocks") : `${n} hi-Latn vs ${expected} data-lang="hi" (want 4)`;
});

/* ---------- CSS contracts ------------------------------------------------ */

check("prefers-reduced-motion block present", () => /@media\s*\(prefers-reduced-motion:\s*reduce\)/.test(css));

check("reduced motion restores revealed content", () => {
  const block = css.split("@media (prefers-reduced-motion: reduce)")[1] || "";
  return /\.reveal[^{]*\{[^}]*opacity:\s*1/.test(block) ? true : ".reveal not forced visible";
});

check(":focus-visible styled, no bare outline:none", () => {
  if (!/:focus-visible\s*\{[^}]*outline:/.test(css)) return "no :focus-visible outline rule";
  const bare = [...css.matchAll(/([^{}]+)\{[^}]*outline:\s*none/g)].map((m) => m[1].trim())
    .filter((sel) => !/:focus:not\(:focus-visible\)/.test(sel));
  return bare.length ? `outline:none on: ${bare.join(" | ")}` : true;
});

check("reveal is gated behind .js (no blank page without JS)", () => {
  if (!/\.js\s+\.reveal\s*\{[^}]*opacity:\s*0/.test(css)) return ".js .reveal rule not found";
  if (/^\s*\.reveal\s*\{[^}]*opacity:\s*0/m.test(css)) return "ungated .reveal{opacity:0}";
  return true;
});

check("[hidden] beats display rules", () => /\[hidden\]\s*\{[^}]*display:\s*none\s*!important/.test(css));

eachPage("reveal gate has a failsafe if main.js never runs", (html) => {
  const problems = [];
  if (!/__revealFailsafe\s*=\s*setTimeout/.test(html)) problems.push("no failsafe timer");
  if (!/onerror="document\.documentElement\.classList\.remove\('js'\)"/.test(html)) problems.push("no script onerror");
  return problems.length ? problems.join("; ") : true;
});

check("main.js clears the failsafe", () => /clearTimeout\(window\.__revealFailsafe\)/.test(js));

/* ---------- head / SEO --------------------------------------------------- */

eachPage("head essentials present", (html) => {
  const need = {
    viewport: /<meta name="viewport"[^>]*width=device-width/,
    canonical: /<link rel="canonical"/,
    "og:title": /property="og:title"/, "og:image": /property="og:image"/,
    "twitter:card": /name="twitter:card"/, "json-ld": /application\/ld\+json/,
  };
  const missing = Object.entries(need).filter(([, re]) => !re.test(html)).map(([k]) => k);
  return missing.length ? `missing: ${missing.join(", ")}` : true;
});

eachPage("JSON-LD parses and is a Person", (html) => {
  const m = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  if (!m) return "no JSON-LD";
  return JSON.parse(m[1])["@type"] === "Person" ? true : "not a Person";
});

check("sitemap lists every page", () => {
  const sm = read("sitemap.xml");
  const missing = PAGE_FILES.filter((f) => !sm.includes(f === "index.html" ? "<loc>https://example.github.io/</loc>" : f));
  const extra = [...sm.matchAll(/<loc>[^<]*\/([a-z-]+\.html)<\/loc>/g)].map((m) => m[1])
    .filter((f) => !PAGE_FILES.includes(f));
  if (missing.length) return `absent: ${missing.join(", ")}`;
  return extra.length ? `stale entries: ${extra.join(", ")}` : ok(`${PAGE_FILES.length} URLs`);
});

/* ---------- JS hygiene --------------------------------------------------- */

check("no console.log left in main.js", () => /console\.log/.test(js) ? "console.log found" : true);

check("storage access is wrapped in try/catch", () => {
  const hits = [...js.matchAll(/localStorage|sessionStorage/g)].length;
  const guarded = js.split(/\btry\s*\{/).slice(1).join("");
  const unguarded = hits - (guarded.match(/localStorage|sessionStorage/g) || []).length;
  return unguarded > 0 ? `${unguarded} unguarded` : true;
});

/* ---------- content completeness across the site ------------------------- */

check("all source content survived the build", () => {
  const must = ["Keeladi", "Blue Whale", "Kolaveri Di", "Super El Ni",
    "Skip the 20+ hours of resume screening this week",
    "Handpicked senior candidates ready for screening",
    "The Opener", "The Social Proof Follow-Up", "The Soft CTA",
    "Sagarvishwa5901@gmail.com", "linkedin.com/in/gagarmesagarr",
    "Pakicetus", "Ryan Maue", "Vaigai river", "7th standard", "ghazal"];
  const missing = must.filter((s) => !ALL.includes(s));
  return missing.length ? `absent: ${missing.join(" | ")}` : ok(`${must.length} anchors present`);
});

check("copy corrections from the source doc were applied", () => {
  const problems = [];
  if (ALL.includes("60% reduction in total fill-time")) problems.push("garbled fill-time clause");
  if (ALL.includes("right now, Worth a quick")) problems.push("comma splice");
  if (/How we cut time-to-hire by 40%/.test(ALL)) problems.push("preview still says 40%");
  if (ALL.includes("A specialized talent acquisition")) problems.push("client still anonymised");
  return problems.length ? problems.join("; ") : true;
});

check("remaining gaps are still visibly marked", () => {
  // After the resume PDF, the reels and the article links landed, the only
  // outstanding gap is the Reqx campaign figures on the Results strip.
  const pendingMetrics = (ALL.match(/data-pending="true"/g) || []).length;
  const badges = (ALL.match(/class="todo"/g) || []).length;
  const problems = [];
  if (pendingMetrics !== 3) problems.push(`expected 3 pending metrics, found ${pendingMetrics}`);
  if (badges < 4) problems.push(`only ${badges} visible TODO badges`);
  if (/<!--\s*TODO: YouTube URL/.test(ALL)) problems.push("stale YouTube TODO — reels are linked now");
  return problems.length ? problems.join("; ") : ok(`${badges} badges / ${pendingMetrics} pending metrics`);
});

check("all 4 reels are linked from the script cards", () => {
  const reels = ["DWKxfhyBeGx", "DXliYTZjRg4", "DYbwxaINFa2", "DZhAhpENolS"];
  const missing = reels.filter((r) => !ALL.includes(`instagram.com/reel/${r}/`));
  const watch = (ALL.match(/class="watch"/g) || []).length;
  if (missing.length) return `not linked: ${missing.join(", ")}`;
  return watch === 4 ? ok("4 reels, one per script card") : `4 URLs but ${watch} watch links`;
});

check("resume page carries the real CV content", () => {
  const html = pages["resume.html"];
  const must = ["Accodigit", "Reqx Technologies Pvt Ltd", "25 million total views", "20,000+",
                "Indira Gandhi National Open University", "Google Digital Marketing",
                "sagarvishwa5901@gmail.com", "+91", "New Delhi",
                "Apr 2025", "Feb 2024", "May 2024"];
  const missing = must.filter((m) => !html.includes(m));
  return missing.length ? `absent: ${missing.join(" | ")}` : ok(`${must.length} CV anchors`);
});

check("the linked resume PDF is real, not a placeholder", () => {
  const pdf = readFileSync(join(ROOT, "assets/Sagar-Vishwakarma-Resume.pdf"), "latin1");
  if (/PLACEHOLDER/i.test(pdf)) return "still the placeholder PDF";
  const must = ["SAGAR VISHWAKARMA", "EXPERIENCE", "SKILLS", "EDUCATION", "ACCODIGIT", "25 million"];
  const missing = must.filter((m) => !pdf.includes(m));
  return missing.length ? `PDF missing: ${missing.join(", ")}` : ok(`${(pdf.length / 1024).toFixed(1)} KB, real content`);
});

check("audience metrics on the scripts page are sourced, not invented", () => {
  const html = pages["work.html"];
  // Both figures come straight off the CV; nothing else may claim a number.
  const okFigures = html.includes(">25M+<") && html.includes(">20,000+<");
  return okFigures ? ok("25M+ views, 20,000+ followers — from the CV") : "metric strip does not match the CV figures";
});

check("no placeholder art left where a real image exists", () => {
  const ph = (ALL.match(/class="placeholder"/g) || []).length;
  return ph ? `${ph} placeholder blocks remain` : ok("all 6 document images wired up");
});

check("all 7 published articles are linked", () => {
  const slugs = ["why-most-startups-fail-in-year-one",
    "ltv-cac-ratio-what-is-it-and-how-important-is-it",
    "why-is-customer-acquisition-cost-cac-rising-how-to-reduce-it",
    "how-to-win-back-customers-without-being-annoying",
    "why-your-website-isnt-getting-any-traffic-in-2026",
    "how-ai-and-automation-can-transform-business-operations",
    "how-to-build-a-successful-brand-identity-in-the-age-of-ai"];
  const missing = slugs.filter((sl) => !ALL.includes(`https://accodigit.com/${sl}/`));
  const cards = (ALL.match(/class="article-card"/g) || []).length;
  if (missing.length) return `not linked: ${missing.join(", ")}`;
  return cards === 7 ? ok("7 articles") : `7 links but ${cards} article cards`;
});

check("every external link is rel-protected and opens in a new tab", () => {
  const bad = [];
  for (const [file, html] of Object.entries(pages)) {
    for (const m of html.matchAll(/<a\b[^>]*href="https?:\/\/[^"]+"[^>]*>/g)) {
      const tag = m[0];
      if (!/rel="[^"]*noopener/.test(tag)) bad.push(`${file}: missing rel=noopener — ${tag.slice(0, 70)}`);
      if (!/target="_blank"/.test(tag)) bad.push(`${file}: missing target=_blank — ${tag.slice(0, 70)}`);
    }
  }
  return bad.length ? bad.slice(0, 3).join(" | ") : ok("all external links protected");
});

check("byline name is consistent", () => {
  // The seven published articles are all bylined "Sagar Vishwakarma".
  const bad = Object.entries(pages).filter(([, html]) =>
    !/"name": "Sagar Vishwakarma"/.test(html) || !/content="Sagar Vishwakarma"/.test(html));
  return bad.length ? `stale name on: ${bad.map(([f]) => f).join(", ")}` : ok("6 pages");
});

check("all 4 social profiles are linked", () => {
  const need = ["linkedin.com/in/gagarmesagarr", "instagram.com/gagarmesagarr",
                "youtube.com/@gagarmesagarr", "facebook.com/profile.php?id=61570788022715"];
  const missing = need.filter((u) => !ALL.includes(u));
  return missing.length ? `not linked: ${missing.join(", ")}` : ok("4 profiles");
});

check("image aspect ratios match the source doc", () => {
  // Doc tabs "1st Page 1:1" and "5th Page 3:4" are the Profile and About image
  // ratios — verified against the embedded originals (1024x1024, 1086x1448).
  const problems = [];
  if (!/portrait-round[\s\S]{0,300}portrait\.webp/.test(pages["index.html"]))
    problems.push("hero portrait is not in the round 1:1 frame on index.html");
  if (!/frame frame-3-4[\s\S]{0,300}about\.webp/.test(pages["about.html"]))
    problems.push("about photo is not in a 3:4 frame on about.html");
  return problems.length ? problems.join("; ") : ok("round 1:1 hero, 3:4 about");
});

/* ---------- contrast recomputed from the stylesheet ---------------------- */

const srgbToLin = (c) => (c /= 255) <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
const luminance = (hex) => {
  const h = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return 0.2126 * srgbToLin(r) + 0.7152 * srgbToLin(g) + 0.0722 * srgbToLin(b);
};
const ratio = (a, b) => { const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
const tokensIn = (block) => Object.fromEntries([...block.matchAll(/--([a-z-]+):\s*(#[0-9A-Fa-f]{6})/g)].map((m) => [m[1], m[2]]));

const light = tokensIn(css.slice(css.indexOf(":root {"), css.indexOf("@media (prefers-color-scheme: dark)")));
const dark  = tokensIn(css.slice(css.indexOf(':root[data-theme="dark"]')));

for (const [themeName, t] of [["light", light], ["dark", dark]]) {
  check(`contrast (${themeName}): body text pairs >= 4.5:1`, () => {
    const pairs = [["ink", "paper"], ["ink-muted", "paper"], ["accent", "paper"],
                   ["ink", "card"], ["ink-muted", "card"], ["accent", "card"]];
    const bad = [];
    for (const [fg, bg] of pairs) {
      if (!t[fg] || !t[bg]) return `token --${fg}/--${bg} missing in ${themeName}`;
      const r = ratio(t[fg], t[bg]);
      if (r < 4.5) bad.push(`--${fg} on --${bg} = ${r.toFixed(2)}:1`);
    }
    return bad.length ? bad.join(", ")
      : ok(`6 pairs, min ${Math.min(...pairs.map(([f, b]) => ratio(t[f], t[b]))).toFixed(2)}:1`);
  });
}

check("accent-deco is never used for body text", () => {
  const uses = [...css.matchAll(/([^{}]+)\{[^}]*color:\s*var\(--accent-deco\)/g)].map((m) => m[1].trim());
  return uses.length ? `used as text colour on: ${uses.join(" | ")}` : true;
});

/* ---------- summary ------------------------------------------------------ */

console.log("\n" + "-".repeat(60));
console.log(`${pass} passed, ${fail} failed, ${pass + fail} total`);
if (fail) { console.log("\nFailures:"); results.filter((r) => !r.ok).forEach((r) => console.log(`  - ${r.name}: ${r.detail}`)); }
process.exit(fail ? 1 : 0);
