/*!
 * Grudge Engine v1.0 — the tiny 2D game engine behind Grudge Forge.
 * Global: G. Entities are centre-positioned. Scenes have start/update/draw/hud.
 */
(function () {
  'use strict';
  var G = (window.G = {});
  var TAU = Math.PI * 2;
  var canvas, ctx, W = 800, H = 450, bg = '#0b0b0f', k = 1, pixelArt = false, touchMode = 'auto';
  var running = false, last = 0, errored = false, inited = false;
  var ents = [], scenes = {}, scene = null, sceneName = null, pending = null;
  var timers = [], tweens = [], colliders = [];
  var down = new Set(), pressed = new Set(), released = new Set();
  var shakeT = 0, shakeI = 0, flashC = null, flashT = 0, flashD = 0;
  var spriteCache = {}, memStore = {};

  G.TAU = TAU;
  G.state = {};
  G.time = 0;
  G.frame = 0;
  G.paused = false;
  G.muted = false;
  G.world = null;
  G.mouse = { x: 0, y: 0, wx: 0, wy: 0, down: false, clicked: false, released: false };
  G.camera = {
    x: 0, y: 0, zoom: 1, target: null, lerp: 0.12,
    follow: function (e, l) { this.target = e; if (l != null) this.lerp = l; },
    reset: function () { this.x = 0; this.y = 0; this.zoom = 1; this.target = null; this.lerp = 0.12; }
  };
  Object.defineProperty(G, 'W', { get: function () { return W; } });
  Object.defineProperty(G, 'H', { get: function () { return H; } });
  Object.defineProperty(G, 'ctx', { get: function () { return ctx; } });
  Object.defineProperty(G, 'canvas', { get: function () { return canvas; } });
  Object.defineProperty(G, 'sceneName', { get: function () { return sceneName; } });
  Object.defineProperty(G, 'entities', { get: function () { return ents; } });

  /* ---------------- errors ---------------- */
  function relLine(abs) {
    var r = window.__GF_LINES;
    if (!r || abs == null) return null;
    if (abs >= r[0] && abs <= r[1]) return abs - r[0] + 1;
    return null;
  }
  function lineFromStack(err) {
    var s = (err && err.stack) || '';
    var re = /:(\d+):(\d+)\)?\s*$/gm, m;
    var lines = s.split('\n');
    for (var i = 0; i < lines.length; i++) {
      m = /:(\d+):(\d+)\)?\s*$/.exec(lines[i]);
      if (m) { var l = relLine(+m[1]); if (l) return l; }
    }
    return null;
  }
  function report(msg, line) {
    if (errored) return;
    errored = true;
    running = false;
    try { parent.postMessage({ type: 'grudge:error', message: String(msg), line: line || null }, '*'); } catch (_) {}
    try {
      if (!ctx) return;
      ctx.setTransform(k, 0, 0, k, 0, 0);
      ctx.globalAlpha = 0.85; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
      ctx.fillStyle = '#ff5a5a'; ctx.font = 'bold 20px system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('The game crashed', W / 2, H / 2 - 20);
      ctx.fillStyle = '#ddd'; ctx.font = '14px ui-monospace,monospace';
      ctx.fillText(String(msg).slice(0, 90) + (line ? '  (line ' + line + ')' : ''), W / 2, H / 2 + 12);
    } catch (_) {}
  }
  window.addEventListener('error', function (ev) {
    report(ev.message || 'Script error', relLine(ev.lineno) || lineFromStack(ev.error));
  });
  window.addEventListener('unhandledrejection', function (ev) {
    var r = ev.reason; report((r && r.message) || r || 'Unhandled promise rejection', lineFromStack(r));
  });

  /* ---------------- setup ---------------- */
  G.init = function (o) {
    o = o || {};
    if (o.width) W = o.width;
    if (o.height) H = o.height;
    if (o.bg) bg = o.bg;
    if (o.pixelArt) pixelArt = true;
    if (o.touch !== undefined) touchMode = o.touch;
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.style.cssText = 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);display:block;touch-action:none;outline:none';
      canvas.tabIndex = 0;
      document.body.appendChild(canvas);
      ctx = canvas.getContext('2d');
      bindInput();
      window.addEventListener('resize', resize);
    }
    resize();
    if (!inited) { inited = true; setupTouch(); }
    return G;
  };
  function resize() {
    if (!canvas) return;
    var vw = window.innerWidth || W, vh = window.innerHeight || H;
    var s = Math.min(vw / W, vh / H);
    var cw = Math.max(1, Math.floor(W * s)), ch = Math.max(1, Math.floor(H * s));
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.style.width = cw + 'px';
    canvas.style.height = ch + 'px';
    canvas.width = Math.floor(cw * dpr);
    canvas.height = Math.floor(ch * dpr);
    k = canvas.width / W;
    canvas.style.imageRendering = pixelArt ? 'pixelated' : 'auto';
  }
  G.background = function (c) { bg = c; };

  /* ---------------- scenes ---------------- */
  G.scene = function (name, def) { scenes[name] = def || {}; return def; };
  G.go = function (name, data) {
    if (!scenes[name]) throw new Error('Scene "' + name + '" does not exist. Define it with G.scene("' + name + '", {...}).');
    if (running) pending = { name: name, data: data };
    else switchScene(name, data);
  };
  function switchScene(name, data) {
    ents.length = 0;
    timers.length = 0;
    tweens.length = 0;
    colliders = colliders.filter(function (c) { return c.persist; });
    G.camera.reset();
    G.world = null;
    shakeT = 0;
    sceneName = name;
    scene = scenes[name];
    if (scene.start) scene.start.call(scene, data);
  }
  G.start = function (s, data) {
    if (!canvas) G.init();
    if (typeof s === 'object' && s) { G.scene('main', s); s = 'main'; }
    if (!s) s = Object.keys(scenes)[0];
    if (s) switchScene(s, data);
    if (!running) {
      running = true;
      last = performance.now();
      requestAnimationFrame(loop);
      try { parent.postMessage({ type: 'grudge:ready' }, '*'); } catch (_) {}
    }
  };
  G.restart = function (data) { if (sceneName) G.go(sceneName, data); };

  /* ---------------- entities ---------------- */
  function rad(e) { return e.r != null ? e.r : Math.min(e.w, e.h) / 2; }
  G.add = function (p) {
    p = p || {};
    var e = {
      x: 0, y: 0, w: 24, h: 24, vx: 0, vy: 0, ax: 0, ay: 0, gravity: 0, drag: 0, maxSpeed: 0,
      angle: 0, spin: 0, scale: 1, color: '#ffffff', shape: 'rect', alpha: 1, z: 0, tag: '',
      fixed: false, dead: false, life: null, fade: false, solid: false, oneWay: false, collide: false,
      bounded: false, bounce: 0, wrap: false, cull: false, onGround: false, stroke: null, lineWidth: 2,
      glow: 0, radius: 0, text: '', size: 18, font: null, align: 'center', flip: false, visible: true,
      pixels: null, palette: null, pixelSize: 4, points: null
    };
    for (var key in p) e[key] = p[key];
    if (p.r != null && p.w == null && p.h == null) { e.w = e.h = p.r * 2; }
    if (e.shape === 'circle' && e.r == null) e.r = Math.min(e.w, e.h) / 2;
    if (e.life != null) e.maxLife = e.life;
    if (e.pixels) buildSprite(e, p);
    e.is = function (t) { return this.tag === t || (Array.isArray(this.tags) && this.tags.indexOf(t) >= 0); };
    e.destroy = function () { this.dead = true; };
    ents.push(e);
    if (e.init) e.init.call(e, e);
    return e;
  };
  G.remove = function (e) { if (e) e.dead = true; };
  G.all = function (tag) {
    var out = [];
    for (var i = 0; i < ents.length; i++) { var e = ents[i]; if (!e.dead && (tag == null || e.is(tag))) out.push(e); }
    return out;
  };
  G.first = function (tag) { for (var i = 0; i < ents.length; i++) if (!ents[i].dead && ents[i].is(tag)) return ents[i]; return null; };
  G.count = function (tag) { return G.all(tag).length; };
  G.clear = function (tag) { G.all(tag).forEach(function (e) { e.dead = true; }); };
  G.each = function (tag, fn) { G.all(tag).forEach(fn); };

  function buildSprite(e, p) {
    var rows = e.pixels, pal = e.palette || {}, ps = e.pixelSize || 4;
    var cols = 0; rows.forEach(function (r) { cols = Math.max(cols, r.length); });
    var key = JSON.stringify([rows, pal]);
    var img = spriteCache[key];
    if (!img) {
      img = document.createElement('canvas'); img.width = cols; img.height = rows.length;
      var c = img.getContext('2d');
      rows.forEach(function (r, y) {
        for (var x = 0; x < r.length; x++) {
          var ch = r[x]; if (ch === '.' || ch === ' ') continue;
          c.fillStyle = pal[ch] || e.color || '#fff'; c.fillRect(x, y, 1, 1);
        }
      });
      spriteCache[key] = img;
    }
    e._img = img;
    e.shape = 'sprite';
    if (p.w == null) e.w = cols * ps;
    if (p.h == null) e.h = rows.length * ps;
  }

  /* ---------------- collisions ---------------- */
  function aabb(a, b) {
    return Math.abs(a.x - b.x) * 2 < a.w + b.w && Math.abs(a.y - b.y) * 2 < a.h + b.h;
  }
  G.hit = function (a, b) {
    if (!a || !b || a.dead || b.dead || a === b) return false;
    if (a.shape === 'circle' && b.shape === 'circle') {
      var rr = rad(a) + rad(b), dx = a.x - b.x, dy = a.y - b.y;
      return dx * dx + dy * dy < rr * rr;
    }
    if (a.shape === 'circle' || b.shape === 'circle') {
      var c = a.shape === 'circle' ? a : b, r = c === a ? b : a;
      var nx = Math.max(r.x - r.w / 2, Math.min(c.x, r.x + r.w / 2));
      var ny = Math.max(r.y - r.h / 2, Math.min(c.y, r.y + r.h / 2));
      var ddx = c.x - nx, ddy = c.y - ny, cr = rad(c);
      return ddx * ddx + ddy * ddy < cr * cr;
    }
    return aabb(a, b);
  };
  G.hits = function (e, tag) {
    for (var i = 0; i < ents.length; i++) { var o = ents[i]; if (o !== e && !o.dead && o.is(tag) && G.hit(e, o)) return o; }
    return null;
  };
  G.hitAll = function (e, tag) { return G.all(tag).filter(function (o) { return o !== e && G.hit(e, o); }); };
  G.onHit = function (tagA, tagB, fn) { colliders.push({ a: tagA, b: tagB, fn: fn, persist: !scene }); };
  G.pointIn = function (px, py, e) { return px > e.x - e.w / 2 && px < e.x + e.w / 2 && py > e.y - e.h / 2 && py < e.y + e.h / 2; };

  function moveSolid(e, dt) {
    var solids = [];
    for (var i = 0; i < ents.length; i++) { var s = ents[i]; if (s.solid && s !== e && !s.dead) solids.push(s); }
    var prevBottom = e.y + e.h / 2;
    e.hitWall = false;
    e.x += e.vx * dt;
    for (i = 0; i < solids.length; i++) {
      s = solids[i]; if (s.oneWay) continue;
      if (aabb(e, s)) {
        if (e.vx > 0) e.x = s.x - s.w / 2 - e.w / 2; else if (e.vx < 0) e.x = s.x + s.w / 2 + e.w / 2;
        e.vx = e.bounce ? -e.vx * e.bounce : 0; e.hitWall = true;
      }
    }
    e.y += e.vy * dt;
    e.onGround = false; e.hitCeiling = false;
    for (i = 0; i < solids.length; i++) {
      s = solids[i];
      if (!aabb(e, s)) continue;
      var top = s.y - s.h / 2;
      if (s.oneWay) {
        if (e.vy >= 0 && prevBottom <= top + 1) { e.y = top - e.h / 2; e.vy = 0; e.onGround = true; e.ground = s; }
        continue;
      }
      if (e.vy > 0) { e.y = top - e.h / 2; e.onGround = true; e.ground = s; e.vy = e.bounce ? -e.vy * e.bounce : 0; }
      else if (e.vy < 0) { e.y = s.y + s.h / 2 + e.h / 2; e.hitCeiling = true; e.vy = 0; }
    }
    if (e.onGround && e.ground && e.ground.vx) e.x += e.ground.vx * dt;
  }

  /* ---------------- goal-driven AI ---------------- */
  // G.brain(e, [{ name, score:(e)=>number, enter?:(e)=>{}, act:(e,dt)=>{} }], { think: 0.2 })
  G.brain = function (e, goals, o) {
    o = o || {};
    e.brain = { goals: goals || [], think: o.think || 0.2, t: 0, current: null };
    e.goal = null;
    return e.brain;
  };
  function thinkBrain(e, dt) {
    var b = e.brain; if (!b || !b.goals.length) return;
    b.t -= dt;
    if (b.t <= 0 || !b.current) {
      b.t = b.think;
      var best = null, bs = -Infinity;
      for (var i = 0; i < b.goals.length; i++) {
        var g = b.goals[i], s = g.score ? +g.score(e) : 0;
        if (s > bs) { bs = s; best = g; }
      }
      if (best && best !== b.current) { b.current = best; e.goal = best.name; if (best.enter) best.enter(e); }
    }
    if (b.current && b.current.act) b.current.act(e, dt);
  }

  function stepEnt(e, dt) {
    if (e.brain) thinkBrain(e, dt);
    if (e.update) e.update.call(e, dt, e);
    if (e.dead) return;
    e.vx += e.ax * dt;
    e.vy += (e.ay + e.gravity) * dt;
    if (e.drag) { var f = Math.max(0, 1 - e.drag * dt); e.vx *= f; e.vy *= f; }
    if (e.maxSpeed) { var sp = Math.hypot(e.vx, e.vy); if (sp > e.maxSpeed) { e.vx *= e.maxSpeed / sp; e.vy *= e.maxSpeed / sp; } }
    if (e.collide) moveSolid(e, dt); else { e.x += e.vx * dt; e.y += e.vy * dt; }
    e.angle += e.spin * dt;
    var bw = G.world ? G.world.w : W, bh = G.world ? G.world.h : H;
    if (e.bounded) {
      var hw = e.w / 2, hh = e.h / 2;
      if (e.x < hw) { e.x = hw; e.vx = e.bounce ? Math.abs(e.vx) * e.bounce : 0; }
      if (e.x > bw - hw) { e.x = bw - hw; e.vx = e.bounce ? -Math.abs(e.vx) * e.bounce : 0; }
      if (e.y < hh) { e.y = hh; e.vy = e.bounce ? Math.abs(e.vy) * e.bounce : 0; }
      if (e.y > bh - hh) { e.y = bh - hh; e.vy = e.bounce ? -Math.abs(e.vy) * e.bounce : 0; if (!e.bounce) e.onGround = true; }
    }
    if (e.wrap) {
      if (e.x < -e.w / 2) e.x += bw + e.w; else if (e.x > bw + e.w / 2) e.x -= bw + e.w;
      if (e.y < -e.h / 2) e.y += bh + e.h; else if (e.y > bh + e.h / 2) e.y -= bh + e.h;
    }
    if (e.cull) {
      var m = 200, cx = e.fixed ? 0 : G.camera.x, cy = e.fixed ? 0 : G.camera.y;
      if (e.x < cx - m || e.x > cx + W + m || e.y < cy - m || e.y > cy + H + m) e.dead = true;
    }
    if (e.life != null) {
      e.life -= dt;
      if (e.fade) e.alpha = Math.max(0, e.life / e.maxLife);
      if (e.life <= 0) e.dead = true;
    }
  }

  /* ---------------- drawing ---------------- */
  function fillStroke(e) {
    if (e.color && e.color !== 'none') { ctx.fillStyle = e.color; ctx.fill(); }
    if (e.stroke) { ctx.strokeStyle = e.stroke; ctx.lineWidth = e.lineWidth; ctx.stroke(); }
  }
  function rr(x, y, w, h, r) {
    ctx.beginPath();
    if (!r) { ctx.rect(x, y, w, h); return; }
    r = Math.min(r, w / 2, h / 2);
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function fontStr(o) { return (o.bold === false ? '' : 'bold ') + (o.size || 18) + 'px ' + (o.font === 'pixel' ? 'ui-monospace,Menlo,Consolas,monospace' : (o.font || 'system-ui,-apple-system,Segoe UI,Roboto,sans-serif')); }
  function drawEnt(e) {
    if (!e.visible || e.alpha <= 0) return;
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, e.alpha));
    ctx.translate(e.x, e.y);
    if (e.angle) ctx.rotate(e.angle);
    if (e.scale !== 1) ctx.scale(e.scale, e.scale);
    if (e.flip) ctx.scale(-1, 1);
    if (e.glow) { ctx.shadowColor = e.glowColor || e.color; ctx.shadowBlur = e.glow; }
    if (e.draw) e.draw.call(e, ctx, e);
    else switch (e.shape) {
      case 'circle': ctx.beginPath(); ctx.arc(0, 0, rad(e), 0, TAU); fillStroke(e); break;
      case 'tri': ctx.beginPath(); ctx.moveTo(e.w / 2, 0); ctx.lineTo(-e.w / 2, -e.h / 2); ctx.lineTo(-e.w / 2, e.h / 2); ctx.closePath(); fillStroke(e); break;
      case 'poly':
        if (e.points && e.points.length) { ctx.beginPath(); ctx.moveTo(e.points[0][0], e.points[0][1]); for (var i = 1; i < e.points.length; i++) ctx.lineTo(e.points[i][0], e.points[i][1]); ctx.closePath(); fillStroke(e); }
        break;
      case 'text':
        ctx.font = fontStr(e); ctx.textAlign = e.align || 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = e.color; ctx.fillText(String(e.text), 0, 0); break;
      case 'sprite':
        ctx.imageSmoothingEnabled = false; if (e._img) ctx.drawImage(e._img, -e.w / 2, -e.h / 2, e.w, e.h); break;
      default: rr(-e.w / 2, -e.h / 2, e.w, e.h, e.radius); fillStroke(e);
    }
    ctx.restore();
  }
  G.rect = function (x, y, w, h, color, o) {
    o = o || {}; ctx.save(); if (o.alpha != null) ctx.globalAlpha = o.alpha;
    rr(x, y, w, h, o.radius || 0);
    if (color) { ctx.fillStyle = color; ctx.fill(); }
    if (o.stroke) { ctx.strokeStyle = o.stroke; ctx.lineWidth = o.lineWidth || 2; ctx.stroke(); }
    ctx.restore();
  };
  G.circle = function (x, y, r, color, o) {
    o = o || {}; ctx.save(); if (o.alpha != null) ctx.globalAlpha = o.alpha;
    ctx.beginPath(); ctx.arc(x, y, Math.max(0, r), 0, TAU);
    if (color) { ctx.fillStyle = color; ctx.fill(); }
    if (o.stroke) { ctx.strokeStyle = o.stroke; ctx.lineWidth = o.lineWidth || 2; ctx.stroke(); }
    ctx.restore();
  };
  G.line = function (x1, y1, x2, y2, color, width, o) {
    o = o || {}; ctx.save(); if (o.alpha != null) ctx.globalAlpha = o.alpha;
    ctx.strokeStyle = color || '#fff'; ctx.lineWidth = width || 2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); ctx.restore();
  };
  G.text = function (str, x, y, o) {
    o = o || {}; ctx.save();
    if (o.alpha != null) ctx.globalAlpha = Math.max(0, Math.min(1, o.alpha));
    ctx.font = fontStr(o); ctx.textAlign = o.align || 'center'; ctx.textBaseline = o.baseline || 'middle';
    if (o.shadow) { ctx.fillStyle = o.shadow; ctx.fillText(String(str), x + 2, y + 2); }
    ctx.fillStyle = o.color || '#fff'; ctx.fillText(String(str), x, y);
    ctx.restore();
  };
  G.bar = function (x, y, w, h, pct, color, back) {
    G.rect(x, y, w, h, back || 'rgba(255,255,255,0.15)', { radius: h / 2 });
    G.rect(x, y, w * Math.max(0, Math.min(1, pct)), h, color || '#ff5a1f', { radius: h / 2 });
  };

  /* ---------------- fx ---------------- */
  G.shake = function (i, d) { shakeI = i == null ? 8 : i; shakeT = d == null ? 0.25 : d; };
  G.flash = function (c, d) { flashC = c || '#fff'; flashD = flashT = d || 0.15; };
  G.burst = function (x, y, o) {
    o = o || {};
    var n = o.count || 16, cols = o.colors || [o.color || '#fff'], sp = o.speed || 180;
    var base = o.angle != null ? o.angle : 0, spread = o.spread != null ? o.spread : TAU;
    for (var i = 0; i < n; i++) {
      var a = base + (Math.random() - 0.5) * spread, s = sp * (0.3 + Math.random() * 0.7), sz = (o.size || 4) * (0.6 + Math.random() * 0.8);
      G.add({ tag: 'particle', x: x, y: y, w: sz, h: sz, vx: Math.cos(a) * s, vy: Math.sin(a) * s, gravity: o.gravity || 0, drag: o.drag != null ? o.drag : 2,
        color: cols[(Math.random() * cols.length) | 0], shape: o.shape || 'rect', life: (o.life || 0.6) * (0.6 + Math.random() * 0.6), fade: true, z: o.z != null ? o.z : 50, fixed: !!o.fixed, glow: o.glow || 0 });
    }
  };

  /* ---------------- timers & tweens ---------------- */
  G.after = function (s, fn) { var t = { t: s, fn: fn, rep: 0, dead: false, cancel: function () { this.dead = true; } }; timers.push(t); return t; };
  G.every = function (s, fn) { var t = { t: s, fn: fn, rep: s, dead: false, cancel: function () { this.dead = true; } }; timers.push(t); return t; };
  var EASE = {
    linear: function (t) { return t; },
    inQuad: function (t) { return t * t; },
    outQuad: function (t) { return t * (2 - t); },
    inOutQuad: function (t) { return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; },
    outBack: function (t) { var c = 1.70158; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); },
    outBounce: function (t) { var n = 7.5625, d = 2.75; if (t < 1 / d) return n * t * t; if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75; if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375; return n * (t -= 2.625 / d) * t + 0.984375; }
  };
  G.tween = function (obj, to, dur, ease, done) {
    if (typeof ease === 'function') { done = ease; ease = null; }
    var from = {}; for (var key in to) from[key] = obj[key];
    var tw = { obj: obj, from: from, to: to, dur: dur || 0.3, t: 0, ease: EASE[ease || 'outQuad'] || EASE.outQuad, done: done, dead: false, cancel: function () { this.dead = true; } };
    tweens.push(tw); return tw;
  };

  /* ---------------- input ---------------- */
  var KEYMAP = { arrowleft: 'left', arrowright: 'right', arrowup: 'up', arrowdown: 'down', ' ': 'space', spacebar: 'space', enter: 'enter', escape: 'escape', esc: 'escape', shift: 'shift', control: 'ctrl' };
  function nk(key) { key = String(key || '').toLowerCase(); return KEYMAP[key] || key; }
  function press(n) { if (!down.has(n)) pressed.add(n); down.add(n); }
  function release(n) { if (down.has(n)) released.add(n); down.delete(n); }
  function toGame(cx, cy) {
    var r = canvas.getBoundingClientRect();
    G.mouse.x = (cx - r.left) / r.width * W;
    G.mouse.y = (cy - r.top) / r.height * H;
  }
  function bindInput() {
    window.addEventListener('keydown', function (e) {
      var n = nk(e.key);
      if (['left', 'right', 'up', 'down', 'space'].indexOf(n) >= 0) e.preventDefault();
      if (n === 'm' && e.altKey) G.muted = !G.muted;
      press(n); ac();
    });
    window.addEventListener('keyup', function (e) { release(nk(e.key)); });
    window.addEventListener('blur', function () { down.forEach(function (n) { released.add(n); }); down.clear(); });
    canvas.addEventListener('pointerdown', function (e) {
      toGame(e.clientX, e.clientY); G.mouse.down = true; G.mouse.clicked = true; press('mouse'); ac();
      try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
      canvas.focus();
    });
    canvas.addEventListener('pointermove', function (e) { toGame(e.clientX, e.clientY); });
    canvas.addEventListener('pointerup', function (e) { toGame(e.clientX, e.clientY); G.mouse.down = false; G.mouse.released = true; release('mouse'); });
    canvas.addEventListener('pointercancel', function () { G.mouse.down = false; release('mouse'); });
    canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  }
  G.key = function () { for (var i = 0; i < arguments.length; i++) if (down.has(nk(arguments[i]))) return true; return false; };
  G.pressed = function () { for (var i = 0; i < arguments.length; i++) if (pressed.has(nk(arguments[i]))) return true; return false; };
  G.released = function () { for (var i = 0; i < arguments.length; i++) if (released.has(nk(arguments[i]))) return true; return false; };
  G.axisX = function () { return (G.key('right', 'd') ? 1 : 0) - (G.key('left', 'a') ? 1 : 0); };
  G.axisY = function () { return (G.key('down', 's') ? 1 : 0) - (G.key('up', 'w') ? 1 : 0); };
  G.action = function () { return G.pressed('space', 'enter', 'z', 'j', 'mouse'); };
  G.actionHeld = function () { return G.key('space', 'enter', 'z', 'j', 'mouse'); };
  G.jump = function () { return G.pressed('space', 'up', 'w', 'z'); };

  function setupTouch() {
    var isTouch = ('ontouchstart' in window) || (window.matchMedia && matchMedia('(pointer:coarse)').matches);
    if (!isTouch || touchMode === false || touchMode === 'mouse') return;
    var wrap = document.createElement('div');
    wrap.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:10;user-select:none;-webkit-user-select:none';
    function btn(label, keyName, css) {
      var b = document.createElement('div');
      b.textContent = label;
      b.style.cssText = 'position:absolute;width:56px;height:56px;border-radius:50%;background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.25);color:rgba(255,255,255,0.8);font:600 18px system-ui;display:flex;align-items:center;justify-content:center;pointer-events:auto;touch-action:none;' + css;
      b.addEventListener('pointerdown', function (e) { e.preventDefault(); press(keyName); ac(); b.style.background = 'rgba(255,255,255,0.3)'; try { b.setPointerCapture(e.pointerId); } catch (_) {} });
      var up = function () { release(keyName); b.style.background = 'rgba(255,255,255,0.12)'; };
      b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up);
      wrap.appendChild(b);
    }
    btn('\u25C0', 'left', 'left:14px;bottom:70px');
    btn('\u25B6', 'right', 'left:122px;bottom:70px');
    btn('\u25B2', 'up', 'left:68px;bottom:124px');
    btn('\u25BC', 'down', 'left:68px;bottom:16px');
    btn('A', 'space', 'right:20px;bottom:84px;width:66px;height:66px');
    btn('B', 'x', 'right:96px;bottom:30px');
    document.body.appendChild(wrap);
  }

  /* ---------------- audio ---------------- */
  var actx = null;
  function ac() {
    if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (_) { actx = null; } }
    if (actx && actx.state === 'suspended') actx.resume();
    return actx;
  }
  G.tone = function (freq, dur, type, vol, slide) {
    var a = ac(); if (!a || G.muted) return;
    freq = freq || 440; dur = dur || 0.1;
    var o = a.createOscillator(), g = a.createGain(), t = a.currentTime;
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(vol == null ? 0.12 : vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + dur + 0.02);
  };
  G.noise = function (dur, vol) {
    var a = ac(); if (!a || G.muted) return;
    dur = dur || 0.2;
    var len = Math.floor(a.sampleRate * dur), buf = a.createBuffer(1, len, a.sampleRate), d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    var s = a.createBufferSource(), g = a.createGain();
    s.buffer = buf; g.gain.value = vol == null ? 0.25 : vol;
    s.connect(g); g.connect(a.destination); s.start();
  };
  function seq(notes, gap, type, vol) { notes.forEach(function (f, i) { setTimeout(function () { G.tone(f, gap * 1.6, type || 'square', vol || 0.1); }, i * gap * 1000); }); }
  G.sound = function (name) {
    switch (name) {
      case 'jump': G.tone(260, 0.16, 'square', 0.1, 380); break;
      case 'coin': seq([988, 1319], 0.07, 'square', 0.09); break;
      case 'shoot': G.tone(880, 0.12, 'sawtooth', 0.07, -640); break;
      case 'laser': G.tone(1400, 0.15, 'square', 0.06, -1200); break;
      case 'hit': G.noise(0.12, 0.2); G.tone(180, 0.12, 'square', 0.1, -100); break;
      case 'explode': G.noise(0.5, 0.35); G.tone(120, 0.4, 'sawtooth', 0.1, -80); break;
      case 'powerup': seq([440, 554, 659, 880], 0.06, 'square', 0.09); break;
      case 'win': seq([523, 659, 784, 1047], 0.1, 'triangle', 0.14); break;
      case 'lose': G.tone(420, 0.6, 'sawtooth', 0.1, -320); break;
      case 'click': case 'select': G.tone(660, 0.05, 'triangle', 0.12); break;
      case 'bounce': G.tone(520, 0.06, 'sine', 0.15, 200); break;
      case 'step': G.tone(140, 0.04, 'triangle', 0.08); break;
      default: G.tone(440, 0.08);
    }
  };

  /* ---------------- utils ---------------- */
  G.rand = function (a, b) { if (a == null) return Math.random(); if (b == null) { b = a; a = 0; } return a + Math.random() * (b - a); };
  G.randInt = function (a, b) { if (b == null) { b = a; a = 0; } return Math.floor(a + Math.random() * (b - a + 1)); };
  G.pick = function (arr) { return arr[(Math.random() * arr.length) | 0]; };
  G.chance = function (p) { return Math.random() < p; };
  G.clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  G.lerp = function (a, b, t) { return a + (b - a) * t; };
  G.approach = function (v, t, s) { return v < t ? Math.min(v + s, t) : Math.max(v - s, t); };
  G.dist = function (a, b, c, d) { if (typeof a === 'object') return Math.hypot(a.x - b.x, a.y - b.y); return Math.hypot(c - a, d - b); };
  G.angleTo = function (a, b) { return Math.atan2(b.y - a.y, b.x - a.x); };
  G.hsl = function (h, s, l, a) { return 'hsla(' + h + ',' + (s == null ? 80 : s) + '%,' + (l == null ? 60 : l) + '%,' + (a == null ? 1 : a) + ')'; };
  G.save = function (key, v) { var kk = 'grudge:' + key; memStore[kk] = v; try { localStorage.setItem(kk, JSON.stringify(v)); } catch (_) {} };
  G.load = function (key, def) {
    var kk = 'grudge:' + key;
    try { var s = localStorage.getItem(kk); if (s != null) return JSON.parse(s); } catch (_) {}
    return memStore[kk] !== undefined ? memStore[kk] : def;
  };

  /* ---------------- loop ---------------- */
  function update(dt) {
    if (pending) { var p = pending; pending = null; switchScene(p.name, p.data); }
    G.time += dt;
    for (var i = 0; i < timers.length; i++) {
      var t = timers[i]; if (t.dead) continue;
      t.t -= dt;
      if (t.t <= 0) { t.fn(); if (t.rep) t.t += t.rep; else t.dead = true; }
    }
    timers = timers.filter(function (t) { return !t.dead; });
    for (i = 0; i < tweens.length; i++) {
      var tw = tweens[i]; if (tw.dead) continue;
      tw.t += dt; var u = Math.min(1, tw.t / tw.dur), e = tw.ease(u);
      for (var key in tw.to) tw.obj[key] = tw.from[key] + (tw.to[key] - tw.from[key]) * e;
      if (u >= 1) { tw.dead = true; if (tw.done) tw.done(); }
    }
    tweens = tweens.filter(function (t) { return !t.dead; });
    if (scene && scene.update) scene.update.call(scene, dt);
    var list = ents.slice();
    for (i = 0; i < list.length; i++) if (!list[i].dead) stepEnt(list[i], dt);
    for (i = 0; i < colliders.length; i++) {
      var c = colliders[i], A = G.all(c.a), B = G.all(c.b);
      for (var a = 0; a < A.length; a++) for (var b = 0; b < B.length; b++) {
        if (A[a] !== B[b] && !A[a].dead && !B[b].dead && G.hit(A[a], B[b])) c.fn(A[a], B[b]);
      }
    }
    for (i = ents.length - 1; i >= 0; i--) if (ents[i].dead) ents.splice(i, 1);
    var cam = G.camera;
    if (cam.target) {
      var tx = cam.target.x - W / 2, ty = cam.target.y - H / 2;
      var l = 1 - Math.pow(1 - Math.min(1, cam.lerp), dt * 60);
      cam.x += (tx - cam.x) * l; cam.y += (ty - cam.y) * l;
    }
    if (G.world) {
      cam.x = G.clamp(cam.x, 0, Math.max(0, G.world.w - W));
      cam.y = G.clamp(cam.y, 0, Math.max(0, G.world.h - H));
    }
    if (shakeT > 0) shakeT -= dt;
    if (flashT > 0) flashT -= dt;
  }
  function render() {
    ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.globalAlpha = 1;
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    var cam = G.camera;
    G.mouse.wx = (G.mouse.x - W / 2) / cam.zoom + W / 2 + cam.x;
    G.mouse.wy = (G.mouse.y - H / 2) / cam.zoom + H / 2 + cam.y;
    ctx.save();
    if (shakeT > 0) ctx.translate((Math.random() * 2 - 1) * shakeI, (Math.random() * 2 - 1) * shakeI);
    ctx.save();
    ctx.translate(W / 2, H / 2); ctx.scale(cam.zoom, cam.zoom); ctx.translate(-W / 2 - cam.x, -H / 2 - cam.y);
    if (scene && scene.draw) scene.draw.call(scene, ctx);
    var sorted = ents.slice().sort(function (a, b) { return a.z - b.z; });
    for (var i = 0; i < sorted.length; i++) if (!sorted[i].fixed) drawEnt(sorted[i]);
    ctx.restore();
    for (i = 0; i < sorted.length; i++) if (sorted[i].fixed) drawEnt(sorted[i]);
    ctx.restore();
    if (scene && scene.hud) scene.hud.call(scene, ctx);
    if (flashT > 0 && flashC) { ctx.globalAlpha = Math.max(0, flashT / flashD) * 0.6; ctx.fillStyle = flashC; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
  }
  function loop(now) {
    if (!running || errored) return;
    var dt = Math.min(1 / 30, Math.max(0, (now - last) / 1000));
    last = now;
    try {
      if (!G.paused) update(dt);
      else if (pending) update(0);
      render();
    } catch (err) {
      report((err && err.message) || String(err), lineFromStack(err));
      return;
    }
    G.frame++;
    pressed.clear(); released.clear();
    G.mouse.clicked = false; G.mouse.released = false;
    requestAnimationFrame(loop);
  }

  /* ---------------- host messages ---------------- */
  window.addEventListener('message', function (ev) {
    var d = ev.data || {};
    if (d.type === 'grudge:snapshot') {
      try {
        var c = document.createElement('canvas'); c.width = 384; c.height = 216;
        var x = c.getContext('2d'); x.fillStyle = bg; x.fillRect(0, 0, 384, 216);
        var s = Math.min(384 / canvas.width, 216 / canvas.height), dw = canvas.width * s, dh = canvas.height * s;
        x.drawImage(canvas, (384 - dw) / 2, (216 - dh) / 2, dw, dh);
        parent.postMessage({ type: 'grudge:snapshot', id: d.id, data: c.toDataURL('image/jpeg', 0.62) }, '*');
      } catch (e) { parent.postMessage({ type: 'grudge:snapshot', id: d.id, data: null }, '*'); }
    } else if (d.type === 'grudge:mute') { G.muted = !!d.value; }
    else if (d.type === 'grudge:pause') { G.paused = !!d.value; }
    else if (d.type === 'grudge:focus') { try { canvas && canvas.focus(); } catch (_) {} }
  });
})();
