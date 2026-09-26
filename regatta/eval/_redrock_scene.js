// Probe: Redrock's animals in the venue — where they spawned, and how they behave with a boat
// near. Steps the sim headless, points the camera at each group and writes the frame plus a
// 3x crop of the centre. Also reports how many boils a race puts up and where.
//   node regatta/eval/_redrock_scene.js <outdir>     (from the repo root)
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
(async () => { const out = process.argv[2] || '/tmp/redrock_scene'; fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1400, height: 860 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
  const info = await p.evaluate(async () => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'redrock', soundEnabled: false, musicEnabled: false, bgSoundEnabled: false }));
    resetGame(); startRace(); await new Promise(r => setTimeout(r, 300));
    for (const el of document.querySelectorAll('.overlay, [id$="-overlay"], #pre-race, #hub')) el.style.display = 'none';
    const d = Wildlife.debug();
    return { bands: d.bands.map(G => `${Math.round(G.home.x)},${Math.round(G.home.y)} x${G.members.length}`), coyotes: d.coyotes.map(K => `${Math.round(K.x)},${Math.round(K.y)}`), condors: d.condors.length, stripers: d.stripers.length }; });
  console.log(JSON.stringify(info));
  const shot = async (name, fn, arg) => {
    const r = await p.evaluate(fn, arg);
    // the camera follows the player, so park a see-through player on the target (animals ignore
    // a boat under 0.2 opacity) for the frame, then put it back
    const keep = await p.evaluate(({ x, y }) => { const me = state.boats[0], k = { x: me.x, y: me.y, o: me.opacity, m: state.camera.mode };
        me.x = x; me.y = y; me.opacity = 0.05; me.speed = 0; state.camera.mode = 'north'; state.camera.fx = x; state.camera.fy = y; state.camera.rotation = 0; return k; }, r);
    await p.waitForTimeout(250);
    const file = path.join(out, name + '.png'); await p.screenshot({ path: file });
    await p.evaluate((k) => { const me = state.boats[0]; me.x = k.x; me.y = k.y; me.opacity = k.o; state.camera.mode = k.m; }, keep);
    console.log(name, JSON.stringify(r.note || ''));
  };
  // park all the other boats far away so only the player bothers the animals
  await p.evaluate(() => { for (const o of state.boats.slice(1)) { o.x = 1e5 + Math.random(); o.y = 1e5; } });
  const step = `(n, me, px, py) => { for (let i = 0; i < n; i++) { me.x = px; me.y = py; me.speed = 0; for (const o of state.boats.slice(1)) { o.x = 1e5; o.y = 1e5; } update(1 / 30); } }`;
  // bighorn band 0: boat far (grazing), at 250 (looking), at 90 (bounding)
  for (const [nm, dist, secs] of [['sheep_far', 900, 20], ['sheep_look', 260, 4], ['sheep_bound', 40, 1.2], ['sheep_after', 40, 6]]) {
    await shot(nm, ({ dist, secs, step }) => { const me = state.boats[0], G = Wildlife.debug().bands[0], S = eval(step);
      const w = (() => { for (let r = 20; r < 400; r += 10) for (let a = 0; a < 24; a++) { const x = G.home.x + Math.cos(a / 24 * 6.283) * r, y = G.home.y + Math.sin(a / 24 * 6.283) * r; if (!pointOnLand(x, y)) return { x, y, a: a / 24 * 6.283 }; } })();
      const px = w.x + Math.cos(w.a) * (dist - 20), py = w.y + Math.sin(w.a) * (dist - 20); S(Math.round(secs * 30), me, px, py);
      return { x: G.home.x, y: G.home.y, note: G.members.map(s => s.mode + Math.round(Math.hypot(s.x - me.x, s.y - me.y))).join(',') }; }, { dist, secs, step });
  }
  for (const [nm, dist, secs] of [['coyote_far', 900, 25], ['coyote_look', 220, 3], ['coyote_lope', 40, 1.5]]) {
    await shot(nm, ({ dist, secs, step }) => { const me = state.boats[0], K = Wildlife.debug().coyotes[0], S = eval(step);
      const w = (() => { for (let r = 10; r < 400; r += 10) for (let a = 0; a < 24; a++) { const x = K.x + Math.cos(a / 24 * 6.283) * r, y = K.y + Math.sin(a / 24 * 6.283) * r; if (!pointOnLand(x, y)) return { x, y, a: a / 24 * 6.283 }; } })();
      const px = w.x + Math.cos(w.a) * Math.max(0, dist - 40), py = w.y + Math.sin(w.a) * Math.max(0, dist - 40); S(Math.round(secs * 30), me, px, py);
      return { x: K.x, y: K.y, note: Wildlife.debug().coyotes.map(k => k.mode).join(',') }; }, { dist, secs, step });
  }
  await shot('condors', ({ step }) => { const me = state.boats[0], S = eval(step); S(60, me, -2000, -1000); const C = Wildlife.debug().condors[1]; return { x: C.x, y: C.y, note: Wildlife.debug().condors.map(c => c.mode + ' z' + Math.round(c.z)).join(',') }; }, { step });
  await shot('boil', ({ step }) => { const me = state.boats[0], S = eval(step); let B = null;
      for (let i = 0; i < 90 && !(B && B.t > 8 && B.life - B.t > 10); i++) { S(30, me, -1500, -700); B = Wildlife.debug().stripers.filter(q => q.t > 8 && q.life - q.t > 10)[0]; }
      return { x: B ? B.x : 0, y: B ? B.y : 0, note: Wildlife.debug().stripers.map(b => `${Math.round(b.x)},${Math.round(b.y)} t${Math.round(b.t)}`).join(' ') }; }, { step });
  // a carp mid-jump, then its slap
  for (const [nm, at] of [['carp_air', 0.6], ['carp_slap', 1.15]]) {
    await shot(nm, ({ step, at }) => { const me = state.boats[0], S = eval(step); let L = null;
        for (let i = 0; i < 900 && !L; i++) { S(1, me, -1600, -700); L = Wildlife.debug().leaps.find(q => q.kind === 'carp' && q.t >= 0 && q.t < 0.1); }
        if (L) { while (L.t < at) S(1, me, -1600, -700); }
        return { x: L ? L.x : 0, y: L ? L.y : 0, note: L ? `carp at ${Math.round(L.x)},${Math.round(L.y)} t ${L.t.toFixed(2)}` : 'no carp' }; }, { step, at });
  }
  console.log(errs.length ? 'errors: ' + errs.join(' | ') : 'no page errors'); await b.close();
  const { execSync } = require('child_process');
  execSync(`python3 -c "
from PIL import Image
import glob
for f in glob.glob('${out}/*.png'):
    if f.endswith('_x3.png'): continue
    im=Image.open(f); w,h=im.size; c=im.crop((w//2-160,h//2-110,w//2+160,h//2+110)).resize((960,660)); c.save(f[:-4]+'_x3.png')
"`);
})();
