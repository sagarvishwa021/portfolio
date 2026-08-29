#!/usr/bin/env node
/* Runtime checks in a real browser, driven over CDP.
   Needs no npm packages — uses Node's built-in WebSocket (Node >= 22).

   Usage:  node tests/browser-check.mjs [--browser <path-to-chrome>]

   Serves the site on an ephemeral port, drives Chrome headless, and asserts
   layout/behaviour a static scan cannot see. Exits non-zero on failure.
   Exits 0 with a SKIP notice if no browser is installed. */

import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { readFile, access } from "node:fs/promises";
import { dirname, resolve, join, extname, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const MIME = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript",
  ".png": "image/png", ".svg": "image/svg+xml", ".pdf": "application/pdf",
  ".xml": "application/xml", ".txt": "text/plain" };

function serve() {
  return new Promise((res) => {
    const server = createServer(async (req, rq) => {
      let p = decodeURIComponent(req.url.split("?")[0].split("#")[0]);
      if (p.endsWith("/")) p += "index.html";
      const file = join(ROOT, normalize(p).replace(/^(\.\.[/\\])+/, ""));
      try {
        const buf = await readFile(file);
        rq.writeHead(200, { "content-type": MIME[extname(file)] || "application/octet-stream" });
        rq.end(buf);
      } catch { rq.writeHead(404); rq.end("not found"); }
    });
    server.listen(0, "127.0.0.1", () => res({ server, port: server.address().port }));
  });
}

class CDP {
  constructor(ws) { this.ws = ws; this.id = 0; this.waiters = new Map(); this.handlers = []; }
  static async attach(wsUrl) {
    const ws = new WebSocket(wsUrl);
    await new Promise((ok, no) => { ws.onopen = ok; ws.onerror = () => no(new Error("ws failed")); });
    const c = new CDP(ws);
    ws.onmessage = (m) => {
      const msg = JSON.parse(m.data);
      if (msg.id && c.waiters.has(msg.id)) {
        const { ok, no } = c.waiters.get(msg.id); c.waiters.delete(msg.id);
        msg.error ? no(new Error(msg.error.message)) : ok(msg.result);
      } else if (msg.method) c.handlers.forEach((h) => h(msg));
    };
    return c;
  }
  send(method, params = {}, sessionId) {
    const id = ++this.id;
    return new Promise((ok, no) => {
      this.waiters.set(id, { ok, no });
      this.ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
      setTimeout(() => { if (this.waiters.delete(id)) no(new Error(method + " timed out")); }, 20000);
    });
  }
  on(fn) { this.handlers.push(fn); }
  close() { try { this.ws.close(); } catch {} }
}

async function exists(p) { try { await access(p); return true; } catch { return false; } }

async function findBrowser(explicit) {
  if (explicit) return explicit;
  const pw = join(homedir(), "Library/Caches/ms-playwright");
  const candidates = [
    join(pw, "chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell"),
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
    "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser",
  ];
  for (const c of candidates) if (await exists(c)) return c;
  return null;
}

let pass = 0, fail = 0;
const failures = [];
function check(name, ok, detail = "") {
  ok ? pass++ : fail++;
  if (!ok) failures.push(`${name}: ${detail}`);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
}

const argv = process.argv.slice(2);
const argBrowser = argv.includes("--browser") ? argv[argv.indexOf("--browser") + 1] : null;
const port = 9222 + (process.pid % 500);

const bin = await findBrowser(argBrowser);
if (!bin) {
  console.log("SKIP  no Chrome/Chromium found — pass --browser <path> to run runtime checks");
  process.exit(0);
}
console.log(`browser: ${bin}\n`);

const { server, port: httpPort } = await serve();
const BASE = `http://127.0.0.1:${httpPort}/`;

const proc = spawn(bin, ["--headless", "--disable-gpu", "--no-sandbox", "--hide-scrollbars",
  "--no-first-run", "--disable-extensions", `--remote-debugging-port=${port}`,
  "--user-data-dir=" + join("/tmp", "cdp-" + process.pid), "about:blank"],
  { stdio: ["ignore", "ignore", "ignore"] });

let cdp;
const cleanup = () => { cdp?.close(); try { proc.kill("SIGKILL"); } catch {} server.close(); };
process.on("exit", cleanup);

async function browserWs() {
  for (let i = 0; i < 60; i++) {
    try { const r = await fetch(`http://127.0.0.1:${port}/json/version`); return (await r.json()).webSocketDebuggerUrl; }
    catch { await new Promise((r) => setTimeout(r, 200)); }
  }
  throw new Error("browser never exposed a debugging port");
}

try {
  cdp = await CDP.attach(await browserWs());
  const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
  const { sessionId: S } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });

  const consoleErrors = [];
  cdp.on((msg) => {
    if (msg.sessionId !== S) return;
    if (msg.method === "Runtime.exceptionThrown")
      consoleErrors.push(msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text);
    if (msg.method === "Runtime.consoleAPICalled" && ["error", "warning"].includes(msg.params.type))
      consoleErrors.push(msg.params.type + ": " + msg.params.args.map((a) => a.value ?? a.description).join(" "));
  });

  await cdp.send("Page.enable", {}, S);
  await cdp.send("Runtime.enable", {}, S);
  await cdp.send("DOM.enable", {}, S);

  const evalJs = async (expression) => {
    const r = await cdp.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }, S);
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || "eval threw");
    return r.result.value;
  };
  const goto = async (url) => {
    await cdp.send("Page.navigate", { url }, S);
    await new Promise((r) => setTimeout(r, 900));
  };
  const setViewport = (width, height = 900) =>
    cdp.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width < 700 }, S);
  const media = (features) => cdp.send("Emulation.setEmulatedMedia", { features }, S);

  const PAGES = ["index.html", "work.html", "resume.html", "about.html", "contact.html"];
  const TABS  = ["work.html", "resume.html", "about.html", "contact.html"];

  /* 1. no horizontal scroll, every page x every breakpoint */
  for (const w of [375, 768, 1024, 1440]) {
    await setViewport(w);
    const bad = [];
    for (const page of PAGES) {
      await goto(BASE + page);
      const r = await evalJs(`(() => {
        const d = document.documentElement;
        const over = [...document.querySelectorAll('body *')]
          .filter(el => el.getBoundingClientRect().right > d.clientWidth + 1).slice(0,3)
          .map(el => el.tagName.toLowerCase() + (el.className ? '.' + String(el.className).split(' ')[0] : ''));
        return { scrollW: d.scrollWidth, clientW: d.clientWidth, over };
      })()`);
      if (r.scrollW > r.clientW + 1) bad.push(`${page} ${r.scrollW}>${r.clientW} (${r.over.join(", ")})`);
    }
    check(`no horizontal scroll @ ${w}px (all pages)`, bad.length === 0, bad.join(" | ") || `${PAGES.length} pages`);
  }

  /* 1b. every page reveals its content and reports no console errors */
  {
    await setViewport(1280, 900);
    const bad = [];
    for (const page of PAGES) {
      await goto(BASE + page);
      const r = await evalJs(`(async () => {
        const frame = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        for (let y = 0; y < document.body.scrollHeight; y += 300) {
          window.scrollTo(0, y); await frame(); await new Promise(r => setTimeout(r, 110));
        }
        window.scrollTo(0,0); await new Promise(r => setTimeout(r, 700));
        const els = [...document.querySelectorAll('.reveal')];
        return { total: els.length, hidden: els.filter(e => parseFloat(getComputedStyle(e).opacity) < 0.9).length };
      })()`);
      if (r.hidden) bad.push(`${page}: ${r.hidden}/${r.total} hidden`);
    }
    check("every page fully reveals its content", bad.length === 0, bad.join(" | ") || `${PAGES.length} pages`);
  }

  /* 1c. the sticky tab strip navigates and marks the current page */
  {
    const bad = [];
    for (const page of PAGES) {
      await goto(BASE + page);
      const r = await evalJs(`(() => {
        const cur = document.querySelectorAll('#nav a[aria-current="page"]');
        const hrefs = [...document.querySelectorAll('#nav a')].map(a => a.getAttribute('href'));
        const strip = document.querySelector('.tabs');
        return { count: cur.length, href: cur[0] && cur[0].getAttribute('href'), navLen: hrefs.length,
                 sticky: strip && getComputedStyle(strip).position === 'sticky',
                 title: document.querySelector('h1') ? document.querySelector('h1').textContent.trim().slice(0,40) : null };
      })()`);
      if (!r.sticky) bad.push(`${page}: tab strip is not sticky`);
      if (r.navLen !== 4) bad.push(`${page}: tab strip has ${r.navLen} links, expected 4`);
      const wantCurrent = TABS.includes(page);
      if (wantCurrent && (r.count !== 1 || r.href !== page)) bad.push(`${page}: aria-current=${r.href} (x${r.count})`);
      if (!wantCurrent && r.count !== 0) bad.push(`${page}: home should not mark a tab current`);
      if (!r.title) bad.push(`${page}: no <h1>`);
    }
    check("tab strip marks the current page", bad.length === 0, bad.join(" | ") || `${PAGES.length} pages, 4 tabs each`);
  }

  /* 1c2. the tab strip persists at the top once the hero has scrolled past */
  {
    await setViewport(1280, 900);
    await goto(BASE + "index.html");
    const r = await evalJs(`(async () => {
      const strip = document.querySelector('.tabs');
      const before = strip.getBoundingClientRect().top;
      const heroBottom = document.querySelector('.hero').getBoundingClientRect().bottom;
      // scroll just past the hero — the case the design actually cares about
      window.scrollTo(0, heroBottom + 400);
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      await new Promise(r => setTimeout(r, 250));
      const pinned = strip.getBoundingClientRect().top;
      const header = document.querySelector('.site-header').getBoundingClientRect().bottom;
      // and still visible at the very bottom of the page
      window.scrollTo(0, document.body.scrollHeight);
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      await new Promise(r => setTimeout(r, 250));
      const atEnd = strip.getBoundingClientRect();
      return { before: Math.round(before), pinned: Math.round(pinned), header: Math.round(header),
               endTop: Math.round(atEnd.top), endVisible: atEnd.bottom > 0 && atEnd.top < innerHeight };
    })()`);
    check("tab strip pins to the top once the hero scrolls away",
      r.before > 100 && r.pinned >= -1 && r.pinned <= 1,
      `starts at y=${r.before}, pins at y=${r.pinned}`);
    check("tab strip is still on screen at the foot of the page", r.endVisible,
      `top=${r.endTop} at max scroll`);
    check("the old menu header scrolls away with the hero", r.header < 0,
      `header bottom at y=${r.header}`);
  }

  /* 1d. clicking through the pager walks the whole doc order */
  {
    await goto(BASE + "work.html");
    const walked = await evalJs(`(async () => {
      const seen = [location.pathname.split('/').pop() || 'index.html'];
      return seen;
    })()`);
    let path = [];
    let current = "work.html";
    for (let i = 0; i < 5; i++) {
      await goto(BASE + current);
      path.push(current);
      const next = await evalJs(`(() => { const a = document.querySelector('.pager-next'); return a ? a.getAttribute('href') : null; })()`);
      if (!next) break;
      current = next;
    }
    check("pager walks the four tabbed pages in order",
      JSON.stringify(path) === JSON.stringify(TABS), path.join(" → "));
  }

  /* 2. reveal completes */
  await setViewport(1280, 900);
  await goto(BASE + "work.html");
  const revealed = await evalJs(`(async () => {
    const els = [...document.querySelectorAll('.reveal')];
    const frame = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    for (let y = 0; y < document.body.scrollHeight; y += 300) {
      window.scrollTo(0, y); await frame(); await new Promise(r => setTimeout(r, 110));
    }
    window.scrollTo(0,0); await new Promise(r=>setTimeout(r,800));
    const hidden = els.filter(e => parseFloat(getComputedStyle(e).opacity) < 0.9);
    return { total: els.length, hidden: hidden.length,
             sample: hidden.slice(0,3).map(e => e.tagName + '.' + String(e.className).split(' ')[0]) };
  })()`);
  check("every .reveal element ends up visible", revealed.hidden === 0,
    revealed.hidden ? `${revealed.hidden}/${revealed.total} transparent: ${revealed.sample.join(", ")}` : `${revealed.total} elements`);

  /* 4. dialog lifecycle */
  const dlg = await evalJs(`(async () => {
    window.scrollTo(0,0);
    const btn = document.querySelector('.script-open');
    const d = document.getElementById('scriptDialog');
    btn.focus(); btn.click();
    await new Promise(r => setTimeout(r, 300));
    const open = { open: d.open, focusInside: d.contains(document.activeElement),
      title: document.getElementById('dialogTitle').textContent,
      bodyLocked: document.body.style.overflow === 'hidden',
      detailsHidden: getComputedStyle(document.getElementById(btn.dataset.script)).display === 'none',
      langBlocks: d.querySelectorAll('[data-lang]').length,
      visibleLang: [...d.querySelectorAll('[data-lang]')].filter(b => !b.hidden).length };
    d.close();
    await new Promise(r => setTimeout(r, 300));
    return { ...open, closed: !d.open, focusRestored: document.activeElement === btn,
             unlocked: document.body.style.overflow === '' };
  })()`);
  check("dialog opens with the right script", dlg.open && dlg.title === "Keeladi", `open=${dlg.open} title="${dlg.title}"`);
  check("focus moves into the dialog", dlg.focusInside);
  check("body scroll locks while open", dlg.bodyLocked);
  check("<details> fallback hidden once enhanced", dlg.detailsHidden);
  check("exactly one language block visible", dlg.langBlocks === 2 && dlg.visibleLang === 1,
    `${dlg.visibleLang} of ${dlg.langBlocks}`);
  check("dialog closes and restores focus", dlg.closed && dlg.focusRestored && dlg.unlocked,
    `closed=${dlg.closed} focus=${dlg.focusRestored} unlocked=${dlg.unlocked}`);

  /* 5. bilingual toggle */
  const lang = await evalJs(`(async () => {
    const d = document.getElementById('scriptDialog');
    document.querySelector('.script-open').click();
    await new Promise(r => setTimeout(r, 250));
    const vis = () => [...d.querySelectorAll('[data-lang]')].find(b => !b.hidden);
    const before = { lang: vis().getAttribute('data-lang') };
    d.querySelector('[data-lang-btn="hi"]').click();
    await new Promise(r => setTimeout(r, 200));
    const after = { lang: vis().getAttribute('data-lang'), htmlLang: vis().getAttribute('lang'),
                    pressed: d.querySelector('[data-lang-btn="hi"]').getAttribute('aria-pressed') };
    d.close();
    return { before, after };
  })()`);
  check("language toggle switches the visible script", lang.before.lang === "en" && lang.after.lang === "hi",
    `${lang.before.lang} → ${lang.after.lang}`);
  check('Hinglish block is tagged lang="hi-Latn"', lang.after.htmlLang === "hi-Latn", lang.after.htmlLang);
  check("toggle reflects state via aria-pressed", lang.after.pressed === "true");

  /* 6. theme toggle */
  const theme = await evalJs(`(async () => {
    const b = document.getElementById('themeToggle');
    const start = getComputedStyle(document.body).backgroundColor;
    b.click(); await new Promise(r => setTimeout(r, 150));
    const one = { attr: document.documentElement.getAttribute('data-theme'),
                  bg: getComputedStyle(document.body).backgroundColor,
                  pressed: b.getAttribute('aria-pressed'), label: b.getAttribute('aria-label') };
    b.click(); await new Promise(r => setTimeout(r, 150));
    const two = { attr: document.documentElement.getAttribute('data-theme'),
                  bg: getComputedStyle(document.body).backgroundColor };
    let stored = null; try { stored = localStorage.getItem('theme'); } catch (e) {}
    return { start, one, two, stored };
  })()`);
  check("theme toggle flips to dark", theme.one.attr === "dark" && theme.one.bg !== theme.start,
    `${theme.start} → ${theme.one.bg}`);
  check("theme toggle overrides back to light", theme.two.attr === "light" && theme.two.bg === theme.start);
  check("choice persists to localStorage", theme.stored === "light", `stored=${theme.stored}`);
  check("toggle exposes state to assistive tech", theme.one.pressed === "true" && /light/i.test(theme.one.label),
    theme.one.label);

  /* 7. OS dark preference */
  await evalJs(`(() => { try { localStorage.removeItem('theme'); } catch(e){} return 1; })()`);
  await media([{ name: "prefers-color-scheme", value: "dark" }]);
  await goto(BASE);
  const sys = await evalJs(`({ bg: getComputedStyle(document.body).backgroundColor,
                               attr: document.documentElement.getAttribute('data-theme') })`);
  check("dark mode follows the OS preference", sys.bg === "rgb(20, 19, 15)" && sys.attr === null,
    `bg=${sys.bg} data-theme=${sys.attr}`);
  await media([]);

  /* 8. reduced motion */
  await media([{ name: "prefers-reduced-motion", value: "reduce" }]);
  await goto(BASE + "work.html");
  const rm = await evalJs(`(() => {
    const els = [...document.querySelectorAll('.reveal')];
    return { total: els.length, invisible: els.filter(e => parseFloat(getComputedStyle(e).opacity) < 0.9).length };
  })()`);
  check("reduced motion leaves all content visible", rm.invisible === 0,
    rm.invisible ? `${rm.invisible}/${rm.total} invisible` : `${rm.total} elements visible`);
  await media([]);

  /* 8b. main.js fails to load (404 / blocked / CDN hiccup).
         The inline head script sets .js before paint, which gates the reveal
         styles — so if main.js never runs, everything below the fold would stay
         invisible. This asserts the page degrades to fully readable instead. */
  await cdp.send("Network.enable", {}, S);
  await cdp.send("Network.setBlockedURLs", { urls: ["*main.js"] }, S);
  await goto(BASE + "work.html");
  {
    const { root } = await cdp.send("DOM.getDocument", { depth: -1 }, S);
    await cdp.send("CSS.enable", {}, S);
    const { nodeIds } = await cdp.send("DOM.querySelectorAll", { nodeId: root.nodeId, selector: ".reveal" }, S);
    let invisible = 0;
    for (const id of nodeIds) {
      const { computedStyle } = await cdp.send("CSS.getComputedStyleForNode", { nodeId: id }, S);
      const op = computedStyle.find((p) => p.name === "opacity");
      if (op && parseFloat(op.value) < 0.9) invisible++;
    }
    check("page stays readable if main.js fails to load", invisible === 0,
      invisible ? `${invisible}/${nodeIds.length} .reveal elements are invisible with no JS to reveal them` : `${nodeIds.length} elements visible`);
  }
  await cdp.send("Network.setBlockedURLs", { urls: [] }, S);

  /* 9. JavaScript disabled */
  await cdp.send("Emulation.setScriptExecutionDisabled", { value: true }, S);
  await goto(BASE + "work.html");
  const { root } = await cdp.send("DOM.getDocument", { depth: -1 }, S);
  const { outerHTML } = await cdp.send("DOM.getOuterHTML", { nodeId: root.nodeId }, S);
  check("all 4 scripts readable in DOM without JS",
    (outerHTML.match(/class="script-fallback"/g) || []).length === 4,
    `${(outerHTML.match(/class="script-fallback"/g) || []).length} fallback <details>`);
  check("no .js class applied without JS", !/<html[^>]*class="[^"]*\bjs\b/.test(outerHTML));
  check("enhancement did not run without JS", !/data-enhanced/.test(outerHTML));
  await cdp.send("Emulation.setScriptExecutionDisabled", { value: false }, S);

  /* 10. touch targets */
  await setViewport(375);
  const TARGET_JS = `(() => {
    // WCAG 2.5.5 exempts a link rendered inline within a sentence of text.
    const inlineInProse = el => {
      if (getComputedStyle(el).display !== 'inline') return false;
      const p = el.parentElement;
      return !!p && [...p.childNodes].some(n => n.nodeType === 3 && n.textContent.trim().length > 0);
    };
    return [...document.querySelectorAll('a[href], button:not([hidden]), summary')]
      .filter(el => !inlineInProse(el))
      .map(el => ({ el, r: el.getBoundingClientRect() }))
      .filter(({ el, r }) => r.width > 0 && r.height > 0 &&
              getComputedStyle(el).visibility !== 'hidden' && r.height < 44)
      .map(({ el, r }) => el.tagName.toLowerCase() + '.' + String(el.className).split(' ')[0] +
                          ' ' + Math.round(r.width) + 'x' + Math.round(r.height));
  })()`;
  {
    const bad = [];
    for (const page of PAGES) {
      await goto(BASE + page);
      const t = await evalJs(TARGET_JS);
      if (t.length) bad.push(`${page}: ${t.slice(0, 3).join(", ")}`);
    }
    check("interactive targets are at least 44px tall (all pages)", bad.length === 0,
      bad.join(" | ") || `${PAGES.length} pages`);
  }

  /* 11. runtime contrast on rendered text */
  for (const scheme of ["light", "dark"]) {
    await media([{ name: "prefers-color-scheme", value: scheme }]);
    await setViewport(1280);
    const CONTRAST_JS = `(() => {
      const lin = c => { c/=255; return c <= 0.04045 ? c/12.92 : Math.pow((c+0.055)/1.055, 2.4); };
      const lum = ([r,g,b]) => 0.2126*lin(r)+0.7152*lin(g)+0.0722*lin(b);
      // Chrome serialises color-mix() as color(srgb r g b / a) with 0-1 channels,
      // and translucent layers must be composited, not read as if opaque.
      const parse = s => {
        if (!s) return null;
        const n = (s.match(/[0-9.]+/g) || []).map(Number);
        if (n.length < 3) return null;
        const srgb = /^color\\(/.test(s);
        const rgb = n.slice(0,3).map(v => srgb ? v * 255 : v);
        const a = n.length > 3 ? n[3] : 1;
        return { rgb, a };
      };
      const over = (fg, bg) => fg.rgb.map((c,i) => c * fg.a + bg[i] * (1 - fg.a));
      const bgOf = el => {
        const layers = [];
        let n = el;
        while (n) {
          const c = parse(getComputedStyle(n).backgroundColor);
          if (c && c.a > 0) { layers.push(c); if (c.a === 1) break; }
          n = n.parentElement;
        }
        let base = [255,255,255];
        if (layers.length && layers[layers.length-1].a === 1) base = layers.pop().rgb;
        for (let i = layers.length - 1; i >= 0; i--) base = over(layers[i], base);
        return base;
      };
      const ratio = (a,b) => { const [x,y] = [lum(a),lum(b)].sort((m,n)=>n-m); return (x+0.05)/(y+0.05); };
      let worst = { r: 99 };
      for (const el of document.querySelectorAll('p,li,h1,h2,h3,h4,dd,dt,span,a,button,summary')) {
        if (![...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) continue;
        const cs = getComputedStyle(el);
        if (cs.visibility === 'hidden' || cs.display === 'none' || el.offsetParent === null) continue;
        const size = parseFloat(cs.fontSize), weight = parseInt(cs.fontWeight) || 400;
        const need = (size >= 24 || (size >= 18.66 && weight >= 700)) ? 3 : 4.5;
        const fg = parse(cs.color); if (!fg) continue;
        const r = ratio(over(fg, bgOf(el)), bgOf(el));
        if (r < need && r < worst.r)
          worst = { r, need, txt: el.textContent.trim().slice(0,40),
                    sel: el.tagName + '.' + String(el.className).split(' ')[0] };
      }
      return worst;
    })()`;
    const bad = [];
    for (const page of PAGES) {
      await goto(BASE + page);
      const worst = await evalJs(CONTRAST_JS);
      if (worst.r !== 99) bad.push(`${page}: ${worst.r.toFixed(2)}:1 (need ${worst.need}) on ${worst.sel} — "${worst.txt}"`);
    }
    check(`runtime contrast (${scheme}): all rendered text, all pages`, bad.length === 0,
      bad.join(" | ") || `${PAGES.length} pages, no violations`);
  }
  await media([]);

  /* 12. console clean */
  await goto(BASE + "work.html");
  await evalJs(`(async () => {
    document.querySelector('.script-open').click();
    await new Promise(r => setTimeout(r, 250));
    document.getElementById('scriptDialog').close();
    document.getElementById('themeToggle').click();
    document.getElementById('themeToggle').click();
    return true;
  })()`);
  await new Promise((r) => setTimeout(r, 300));
  check("no console errors or warnings", consoleErrors.length === 0, consoleErrors.slice(0, 3).join(" | "));

} catch (e) {
  fail++; failures.push("harness error: " + e.message);
  console.log("FAIL  harness error: " + e.message);
}

console.log("\n" + "-".repeat(60));
console.log(`${pass} passed, ${fail} failed, ${pass + fail} total`);
if (failures.length) { console.log("\nFailures:"); failures.forEach((f) => console.log("  - " + f)); }
cleanup();
process.exit(fail ? 1 : 0);
