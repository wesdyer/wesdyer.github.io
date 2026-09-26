// Probe: Glowtide's animals in the real game view (night) — steps the sim, parks a see-through
// player on each subject and writes the frame and a 3x crop.
//   node regatta/eval/_glowtide_scene.js <outdir>     (from the repo root)
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
(async () => { const out = process.argv[2] || '/tmp/glowtide_scene'; fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1400, height: 860 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
  await p.evaluate(async () => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'glowtide', soundEnabled: false, musicEnabled: false, bgSoundEnabled: false }));
    resetGame(); startRace(); await new Promise(r => setTimeout(r, 600)); window.requestAnimationFrame = () => 0; await new Promise(r => setTimeout(r, 100));
    for (const el of document.querySelectorAll('.overlay, [id$="-overlay"], #pre-race, #hub')) el.style.display = 'none';
    for (const o of state.boats.slice(1)) { o.x = 1e5; o.y = 1e5; }
    for (let i = 0; i < 30 * 60; i++) { state.boats[0].x = 1e5; update(1 / 30); for (const o of state.boats.slice(1)) { o.x = 1e5; o.y = 1e5; } } });
  const shot = async (name, fn) => {
    const r = await p.evaluate(fn);
    await p.evaluate(({ x, y }) => { const me = state.boats[0]; me.x = x; me.y = y; me.opacity = 0.05; me.speed = 0; state.camera.mode = 'north'; state.camera.fx = x; state.camera.fy = y; state.camera.x = x; state.camera.y = y; state.camera.rotation = 0; draw(); }, r);
    await p.screenshot({ path: path.join(out, name + '.png') }); console.log(name, JSON.stringify(r.note || ''));
  };
  await shot('bloom', () => { const B = Wildlife.debug().jellyBloom; return { x: B.cx, y: B.cy, note: B.jel.length + ' jellies' }; });
  // a boat IN the bloom: the jellies' light must stay under the hull
  await p.evaluate(() => { const B = Wildlife.debug().jellyBloom, o = state.boats[1]; o.x = B.cx + 10; o.y = B.cy; o.heading = 0.6; o.speed = 0; });
  await shot('bloom_boat', () => { const B = Wildlife.debug().jellyBloom; return { x: B.cx + 10, y: B.cy, note: 'boat in the bloom' }; });
  await p.evaluate(() => { const o = state.boats[1]; o.x = 1e5; o.y = 1e5; });
  await shot('manta', () => { const M = Wildlife.debug().mantas[0]; return { x: M.x, y: M.y, note: M.mode }; });
  await shot('dugong', () => { const G = Wildlife.debug().dugongs[1]; return { x: G.x, y: G.y, note: G.mode + (G.calf ? ' + calf' : '') }; });
  await shot('hawksbill_swim', () => { for (let i = 0; i < 30 * 20; i++) { update(1 / 30); const H = Wildlife.debug().hawksbills[1]; if (H.up > 0.6) break; } const H = Wildlife.debug().hawksbills[1]; return { x: H.x, y: H.y, note: H.mode + ' up ' + H.up.toFixed(2) }; });
  await shot('hawksbill_nest', () => { let H = null; for (let i = 0; i < 30 * 300 && !H; i++) { update(1 / 30); H = Wildlife.debug().hawksbills.find(h => h.mode === 'nest'); } return { x: H ? H.x : 0, y: H ? H.y : 0, note: H ? 'nesting' : 'none' }; });
  await shot('foxes', () => { const F = Wildlife.debug().foxFlocks[0], b0 = F.bats[Math.floor(F.bats.length / 2)]; return { x: b0.x, y: b0.y, note: F.bats.length + ' bats' }; });
  console.log(errs.length ? 'errors: ' + errs.join(' | ') : 'no page errors'); await b.close();
  require('child_process').execFileSync('python3', ['-c', `
import glob,sys
from PIL import Image
for f in glob.glob(sys.argv[1]+'/*.png'):
    if f.endswith('_x3.png'): continue
    im=Image.open(f); w,h=im.size; im.crop((w//2-160,h//2-110,w//2+160,h//2+110)).resize((960,660)).save(f[:-4]+'_x3.png')`, out]);
})();
