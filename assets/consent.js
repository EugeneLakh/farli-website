/* Consent banner + PostHog loader.
   - Nothing analytics-related loads or is stored before the visitor accepts.
   - Declining (or a Global Privacy Control / Do Not Track signal) keeps it all off.
   - "Cookie settings" in the footer reopens the choice at any time. */
(function () {
  'use strict';

  var cfg = window.FARLI_CONFIG || {};
  var KEY = 'farli-consent-v1';
  var demo = !!cfg.demo;
  var enabled = !!cfg.posthogKey || demo;
  var host = cfg.posthogHost || 'https://eu.i.posthog.com';
  var pending = [];
  var loading = false;
  var banner = null;

  function readChoice() {
    try {
      var v = localStorage.getItem(KEY);
      return v === 'granted' || v === 'denied' ? v : null;
    } catch (e) { return null; }
  }
  function writeChoice(v) {
    if (demo) return;
    try { localStorage.setItem(KEY, v); } catch (e) {}
  }
  function privacySignal() {
    return navigator.globalPrivacyControl === true || navigator.doNotTrack === '1' || window.doNotTrack === '1';
  }

  var choice = demo ? null : readChoice();

  // Public, safe-to-call-anytime tracking function.
  window.farliTrack = function (name, props) {
    if (!enabled || demo || choice !== 'granted') return;
    if (window.posthog && typeof window.posthog.capture === 'function' && window.posthog.__loaded) {
      window.posthog.capture(name, props || {});
    } else if (loading) {
      pending.push([name, props || {}]);
    }
  };

  function loadPostHog() {
    if (!cfg.posthogKey || demo || loading || (window.posthog && window.posthog.__loaded)) return;
    loading = true;
    var s = document.createElement('script');
    s.async = true;
    s.crossOrigin = 'anonymous';
    s.src = host.replace('.i.posthog.com', '-assets.i.posthog.com') + '/static/array.js';
    s.onload = function () {
      try {
        window.posthog.init(cfg.posthogKey, {
          api_host: host,
          person_profiles: 'identified_only',
          autocapture: false,
          capture_pageview: true,
          capture_pageleave: true,
          disable_session_recording: true,
          respect_dnt: true,
          persistence: 'localStorage+cookie',
          loaded: function (ph) { ph.register({ site: 'farli.net' }); }
        });
        pending.splice(0).forEach(function (e) { window.posthog.capture(e[0], e[1]); });
      } catch (e) {}
    };
    s.onerror = function () { loading = false; };
    document.head.appendChild(s);
  }

  function clearPostHogData() {
    try {
      Object.keys(localStorage).forEach(function (k) {
        if (k.indexOf('ph_') === 0 || k.indexOf('posthog') === 0) localStorage.removeItem(k);
      });
    } catch (e) {}
    try {
      var parts = location.hostname.split('.');
      var domains = ['', location.hostname];
      if (parts.length > 2) domains.push('.' + parts.slice(-2).join('.'));
      document.cookie.split(';').forEach(function (c) {
        var n = c.split('=')[0].trim();
        if (n.indexOf('ph_') === 0 || n.indexOf('posthog') === 0) {
          domains.forEach(function (d) {
            document.cookie = n + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/' + (d ? '; domain=' + d : '');
          });
        }
      });
    } catch (e) {}
  }

  function grant() {
    choice = 'granted';
    writeChoice('granted');
    hideBanner();
    loadPostHog();
  }
  function deny() {
    choice = 'denied';
    writeChoice('denied');
    hideBanner();
    pending.length = 0;
    try {
      if (window.posthog && window.posthog.__loaded) {
        window.posthog.opt_out_capturing();
        window.posthog.reset();
      }
    } catch (e) {}
    clearPostHogData();
  }

  function hideBanner() {
    if (banner) banner.hidden = true;
  }

  function buildBanner() {
    if (banner) return banner;
    banner = document.createElement('section');
    banner.className = 'consent';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-modal', 'false');
    banner.setAttribute('aria-labelledby', 'consent-title');
    banner.hidden = true;
    banner.innerHTML =
      '<h2 id="consent-title">Analytics, only if you agree</h2>' +
      '<p>We would like to use privacy-friendly analytics (PostHog, EU servers) to see which parts of this site are used. No ads, no selling data. ' +
      '<a href="privacy.html#analytics">Details</a></p>' +
      '<div class="consent-actions">' +
      '<button type="button" class="btn btn-primary btn-sm" data-consent="accept">Accept</button>' +
      '<button type="button" class="btn btn-ghost btn-sm" data-consent="decline">Decline</button>' +
      '</div>';
    banner.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('[data-consent]') : null;
      if (!b) return;
      if (b.getAttribute('data-consent') === 'accept') grant(); else deny();
    });
    document.body.appendChild(banner);
    return banner;
  }

  function showBanner() {
    buildBanner().hidden = false;
  }

  function init() {
    // Reveal the "Cookie settings" link only when analytics is configured.
    var openers = document.querySelectorAll('[data-consent-open]');
    for (var i = 0; i < openers.length; i++) {
      if (enabled) {
        openers[i].hidden = false;
        openers[i].addEventListener('click', showBanner);
      }
    }
    if (!enabled) return;

    if (demo) { showBanner(); return; }
    if (choice === 'granted') { loadPostHog(); return; }
    if (choice === 'denied') return;
    if (privacySignal()) { choice = 'denied'; writeChoice('denied'); return; }
    showBanner();
  }

  // Click tracking for elements marked with data-track (only fires after consent).
  document.addEventListener('click', function (e) {
    var el = e.target.closest ? e.target.closest('[data-track]') : null;
    if (!el) return;
    var props = { label: (el.textContent || '').trim().slice(0, 40) };
    var href = el.getAttribute('href');
    if (href) props.href = href;
    window.farliTrack(el.getAttribute('data-track'), props);
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
