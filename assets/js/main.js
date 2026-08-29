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

  /* ---------- 2. Keep the current tab in view on small screens ------------ */

  var tabStrip = document.querySelector(".tabs-scroll");
  var currentTab = document.querySelector('.tabs a[aria-current="page"]');
  if (tabStrip && currentTab && tabStrip.scrollWidth > tabStrip.clientWidth) {
    // Centre the active tab without scrolling the page itself.
    var target = currentTab.offsetLeft - (tabStrip.clientWidth - currentTab.offsetWidth) / 2;
    tabStrip.scrollLeft = Math.max(0, target);
  }

  /* ---------- 4. Reveal on scroll ------------------------------------------ */

  // We got here, so the reveal styles are safe to keep — cancel the head failsafe.
  window.clearTimeout(window.__revealFailsafe);

  var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
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
    btn.addEventListener("click", function () {
      var article = btn.closest(".email");
      if (!article) return;
      navigator.clipboard.writeText(emailToText(article)).then(function () {
        btn.setAttribute("data-copied", "true");
        btn.querySelector("span").textContent = "Copied";
        announce("Email sample copied to clipboard");
        window.clearTimeout(timer);
        timer = window.setTimeout(function () {
          btn.removeAttribute("data-copied");
          btn.querySelector("span").textContent = "Copy email";
        }, 1600);
      }).catch(function () {
        announce("Could not copy — please select the text manually");
      });
    });
  });
})();
