// Starter games written with the Grudge Engine. Each is a plain script that uses the global G.
export const STARTERS = [
{
  id: 'starter-ember-run',
  title: 'Ember Run',
  genre: 'Platformer',
  description: 'Leap across floating forge platforms, grab embers and reach the anvil flag.',
  tags: ['platformer', 'arcade'],
  code: `G.init({ width: 800, height: 450, bg: '#120c0a' });
G.state.best = G.load('ember-best', 0);

G.scene('title', {
  update() { if (G.action()) G.go('play'); },
  hud() {
    G.text('EMBER RUN', 400, 170, { size: 56, color: '#ff6a1f' });
    G.text('Arrows / WASD to move, Space to jump', 400, 240, { size: 18, color: '#cbb' });
    G.text('Press Space to start', 400, 290, { size: 18, color: '#fff', alpha: 0.5 + Math.sin(G.time * 4) * 0.5 });
    G.text('Best: ' + G.state.best, 400, 340, { size: 16, color: '#ffb36b' });
  }
});

G.scene('play', {
  start() {
    G.world = { w: 3200, h: 450 };
    this.score = 0; this.t = 0;
    const plat = (x, y, w, moving) => G.add({ tag: 'ground', x, y, w, h: 18, color: '#3a2a24', solid: true, radius: 4,
      update: moving ? function (dt) { this.vx = Math.cos(G.time * 1.5) * 90; } : null });
    plat(1600, 440, 3200);
    const layout = [[300,360,160],[520,300,140],[760,250,120,1],[1000,320,160],[1240,260,120],[1480,200,140,1],[1740,300,180],[1980,240,120],[2220,180,140,1],[2460,280,160],[2720,220,140],[2960,330,200]];
    layout.forEach(p => {
      plat(p[0], p[1], p[2], p[3]);
      G.add({ tag: 'ember', x: p[0], y: p[1] - 40, r: 9, shape: 'circle', color: '#ffb020', glow: 14 });
    });
    for (let i = 0; i < 8; i++) G.add({ tag: 'spike', x: 600 + i * 330, y: 424, w: 30, h: 14, color: '#ff3b3b', shape: 'poly',
      points: [[-15,7],[0,-7],[15,7]] });
    G.add({ tag: 'flag', x: 3100, y: 390, w: 20, h: 80, color: '#ffd166' });
    this.p = G.add({ tag: 'player', x: 80, y: 300, w: 26, h: 34, color: '#ff6a1f', radius: 6, gravity: 1500, collide: true, bounded: true, z: 5 });
    G.camera.follow(this.p, 0.1);
  },
  update(dt) {
    const p = this.p; this.t += dt;
    p.vx = G.approach(p.vx, G.axisX() * 260, 2200 * dt);
    if (p.onGround) this.coyote = 0.1; else this.coyote -= dt;
    if (G.jump() && this.coyote > 0) { p.vy = -620; this.coyote = 0; G.sound('jump'); }
    if (G.released('space', 'up', 'w', 'z') && p.vy < -200) p.vy = -200;
    if (p.vx) p.flip = p.vx < 0;
    const e = G.hits(p, 'ember');
    if (e) { e.destroy(); this.score += 10; G.sound('coin'); G.burst(e.x, e.y, { colors: ['#ffb020','#ff6a1f'], count: 12 }); }
    if (G.hits(p, 'spike') || p.y > 440) { G.sound('lose'); G.shake(10); G.go('over', { score: this.score, win: false }); }
    if (G.hits(p, 'flag')) { G.sound('win'); G.go('over', { score: this.score + Math.max(0, 300 - Math.floor(this.t * 5)), win: true }); }
  },
  draw() {
    for (let i = 0; i < 40; i++) G.circle((i * 173) % 3200, 60 + (i * 97) % 220, 1.5, '#ff6a1f', { alpha: 0.3 });
  },
  hud() { G.text('Embers: ' + this.score, 20, 24, { align: 'left', size: 18 }); }
});

G.scene('over', {
  start(d) { this.d = d; if (d.score > G.state.best) { G.state.best = d.score; G.save('ember-best', d.score); } },
  update() { if (G.action()) G.go('play'); },
  hud() {
    G.text(this.d.win ? 'FORGED IT!' : 'BURNED OUT', 400, 180, { size: 50, color: this.d.win ? '#ffd166' : '#ff3b3b' });
    G.text('Score ' + this.d.score + '   Best ' + G.state.best, 400, 250, { size: 20 });
    G.text('Space to play again', 400, 300, { size: 16, color: '#aaa' });
  }
});
G.start('title');`
},
{
  id: 'starter-grudge-arena',
  title: 'Grudge Arena',
  genre: 'Arena',
  description: 'Survive waves of goal-driven foes that hunt, flank, flee and heal with their own brains.',
  tags: ['action', 'ai', 'survival'],
  code: `G.init({ width: 800, height: 450, bg: '#0d0b14' });

G.scene('play', {
  start() {
    this.wave = 0; this.score = 0;
    this.p = G.add({ tag: 'player', x: 400, y: 225, r: 14, shape: 'circle', color: '#4fd1ff', bounded: true, hp: 5, cd: 0, inv: 0, glow: 12 });
    this.next();
  },
  next() {
    this.wave++;
    for (let i = 0; i < 2 + this.wave * 2; i++) this.spawn();
  },
  spawn() {
    const side = G.randInt(3), p = this.p;
    const x = side === 0 ? -20 : side === 1 ? 820 : G.rand(800), y = side === 2 ? -20 : side === 3 ? 470 : G.rand(450);
    const e = G.add({ tag: 'foe', x, y, r: 12, shape: 'circle', color: '#ff4d6d', hp: 3, maxHp: 3, speed: G.rand(90, 130) });
    G.brain(e, [
      { name: 'hunt', score: f => 0.6, act: (f, dt) => { const a = G.angleTo(f, p); f.vx = Math.cos(a) * f.speed; f.vy = Math.sin(a) * f.speed; } },
      { name: 'flank', score: f => G.dist(f, p) < 220 && f.hp > 1 ? 0.7 + Math.sin(G.time + f.speed) * 0.2 : 0,
        act: (f, dt) => { const a = G.angleTo(f, p) + 1.2; f.vx = Math.cos(a) * f.speed * 1.1; f.vy = Math.sin(a) * f.speed * 1.1; } },
      { name: 'flee', score: f => f.hp === 1 ? 0.9 : 0,
        act: (f, dt) => { const a = G.angleTo(p, f); f.vx = Math.cos(a) * f.speed; f.vy = Math.sin(a) * f.speed; f.hp = Math.min(f.maxHp, f.hp + dt * 0.4); } }
    ], { think: 0.3 });
    e.color = '#ff4d6d';
  },
  update(dt) {
    const p = this.p;
    p.vx = G.axisX() * 240; p.vy = G.axisY() * 240;
    p.cd -= dt; p.inv -= dt;
    if ((G.actionHeld() || G.mouse.down) && p.cd <= 0) {
      p.cd = 0.18;
      const a = G.mouse.down ? Math.atan2(G.mouse.y - p.y, G.mouse.x - p.x) : (this.aim || 0);
      G.add({ tag: 'bullet', x: p.x, y: p.y, r: 4, shape: 'circle', color: '#fff', vx: Math.cos(a) * 600, vy: Math.sin(a) * 600, cull: true, glow: 8 });
      G.sound('shoot');
    }
    if (G.axisX() || G.axisY()) this.aim = Math.atan2(G.axisY(), G.axisX());
    G.each('foe', f => {
      f.color = f.goal === 'flee' ? '#ffd166' : f.goal === 'flank' ? '#c77dff' : '#ff4d6d';
      const b = G.hits(f, 'bullet');
      if (b) { b.destroy(); f.hp--; G.burst(f.x, f.y, { color: f.color, count: 6 }); G.sound('hit');
        if (f.hp <= 0) { f.destroy(); this.score += 10; G.burst(f.x, f.y, { colors: ['#ff4d6d','#fff'], count: 20 }); G.shake(4); } }
      if (G.hit(f, p) && p.inv <= 0) { p.hp--; p.inv = 1; G.flash('#ff0000'); G.shake(8); G.sound('hit');
        if (p.hp <= 0) G.go('over', { score: this.score, wave: this.wave }); }
    });
    p.alpha = p.inv > 0 ? 0.4 + Math.sin(G.time * 30) * 0.3 : 1;
    if (G.count('foe') === 0) this.next();
  },
  draw() { for (let x = 0; x < 800; x += 40) G.line(x, 0, x, 450, '#1a1726', 1); for (let y = 0; y < 450; y += 40) G.line(0, y, 800, y, '#1a1726', 1); },
  hud() {
    G.text('Wave ' + this.wave, 20, 22, { align: 'left', size: 18 });
    G.text('Score ' + this.score, 780, 22, { align: 'right', size: 18 });
    for (let i = 0; i < this.p.hp; i++) G.circle(26 + i * 18, 48, 6, '#4fd1ff');
    G.text('red = hunting   purple = flanking   yellow = fleeing & healing', 400, 435, { size: 12, color: '#777', bold: false });
  }
});
G.scene('over', {
  start(d) { this.d = d; },
  update() { if (G.action()) G.go('play'); },
  hud() {
    G.text('DEFEATED', 400, 180, { size: 52, color: '#ff4d6d' });
    G.text('Wave ' + this.d.wave + '  •  Score ' + this.d.score, 400, 245, { size: 20 });
    G.text('Space or tap to fight again', 400, 295, { size: 16, color: '#aaa' });
  }
});
G.start('play');`
},
{
  id: 'starter-neon-dodge',
  title: 'Neon Dodge',
  genre: 'Arcade',
  description: 'Weave through a storm of neon shards. How long can you last?',
  tags: ['arcade', 'endless'],
  code: `G.init({ width: 450, height: 800, bg: '#07070c' });
G.scene('play', {
  start() {
    this.t = 0; this.best = G.load('dodge-best', 0);
    this.p = G.add({ tag: 'player', x: 225, y: 700, w: 30, h: 30, color: '#00f5d4', radius: 6, bounded: true, glow: 18 });
    G.every(0.35, () => {
      const s = G.rand(14, 40);
      G.add({ tag: 'shard', x: G.rand(450), y: -40, w: s, h: s, color: G.hsl(G.rand(280, 340), 90, 60), vy: G.rand(220, 320) + this.t * 8, spin: G.rand(-4, 4), cull: true, glow: 10 });
    });
  },
  update(dt) {
    this.t += dt;
    const p = this.p;
    if (G.mouse.down) p.x = G.lerp(p.x, G.mouse.x, 0.25); else p.vx = G.axisX() * 380;
    G.add({ x: p.x, y: p.y + 14, w: 8, h: 8, color: '#00f5d4', life: 0.3, fade: true, vy: 160, z: -1 });
    if (G.hits(p, 'shard')) {
      G.sound('explode'); G.shake(12); G.burst(p.x, p.y, { colors: ['#00f5d4', '#fff'], count: 40 });
      const s = Math.floor(this.t * 10);
      if (s > this.best) G.save('dodge-best', s);
      G.go('over', { s, best: Math.max(s, this.best) });
    }
  },
  hud() { G.text(Math.floor(this.t * 10), 225, 60, { size: 44, color: '#fff' }); }
});
G.scene('over', {
  start(d) { this.d = d; },
  update() { if (G.action()) G.go('play'); },
  hud() {
    G.text('SHATTERED', 225, 330, { size: 46, color: '#f15bb5' });
    G.text('Score ' + this.d.s + '   Best ' + this.d.best, 225, 390, { size: 20 });
    G.text('Tap or Space to retry', 225, 440, { size: 16, color: '#888' });
  }
});
G.start('play');`
},
{
  id: 'starter-brick-forge',
  title: 'Brick Forge',
  genre: 'Breakout',
  description: 'Smash molten bricks with a bouncing ember. Classic breakout, forged hot.',
  tags: ['classic', 'arcade'],
  code: `G.init({ width: 800, height: 450, bg: '#0f0d0d' });
G.scene('play', {
  start(d) {
    this.lives = 3; this.score = 0; this.level = (d && d.level) || 1;
    for (let r = 0; r < 5; r++) for (let c = 0; c < 10; c++)
      G.add({ tag: 'brick', x: 85 + c * 70, y: 60 + r * 28, w: 62, h: 20, radius: 4, color: G.hsl(10 + r * 12, 85, 55), hp: r < this.level - 1 ? 2 : 1 });
    this.pad = G.add({ tag: 'pad', x: 400, y: 420, w: 110, h: 14, radius: 7, color: '#eee', bounded: true });
    this.reset();
  },
  reset() { G.clear('ball'); this.ball = G.add({ tag: 'ball', x: 400, y: 400, r: 8, shape: 'circle', color: '#ffb020', glow: 14, stuck: true }); },
  update(dt) {
    const p = this.pad, b = this.ball;
    if (G.mouse.down) p.x = G.mouse.x; else p.vx = G.axisX() * 520;
    if (b.stuck) { b.x = p.x; b.y = p.y - 18; if (G.action()) { b.stuck = false; b.vx = G.rand(-200, 200); b.vy = -360 - this.level * 30; } return; }
    if (b.x < 8 || b.x > 792) { b.vx *= -1; b.x = G.clamp(b.x, 8, 792); G.sound('bounce'); }
    if (b.y < 8) { b.vy = Math.abs(b.vy); G.sound('bounce'); }
    if (G.hit(b, p) && b.vy > 0) { b.vy = -Math.abs(b.vy); b.vx = (b.x - p.x) * 7; G.sound('bounce'); }
    const k = G.hits(b, 'brick');
    if (k) { b.vy *= -1; k.hp--; G.sound('hit'); if (k.hp <= 0) { k.destroy(); this.score += 10; G.burst(k.x, k.y, { color: k.color, count: 10, gravity: 400 }); } else k.color = '#999'; }
    if (b.y > 460) { this.lives--; G.shake(8); G.sound('lose'); if (this.lives <= 0) G.go('over', { score: this.score }); else this.reset(); }
    if (G.count('brick') === 0) { G.sound('win'); G.go('play', { level: this.level + 1 }); }
  },
  hud() {
    G.text('Score ' + this.score, 20, 20, { align: 'left', size: 16 });
    G.text('Level ' + this.level + '   Lives ' + this.lives, 780, 20, { align: 'right', size: 16 });
    if (this.ball.stuck) G.text('Space / tap to launch', 400, 300, { size: 16, color: '#aaa' });
  }
});
G.scene('over', { start(d) { this.d = d; }, update() { if (G.action()) G.go('play'); },
  hud() { G.text('GAME OVER', 400, 190, { size: 52, color: '#ff6a1f' }); G.text('Score ' + this.d.score, 400, 250, { size: 20 }); G.text('Space to retry', 400, 295, { size: 16, color: '#888' }); } });
G.start('play');`
},
{
  id: 'starter-star-grudge',
  title: 'Star Grudge',
  genre: 'Shooter',
  description: 'Pilot a forge-ship through drifting asteroids. Thrust, turn, blast.',
  tags: ['shooter', 'space'],
  code: `G.init({ width: 800, height: 450, bg: '#05060b' });
const stars = Array.from({ length: 90 }, () => [G.rand(800), G.rand(450), G.rand(0.3, 1)]);
G.scene('play', {
  start() {
    this.score = 0; this.lives = 3; this.lvl = 0;
    this.ship = G.add({ tag: 'ship', x: 400, y: 225, w: 26, h: 18, shape: 'tri', color: '#9be7ff', wrap: true, drag: 0.6, angle: -Math.PI / 2, cd: 0, inv: 2 });
    this.wave();
  },
  rock(x, y, s) {
    const pts = []; for (let i = 0; i < 9; i++) { const a = i / 9 * G.TAU, r = s * G.rand(0.75, 1.1); pts.push([Math.cos(a) * r, Math.sin(a) * r]); }
    G.add({ tag: 'rock', x, y, r: s, w: s * 2, h: s * 2, shape: 'poly', points: pts, color: 'none', stroke: '#c9b8a6', lineWidth: 2, vx: G.rand(-60, 60), vy: G.rand(-60, 60), spin: G.rand(-1, 1), wrap: true, size: s });
  },
  wave() { this.lvl++; for (let i = 0; i < 3 + this.lvl; i++) this.rock(G.chance(0.5) ? G.rand(120) : G.rand(680, 800), G.rand(450), 40); },
  update(dt) {
    const s = this.ship; s.cd -= dt; s.inv -= dt;
    s.angle += G.axisX() * 4.5 * dt;
    if (G.key('up', 'w')) { s.vx += Math.cos(s.angle) * 380 * dt; s.vy += Math.sin(s.angle) * 380 * dt;
      G.add({ x: s.x - Math.cos(s.angle) * 14, y: s.y - Math.sin(s.angle) * 14, w: 5, h: 5, color: '#ff8a3d', life: 0.25, fade: true }); }
    if (G.actionHeld() && s.cd <= 0) { s.cd = 0.2; G.sound('laser');
      G.add({ tag: 'shot', x: s.x, y: s.y, r: 3, shape: 'circle', color: '#fff', vx: Math.cos(s.angle) * 520 + s.vx, vy: Math.sin(s.angle) * 520 + s.vy, life: 0.9, wrap: true }); }
    s.alpha = s.inv > 0 ? 0.4 : 1;
    G.each('rock', r => {
      const sh = G.hits(r, 'shot');
      if (sh) { sh.destroy(); r.destroy(); this.score += Math.round(100 / r.size * 10); G.sound('explode'); G.burst(r.x, r.y, { color: '#c9b8a6', count: 14 });
        if (r.size > 15) { this.rock(r.x, r.y, r.size / 2); this.rock(r.x, r.y, r.size / 2); } }
      else if (s.inv <= 0 && G.dist(r, s) < r.size + 8) { this.lives--; s.inv = 2; s.x = 400; s.y = 225; s.vx = s.vy = 0; G.shake(10); G.sound('lose');
        if (this.lives <= 0) G.go('over', { score: this.score }); }
    });
    if (G.count('rock') === 0) this.wave();
  },
  draw() { stars.forEach(t => G.circle(t[0], t[1], t[2], '#fff', { alpha: t[2] * 0.6 })); },
  hud() { G.text('Score ' + this.score, 20, 20, { align: 'left', size: 16 }); G.text('Ships ' + this.lives, 780, 20, { align: 'right', size: 16 }); }
});
G.scene('over', { start(d) { this.d = d; }, update() { if (G.action()) G.go('play'); },
  hud() { G.text('SHIP LOST', 400, 190, { size: 50, color: '#9be7ff' }); G.text('Score ' + this.d.score, 400, 250, { size: 20 }); G.text('Space to fly again', 400, 295, { size: 16, color: '#888' }); } });
G.start('play');`
}
];

export const BLANK = `G.init({ width: 800, height: 450, bg: '#111' });

G.scene('play', {
  start() {
    this.player = G.add({ tag: 'player', x: 400, y: 225, w: 32, h: 32, color: '#ff6a1f', bounded: true, radius: 6 });
  },
  update(dt) {
    this.player.vx = G.axisX() * 260;
    this.player.vy = G.axisY() * 260;
  },
  hud() {
    G.text('Describe your game in the Forge to replace this!', 400, 40, { size: 18, color: '#aaa' });
  }
});

G.start('play');`;
