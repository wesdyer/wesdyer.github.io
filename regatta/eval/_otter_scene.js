// Probe: Otter Point's animals in the real game view — steps the sim, parks a see-through player
// on each subject and writes the frame and a 3x crop.
//   node regatta/eval/_otter_scene.js <outdir> [warmSeconds] [spots.json]    (from the repo root)
// spots: [[name, x, y] | [name, "js expression returning {x,y,note}"] ...]
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
(async () => { const out = process.argv[2] || '/tmp/otter_scene'; fs.mkdirSync(out, { recursive: true });
  const warm = +(process.argv[3] || 30);
  const spots = JSON.parse(fs.readFileSync(process.argv[4], 'utf8'));
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1400, height: 860 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
  await p.evaluate(async (warm) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'otter', soundEnabled: false, musicEnabled: false, bgSoundEnabled: false }));
    resetGame(); startRace(); await new Promise(r => setTimeout(r, 600)); window.requestAnimationFrame = () => 0; await new Promise(r => setTimeout(r, 100));
    for (const el of document.querySelectorAll('.overlay, [id$="-overlay"], #pre-race, #hub')) el.style.display = 'none';
    const park = () => { for (const o of state.boats) { o.x = 1e5 + o.id * 300; o.y = 1e5; } };
    for (let i = 0; i < 30 * warm; i++) { park(); update(1 / 30); } park(); }, warm);
  await new Promise(r => setTimeout(r, 4000));   // big prop images load in real time
  for (const s of spots) {
    const r = await p.evaluate((s) => { if (typeof s[1] === 'string') return (0, eval)(s[1]); return { x: s[1], y: s[2] }; }, s);
    await p.evaluate(({ x, y }) => { const me = state.boats[0]; me.x = x; me.y = y; me.opacity = 0.05; me.speed = 0; state.camera.mode = 'north'; state.camera.fx = x; state.camera.fy = y; state.camera.x = x; state.camera.y = y; state.camera.rotation = 0; draw(); }, r);
    for (let i = 0; i < 6; i++) { await new Promise(q => setTimeout(q, 250)); await p.evaluate(() => draw()); }
    await p.evaluate(() => { state.boats[0].x = 1e5; });
    await p.screenshot({ path: path.join(out, s[0] + '.png') }); console.log(s[0], JSON.stringify(r.note || ''), Math.round(r.x), Math.round(r.y));
  }
  console.log(errs.length ? 'errors: ' + errs.join(' | ') : 'no page errors'); await b.close();
  require('child_process').execFileSync('python3', ['-c', `
import glob,sys
from PIL import Image
for f in glob.glob(sys.argv[1]+'/*.png'):
    if f.endswith('_x3.png'): continue
    im=Image.open(f); w,h=im.size; im.crop((w//2-160,h//2-110,w//2+160,h//2+110)).resize((960,660)).save(f[:-4]+'_x3.png')`, out]);
})();
