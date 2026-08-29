#!/usr/bin/env node
/* Zero-dependency build checks for the Sagar portfolio (6 static pages).
   Run: node tests/check.mjs        (Node >= 18, no npm install)
   Exits non-zero on any failure. */

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");

/* One scrolling document; the four tabs are section anchors. */
const PAGE_FILES = ["index.html"];
const SECTION_IDS = ["work", "resume", "about", "contact"];
const TAB_LABELS = ["Work Samples", "Resume", "About Me", "Contact"];

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
                ".nojekyll", "robots.txt", "sitemap.xml", "README.md", "tools/build.mjs",
                "assets/Sagar-Vishwakarma-Resume.pdf", "assets/Sagar-Vishwakarma-Resume.docx"];
  const missing = need.filter((f) => !existsSync(join(ROOT, f)));
  return missing.length ? `missing: ${missing.join(", ")}` : ok(`${need.length} files`);
});

check("generated page is in sync with src/", () => {
  try {
    execFileSync("node", [join(ROOT, "tools/build.mjs"), "--check"], { cwd: ROOT, stdio: "pipe" });
    return ok("no drift");
  } catch (e) {
    return "committed page is stale — run: node tools/build.mjs";
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

/* ---------- navigation --------------------------------------------------- */

check("the tab strip has four anchor tabs, no numbering", () => {
  const html = pages["index.html"];
  const strip = html.match(/<nav class="tabs"[\s\S]*?<\/nav>/)[0];
  const links = [...strip.matchAll(/<a href="#([^"]+)" data-tab="([^"]+)">[\s\S]*?<span class="t-label">([^<]+)</g)];
  const problems = [];
  if (links.length !== 4) problems.push(`${links.length} tabs, expected 4`);
  const names = links.map((m) => m[3].trim());
  if (names.some((n) => /\d/.test(n))) problems.push(`numbered labels: ${names.filter((n) => /\d/.test(n)).join(", ")}`);
  if (names.join("|") !== TAB_LABELS.join("|")) problems.push(`labels are ${names.join(", ")}`);
  if (links.map((m) => m[1]).join("|") !== SECTION_IDS.join("|")) problems.push("tab targets do not match the section order");
  return problems.length ? problems.join("; ") : ok(names.join(" · "));
});

check("no leftover section numbering", () => {
  const html = pages["index.html"];
  const numbered = [...html.matchAll(/<p class="eyebrow">[^<]*<span class="num">/g)];
  return numbered.length ? `${numbered.length} eyebrows still numbered` : ok("eyebrows are unnumbered");
});

check("every tab points at a section that exists", () => {
  const html = pages["index.html"];
  const missing = SECTION_IDS.filter((id) => !new RegExp(`<section[^>]*\\sid="${id}"`).test(html));
  return missing.length ? `no section for: ${missing.join(", ")}` : ok(`${SECTION_IDS.length} sections`);
});

check("sections appear in tab order", () => {
  const html = pages["index.html"];
  const at = SECTION_IDS.map((id) => html.indexOf(`id="${id}"`));
  const sorted = [...at].sort((a, b) => a - b);
  return at.join() === sorted.join() ? ok(SECTION_IDS.join(" → ")) : "document order does not match tab order";
});

check("the tab strip follows the hero so it can pin", () => {
  const html = pages["index.html"];
  const hero = html.indexOf('class="section hero"');
  const tabs = html.indexOf('<nav class="tabs"');
  const work = html.indexOf('id="work"');
  return hero > -1 && tabs > hero && work > tabs
    ? ok("hero → tabs → sections")
    : "tab strip is not between the hero and the sections";
});

check("every section between the tabs and the footer is attributed to a tab", () => {
  // An untagged section is a stretch of page where no tab is lit. The featured
  // writing samples are Work Samples; leaving them out put a ~1,250px dead zone
  // in front of the Work Samples tab.
  const html = pages["index.html"];
  const main = html.slice(html.indexOf('<nav class="tabs"'), html.indexOf("</main>"));
  const untagged = [...main.matchAll(/<section class="section"(?![^>]*data-spy)[^>]*id="([^"]+)"/g)]
    .map((m) => m[1]);
  const featured = /<section class="section" data-spy="work" id="featured"/.test(html);
  const problems = [];
  if (untagged.length) problems.push(`no data-spy on: ${untagged.join(", ")}`);
  if (!featured) problems.push("#featured is not attributed to the work tab");
  return problems.length ? problems.join("; ") : ok("every section below the tabs owns a tab");
});

check("scroll-spy drives the active tab", () => {
  const problems = [];
  if (!/new IntersectionObserver/.test(js)) problems.push("no IntersectionObserver");
  if (!/setAttribute\("aria-current", "page"\)/.test(js)) problems.push("never sets aria-current");
  if (/addEventListener\("scroll"/.test(js)) problems.push("uses a scroll listener instead of an observer");
  return problems.length ? problems.join("; ") : ok("observer-driven, no scroll listener");
});

check("the active tab is markedly larger, not just tinted", () => {
  const card  = css.match(/\.tabs a\[aria-current="page"\]\s*\{[^}]*\}/);
  const photo = css.match(/\.tabs a\[aria-current="page"\] \.t-photo\s*\{[^}]*\}/);
  const label = css.match(/\.tabs a\[aria-current="page"\] \.t-label\s*\{[^}]*\}/);
  const problems = [];
  if (!card || !/width:/.test(card[0])) problems.push("not wider");
  if (!photo || !/height:/.test(photo[0])) problems.push("picture not taller");
  if (!label || !/font-size:/.test(label[0])) problems.push("no label size bump");
  if (!card || !/box-shadow:/.test(card[0])) problems.push("no lift");
  return problems.length ? problems.join("; ") : ok("wider card, taller picture, bigger label");
});

check("no layout properties are transitioned on the tabs", () => {
  // Animating width/height/font-size forces layout on every frame — that is
  // what makes an active tab feel laggy. Only paint/composite props may animate.
  const rules = [...css.matchAll(/\.tabs a[^{]*\{([^}]*)\}/g)].map((m) => m[1]);
  const bad = [];
  for (const body of rules) {
    const t = body.match(/transition:\s*([^;]+);/);
    if (!t) continue;
    for (const prop of ["width", "height", "min-height", "font-size", "padding", "margin", "top", "left"])
      if (new RegExp(`(^|[\\s,])${prop}\\s`).test(t[1])) bad.push(prop);
  }
  return bad.length ? `transitions layout props: ${[...new Set(bad)].join(", ")}` : ok("opacity/transform/shadow only");
});

check("each tab shows its picture in full, label on a solid bar", () => {
  const problems = [];
  if (/data-bg=/.test(css) || /data-bg=/.test(js)) problems.push("strip ground still swaps per section");
  // The label never sits on the photograph — it has its own solid bar, so the
  // picture can be shown at full strength without hurting contrast.
  if (!/\.t-label\s*\{[^}]*background:\s*var\(--card\)/.test(css))
    problems.push("label bar is not solid");
  if (/\.tabs a::after\s*\{[^}]*linear-gradient/.test(css))
    problems.push("still darkening the picture behind the label");
  if (/\.t-photo\s*\{[^}]*opacity:\s*0?\.[0-9]/.test(css))
    problems.push("picture is dimmed");
  for (const key of SECTION_IDS) {
    if (!new RegExp(`\\.tabs a\\[data-tab="${key}"\\]\\s+\\.t-photo[^}]*tab-${key}`).test(css))
      problems.push(`no image for the ${key} tab`);
    for (const ext of ["webp", "jpg"])
      if (!existsSync(join(ROOT, `assets/img/tab-${key}.${ext}`))) problems.push(`missing tab-${key}.${ext}`);
  }
  return problems.length ? problems.slice(0, 3).join("; ") : ok("4 undimmed photos + solid label bars");
});

check("sections clear the sticky strip when jumped to", () =>
  /scroll-margin-top:\s*\d+px/.test(css) || "no scroll-margin-top on .section");

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

check("no orphaned images in assets/img", () => {
  const used = new Set();
  for (const m of css.matchAll(/url\("\.\.\/img\/([^"]+)"\)/g)) used.add(m[1]);
  for (const m of ALL.matchAll(/assets\/img\/([\w.-]+)/g)) used.add(m[1]);
  const onDisk = readdirSync(join(ROOT, "assets/img"));
  const orphans = onDisk.filter((f) => !used.has(f));
  return orphans.length ? `unreferenced: ${orphans.join(", ")}` : ok(`${onDisk.length} images, all referenced`);
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

check("no duplicate element ids", () => {
  // Duplicates are invalid HTML and silently break in-page anchors and
  // aria-labelledby references.
  const ids = [...pages["index.html"].matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  const seen = new Set(), dupes = new Set();
  for (const id of ids) (seen.has(id) ? dupes : seen).add(id);
  return dupes.size ? `duplicated: ${[...dupes].join(", ")}` : ok(`${seen.size} unique ids`);
});

check("every aria-labelledby points at an existing id", () => {
  const html = pages["index.html"];
  const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
  const dangling = [...html.matchAll(/aria-labelledby="([^"]+)"/g)]
    .flatMap((m) => m[1].split(/\s+/)).filter((r) => !ids.has(r));
  return dangling.length ? `no element with id: ${[...new Set(dangling)].join(", ")}` : ok("all resolve");
});

check("no aria-hidden wrapped around a focusable element", () => {
  // axe rule aria-hidden-focus: hiding a link or button from the a11y tree while
  // it remains reachable strands keyboard and screen-reader users on it.
  const html = pages["index.html"];
  const bad = [];
  for (const m of html.matchAll(/<(a|button)\b[^>]*aria-hidden="true"[^>]*>/g)) bad.push(m[0].slice(0, 60));
  for (const m of html.matchAll(/<[^>]+aria-hidden="true"[^>]*tabindex="-?\d"[^>]*>/g)) bad.push(m[0].slice(0, 60));
  return bad.length ? `${bad.length} focusable element(s) hidden: ${bad[0]}…` : ok("none");
});

check("images below the fold are lazy-loaded", () => {
  // A CSS background is always fetched; an <img loading="lazy"> is not. The four
  // 9:16 posters alone were 211 KB of eager download before this.
  const html = pages["index.html"];
  const imgs = html.match(/<img\b[^>]*>/g) || [];
  const eager = imgs.filter((t) => !/loading="lazy"/.test(t));
  // only the hero portrait may load eagerly
  const problems = eager.filter((t) => !/fetchpriority="high"/.test(t))
    .map((t) => (t.match(/src="([^"]+)"/) || [])[1]);
  const cssBg = [...css.matchAll(/url\("\.\.\/img\/(poster-[^"]+)"\)/g)].map((m) => m[1]);
  if (cssBg.length) problems.push(`posters still CSS backgrounds: ${cssBg.join(", ")}`);
  return problems.length ? `eagerly fetched: ${problems.join(", ")}`
    : ok(`${imgs.length} images, ${imgs.length - eager.length} lazy`);
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

check("stylesheet parses cleanly", () => {
  const problems = [];
  const opens = (css.match(/\{/g) || []).length, closes = (css.match(/\}/g) || []).length;
  if (opens !== closes) problems.push(`${opens} { vs ${closes} }`);
  // a selector must not begin with a quote or a stray delimiter
  for (const m of css.matchAll(/(^|\n)\s*(["'`;])/g)) problems.push(`stray ${m[2]} at a rule boundary`);
  return problems.length ? [...new Set(problems)].slice(0, 3).join("; ") : ok(`${opens} balanced rules`);
});

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

check("sitemap has no stale page entries", () => {
  const sm = read("sitemap.xml");
  const extra = [...sm.matchAll(/<loc>[^<]*\/([a-z-]+\.html)<\/loc>/g)].map((m) => m[1]);
  if (!sm.includes("<loc>https://example.github.io/</loc>")) return "home URL missing";
  return extra.length ? `stale entries: ${extra.join(", ")}` : ok("1 URL");
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

check("results tiles and their caveat stay in sync", () => {
  // The three tiles Sagar asked for are Open / Response / Conversion rate.
  // Until real figures are supplied they must stay visibly pending, and the
  // "to be supplied" note must be present. Fill a tile and the note has to go —
  // this stops a half-finished strip reading as measured results.
  const html = pages["index.html"];
  const sec = html.slice(html.indexOf('id="work"'), html.indexOf('id="resume"'));
  const stripAt = sec.indexOf('class="metrics');
  if (stripAt === -1) return "the results strip is missing";
  const strip = sec.slice(stripAt, sec.indexOf("</ul>", stripAt));
  const text = (h) => h.replace(/<[^>]+>/g, " ").replace(/&[a-z]+;/gi, " ").replace(/\s+/g, " ").trim();

  const tiles = [...strip.matchAll(/class="value"([^>]*)>([\s\S]*?)<\/span>[\s\S]*?class="label"[^>]*>([\s\S]*?)<\/span>/g)]
    .map((m) => ({ pending: /data-pending="true"/.test(m[1]), value: text(m[2]), label: text(m[3]) }));

  const problems = [];
  const want = ["Open rate", "Response rate", "Conversion rate"];
  want.forEach((w, i) => {
    if (!tiles[i] || !tiles[i].label.startsWith(w)) problems.push(`tile ${i + 1} is not "${w}"`);
  });

  const noteShown = /Figures to be supplied/i.test(sec);
  const SUPPLIED = { "Open rate": "60%", "Response rate": "11.5%", "Conversion rate": "3.8%" };
  const filled = tiles.filter((t) => !t.pending);
  const stillPending = tiles.filter((t) => t.pending);

  for (const t of filled) {
    if (/^[\s—-]*$/.test(t.value)) problems.push(`"${t.label}" is marked filled but has no value`);
    // pin the figures Sagar supplied, so a later edit cannot quietly change them
    const want = SUPPLIED[t.label];
    if (want && t.value !== want) problems.push(`"${t.label}" is ${t.value}, supplied figure was ${want}`);
  }
  if (stillPending.length && !noteShown) problems.push("tiles are pending but the caveat note is missing");
  if (!stillPending.length && noteShown) problems.push("all tiles filled but the caveat note is still there");
  // a pending tile must also carry its visible badge
  const badges = (strip.match(/class="todo"/g) || []).length;
  if (badges !== stillPending.length)
    problems.push(`${badges} badges for ${stillPending.length} pending tiles`);

  return problems.length ? problems.slice(0, 3).join("; ")
    : ok(`${want.length} tiles, ${stillPending.length} awaiting figures`);
});

check("no placeholder art left where a real image exists", () => {
  const ph = (ALL.match(/class="placeholder"/g) || []).length;
  return ph ? `${ph} placeholder blocks remain` : ok("every image slot filled");
});

check("each script links the reel that actually matches it", () => {
  // Verified against each reel's own og:title caption on instagram.com:
  //   DWKxfhyBeGx "Keeladi: India's Hidden Civilisation"
  //   DYbwxaINFa2 "When a blue whale dives deep into the abyss..."
  //   DZhAhpENolS "...blending the South Indian..."   (Kolaveri Di)
  //   DXliYTZjRg4 "El Nino is heading our way..."
  const pairs = { "script-keeladi": "DWKxfhyBeGx", "script-bluewhale": "DYbwxaINFa2",
                  "script-kolaveri": "DZhAhpENolS", "script-elnino": "DXliYTZjRg4" };
  const html = pages["index.html"];
  const problems = [];
  for (const [sid, code] of Object.entries(pairs)) {
    const at = html.indexOf(`id="${sid}"`);
    if (at === -1) { problems.push(`no card ${sid}`); continue; }
    const card = html.slice(Math.max(0, at - 2600), at);
    const found = [...card.matchAll(/instagram\.com\/reel\/([A-Za-z0-9_-]+)\//g)].map((m) => m[1]);
    if (!found.length) problems.push(`${sid} links no reel`);
    else if (found.some((f) => f !== code)) problems.push(`${sid} → ${[...new Set(found)].join("/")}, expected ${code}`);
  }
  const cta = (ALL.match(/class="poster-cta"/g) || []).length;
  if (cta !== 4) problems.push(`${cta} watch CTAs, expected 4`);
  // exactly one link per card — a duplicate is noise in a screen reader's link list
  for (const card of ALL.match(/<article class="script-card reveal">[\s\S]*?<\/article>/g) || []) {
    const links = (card.match(/href="https:\/\/www\.instagram\.com\/reel\//g) || []).length;
    if (links !== 1) problems.push(`a card has ${links} reel links, expected 1`);
  }
  return problems.length ? [...new Set(problems)].join("; ") : ok("4 reels, one link each, correctly matched");
});

check("audience metrics on the scripts page are sourced, not invented", () => {
  const html = pages["index.html"];
  return html.includes(">25M+<") && html.includes(">20,000+<")
    ? ok("25M+ views, 20,000+ followers — from the CV")
    : "metric strip does not match the CV figures";
});

check("the site does not oversell the published pieces", () => {
  // All seven Accodigit pieces are 520-850 words with 5-7 subheads — blog
  // length, not long-form. Quoted CV/source text may say otherwise; the site's
  // own headings and intros must not.
  const html = pages["index.html"];
  const featured = html.slice(html.indexOf('id="featured"'), html.indexOf("</ul>", html.indexOf('id="featured"')));
  const heading = featured.match(/<h2[^>]*>([^<]+)<\/h2>/);
  const intro = featured.match(/<div class="prose reveal">([\s\S]*?)<\/div>/);
  const problems = [];
  if (heading && /long-form/i.test(heading[1])) problems.push("featured heading still claims long-form");
  if (intro && /long-form/i.test(intro[1])) problems.push("featured intro still claims long-form");
  if (/<strong>Long-form articles<\/strong>/.test(html)) problems.push("services list still claims long-form articles");
  return problems.length ? problems.join("; ") : ok("framed as published pieces, not long-form");
});

check("the resume section summarises rather than re-typesets the CV", () => {
  const html = pages["index.html"];
  const sec = html.slice(html.indexOf('id="resume"'), html.indexOf('id="about"'));
  const problems = [];
  for (const m of ["Accodigit", "Reqx Technologies", "Video Scriptwriter",
                   "Apr 2025", "Feb 2024", "May 2024", "25M+", "20,000+"])
    if (!sec.includes(m)) problems.push(`missing ${m}`);
  for (const m of ["Indira Gandhi", "Google Digital Marketing", "Structural Editing", "Pivot Tables"])
    if (sec.includes(m)) problems.push(`${m} duplicated out of the CV`);
  if (sec.includes("sagarvishwa5901@gmail.com")) problems.push("contact details duplicated from the Contact section");
  return problems.length ? problems.slice(0, 3).join("; ") : ok("3 roles + downloads, detail left in the document");
});

check("the resume is previewable in-app and downloadable both ways", () => {
  const html = pages["index.html"];
  const problems = [];
  // <object data=...pdf> silently shows nothing in many browsers — the preview
  // is a rendered image so it always displays.
  if (/<object[^>]*\.pdf/.test(html)) problems.push("uses <object> for the preview — unreliable");
  if (!/resume-preview\.(webp|jpg)/.test(html)) problems.push("no rendered preview image");
  if (!/href="assets\/Sagar-Vishwakarma-Resume\.pdf" download/.test(html)) problems.push("no PDF download");
  if (!/href="assets\/Sagar-Vishwakarma-Resume\.docx" download/.test(html)) problems.push("no Word download");
  return problems.length ? problems.join("; ") : ok("preview + PDF + Word");
});

check("the full CV detail is still in the downloadable files", () => {
  const pdf = readFileSync(join(ROOT, "assets/Sagar-Vishwakarma-Resume.pdf"), "latin1");
  const docx = readFileSync(join(ROOT, "assets/Sagar-Vishwakarma-Resume.docx"));
  const problems = [];
  if (/PLACEHOLDER/i.test(pdf)) problems.push("PDF is still a placeholder");
  for (const m of ["Indira Gandhi", "Google Digital Marketing", "SKILLS", "25 million"])
    if (!pdf.includes(m)) problems.push(`PDF missing ${m}`);
  if (docx[0] !== 0x50 || docx[1] !== 0x4b) problems.push("Word file is not a zip container");
  const raw = docx.toString("latin1");
  for (const part of ["[Content_Types].xml", "word/document.xml"])
    if (!raw.includes(part)) problems.push(`docx missing ${part}`);
  return problems.length ? problems.slice(0, 3).join("; ") : ok("PDF + Word carry the detail");
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
  const html = pages["index.html"];
  return /"name": "Sagar Vishwakarma"/.test(html) && /content="Sagar Vishwakarma"/.test(html)
    ? ok("Sagar Vishwakarma") : "stale name in metadata";
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
  if (!/frame frame-3-4[\s\S]{0,300}about\.webp/.test(pages["index.html"]))
    problems.push("about photo is not in a 3:4 frame");
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
                   ["accent-label", "paper"], ["accent-label", "card"],
                   ["ink", "card"], ["ink-muted", "card"], ["accent", "card"]];
    const bad = [];
    for (const [fg, bg] of pairs) {
      if (!t[fg] || !t[bg]) return `token --${fg}/--${bg} missing in ${themeName}`;
      const r = ratio(t[fg], t[bg]);
      if (r < 4.5) bad.push(`--${fg} on --${bg} = ${r.toFixed(2)}:1`);
    }
    return bad.length ? bad.join(", ")
      : ok(`${pairs.length} pairs, min ${Math.min(...pairs.map(([f, b]) => ratio(t[f], t[b]))).toFixed(2)}:1`);
  });
}

check("section labels are yellow and bold", () => {
  const rule = css.match(/\.eyebrow\s*\{[^}]*\}/);
  if (!rule) return "no .eyebrow rule";
  const problems = [];
  if (!/color:\s*var\(--accent-label\)/.test(rule[0])) problems.push("not using --accent-label");
  const w = rule[0].match(/font-weight:\s*(\d+)/);
  if (!w || +w[1] < 600) problems.push(`font-weight ${w ? w[1] : "unset"} — not bold`);
  const count = (pages["index.html"].match(/class="eyebrow"/g) || []).length;
  if (count !== 6) problems.push(`${count} eyebrows, expected 6`);
  return problems.length ? problems.join("; ") : ok(`6 labels, --accent-label, weight ${w[1]}`);
});

check("accent-deco is never used for body text", () => {
  const uses = [...css.matchAll(/([^{}]+)\{[^}]*color:\s*var\(--accent-deco\)/g)].map((m) => m[1].trim());
  return uses.length ? `used as text colour on: ${uses.join(" | ")}` : true;
});

/* ---------- summary ------------------------------------------------------ */

console.log("\n" + "-".repeat(60));
console.log(`${pass} passed, ${fail} failed, ${pass + fail} total`);
if (fail) { console.log("\nFailures:"); results.filter((r) => !r.ok).forEach((r) => console.log(`  - ${r.name}: ${r.detail}`)); }
process.exit(fail ? 1 : 0);
