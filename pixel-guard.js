/**
 * Pixel Guard v2.0 — Lead Firewall by Vista Growth Agency
 * Protects Meta Pixel conversions from bot/spam form submissions.
 * Drop-in script for any landing page or embed as external SaaS.
 */
;(function PixelGuard(global) {
  "use strict";

  // ─── Configuration ───────────────────────────────────────────
  var CFG = {
    minSubmitTime:    3.0,    // seconds — anything faster is a bot
    minKeystrokes:    4,      // real humans type at least a few keys
    minMouseEvents:   2,      // mouse moves / touches before submit
    honeypotClass:    "pg-hp",// CSS class for hidden honeypot field
    maxFormScans:     50,     // MutationObserver form discovery cap
    debug:            false   // set true during development only
  };

  // ─── Blacklist patterns (username part of email) ─────────────
  var BLACKLIST = [
    "asdasd", "qweqwe", "zxczxc", "123123", "abcabc",
    "testtest", "prueba", "aaaaa", "bbbbb", "11111",
    "click", "fake", "noemail", "spam", "noname",
    "admin", "root", "null", "undefined", "test"
  ];

  // ─── Disposable email domains ────────────────────────────────
  var DISPOSABLE_DOMAINS = [
    "mailinator.com", "guerrillamail.com", "tempmail.com",
    "throwaway.email", "yopmail.com", "sharklasers.com",
    "guerrillamailblock.com", "grr.la", "dispostable.com",
    "maildrop.cc", "10minutemail.com", "trashmail.com",
    "fakeinbox.com", "tempail.com", "getnada.com"
  ];

  // ─── Regex patterns ─────────────────────────────────────────
  var RE_REPEAT_CHARS  = /(.)\1{3,}/;
  var RE_KEYBOARD_WALK = /^[qwerty]{5,}|^[asdfgh]{5,}|^[zxcvbn]{5,}|^[12345]{5,}/i;
  var RE_VALID_EMAIL   = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  // ─── Per-page behavioral state ──────────────────────────────
  var state = {
    pageLoad:       Date.now(),
    keystrokes:     0,
    mouseEvents:    0,
    touchEvents:    0,
    inputFocused:   false,
    focusCount:     0,
    pasteDetected:  false,
    hasScrolled:    false,
    mousePath:      [],       // sampled [x,y] coords
    blockedCount:   0,
    formsProtected: 0
  };

  // ─── Utility helpers ─────────────────────────────────────────

  function log(msg) {
    if (CFG.debug) console.log("[PixelGuard] " + msg);
  }

  function shannonEntropy(str) {
    if (!str) return 0;
    var freq = {};
    for (var i = 0; i < str.length; i++) {
      freq[str[i]] = (freq[str[i]] || 0) + 1;
    }
    var entropy = 0;
    var len = str.length;
    for (var ch in freq) {
      var p = freq[ch] / len;
      entropy -= p * Math.log2(p);
    }
    return entropy;
  }

  function isSuspiciousUsername(username) {
    if (username.length < 3) return "Nombre de usuario demasiado corto.";

    for (var i = 0; i < BLACKLIST.length; i++) {
      if (username.indexOf(BLACKLIST[i]) !== -1) {
        return "Correo contiene texto identificado como basura.";
      }
    }

    if (RE_REPEAT_CHARS.test(username)) {
      return "Formato inválido: caracteres repetidos.";
    }

    if (RE_KEYBOARD_WALK.test(username)) {
      return "Formato inválido: patrón de teclado detectado.";
    }

    if (shannonEntropy(username) < 1.5 && username.length > 4) {
      return "Baja entropía: texto demasiado uniforme.";
    }

    return null;
  }

  function isDisposableDomain(domain) {
    for (var i = 0; i < DISPOSABLE_DOMAINS.length; i++) {
      if (domain === DISPOSABLE_DOMAINS[i]) return true;
    }
    return false;
  }

  // ─── Behavioral scoring engine ──────────────────────────────

  function computeHumanScore() {
    var score = 0;
    var max   = 100;

    // Time on page (0-25 pts)
    var elapsed = (Date.now() - state.pageLoad) / 1000;
    if (elapsed > 10) score += 25;
    else if (elapsed > 5) score += 15;
    else if (elapsed >= CFG.minSubmitTime) score += 5;

    // Keystrokes (0-25 pts)
    if (state.keystrokes > 15) score += 25;
    else if (state.keystrokes > 8) score += 15;
    else if (state.keystrokes >= CFG.minKeystrokes) score += 5;

    // Mouse / touch activity (0-20 pts)
    var interactions = state.mouseEvents + state.touchEvents;
    if (interactions > 10) score += 20;
    else if (interactions > 4) score += 12;
    else if (interactions >= CFG.minMouseEvents) score += 5;

    // Mouse path variance — bots move in straight lines (0-10 pts)
    if (state.mousePath.length > 3) {
      var dx = 0, dy = 0;
      for (var i = 1; i < state.mousePath.length; i++) {
        dx += Math.abs(state.mousePath[i][0] - state.mousePath[i - 1][0]);
        dy += Math.abs(state.mousePath[i][1] - state.mousePath[i - 1][1]);
      }
      if (dx > 50 && dy > 50) score += 10;
      else if (dx > 20 || dy > 20) score += 5;
    }

    // Focus interactions (0-10 pts)
    if (state.focusCount >= 2) score += 10;
    else if (state.focusCount === 1) score += 5;

    // Scroll activity (0-5 pts)
    if (state.hasScrolled) score += 5;

    // Penalties
    if (state.pasteDetected) score -= 10;

    return Math.max(0, Math.min(max, score));
  }

  // ─── Global behavioral listeners ────────────────────────────

  function attachBehavioralListeners() {
    document.addEventListener("keydown", function () {
      state.keystrokes++;
    }, true);

    document.addEventListener("mousemove", function (e) {
      state.mouseEvents++;
      if (state.mousePath.length < 30) {
        state.mousePath.push([e.clientX, e.clientY]);
      }
    }, true);

    document.addEventListener("touchstart", function () {
      state.touchEvents++;
    }, true);

    document.addEventListener("scroll", function () {
      state.hasScrolled = true;
    }, true);

    document.addEventListener("focusin", function (e) {
      if (e.target && e.target.tagName === "INPUT") {
        state.inputFocused = true;
        state.focusCount++;
      }
    }, true);

    document.addEventListener("paste", function (e) {
      if (e.target && e.target.type === "email") {
        state.pasteDetected = true;
      }
    }, true);
  }

  // ─── Honeypot injection ──────────────────────────────────────

  function injectHoneypot(form) {
    if (form.querySelector("." + CFG.honeypotClass)) return;

    var wrapper = document.createElement("div");
    wrapper.setAttribute("aria-hidden", "true");
    wrapper.style.cssText =
      "position:absolute;left:-9999px;top:-9999px;" +
      "width:0;height:0;overflow:hidden;opacity:0;" +
      "pointer-events:none;tab-index:-1;";

    // Nombre NO semántico: ningún navegador ni gestor de contraseñas
    // (1Password/LastPass/etc.) lo autocompleta. Evita palabras como
    // website/url/company/email/name/address/phone que disparan autofill
    // y bloquearían a humanos reales con autocompletado activo.
    var input = document.createElement("input");
    input.type = "text";
    input.name = "pg_hp_token";
    input.id = "pg_hp_token";
    input.tabIndex = -1;
    input.autocomplete = "off";
    input.setAttribute("data-lpignore", "true");   // LastPass
    input.setAttribute("data-1p-ignore", "");        // 1Password
    input.setAttribute("data-form-type", "other");   // navegadores/Chrome
    input.className = CFG.honeypotClass;

    wrapper.appendChild(input);
    form.appendChild(wrapper);
  }

  // ─── Core validation on submit ──────────────────────────────

  function handleSubmit(e) {
    var form = e.currentTarget || e.target;

    // Honeypot check — if filled, it's a bot
    var honeypot = form.querySelector("." + CFG.honeypotClass);
    if (honeypot && honeypot.value.length > 0) {
      blockSubmission(e, "Honeypot activado: bot detectado.");
      return;
    }

    // Find email input — support common name/type patterns
    var emailInput =
      form.querySelector('input[type="email"]') ||
      form.querySelector('input[name*="email"]') ||
      form.querySelector('input[name*="correo"]') ||
      form.querySelector('input[autocomplete="email"]');

    if (!emailInput) {
      log("No email field found — skipping validation.");
      return;
    }

    var emailValue = emailInput.value.toLowerCase().trim();

    // Basic format validation
    if (!RE_VALID_EMAIL.test(emailValue)) {
      blockSubmission(e, "Formato de correo electrónico inválido.");
      return;
    }

    var parts    = emailValue.split("@");
    var username = parts[0];
    var domain   = parts[1];

    // Disposable domain check
    if (isDisposableDomain(domain)) {
      blockSubmission(e, "Dominio de correo temporal detectado.");
      return;
    }

    // Username quality check
    var usernameIssue = isSuspiciousUsername(username);
    if (usernameIssue) {
      blockSubmission(e, usernameIssue);
      return;
    }

    // Behavioral analysis
    var elapsed = (Date.now() - state.pageLoad) / 1000;

    if (elapsed < CFG.minSubmitTime) {
      blockSubmission(e, "Velocidad de llenado sospechosa (bot detectado).");
      return;
    }

    var humanScore = computeHumanScore();
    log("Human score: " + humanScore + "/100");

    if (humanScore < 15) {
      blockSubmission(e, "Comportamiento no humano detectado (score: " + humanScore + ").");
      return;
    }

    // ✓ Passed all checks
    log("Lead legítimo verificado. Score: " + humanScore + ". Píxel a salvo.");
  }

  function blockSubmission(e, reason) {
    e.preventDefault();
    e.stopImmediatePropagation();
    state.blockedCount++;

    log("BLOQUEADO (#" + state.blockedCount + "): " + reason);

    // Dispatch custom event for external integrations
    document.dispatchEvent(new CustomEvent("pixelguard:blocked", {
      detail: { reason: reason, count: state.blockedCount, timestamp: Date.now() }
    }));

    showUserMessage(e.currentTarget || e.target, reason);
  }

  function showUserMessage(form, reason) {
    var existing = form.querySelector(".pg-error-msg");
    if (existing) existing.remove();

    var msg = document.createElement("div");
    msg.className = "pg-error-msg";
    msg.setAttribute("role", "alert");
    msg.style.cssText =
      "color:#d32f2f;font-size:14px;margin-top:8px;" +
      "padding:10px 14px;border-left:3px solid #d32f2f;" +
      "background:#fff5f5;border-radius:4px;font-family:inherit;";
    msg.textContent = "Por favor, introduce un correo electrónico válido para continuar.";

    var submitBtn =
      form.querySelector('button[type="submit"]') ||
      form.querySelector('input[type="submit"]') ||
      form.querySelector("button:last-of-type");

    if (submitBtn && submitBtn.parentNode) {
      submitBtn.parentNode.insertBefore(msg, submitBtn.nextSibling);
    } else {
      form.appendChild(msg);
    }

    setTimeout(function () { if (msg.parentNode) msg.remove(); }, 6000);
  }

  // ─── Form discovery (supports dynamic/SPA forms) ────────────

  function protectForm(form) {
    if (form.dataset.pgProtected) return;
    form.dataset.pgProtected = "1";
    form.addEventListener("submit", handleSubmit, true);
    injectHoneypot(form);
    state.formsProtected++;
    log("Form #" + state.formsProtected + " protected.");
  }

  function scanForms() {
    var forms = document.querySelectorAll("form");
    for (var i = 0; i < forms.length; i++) {
      protectForm(forms[i]);
    }
  }

  function observeDynamicForms() {
    if (typeof MutationObserver === "undefined") return;

    var scanned = 0;
    var observer = new MutationObserver(function (mutations) {
      for (var m = 0; m < mutations.length; m++) {
        var nodes = mutations[m].addedNodes;
        for (var n = 0; n < nodes.length; n++) {
          if (scanned >= CFG.maxFormScans) { observer.disconnect(); return; }
          var node = nodes[n];
          if (node.nodeType !== 1) continue;
          if (node.tagName === "FORM") { protectForm(node); scanned++; }
          var nested = node.querySelectorAll ? node.querySelectorAll("form") : [];
          for (var f = 0; f < nested.length; f++) { protectForm(nested[f]); scanned++; }
        }
      }
    });

    observer.observe(document.body || document.documentElement, {
      childList: true, subtree: true
    });
  }

  // ─── Platform-specific adapters ──────────────────────────────

  function attachPlatformAdapters() {

    // --- Elementor (WordPress) ---
    // Elementor forms use custom AJAX submit events
    document.addEventListener("submit", function (e) {
      var form = e.target;
      if (form && form.classList &&
         (form.classList.contains("elementor-form") ||
          form.closest && form.closest(".elementor-widget-form"))) {
        if (!form.dataset.pgProtected) protectForm(form);
      }
    }, true);

    // --- HubSpot embedded forms ---
    // HubSpot injects forms inside iframes or via JS; listen for their event
    if (global.addEventListener) {
      global.addEventListener("message", function (e) {
        try {
          var data = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
          if (data && data.type === "hsFormCallback" && data.eventName === "onFormReady") {
            setTimeout(scanForms, 500);
          }
        } catch (_) { /* not a HubSpot message */ }
      });
    }

    // --- Typeform ---
    // Typeform uses iframes; we intercept via postMessage
    if (global.addEventListener) {
      global.addEventListener("message", function (e) {
        try {
          var data = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
          if (data && data.type === "form-submit" && data.source === "typeform") {
            log("Typeform submission detected — external validation requires server-side webhook.");
          }
        } catch (_) { /* not a Typeform message */ }
      });
    }

    // --- Shopify ---
    // Shopify contact/newsletter forms are standard <form> elements
    // The MutationObserver + scanForms already covers them
    // Additional: intercept Shopify AJAX forms
    if (global.Shopify || document.querySelector('meta[name="shopify-checkout-api-token"]')) {
      log("Shopify detected — forms will be intercepted via MutationObserver.");
    }
  }

  // ─── Initialization ─────────────────────────────────────────

  function init() {
    if (global.__pixelGuardLoaded) return;
    global.__pixelGuardLoaded = true;

    attachBehavioralListeners();
    scanForms();
    observeDynamicForms();
    attachPlatformAdapters();

    log("Pixel Guard v2.0 initialized. Forms protected: " + state.formsProtected);
  }

  // Boot — works regardless of when the script loads
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // ─── Public API (for SaaS dashboard / external control) ─────
  global.PixelGuard = {
    version: "2.0.0",
    getStats: function () {
      return {
        formsProtected: state.formsProtected,
        blockedCount:   state.blockedCount,
        humanScore:     computeHumanScore(),
        uptime:         ((Date.now() - state.pageLoad) / 1000).toFixed(1) + "s"
      };
    },
    configure: function (opts) {
      for (var key in opts) {
        if (CFG.hasOwnProperty(key)) CFG[key] = opts[key];
      }
    }
  };

})(typeof window !== "undefined" ? window : this);
