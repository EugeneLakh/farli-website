(function () {
  'use strict';

  var calm = false;
  try { calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  // ---- Hero cube: drawn on a canvas so every edge is anti-aliased ----
  var VERTS = [[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]];
  // face: 4 vertex indices (in order around the face) + outward normal
  var FACES = [
    { v: [0,1,2,3], n: [0,0,-1] },
    { v: [4,5,6,7], n: [0,0,1] },
    { v: [0,1,5,4], n: [0,-1,0] },
    { v: [3,2,6,7], n: [0,1,0] },
    { v: [0,3,7,4], n: [-1,0,0] },
    { v: [1,2,6,5], n: [1,0,0] }
  ];
  var LIGHT = (function () { var l = [-0.5, -0.7, 0.6], m = Math.sqrt(l[0]*l[0] + l[1]*l[1] + l[2]*l[2]); return [l[0]/m, l[1]/m, l[2]/m]; })();
  var DARK = [30, 48, 125], BRIGHT = [128, 156, 232];
  var CAM = 4.2; // camera distance in cube half-sizes

  function rot(p, rx, ry) {
    var cy = Math.cos(ry), sy = Math.sin(ry), cx = Math.cos(rx), sx = Math.sin(rx);
    var x = p[0] * cy + p[2] * sy, z = -p[0] * sy + p[2] * cy, y = p[1];
    return [x, y * cx - z * sx, y * sx + z * cx];
  }
  function mix(t) {
    t = Math.max(0, Math.min(1, t));
    return 'rgba(' + Math.round(DARK[0] + (BRIGHT[0] - DARK[0]) * t) + ',' +
      Math.round(DARK[1] + (BRIGHT[1] - DARK[1]) * t) + ',' +
      Math.round(DARK[2] + (BRIGHT[2] - DARK[2]) * t) + ',.94)';
  }

  // Draws the cube centred in a size x size box. Returns the number of faces drawn.
  function drawCube(ctx, size, rxDeg, ryDeg) {
    var half = size * 0.26, cx = size / 2, cy = size / 2;
    var rx = rxDeg * Math.PI / 180, ry = ryDeg * Math.PI / 180;
    var P = VERTS.map(function (v) {
      var q = rot(v, rx, ry), k = CAM / (CAM - q[2]);
      return { x: cx + q[0] * half * k, y: cy + q[1] * half * k, z: q[2] };
    });
    var drawn = 0;
    ctx.clearRect(0, 0, size, size);

    // soft contact shadow
    var sh = ctx.createRadialGradient(cx, cy + half * 1.55, 2, cx, cy + half * 1.55, half * 1.5);
    sh.addColorStop(0, 'rgba(70,110,255,.22)');
    sh.addColorStop(1, 'rgba(70,110,255,0)');
    ctx.fillStyle = sh;
    ctx.fillRect(0, 0, size, size);

    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    FACES.forEach(function (f) {
      var n = rot(f.n, rx, ry);
      var c = [0, 0, 0];
      f.v.forEach(function (i) { var q = rot(VERTS[i], rx, ry); c[0] += q[0] / 4; c[1] += q[1] / 4; c[2] += q[2] / 4; });
      // visible when the normal points toward the camera
      if (n[0] * (0 - c[0]) + n[1] * (0 - c[1]) + n[2] * (CAM - c[2]) <= 0) return;
      drawn += 1;
      var b = Math.max(0, n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2]);
      var t = 0.28 + 0.55 * b;
      var p0 = P[f.v[0]], p2 = P[f.v[2]];
      var g = ctx.createLinearGradient(p0.x, p0.y, p2.x, p2.y);
      g.addColorStop(0, mix(t + 0.14));
      g.addColorStop(1, mix(t - 0.12));
      ctx.beginPath();
      f.v.forEach(function (i, k) { if (k === 0) ctx.moveTo(P[i].x, P[i].y); else ctx.lineTo(P[i].x, P[i].y); });
      ctx.closePath();
      ctx.fillStyle = g;
      ctx.fill();
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = 'rgba(235,242,255,.78)';
      ctx.stroke();
    });
    return drawn;
  }
  window.__farliDrawCube = drawCube; // exposed for tests

  var scene = document.getElementById('scene');
  var canvas = document.getElementById('cube');
  if (scene && canvas && canvas.getContext) {
    var ctx = canvas.getContext('2d');
    var r = { ox: 0, oy: 0, vx: 0, vy: 0, t: 0, drag: false, lx: 0, ly: 0, tracked: false, moved: 0 };
    var orbiters = [].slice.call(scene.querySelectorAll('.sticker'));
    var orbitLine = scene.querySelector('.orbit ellipse');
    var TILT = -8 * Math.PI / 180;
    // Icons ride an ellipse around the cube; the far half goes behind it, smaller and dimmer.
    function placeOrbiters(size, yawDeg) {
      var R = Math.min(size * 0.76, (window.innerWidth || 9999) / 2 - 34), n = orbiters.length;
      if (orbitLine && orbitLine.__r !== R) {
        orbitLine.__r = R;
        orbitLine.setAttribute('rx', (R / size * 100).toFixed(1));
        orbitLine.setAttribute('ry', (R / size * 26).toFixed(1));
      }
      orbiters.forEach(function (el, i) {
        var a = r.t * 0.22 + yawDeg * Math.PI / 180 + i * 2 * Math.PI / n;
        var ex = Math.cos(a) * R, depth = Math.sin(a), ey = depth * R * 0.26;
        var x = ex * Math.cos(TILT) - ey * Math.sin(TILT);
        var y = ex * Math.sin(TILT) + ey * Math.cos(TILT) + size * 0.04;
        var k = 0.83 + 0.19 * (depth + 1) / 2; // 54 px icon never drops under a 44 px touch target
        el.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px) scale(' + k.toFixed(3) + ')';
        el.style.zIndex = depth > 0 ? 3 : 1;
        el.style.opacity = (0.5 + 0.5 * (depth + 1) / 2).toFixed(2);
      });
    }

    scene.addEventListener('pointerdown', function (e) {
      r.drag = true; r.lx = e.clientX; r.ly = e.clientY; r.moved = 0;
      r.downEl = e.target.closest ? e.target.closest('.sticker') : null;
      if (!r.tracked) { r.tracked = true; if (window.farliTrack) window.farliTrack('cube_drag'); }
      try { scene.setPointerCapture(e.pointerId); } catch (x) {}
    });
    scene.addEventListener('pointermove', function (e) {
      if (!r.drag) return;
      var dx = e.clientX - r.lx, dy = e.clientY - r.ly;
      r.lx = e.clientX; r.ly = e.clientY;
      r.moved += Math.abs(dx) + Math.abs(dy);
      r.oy += dx * 0.3;
      r.ox = Math.max(-45, Math.min(45, r.ox - dy * 0.3));
      r.vy = dx * 0.3;
      r.vx = -dy * 0.3;
    });
    var release = function () { r.drag = false; };
    scene.addEventListener('pointerup', release);
    scene.addEventListener('pointercancel', release);

    var tick = function () {
      if (!calm) r.t += 0.016;
      if (!r.drag) {
        r.oy += r.vy; r.ox += r.vx;
        r.vy *= 0.9; r.vx *= 0.9;
        r.oy *= 0.99; r.ox *= 0.99;
      }
      var css = canvas.clientWidth || 260;
      var dpr = Math.min(window.devicePixelRatio || 1, 3);
      var px = Math.round(css * dpr);
      if (canvas.width !== px) { canvas.width = px; canvas.height = px; }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var sy = calm ? 0 : Math.sin(r.t * 0.5) * 9;
      var sx = calm ? 0 : Math.sin(r.t * 0.35) * 2.5;
      drawCube(ctx, css, -22 + r.ox + sx, 32 + r.oy + sy);
      placeOrbiters(css, r.oy);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);

    // Tap an icon to jump to its app. The scene captures the pointer for dragging, so the tap is
    // recognised here (short press, no movement); the link's own click only serves the keyboard.
    var goToApp = function (el) {
      var card = document.getElementById(el.getAttribute('href').slice(1));
      if (!card) return;
      if (card.hidden && window.__farliFilter) window.__farliFilter('all');
      card.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'center' });
      card.classList.remove('flash');
      void card.offsetWidth;
      card.classList.add('flash');
      if (window.farliTrack) window.farliTrack('sticker_tap', { app: el.getAttribute('aria-label') });
    };
    scene.addEventListener('pointerup', function () {
      if (r.downEl && r.moved <= 8) goToApp(r.downEl);
      r.downEl = null;
    });
    orbiters.forEach(function (el) {
      el.addEventListener('dragstart', function (e) { e.preventDefault(); });
      el.addEventListener('click', function (e) {
        e.preventDefault();
        if (e.detail === 0) goToApp(el); // keyboard
      });
    });
  }

  // ---- Easter egg: tap the F in the footer three times ----
  var logo = document.getElementById('egg-logo');
  var egg = document.getElementById('egg');
  if (logo && egg) {
    var taps = 0, tapTimer, hideTimer;
    logo.addEventListener('mousedown', function (e) { e.preventDefault(); });
    logo.addEventListener('click', function () {
      taps += 1;
      clearTimeout(tapTimer);
      tapTimer = setTimeout(function () { taps = 0; }, 1200);
      if (taps >= 3) {
        taps = 0;
        egg.hidden = true;
        void egg.offsetWidth;
        egg.hidden = false;
        clearTimeout(hideTimer);
        hideTimer = setTimeout(function () { egg.hidden = true; }, 5200);
        if (window.farliTrack) window.farliTrack('easter_egg_found');
      }
    });
  }

  // ---- Scroll: progress line, header state, hero drift, screenshot parallax ----
  var root = document.documentElement;
  var header = document.querySelector('.site-header');
  var scrollQueued = false;
  function onScroll() {
    scrollQueued = false;
    var y = window.pageYOffset || 0, vh = window.innerHeight || 1;
    var max = Math.max(1, root.scrollHeight - vh);
    root.style.setProperty('--scroll', Math.min(1, y / max).toFixed(4));
    if (header) header.classList.toggle('scrolled', y > 8);
    if (calm) return;
    root.style.setProperty('--sy', Math.round(y));
    root.style.setProperty('--hero', Math.min(1, y / (vh * 0.7)).toFixed(3));
  }
  function queueScroll() { if (!scrollQueued) { scrollQueued = true; requestAnimationFrame(onScroll); } }
  window.addEventListener('scroll', queueScroll, { passive: true });
  window.addEventListener('resize', queueScroll);
  onScroll();

  // ---- Reveal blocks as they enter the screen ----
  var revealEls = [].slice.call(document.querySelectorAll('.rv, .rv-item'));
  function show(el) {
    el.classList.add('in');
    // after the entrance the card goes back to its own hover transitions
    if (el.classList.contains('rv-item')) setTimeout(function () { el.classList.remove('rv-item', 'in'); el.style.removeProperty('--i'); }, 1400);
  }
  if (calm || !('IntersectionObserver' in window)) {
    revealEls.forEach(function (el) { el.classList.add('in'); });
  } else {
    var revealer = new IntersectionObserver(function (entries) {
      // items that appear together come in one after another
      var n = 0;
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        en.target.style.setProperty('--i', n++);
        show(en.target);
        revealer.unobserve(en.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
    revealEls.forEach(function (el) { revealer.observe(el); });
  }

  // ---- Header: mark the section on screen ----
  var navLinks = [].slice.call(document.querySelectorAll('.nav .navlink'));
  if (navLinks.length && 'IntersectionObserver' in window) {
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        navLinks.forEach(function (a) {
          if (a.getAttribute('href') === '#' + en.target.id) a.setAttribute('aria-current', 'true');
          else a.removeAttribute('aria-current');
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    navLinks.forEach(function (a) {
      var sec = document.getElementById(a.getAttribute('href').slice(1));
      if (sec) spy.observe(sec);
    });
  }

  // ---- App cards: light under the pointer ----
  var cards = [].slice.call(document.querySelectorAll('.app'));
  cards.forEach(function (card) {
    card.addEventListener('pointermove', function (e) {
      if (e.pointerType === 'touch') return;
      var b = card.getBoundingClientRect();
      card.style.setProperty('--mx', (e.clientX - b.left) + 'px');
      card.style.setProperty('--my', (e.clientY - b.top) + 'px');
    });
  });

  // ---- App filter ----
  var filters = [].slice.call(document.querySelectorAll('.filter'));
  var filterStatus = document.getElementById('filter-status');
  function applyFilter(kind) {
    var shown = 0;
    cards.forEach(function (card) {
      var on = kind === 'all' || card.getAttribute('data-kind') === kind;
      card.hidden = !on;
      if (on) shown += 1;
    });
    filters.forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-filter') === kind)); });
    if (filterStatus) filterStatus.textContent = shown + (shown === 1 ? ' app shown' : ' apps shown');
    queueScroll();
  }
  window.__farliFilter = applyFilter;
  filters.forEach(function (b) {
    var kind = b.getAttribute('data-filter');
    var count = b.querySelector('.n');
    if (count) count.textContent = kind === 'all' ? cards.length : cards.filter(function (c) { return c.getAttribute('data-kind') === kind; }).length;
    b.addEventListener('click', function () {
      if (b.getAttribute('aria-pressed') === 'true') return;
      // cards slide to their new places where the browser supports view transitions
      if (!calm && document.startViewTransition) document.startViewTransition(function () { applyFilter(kind); });
      else applyFilter(kind);
      if (window.farliTrack) window.farliTrack('apps_filter', { kind: kind });
    });
  });

  // ---- App details: screens, description, Notify me ----
  var viewer = document.getElementById('viewer');
  if (viewer && viewer.showModal) {
    var vImg = viewer.querySelector('.viewer-stage img');
    var vIcon = viewer.querySelector('.viewer-icon');
    var vChips = viewer.querySelector('.viewer-chips');
    var vDesc = viewer.querySelector('.viewer-desc');
    var vNotify = viewer.querySelector('.viewer-notify');
    var vTitle = viewer.querySelector('.viewer-title');
    var vCap = viewer.querySelector('.viewer-cap');
    var vPrev = viewer.querySelector('[data-prev]');
    var vNext = viewer.querySelector('[data-next]');
    var shots = [], at = 0, opener = null;
    var render = function (dir) {
      var s = shots[at];
      vImg.style.setProperty('--dir', dir || 1);
      vImg.classList.remove('swap');
      void vImg.offsetWidth;
      if (dir) vImg.classList.add('swap');
      vImg.src = s.src;
      vImg.alt = s.alt;
      vCap.textContent = '';
      if (s.concept) { // a drawn concept, not a screenshot of the running app
        var badge = document.createElement('span');
        badge.className = 'badge';
        badge.textContent = 'Concept';
        vCap.appendChild(badge);
      }
      vCap.appendChild(document.createTextNode(s.alt + (shots.length > 1 ? ' · ' + (at + 1) + ' / ' + shots.length : '')));
      vPrev.hidden = vNext.hidden = shots.length < 2;
    };
    var step = function (d) { if (shots.length < 2) return; at = (at + d + shots.length) % shots.length; render(d); };
    [].slice.call(document.querySelectorAll('button.shot')).forEach(function (btn) {
      btn.addEventListener('click', function () {
        try { shots = JSON.parse(btn.getAttribute('data-shots')); } catch (e) { shots = []; }
        if (!shots.length) return;
        at = 0; opener = btn;
        vTitle.textContent = btn.getAttribute('data-app');
        var card = btn.closest('.app');
        var icon = btn.querySelector('.app-icon');
        vIcon.src = icon.src;
        vIcon.style.imageRendering = icon.style.imageRendering;
        vChips.innerHTML = card.querySelector('.chips').innerHTML;
        vDesc.textContent = card.querySelector('.app-body p').textContent;
        var link = card.querySelector('.app-foot a');
        vNotify.href = link.href;
        vNotify.setAttribute('aria-label', link.getAttribute('aria-label'));
        render(0);
        viewer.showModal();
        if (window.farliTrack) window.farliTrack('screenshot_open', { app: btn.getAttribute('data-app') });
      });
    });
    vPrev.addEventListener('click', function () { step(-1); });
    vNext.addEventListener('click', function () { step(1); });
    viewer.querySelector('[data-close]').addEventListener('click', function () { viewer.close(); });
    viewer.addEventListener('click', function (e) { if (e.target === viewer) viewer.close(); });
    viewer.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') step(-1);
      else if (e.key === 'ArrowRight') step(1);
    });
    var touchX = null;
    viewer.addEventListener('touchstart', function (e) { touchX = e.touches[0].clientX; }, { passive: true });
    viewer.addEventListener('touchend', function (e) {
      if (touchX === null) return;
      var dx = e.changedTouches[0].clientX - touchX; touchX = null;
      if (Math.abs(dx) > 40) step(dx < 0 ? 1 : -1);
    });
    viewer.addEventListener('close', function () { if (opener) opener.focus(); });
  }

  // ---- Phone menu ----
  var menuBtn = document.getElementById('menu-btn');
  var nav = document.getElementById('nav');
  if (menuBtn && nav) {
    var setMenu = function (open) {
      nav.classList.toggle('open', open);
      menuBtn.setAttribute('aria-expanded', String(open));
    };
    menuBtn.addEventListener('click', function () { setMenu(menuBtn.getAttribute('aria-expanded') !== 'true'); });
    nav.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('a')) setMenu(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setMenu(false); });
    document.addEventListener('click', function (e) {
      if (!nav.contains(e.target) && !menuBtn.contains(e.target)) setMenu(false);
    });
  }

  try {
    console.log('%cFARLI', 'font:700 20px sans-serif;letter-spacing:.2em;color:#9FB4E8',
      '\nHello, curious one. Simple, fast, reliable. help@farli.net');
  } catch (e) {}
})();
