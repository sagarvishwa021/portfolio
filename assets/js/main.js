/* Sagar — writer portfolio.
   Progressive enhancement only: every byte of content is readable without this file. */
(function () {
  "use strict";

  var root = document.documentElement;
  var live = document.getElementById("liveRegion");

  function announce(msg) {
    if (!live) return;
    live.textContent = "";
    window.setTimeout(function () { live.textContent = msg; }, 40);
  }

  /* ---------- 1. Theme ---------------------------------------------------- */

  var themeBtn = document.getElementById("themeToggle");

  function systemPrefersDark() {
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  }

  function effectiveTheme() {
    var set = root.getAttribute("data-theme");
    if (set === "dark" || set === "light") return set;
    return systemPrefersDark() ? "dark" : "light";
  }

  function syncThemeButton() {
    if (!themeBtn) return;
    var dark = effectiveTheme() === "dark";
    themeBtn.setAttribute("aria-pressed", dark ? "true" : "false");
    themeBtn.setAttribute("aria-label", dark ? "Switch to light theme" : "Switch to dark theme");
  }

  if (themeBtn) {
    syncThemeButton();
    themeBtn.addEventListener("click", function () {
      var next = effectiveTheme() === "dark" ? "light" : "dark";
      root.setAttribute("data-theme", next);
      try { localStorage.setItem("theme", next); } catch (e) { /* private mode */ }
      syncThemeButton();
      announce(next === "dark" ? "Dark theme on" : "Light theme on");
    });

    if (window.matchMedia) {
      var mq = window.matchMedia("(prefers-color-scheme: dark)");
      var onChange = function () {
        if (!root.hasAttribute("data-theme")) syncThemeButton();
      };
      if (mq.addEventListener) mq.addEventListener("change", onChange);
      else if (mq.addListener) mq.addListener(onChange);
    }
  }

  /* ---------- 2. Tabs follow the scroll ------------------------------------ */

  var tabStrip = document.querySelector(".tabs-scroll");
  var tabNav = document.querySelector(".tabs");
  var tabLinks = Array.prototype.slice.call(document.querySelectorAll(".tabs a[data-tab]"));
  // Every section carries data-spy naming the tab that owns it, so a tab whose
  // content spans several sections still reports correctly.
  var spied = Array.prototype.slice.call(document.querySelectorAll(".section[data-spy]"));
  var sections = spied;                       // observed elements, in document order
  var keyOf = function (el) { return el.getAttribute("data-spy"); };

  function centreTab(link) {
    if (!tabStrip || !link) return;
    if (tabStrip.scrollWidth <= tabStrip.clientWidth) return;
    var target = link.offsetLeft - (tabStrip.clientWidth - link.offsetWidth) / 2;
    tabStrip.scrollTo({ left: Math.max(0, target), behavior: reducedMotion() ? "auto" : "smooth" });
  }

  function reducedMotion() {
    return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  var activeKey = null;
  function setActive(key) {
    if (key === activeKey) return;
    activeKey = key;
    tabLinks.forEach(function (a) {
      var on = a.getAttribute("data-tab") === key;
      if (on) { a.setAttribute("aria-current", "page"); centreTab(a); }
      else a.removeAttribute("aria-current");
    });
  }

  if (sections.length && "IntersectionObserver" in window) {
    // A tab lights when its section *dominates* the screen — the one with the
    // largest visible area wins. Deciding from individual observer entries is
    // wrong when several sections cross at once (a long jump, or an instant
    // scroll): whichever entry lands last would win. Recompute from geometry
    // instead; it is a handful of rects and it is exact.
    var bandSpy = null;   // fires at each crossover between adjacent sections
    var edgeSpy = null;   // fires when a section fully enters or leaves the viewport

    function buildBand() {
      if (bandSpy) bandSpy.disconnect();
      if (edgeSpy) edgeSpy.disconnect();

      // offsetHeight, not the live rect: correct whether or not the strip is
      // currently pinned, and the same number feeds the observer and the pick.
      var stripH = tabNav ? tabNav.offsetHeight : 72;

      function pick() {
        var viewH = window.innerHeight;
        var band = Math.max(1, viewH - stripH);   // the part of the screen actually readable
        var best = null, bestArea = 0;

        for (var i = 0; i < sections.length; i++) {
          var r = sections[i].getBoundingClientRect();
          var visible = Math.min(r.bottom, viewH) - Math.max(r.top, stripH);
          if (visible > bestArea) { bestArea = visible; best = keyOf(sections[i]); }
        }

        // Hysteresis: a section has to genuinely take the screen before it lights,
        // but keeps the tab until it has nearly gone. Without the upper bound the
        // first section peeking above the fold would light a tab on page load;
        // without the lower one the last tab would drop out over a tall footer.
        var share = bestArea / band;
        if (activeKey === null) {
          if (share >= 0.35) setActive(best);
        } else {
          setActive(share >= 0.10 ? best : null);
        }
      }

      // Two triggers, one decision. Adjacent sections swap places exactly when
      // their shared edge passes the middle of the readable band, so a thin band
      // there catches every crossover. It never fires when the last section
      // scrolls off the top, though — that is what edgeSpy is for.
      var mid = Math.round(stripH + (window.innerHeight - stripH) / 2);
      var below = Math.max(0, window.innerHeight - mid - 2);
      bandSpy = new IntersectionObserver(pick, {
        rootMargin: "-" + mid + "px 0px -" + below + "px 0px",
        threshold: 0,
      });
      edgeSpy = new IntersectionObserver(pick, { threshold: 0 });

      sections.forEach(function (sec) { bandSpy.observe(sec); edgeSpy.observe(sec); });
      pick();
    }

    buildBand();

    var resizeTimer;
    window.addEventListener("resize", function () {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(buildBand, 200);
    }, { passive: true });
  }

  // Anchor clicks should land below the sticky strip and move focus for AT.
  // Wait for the scroll to settle rather than guessing a duration; "scrollend"
  // where supported, otherwise a short idle watcher.
  function afterScroll(fn) {
    if ("onscrollend" in window) {
      var once = function () { window.removeEventListener("scrollend", once); fn(); };
      window.addEventListener("scrollend", once);
      window.setTimeout(function () {
        window.removeEventListener("scrollend", once);
      }, 1500);
      return;
    }
    var last = -1, still = 0;
    var tick = function () {
      if (window.scrollY === last) { if (++still > 3) return fn(); }
      else { still = 0; last = window.scrollY; }
      window.requestAnimationFrame(tick);
    };
    window.requestAnimationFrame(tick);
  }

  tabLinks.forEach(function (a) {
    a.addEventListener("click", function () {
      var target = document.getElementById(a.getAttribute("href").slice(1));
      if (!target) return;
      afterScroll(function () {
        target.setAttribute("tabindex", "-1");
        target.focus({ preventScroll: true });
        // drop the temporary attribute again so the section is not a tab stop
        target.addEventListener("blur", function once() {
          target.removeAttribute("tabindex");
          target.removeEventListener("blur", once);
        });
      });
    });
  });

  /* ---------- 4. Reveal on scroll ------------------------------------------ */

  // We got here, so the reveal styles are safe to keep — cancel the head failsafe.
  window.clearTimeout(window.__revealFailsafe);

  var reduced = reducedMotion();
  var reveals = Array.prototype.slice.call(document.querySelectorAll(".reveal"));

  if (reduced || !("IntersectionObserver" in window)) {
    reveals.forEach(function (el) { el.classList.add("is-in"); });
  } else {
    var revealer = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-in");
        obs.unobserve(entry.target);
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.05 });

    reveals.forEach(function (el) { revealer.observe(el); });
  }

  /* ---------- 5. Script dialog + language switch ---------------------------- */

  var dialog = document.getElementById("scriptDialog");
  var dialogScroll = document.getElementById("dialogScroll");
  var dialogTitle = document.getElementById("dialogTitle");
  var dialogTag = document.getElementById("dialogTag");
  var dialogClose = document.getElementById("dialogClose");
  var langBtns = Array.prototype.slice.call(document.querySelectorAll("[data-lang-btn]"));
  var lastFocused = null;
  var currentLang = "en";

  try {
    var storedLang = sessionStorage.getItem("scriptLang");
    if (storedLang === "en" || storedLang === "hi") currentLang = storedLang;
  } catch (e) { /* private mode */ }

  function applyLang(lang) {
    currentLang = lang;
    langBtns.forEach(function (b) {
      b.setAttribute("aria-pressed", b.getAttribute("data-lang-btn") === lang ? "true" : "false");
    });
    if (!dialogScroll) return;
    Array.prototype.slice.call(dialogScroll.querySelectorAll("[data-lang]")).forEach(function (block) {
      block.hidden = block.getAttribute("data-lang") !== lang;
    });
  }

  var dialogSupported = dialog && typeof dialog.showModal === "function";

  if (dialogSupported) {
    // Only now is the modal path real — swap disclosure for button.
    Array.prototype.slice.call(document.querySelectorAll(".script-open")).forEach(function (btn) {
      btn.hidden = false;
      var details = document.getElementById(btn.getAttribute("data-script"));
      if (details) details.setAttribute("data-enhanced", "true");

      btn.addEventListener("click", function () {
        if (!details) return;
        var body = details.querySelector(".script-body");
        if (!body) return;

        lastFocused = btn;
        dialogTitle.textContent = details.getAttribute("data-title") || "";
        dialogTag.textContent = details.getAttribute("data-tag") || "";
        dialogScroll.textContent = "";
        dialogScroll.appendChild(body.cloneNode(true));
        applyLang(currentLang);
        dialogScroll.scrollTop = 0;

        dialog.showModal();
        document.body.style.overflow = "hidden";
        dialogTitle.focus();
      });
    });

    langBtns.forEach(function (b) {
      b.addEventListener("click", function () {
        var lang = b.getAttribute("data-lang-btn");
        applyLang(lang);
        try { sessionStorage.setItem("scriptLang", lang); } catch (e) {}
        announce(lang === "en" ? "Showing English translation" : "Showing original Hinglish script");
      });
    });

    if (dialogClose) {
      dialogClose.addEventListener("click", function () { dialog.close(); });
    }

    // Backdrop click — the dialog element itself only receives the click
    // when the pointer lands outside its content box.
    dialog.addEventListener("click", function (e) {
      if (e.target === dialog) dialog.close();
    });

    dialog.addEventListener("close", function () {
      document.body.style.overflow = "";
      dialogScroll.textContent = "";
      if (lastFocused && document.contains(lastFocused)) lastFocused.focus();
      lastFocused = null;
    });
  }

  /* ---------- 6. Copy email sample ------------------------------------------ */

  function emailToText(article) {
    var lines = [];
    var subject = article.querySelector(".email-meta dd");
    var preview = article.querySelector(".email-meta dd.preview");
    if (subject) lines.push("Subject: " + subject.textContent.trim());
    if (preview) lines.push("Preview: " + preview.textContent.trim());
    lines.push("");

    var body = article.querySelector("[data-copy-source]");
    if (body) {
      Array.prototype.slice.call(body.children).forEach(function (node) {
        if (node.classList.contains("email-sign")) {
          Array.prototype.slice.call(node.querySelectorAll("span")).forEach(function (s) {
            lines.push(s.textContent.trim());
          });
        } else {
          lines.push(node.textContent.trim());
          lines.push("");
        }
      });
    }
    return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  }

  Array.prototype.slice.call(document.querySelectorAll(".copy-btn")).forEach(function (btn) {
    if (!navigator.clipboard || !navigator.clipboard.writeText) {
      btn.hidden = true;
      return;
    }
    var timer;
    var label = btn.querySelector("span");
    if (!label) return;
    btn.addEventListener("click", function () {
      var article = btn.closest(".email");
      if (!article) return;
      navigator.clipboard.writeText(emailToText(article)).then(function () {
        btn.setAttribute("data-copied", "true");
        label.textContent = "Copied";
        announce("Email sample copied to clipboard");
        window.clearTimeout(timer);
        timer = window.setTimeout(function () {
          btn.removeAttribute("data-copied");
          label.textContent = "Copy email";
        }, 1600);
      }).catch(function () {
        announce("Could not copy — please select the text manually");
      });
    });
  });
})();
