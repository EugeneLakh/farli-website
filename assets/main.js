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
    var r = { ox: 0, oy: 0, vx: 0, vy: 0, t: 0, drag: false, lx: 0, ly: 0, tracked: false };

    scene.addEventListener('pointerdown', function (e) {
      r.drag = true; r.lx = e.clientX; r.ly = e.clientY;
      if (!r.tracked) { r.tracked = true; if (window.farliTrack) window.farliTrack('cube_drag'); }
      try { scene.setPointerCapture(e.pointerId); } catch (x) {}
    });
    scene.addEventListener('pointermove', function (e) {
      if (!r.drag) return;
      var dx = e.clientX - r.lx, dy = e.clientY - r.ly;
      r.lx = e.clientX; r.ly = e.clientY;
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
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
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

  try {
    console.log('%cFARLI', 'font:700 20px sans-serif;letter-spacing:.2em;color:#9FB4E8',
      '\nHello, curious one. Simple, fast, reliable. help@farli.net');
  } catch (e) {}
})();
