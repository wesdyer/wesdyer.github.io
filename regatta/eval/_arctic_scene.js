// Probe: Glacier Sound's animals in the venue — steps the sim headless, parks a see-through
// player on each subject (the camera follows the player; animals ignore a boat under 0.2
// opacity) and writes the frame plus a 3x crop of the centre.
//   node regatta/eval/_arctic_scene.js <outdir>     (from the repo root)
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
(async () => { const out = process.argv[2] || '/tmp/arctic_scene'; fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1400, height: 860 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
  await p.evaluate(async () => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'arctic', soundEnabled: false, musicEnabled: false, bgSoundEnabled: false }));
    resetGame(); startRace(); await new Promise(r => setTimeout(r, 600));
    for (const el of document.querySelectorAll('.overlay, [id$="-overlay"], #pre-race, #hub')) el.style.display = 'none';
    for (const o of state.boats.slice(1)) { o.x = 1e5; o.y = 1e5; } });
  const step = `(n, me, px, py) => { for (let i = 0; i < n; i++) { if (px !== null) { me.x = px; me.y = py; } me.speed = 0; for (const o of state.boats.slice(1)) { o.x = 1e5; o.y = 1e5; } update(1 / 30); } }`;
  const shot = async (name, fn, arg) => {
    const r = await p.evaluate(fn, Object.assign({ step }, arg || {}));
    const keep = await p.evaluate(({ x, y }) => { const me = state.boats[0], k = { x: me.x, y: me.y, o: me.opacity, m: state.camera.mode };
        me.x = x; me.y = y; me.opacity = 0.05; me.speed = 0; state.camera.mode = 'north'; state.camera.fx = x; state.camera.fy = y; state.camera.rotation = 0; return k; }, r);
    await p.waitForTimeout(300);
    await p.screenshot({ path: path.join(out, name + '.png') });
    await p.evaluate((k) => { const me = state.boats[0]; me.x = k.x; me.y = k.y; me.opacity = k.o; state.camera.mode = k.m; }, keep);
    console.log(name, JSON.stringify(r.note || ''));
  };
  await shot('orcas', ({ step }) => { const S = eval(step), me = state.boats[0]; let W = null;
      for (let i = 0; i < 1200; i++) { S(1, me, 1e5, 1e5); W = Wildlife.debug().orcaPods[2]; if (W.members.some(m => m.up > 0.4 && m.up < 0.55)) break; }
      return { x: W.x, y: W.y, note: W.members.map(m => m.up.toFixed(2)).join(' ') }; });
  await shot('emperors', () => { const C = Wildlife.debug().penguinColonies[0]; return { x: C.home.x, y: C.home.y, note: C.species }; });
  await shot('rounding_colonies', () => { const C = Wildlife.debug().penguinColonies[3]; return { x: C.home.x - 120, y: C.home.y, note: 'macaroni + gentoo' }; });
  await shot('adelie_floe', () => { const G = Wildlife.debug().floeGroups.find(g => g.birds.length); return { x: G.floe.x, y: G.floe.y, note: G.birds.length + ' on floe r' + Math.round(G.floe.radius) }; });
  await shot('adelie_slide', ({ step }) => { const S = eval(step), me = state.boats[0], G = Wildlife.debug().floeGroups.find(g => g.birds.length), F = G.floe;
      S(1, me, F.x + F.radius + 80, F.y); S(20, me, 1e5, 1e5);
      return { x: F.x, y: F.y, note: 'tobogganing to the edge: ' + Wildlife.debug().treks.filter(T => T.floe === F).length }; });
  await shot('seal', () => { const s = Wildlife.debug().lseals.find(q => q.mode === 'haul') || Wildlife.debug().lseals[0]; return { x: s.x, y: s.y, note: s.mode }; });
  await shot('terns', ({ step }) => { const S = eval(step), me = state.boats[0]; S(60, me, 1e5, 1e5); const F = Wildlife.debug().ternFlocks[0]; return { x: F.cx, y: F.cy, note: F.birds.map(b => b.mode).join(',') }; });
  // treks and swimmers, species by species: run until one is seen, then frame it
  const findT = (pred, key) => `(() => { const S = eval(step), me = state.boats[0]; let T = null; for (let i = 0; i < 30 * 200 && !T; i++) { S(1, me, 1e5, 1e5); T = Wildlife.debug().${key}.find(${pred}); } return T; })()`;
  await shot('emperor_toboggan', new Function('a', `const step = a.step; const T = ${findT("T => T.species === 'emperor' && T.dir === 'out' && T.birds.some(b => b.delay <= 0 && !b.done && b.s > 20)", 'treks')}; const p = T ? T.pts[1] : { x: 0, y: 0 }; return { x: p.x, y: p.y, note: T ? 'emperors tobogganing ' + T.birds.length : 'none' };`));
  await shot('gentoo_line', new Function('a', `const step = a.step; const T = ${findT("T => T.species === 'gentoo' && T.dir === 'out' && T.birds.some(b => b.delay <= 0 && !b.done)", 'treks')}; const p = T ? T.pts[1] : { x: 0, y: 0 }; return { x: p.x, y: p.y, note: T ? 'gentoos walking ' + T.birds.length : 'none' };`));
  await shot('gentoo_porpoise', new Function('a', `const step = a.step; const T = ${findT("S => S.species === 'gentoo' && S.t > 3", 'swimmers')}; return { x: T ? T.x : 0, y: T ? T.y : 0, note: T ? 'gentoos porpoising' : 'none' };`));
  await shot('emperor_swim', new Function('a', `const step = a.step; const T = ${findT("S => S.species === 'emperor' && S.t > 3", 'swimmers')}; return { x: T ? T.x : 0, y: T ? T.y : 0, note: T ? 'emperors swimming' : 'none' };`));
  await shot('seal_patrol', () => { const s = Wildlife.debug().lseals.find(q => q.mode === 'swim') || Wildlife.debug().lseals[0]; return { x: s.x, y: s.y, note: s.mode + ' off ' + (s.st.C ? s.st.C.species : 'the pack') }; });
  await shot('tern_roost', ({ step }) => { const S = eval(step), me = state.boats[0]; let T = null; for (let i = 0; i < 30 * 200 && !T; i++) { S(1, me, 1e5, 1e5); for (const F of Wildlife.debug().ternFlocks) { const r = F.birds.filter(b => b.mode === 'roost'); if (r.length >= 2) T = r[0]; } } return { x: T ? T.x : 0, y: T ? T.y : 0, note: T ? 'terns roosting' : 'none' }; });
  console.log(errs.length ? 'errors: ' + errs.join(' | ') : 'no page errors'); await b.close();
  require('child_process').execSync(`python3 -c "
from PIL import Image
import glob
for f in glob.glob('${out}/*.png'):
    if f.endswith('_x3.png'): continue
    im=Image.open(f); w,h=im.size; c=im.crop((w//2-160,h//2-110,w//2+160,h//2+110)).resize((960,660)); c.save(f[:-4]+'_x3.png')
"`);
})();
