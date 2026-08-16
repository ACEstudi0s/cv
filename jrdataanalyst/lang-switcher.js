/**
 * Language Switcher — Globe icon + dropdown for EN/ES
 * Mirrors the myst:theme localStorage pattern (myst:lang)
 *
 * Dependencies: none (vanilla JS, ES5-safe)
 * Graceful degradation: no JS = no button, site fully readable in English
 */
(function () {
  "use strict";

  /* ------------------------------------------------------------------ */
  /*  Constants                                                         */
  /* ------------------------------------------------------------------ */

  var LANG_KEY = "myst:lang";

/** Deployment sub-path prefix (site served under /cv/jrdataanalyst/*). */
var BASE = "/cv/jrdataanalyst";

/** Strip the deployment sub-path off a path/href (root becomes "/"). */
function stripBase(p) {
  if (!p) return p;
  var s = String(p);
  if (s === BASE) return "/";
  if (s.indexOf(BASE + "/") === 0) return s.slice(BASE.length);
  return s;
}

/** Prefix a root-relative destination with the deployment sub-path. */
function addBase(p) {
  if (!p) return p;
  var s = String(p);
  if (s === BASE || s.indexOf(BASE + "/") === 0) return s;
  if (s.charAt(0) !== "/") s = "/" + s;
  return BASE + s;
}

  // SVG — Lucide "languages" icon (exact markup from spec)
  var SVG_LANG =
    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-languages-icon lucide-languages"><path d="m5 8 6 6"/><path d="m4 14 6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="m22 22-5-10-5 10"/><path d="M14 18h6"/></svg>';

  // Check SVG for the active item
  var SVG_CHECK =
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="myst-lang-check"><path d="M20 6 9 17l-5-5"/></svg>';

  // Label map keyed by current page language
  //  - en/es: dropdown item labels
  //  - btnLabel: accessible name of the trigger button (aria-label/title/sr-only)
  var LABELS = {
    en: { en: "English", es: "Spanish", btnLabel: "Change language" },
    es: { en: "Inglés", es: "Español", btnLabel: "Cambiar idioma" }
  };

  /* ------------------------------------------------------------------ */
  /*  Helpers                                                           */
  /* ------------------------------------------------------------------ */

  function getSavedLang() {
    try {
      var v = localStorage.getItem(LANG_KEY);
      if (v === "en" || v === "es") return v;
    } catch (_) {}
    return null;
  }

  function saveLang(lang) {
    try {
      localStorage.setItem(LANG_KEY, lang);
    } catch (_) {}
  }

  /** Normalise a pathname: strip trailing slash except for root */
  function normalisePath(p) {
    if (!p || p === "/") return "/";
    return p.replace(/\/+$/, "") + "/";
  }

  /** Determine if a path is under the /es/ tree */
  function isSpanishPath(p) {
    return normalisePath(p).indexOf("/es/") === 0;
  }

  /** Return the path portion (without hash/search) */
  function getPathname() {
    return stripBase(window.location.pathname);
  }

  /** Normalise an href/path for comparison ("/" stays "/"). */
  function comparable(p) {
    if (!p) return "";
    var s = String(p);
    if (s.charAt(0) !== "/") s = "/" + s;
    if (s.length > 1 && s.charAt(s.length - 1) === "/") s = s.slice(0, -1);
    return s;
  }

  /** True when the passed href points into the Spanish tree. */
  function isEsHref(href) {
    if (!href) return false;
    var np = normalisePath(stripBase(href));
    return np === "/es/" || np.indexOf("/es/") === 0;
  }

  /** True when the passed href points at an English route. */
  function isEnHref(href) {
    if (!href) return false;
    var np = normalisePath(stripBase(href));
    return np === "/" || np.indexOf("/pages/") === 0;
  }

  /** Determine the active language based on current path */
  function langFromPath() {
    return isSpanishPath(getPathname()) ? "es" : "en";
  }

  /* ------------------------------------------------------------------ */
  /*  Route lists (single source of truth, read from the DOM)           */
  /* ------------------------------------------------------------------ */

  /**
   * Collect the two language route lists exactly as the theme renders them:
   *  - EN: flat <a> anchors that are direct children of .myst-toc
   *  - ES: <a> anchors inside the open .collapsible-content of the group
   *    folder container (div[data-state] direct child of .myst-toc)
   * Both lists stay in sidebar order. Used by the language switcher to
   * compute twin URLs and by the footer extremes rule to decide which
   * prev/next card to show.
   */
  function tocRouteLists() {
    var en = [], es = [], folder = null, i;
    var toc = document.querySelector(".myst-toc");
    if (toc && toc.children) {
      for (i = 0; i < toc.children.length; i++) {
        var c = toc.children[i];
        if (c.nodeType !== 1) continue;
        if (c.tagName === "A") {
          var h = stripBase(c.getAttribute("href"));
          if (h === "/" || h.indexOf("/pages/") === 0) en.push(c);
        } else if (
          c.tagName === "DIV" &&
          c.getAttribute &&
          c.getAttribute("data-state") !== null
        ) {
          folder = c;
        }
      }
      if (folder) {
        var col = folder.querySelector(".collapsible-content");
        var links = col ? col.getElementsByTagName("a") : [];
        for (i = 0; i < links.length; i++) {
          var lh = stripBase(links[i].getAttribute("href"));
          if (lh && (lh === "/es" || lh.indexOf("/es/") === 0)) es.push(links[i]);
        }
      }
    }
    return { en: en, es: es };
  }

  /**
   * Structural twin-path transformation for the project's i18n layout
   * (English file tree <-> Spanish es/ tree):
   *   "/"                 <-> "/es"
   *   "/pages/<slug>"     <-> "/es/<slug>"
   * Used whenever the target language's anchor list is not present in the
   * DOM — the theme only renders the folder's children when that group is
   * OPEN (Spanish pages), so on English pages the ES list is empty and the
   * structural mapping is the fallback. The slicing keeps the leading "/"
   * so the joined path never collapses ("/es" + "/contact", not "/escontact").
   */
  function twinPath(clean, targetLang) {
    if (targetLang === "es") {
      if (clean === "/") return "/es";
      if (clean.indexOf("/pages/") === 0) {
        var slug = clean.slice(6); // remove "/pages/"
        if (slug === "certifications/") return "/es/certificaciones/";
        if (slug === "education/") return "/es/education/";
        if (slug === "skills/") return "/es/skills/";
        if (slug === "contact/") return "/es/contact/";
        return "/es" + slug; // fallback
      }
      return "/es";
    }
    if (clean === "/es") return "/";
    if (clean.indexOf("/es/") === 0) {
      var slug = clean.slice(4); // remove "/es/"
      if (slug === "certificaciones/") return "/pages/certifications/";
      if (slug === "education/") return "/pages/education/";
      if (slug === "skills/") return "/pages/skills/";
      if (slug === "contact/") return "/pages/contact/";
      return "/pages" + slug; // fallback
    }
    return "/";
  }

  /**
   * Given a current path and a target language, return the destination URL.
   * The twin route is resolved by ORDER (Nth anchor of the current language
   * maps to the Nth anchor of the target language); when the target list is
   * absent from the DOM, the structural twin-path transformation is used.
   * The trailing-slash convention of the current page is preserved.
   */
  function computeDestination(currentPath, targetLang) {
    var hasTrailingSlash =
      currentPath.length > 1 && currentPath.charAt(currentPath.length - 1) === "/";
    var clean = comparable(currentPath);
    var lists = tocRouteLists();
    var curList = isSpanishPath(currentPath) ? lists.es : lists.en;
    var tgtList = targetLang === "es" ? lists.es : lists.en;

    function preserveTrailing(dest) {
      if (!hasTrailingSlash && dest !== "/") return dest.replace(/\/+$/, "") || "/";
      return dest;
    }

    var dest = null;
    var i;
    for (i = 0; i < curList.length; i++) {
      if (comparable(stripBase(curList[i].getAttribute("href"))) === clean) {
        var twin = i < tgtList.length ? tgtList[i] : null;
        if (twin && twin.getAttribute("href")) {
          dest = comparable(stripBase(twin.getAttribute("href")));
        }
        break;
      }
    }
    if (!dest) dest = twinPath(clean, targetLang);
    return addBase(preserveTrailing(dest));
  }

  /* ------------------------------------------------------------------ */
  /*  Footer edges                                                      */
  /* ------------------------------------------------------------------ */

  function hideEl(el) {
    el.style.setProperty("display", "none", "important");
  }

  function showEl(el) {
    el.style.removeProperty("display");
  }

  /**
   * Footer extremes rule (display only — no href/label rewriting):
   * the "first" and "last" page are derived from the *visible* anchors of
   * the current language (EN: direct children of .myst-toc; ES: anchors
   * inside the open .collapsible-content).
   *  - FIRST page  -> hide .myst-footer-link-prev, show next
   *  - LAST page   -> hide .myst-footer-link-next, show prev
   *  - middle page -> show both
   * The theme's wrap-around footer cards jump to the OTHER language exactly
   * at those two extremes (EN contact -> /es, ES home <- /pages/contact),
   * so every cross-language wrap card is hidden and every SHOWN card keeps
   * an in-language href. A belt-and-braces guard additionally hides any
   * would-be-shown card that still points out of the current language.
   */
  function normalizeFooter() {
    var prev = document.querySelector(".myst-footer-link-prev");
    var next = document.querySelector(".myst-footer-link-next");
    if (!prev && !next) return;

    var lists = tocRouteLists();
    var cur = getPathname();
    var list = isSpanishPath(cur) ? lists.es : lists.en;
    if (!list.length) return;

    var clean = comparable(cur);
    var first = comparable(stripBase(list[0].getAttribute("href")));
    var last = comparable(stripBase(list[list.length - 1].getAttribute("href")));

    if (clean === first) {
      if (prev) hideEl(prev);
      if (next) showEl(next);
    } else if (clean === last) {
      if (next) hideEl(next);
      if (prev) showEl(prev);
    } else {
      if (prev) showEl(prev);
      if (next) showEl(next);
    }

    // Safety guard: never show a card that leaves the current language.
    var inLang = isSpanishPath(cur) ? isEsHref : isEnHref;
    if (prev && getComputedStyle(prev).display !== "none" && !inLang(prev.getAttribute("href"))) {
      hideEl(prev);
    }
    if (next && getComputedStyle(next).display !== "none" && !inLang(next.getAttribute("href"))) {
      hideEl(next);
    }
  }

  /* ------------------------------------------------------------------ */
  /*  CV PDF swap                                                       */
  /* ------------------------------------------------------------------ */

  function swapPdfLinks(lang) {
    var anchors = document.querySelectorAll('a[href]');
    for (var i = 0; i < anchors.length; i++) {
      var href = anchors[i].getAttribute("href");
      if (!href) continue;
      // Match /cv.pdf or /cv-es.pdf (root-absolute) — idempotent
      if (lang === "es") {
        // Only rewrite /cv.pdf → /cv-es.pdf; never touch /cv-es.pdf
        if (href.indexOf("/cv.pdf") !== -1 && href.indexOf("/cv-es.pdf") === -1) {
          anchors[i].setAttribute("href", href.replace("/cv.pdf", "/cv-es.pdf"));
        }
      } else {
        // Only rewrite /cv-es.pdf → /cv.pdf; never touch /cv.pdf
        if (href.indexOf("/cv-es.pdf") !== -1) {
          anchors[i].setAttribute("href", href.replace("/cv-es.pdf", "/cv.pdf"));
        }
      }
    }
  }

  /* ------------------------------------------------------------------ */
  /*  UI — Button & dropdown                                            */
  /* ------------------------------------------------------------------ */

  function createButton(activeLang) {
    var btn = document.createElement("button");
    btn.className = "myst-lang-button shrink-0 rounded-full border border-stone-700 dark:border-white hover:bg-neutral-100 border-solid overflow-hidden text-stone-700 dark:text-white hover:text-stone-500 dark:hover:text-neutral-800 w-8 h-8 ml-3 flex items-center justify-center";
    btn.setAttribute("type", "button");
    btn.setAttribute("aria-haspopup", "menu");
    btn.setAttribute("aria-expanded", "false");
    btn.setAttribute("aria-label", LABELS[activeLang].btnLabel);
    btn.setAttribute("title", LABELS[activeLang].btnLabel);

    // Visually-hidden label
    var srOnly = document.createElement("span");
    srOnly.className = "sr-only";
    srOnly.textContent = LABELS[activeLang].btnLabel;

    // Icon container — the SVG with class myst-lang-icon
    var iconWrap = document.createElement("span");
    iconWrap.className = "myst-lang-icon flex items-center justify-center h-full w-full";
    iconWrap.setAttribute("aria-hidden", "true");
    iconWrap.innerHTML = SVG_LANG;

    btn.appendChild(srOnly);
    btn.appendChild(iconWrap);

    return btn;
  }

  function createDropdown(activeLang) {
    var dropdown = document.createElement("div");
    dropdown.className = "myst-lang-dropdown";
    dropdown.setAttribute("role", "menu");

    // "English" item
    var enItem = document.createElement("button");
    enItem.className = "myst-lang-item" + (activeLang === "en" ? " myst-lang-item--active" : "");
    enItem.setAttribute("role", "menuitem");
    enItem.setAttribute("data-lang", "en");
    if (activeLang === "en") {
      enItem.setAttribute("aria-current", "page");
    }
    enItem.innerHTML = SVG_CHECK + LABELS[activeLang].en;
    dropdown.appendChild(enItem);

    // "Spanish" item
    var esItem = document.createElement("button");
    esItem.className = "myst-lang-item" + (activeLang === "es" ? " myst-lang-item--active" : "");
    esItem.setAttribute("role", "menuitem");
    esItem.setAttribute("data-lang", "es");
    if (activeLang === "es") {
      esItem.setAttribute("aria-current", "page");
    }
    esItem.innerHTML = SVG_CHECK + LABELS[activeLang].es;
    dropdown.appendChild(esItem);

    return dropdown;
  }

  /* ------------------------------------------------------------------ */
  /*  Fallback stylesheet (build-portability safety net)                */
  /* ------------------------------------------------------------------ */

  /**
   * Detect whether any loaded stylesheet already defines the switcher's
   * .myst-lang-* rules.
   *
   * These rules normally travel inside custom.css, which myst inlines into
   * /myst-theme.css during the build. When custom.css is missing from the
   * build directory, myst emits a "No Custom Stylesheet Provided" stub
   * instead, and the injected div.myst-lang-dropdown renders unstyled as a
   * plain block inline in the navbar (the "language option buttons loose in
   * the top bar" regression on the current static build).
   *
   * @returns {boolean} true if at least one rule targets .myst-lang-dropdown.
   */
  function stylesHaveLangSwitcher() {
    var sheets = document.styleSheets;
    var i, j, rules, sel;
    for (i = 0; i < sheets.length; i++) {
      try {
        rules = sheets[i].cssRules;
      } catch (e) {
        continue; // cross-origin sheet (CDN) — cannot read rules, skip
      }
      if (!rules) continue;
      for (j = 0; j < rules.length; j++) {
        sel = rules[j].selectorText;
        if (sel && sel.indexOf(".myst-lang-dropdown") !== -1) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Injectable copy of the switcher styles (the custom.css "Language
   * Switcher" section, incl. dark variants). Only applied when the loaded
   * page ships without the custom stylesheet.
   */
  var FALLBACK_LANG_CSS =
    ".myst-lang-button{cursor:pointer;transition:background-color .15s ease,color .15s ease}" +
    ".myst-lang-icon{line-height:0}" +
    ".myst-lang-icon svg{width:1.25rem;height:1.25rem}" +
    ".myst-lang-dropdown{position:absolute;right:0;top:calc(100% + 6px);z-index:40;min-width:10rem;max-width:calc(100vw - 1.5rem);border-radius:.5rem;padding:.25rem 0;opacity:0;visibility:hidden;transform:translateY(-4px) scale(.97);transform-origin:top right;transition:opacity .15s ease,transform .15s ease,visibility .15s ease;background-color:#ffffff;border:1px solid #e5e7eb;box-shadow:0 4px 6px -1px rgba(0,0,0,.1),0 2px 4px -2px rgba(0,0,0,.1)}" +
    ".dark .myst-lang-dropdown{background-color:#1c1917;border-color:#292524}" +
    ".myst-lang-dropdown--open{opacity:1;visibility:visible;transform:translateY(0) scale(1)}" +
    ".myst-lang-item{display:flex;align-items:center;gap:.5rem;width:100%;padding:.5rem .875rem;font-size:.875rem;line-height:1.25rem;text-align:left;background:none;border:none;cursor:pointer;white-space:nowrap;transition:background-color .12s ease;color:#1c1917}" +
    ".myst-lang-item:hover{background-color:#f5f5f5}" +
    ".dark .myst-lang-item{color:#e7e5e4}" +
    ".dark .myst-lang-item:hover{background-color:#292524}" +
    ".myst-lang-check{display:none;flex-shrink:0;width:1rem;height:1rem}" +
    ".myst-lang-item--active{font-weight:600}" +
    ".myst-lang-item--active .myst-lang-check{display:inline-block}" +
    ".myst-lang-item:focus-visible{outline:2px solid #3b82f6;outline-offset:-2px;border-radius:.375rem}";

  /**
   * Inject FALLBACK_LANG_CSS once, but only when the theme does not already
   * provide the .myst-lang-* rules. Called before the button/dropdown nodes
   * are created, so the styles are in place the moment the dropdown renders.
   */
  function ensureLangSwitcherStyles() {
    if (document.getElementById("myst-lang-fallback-css")) {
      return;
    }
    if (stylesHaveLangSwitcher()) {
      return;
    }
    var style = document.createElement("style");
    style.id = "myst-lang-fallback-css";
    style.textContent = FALLBACK_LANG_CSS;
    var head = document.head || document.getElementsByTagName("head")[0];
    (head || document.documentElement).appendChild(style);
  }

  /* ------------------------------------------------------------------ */
  /*  Close logic                                                       */
  /* ------------------------------------------------------------------ */

  var _isOpen = false;
  var _dropdown = null;
  var _btn = null;

  function closeDropdown() {
    if (!_isOpen) return;
    _isOpen = false;
    if (_dropdown) {
      _dropdown.classList.remove("myst-lang-dropdown--open");
    }
    if (_btn) {
      _btn.setAttribute("aria-expanded", "false");
    }
    document.removeEventListener("mousedown", onOutsideClick, false);
    document.removeEventListener("keydown", onEscKey, false);
  }

  function openDropdown() {
    if (_isOpen) { closeDropdown(); return; }
    _isOpen = true;
    if (_dropdown) {
      _dropdown.classList.add("myst-lang-dropdown--open");
    }
    if (_btn) {
      _btn.setAttribute("aria-expanded", "true");
    }
    document.addEventListener("mousedown", onOutsideClick, false);
    document.addEventListener("keydown", onEscKey, false);
  }

  function onOutsideClick(e) {
    if (_btn && _dropdown) {
      if (!_btn.contains(e.target) && !_dropdown.contains(e.target)) {
        closeDropdown();
      }
    }
  }

  function onEscKey(e) {
    if (e.key === "Escape" || e.keyCode === 27) {
      closeDropdown();
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Init                                                              */
  /* ------------------------------------------------------------------ */

  function injectButton() {
    // --- Ensure the .myst-lang-* styles exist before creating the UI ---
    ensureLangSwitcherStyles();

    // --- Set <html lang> ---
    var currentLang = langFromPath();
    document.documentElement.lang = currentLang === "es" ? "es" : "en";

    // --- CV PDF swap ---
    swapPdfLinks(currentLang);

    // --- Footer extremes (sidebar left entirely to html[lang] CSS) ---
    try { normalizeFooter(); } catch (_) {}

    // --- Inject button ---
    var themeBtn = document.querySelector(".myst-theme-button");
    // The right-side nav container holds the search + theme toggle. Appending
    // our button at its END (after the theme toggle) is where the RSS action
    // button used to live, and is the safest spot for React post-hydration.
    var navBar = (themeBtn ? themeBtn.parentElement : null) || document.querySelector("nav");

    if (!navBar) return; // nowhere to put it

    var activeLang = currentLang;
    _btn = createButton(activeLang);
    _dropdown = createDropdown(activeLang);

    // Append button at the end of the right-side container
    navBar.appendChild(_btn);

    // The dropdown sits as a sibling to btn, wrapped in a relative container
    // We need the btn's parent to be relative for absolute positioning
    var wrapper = _btn.parentNode;
    if (wrapper) {
      wrapper.style.position = "relative";
    }
    // Insert dropdown right after button
    navBar.appendChild(_dropdown);

    // --- Event listeners ---

    // Toggle dropdown
    _btn.addEventListener("click", function (e) {
      e.stopPropagation();
      if (_isOpen) {
        closeDropdown();
      } else {
        openDropdown();
      }
    });

    // Handle item clicks
    _dropdown.addEventListener("click", function (e) {
      var item = e.target.closest ? e.target.closest(".myst-lang-item") : null;
      // Fallback for older browsers
      if (!item) {
        var el = e.target;
        while (el && el !== _dropdown) {
          if (el.classList && el.classList.contains("myst-lang-item")) {
            item = el;
            break;
          }
          el = el.parentElement;
        }
      }
      if (!item) return;

      var chosenLang = item.getAttribute("data-lang");
      if (!chosenLang) return;

      closeDropdown();

      // If already on this language, do nothing
      if (chosenLang === langFromPath()) return;

      // Save preference
      saveLang(chosenLang);

      // Compute and navigate (twin route resolved from the sidebar order)
      var dest = computeDestination(getPathname(), chosenLang);
      window.location.href = dest;
    });

    // Keyboard nav in dropdown
    _dropdown.addEventListener("keydown", function (e) {
      if (e.key === "Escape" || e.keyCode === 27) {
        closeDropdown();
        _btn.focus();
      }
    });
  }

  /* ------------------------------------------------------------------ */
  /*  Boot                                                              */
  /* ------------------------------------------------------------------ */

  /**
   * React (via Remix) hydrates ASYNCHRONOUSLY — the theme's own entry point
   * calls `window.requestIdleCallback(() => hydrateRoot(document, ...))`, so
   * a quiet-DOM heuristic can fire while hydration is still pending. Mutating
   * the DOM before React mounts makes React throw hydration-mismatch errors
   * (Minified React #418/#423), which Remix's error boundary occasionally
   * surfaces as the "Unexpected Error Occurred" page on slow/queued loads.
   *
   * Root-cause fix: wait for a deterministic "React committed" signal —
   * React attaches `__reactFiber$*` properties to the DOM nodes it renders
   * (confirmed: these appear on `.myst-toc` once hydration finishes). Only
   * then do we mutate the DOM. A long timeout keeps graceful degradation in
   * case the app never hydrates. After injecting, the button's survival is
   * re-verified once a second; if a late client-side rebuild wipes it, we
   * simply re-inject (idempotent).
   */

  function reactHydrated() {
    var toc = document.querySelector(".myst-toc");
    if (!toc) return false;
    var k;
    for (k in toc) {
      if (k.indexOf("__reactFiber") === 0) return true;
    }
    return false;
  }

  function waitForHydration(cb) {
    var maxWait = 12000;
    var started = Date.now();
    var injectedAt = 0;
    var done = false;
    var timer = null;

    function tryInject() {
      if (done) return;
      var now = Date.now();
      var timedOut = now - started > maxWait;
      var ready =
        document.querySelector(".myst-theme-button") &&
        (reactHydrated() || timedOut);

      // After injecting, confirm the button survived a full second. React's
      // code-split hydration may commit late and wipe our node.
      if (injectedAt && now - injectedAt > 1000) {
        if (document.querySelector(".myst-lang-button")) {
          done = true;
          if (timer) clearInterval(timer);
          try { cb(); } catch (_) {}
        } else {
          // Wiped by a late hydration rebuild — re-inject once hydration
          // is (or was) settled.
          injectedAt = 0;
        }
        return;
      }

      if (!injectedAt && (ready || timedOut)) {
        try { cb(); } catch (_) {}
        injectedAt = Date.now();
      }
    }

    timer = setInterval(tryInject, 100);
    tryInject();
  }

  function ensureButton() {
    // Idempotent: if the button is already present, do nothing.
    if (document.querySelector(".myst-lang-button")) return;
    try { injectButton(); } catch (_) {}
  }

  var _routeWatchStarted = false;

  // Debounce key: only run normalizeFooter when we're confident the new
  // route's footer is actually in the DOM. We track the last path we
  // successfully normalized against, and only re-normalize when the
  // footer's hrefs have been updated to match the current URL (or after
  // a short grace period for the React swap to complete).
  var _lastNormalizedPath = "";
  var _footerObserver = null;
  var _pendingNormalize = false;

  function normalizeFooterNow() {
    var cur = getPathname();
    var clean = comparable(cur);

    // Read sidebar lists fresh every time (never cache page identity).
    var lists = tocRouteLists();
    var list = isSpanishPath(cur) ? lists.es : lists.en;
    if (!list.length) return;

    var first = comparable(stripBase(list[0].getAttribute("href")));
    var last = comparable(stripBase(list[list.length - 1].getAttribute("href")));

    var prev = document.querySelector(".myst-footer-link-prev");
    var next = document.querySelector(".myst-footer-link-next");
    if (!prev && !next) return;

    var isFirst = clean === first;
    var isLast = clean === last;

    if (isFirst) {
      if (prev) hideEl(prev);
      if (next) showEl(next);
    } else if (isLast) {
      if (next) hideEl(next);
      if (prev) showEl(prev);
    } else {
      if (prev) showEl(prev);
      if (next) showEl(next);
    }

    // Safety guard: never show a card that leaves the current language.
    var inLang = isSpanishPath(cur) ? isEsHref : isEnHref;
    if (prev && getComputedStyle(prev).display !== "none" && !inLang(prev.getAttribute("href"))) {
      hideEl(prev);
    }
    if (next && getComputedStyle(next).display !== "none" && !inLang(next.getAttribute("href"))) {
      hideEl(next);
    }

    _lastNormalizedPath = clean;
    _pendingNormalize = false;
  }

  function scheduleNormalizeFooter() {
    if (_pendingNormalize) return;
    _pendingNormalize = true;
    // Use requestAnimationFrame + microtask to run after React's commit
    // phase, then a short setTimeout as fallback if the footer swap
    // is delayed by code-split chunk loading.
    if (window.requestAnimationFrame) {
      window.requestAnimationFrame(function () {
        setTimeout(normalizeFooterNow, 50);
      });
    } else {
      setTimeout(normalizeFooterNow, 80);
    }
  }

  function applyOnce() {
    var currentLang = langFromPath();
    document.documentElement.lang = currentLang === "es" ? "es" : "en";
    try { swapPdfLinks(currentLang); } catch (_) {}
    ensureButton();
    // Initial normalize: sidebar is already rendered at this point.
    try { normalizeFooterNow(); } catch (_) {}

    // Re-apply lang + PDF swap on client-side route changes (URL changes
    // without a full reload). The button itself persists in the root layout.
    if (_routeWatchStarted) return;
    _routeWatchStarted = true;
    var lastPath = getPathname();

    // Observe the footer container for React re-renders so we can
    // re-normalize exactly when the new footer cards are mounted.
    var footerContainer = document.querySelector("footer") || document.body;
    if (window.MutationObserver && footerContainer) {
      _footerObserver = new MutationObserver(function (mutations) {
        // Only react if the footer link elements themselves changed
        var relevant = false;
        for (var i = 0; i < mutations.length; i++) {
          var m = mutations[i];
          if (m.type === "childList") {
            // Check if added/removed nodes include our footer links
            var nodes = m.addedNodes;
            for (var j = 0; j < nodes.length; j++) {
              var n = nodes[j];
              if (n.nodeType === 1 && (n.matches && (n.matches(".myst-footer-link-prev, .myst-footer-link-next") ||
                  n.querySelector && n.querySelector(".myst-footer-link-prev, .myst-footer-link-next")))) {
                relevant = true; break;
              }
            }
          }
          if (m.type === "attributes" && m.target &&
              (m.target.classList.contains("myst-footer-link-prev") ||
               m.target.classList.contains("myst-footer-link-next"))) {
            relevant = true; break;
          }
        }
        if (relevant) scheduleNormalizeFooter();
      });
      _footerObserver.observe(footerContainer, { childList: true, subtree: true, attributes: true, attributeFilter: ["href", "style", "class"] });
    }

    // Fallback: pathname polling + scheduled normalize (covers cases where
    // the footer swap doesn't trigger our observer or happens before it attaches).
    setInterval(function () {
      var p = getPathname();
      if (p !== lastPath) {
        lastPath = p;
        var lang = langFromPath();
        document.documentElement.lang = lang === "es" ? "es" : "en";
        try { swapPdfLinks(lang); } catch (_) {}
        // Schedule a footer re-normalize after the route change.
        scheduleNormalizeFooter();
      } else if (!_pendingNormalize && comparable(p) !== _lastNormalizedPath) {
        // Path same but footer hasn't been normalized for this path yet
        // (e.g., late React swap). Schedule it.
        scheduleNormalizeFooter();
      }
    }, 400);
  }

  function boot() {
    // Resolve the saved-language redirect only after hydration so the
    // sidebar (and its two language lists) is fully rendered — the twin
    // route is derived from the sidebar order, which React populates
    // asynchronously.
    waitForHydration(function () {
      var savedLang = getSavedLang();
      var currentLang = langFromPath();
      if (savedLang === "es" && currentLang === "en") {
        window.location.replace(computeDestination(getPathname(), "es"));
        return; // redirect in progress
      }
      if (savedLang === "en" && currentLang === "es") {
        window.location.replace(computeDestination(getPathname(), "en"));
        return;
      }
      applyOnce();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      try { boot(); } catch (_) {}
    });
  } else {
    try { boot(); } catch (_) {}
  }

  /* ------------------------------------------------------------------ */
  /*  Search localization & filtering (issue 3)                         */
  /* ------------------------------------------------------------------ */

  /**
   * Client-side search UX fixes for the bilingual site:
   *  1. Placeholder localization: "Search" -> "Buscar" on ES pages
   *  2. Result filtering: hide results not matching current language
   * Both the search bar placeholder and the dialog input mount asynchronously,
   * so we use MutationObservers to re-apply patches whenever matching nodes
   * appear. We only patch if the current value is still "Search" to avoid
   * clobbering other languages after a language switch.
   */
  try {
    (function () {
      // Reuse existing detection helper
      var currentLang = langFromPath();
      var isEs = currentLang === "es";

      // Guard: no querySelector = no point continuing
      if (!document.querySelector) return;

      /* ---- Placeholder localization ---- */
      var PLACEHOLDER_EN = "Search";
      var PLACEHOLDER_EN_DOTS = "Search...";
      var PLACEHOLDER_ES = "Buscar";
      var desiredPlaceholder = isEs ? PLACEHOLDER_ES : PLACEHOLDER_EN;

      // Patch function: update both the bar span and the dialog input
      function patchPlaceholders() {
        try {
          // 1) Collapsed bar: <span class="myst-search-text-placeholder hidden sm:block grow">Search</span>
          var barSpans = document.querySelectorAll(".myst-search-text-placeholder");
          for (var i = 0; i < barSpans.length; i++) {
            var sp = barSpans[i];
            if (sp.textContent === PLACEHOLDER_EN || sp.textContent === PLACEHOLDER_EN_DOTS) {
              sp.textContent = desiredPlaceholder;
            }
          }

          // 2) Dialog input: <input type="search" placeholder="Search..." ...>
          // Only patch if placeholder is still the English default
          var dialogInputs = document.querySelectorAll('input[type="search"][placeholder="' + PLACEHOLDER_EN + '"], input[type="search"][placeholder="' + PLACEHOLDER_EN_DOTS + '"]');
          for (var j = 0; j < dialogInputs.length; j++) {
            var inp = dialogInputs[j];
            inp.setAttribute("placeholder", desiredPlaceholder);
          }
        } catch (_) {}
      }

      // Initial patch (runs after hydration when this IIFE executes)
      patchPlaceholders();

      // Re-apply via MutationObserver on body (dialog mounts asynchronously)
      if (window.MutationObserver) {
        var placeholderObserver = new MutationObserver(function (mutations) {
          var shouldPatch = false;
          for (var m = 0; m < mutations.length; m++) {
            var mut = mutations[m];
            if (mut.type === "childList") {
              for (var n = 0; n < mut.addedNodes.length; n++) {
                var node = mut.addedNodes[n];
                if (node.nodeType !== 1) continue;
                // Check if added node matches our targets OR contains them
                if (
                  (node.matches && node.matches(".myst-search-text-placeholder")) ||
                  (node.matches && node.matches('input[type="search"][placeholder="' + PLACEHOLDER_EN + '"], input[type="search"][placeholder="' + PLACEHOLDER_EN_DOTS + '"]')) ||
                  (node.querySelector && (
                    node.querySelector(".myst-search-text-placeholder") ||
                    node.querySelector('input[type="search"][placeholder="' + PLACEHOLDER_EN + '"], input[type="search"][placeholder="' + PLACEHOLDER_EN_DOTS + '"]')
                  ))
                ) {
                  shouldPatch = true;
                  break;
                }
              }
            }
            if (shouldPatch) break;
          }
          if (shouldPatch) patchPlaceholders();
        });
        placeholderObserver.observe(document.body, { childList: true, subtree: true });
      }

      /* ---- Result filtering by language ---- */
      function filterResults() {
        try {
          var resultsContainer = document.querySelector(".myst-search-results");
          if (!resultsContainer) return;

          var items = resultsContainer.querySelectorAll("li.myst-search-result-item");
          for (var k = 0; k < items.length; k++) {
            var li = items[k];
            var a = li.querySelector("a[href]");
            if (!a) continue;
            var href = a.getAttribute("href");
            if (!href) continue;

            // Extract pathname from href (handles both relative and absolute URLs)
            var pathname;
            try {
              var url = new URL(href, window.location.origin);
              pathname = url.pathname;
            } catch (_) {
              // Relative URL fallback
              pathname = href.split('?')[0].split('#')[0];
            }

            var isEsResult = stripBase(pathname).indexOf("/es") === 0;
            var shouldHide = isEs ? !isEsResult : isEsResult;

            if (shouldHide) {
              li.style.display = "none";
            } else {
              li.style.display = "";
            }
          }
        } catch (_) {}
      }

      // Initial filter
      filterResults();

      // Re-apply via MutationObserver on the results container (or body)
      if (window.MutationObserver) {
        var resultsObserver = new MutationObserver(function (mutations) {
          var shouldFilter = false;
          for (var m = 0; m < mutations.length; m++) {
            var mut = mutations[m];
            if (mut.type === "childList") {
              for (var n = 0; n < mut.addedNodes.length; n++) {
                var node = mut.addedNodes[n];
                if (node.nodeType !== 1) continue;
                // Check if results container or result items were added
                if (
                  (node.matches && node.matches(".myst-search-results")) ||
                  (node.matches && node.matches("li.myst-search-result-item")) ||
                  (node.querySelector && (
                    node.querySelector(".myst-search-results") ||
                    node.querySelector("li.myst-search-result-item")
                  ))
                ) {
                  shouldFilter = true;
                  break;
                }
              }
            }
            if (shouldFilter) break;
          }
          if (shouldFilter) filterResults();
        });
        // Observe body for the results container mounting/unmounting with the dialog
        resultsObserver.observe(document.body, { childList: true, subtree: true });
      }
    })();
  } catch (_) {}
})();