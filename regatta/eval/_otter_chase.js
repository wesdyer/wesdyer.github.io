// Probe: the shark's surface chases, frame by frame — after a sea lion in open water (fin up, the
// group porpoising off, a lunge) and after a sea otter caught out of the kelp (it bolts for the bed).
//   node regatta/eval/_otter_chase.js <outdir>     (from the repo root)
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
(async () => { const out = process.argv[2] || '/tmp/otter_chase'; fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1400, height: 860 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
  await p.evaluate(async () => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'otter', soundEnabled: false, musicEnabled: false, bgSoundEnabled: false }));
    resetGame(); startRace(); await new Promise(r => setTimeout(r, 600)); window.requestAnimationFrame = () => 0; await new Promise(r => setTimeout(r, 100));
    for (const el of document.querySelectorAll('.overlay, [id$="-overlay"], #pre-race, #hub')) el.style.display = 'none';
    window.__park = () => { for (const o of state.boats) { o.x = 1e5 + o.id * 300; o.y = 1e5; } };
    for (let i = 0; i < 30 * 20; i++) { __park(); Wildlife.update(1 / 30); } });
  const shot = async (name, x, y) => { await p.evaluate(({ x, y }) => { const c = state.camera; c.mode = 'north'; c.x = x; c.y = y; c.fx = x; c.fy = y; c.rotation = 0; draw(); draw(); }, { x, y }); await p.screenshot({ path: path.join(out, name + '.png') }); };
  // a sea lion chase: a group in open water, a shark 300 u off it, set chasing
  const s0 = await p.evaluate(() => { const d = Wildlife.debug(); const open = (x, y) => { for (let r = 0; r <= 200; r += 40) for (let i = 0; i < 8; i++) if (pointOnLand(x + Math.cos(i * 0.785) * r, y + Math.sin(i * 0.785) * r)) return false; return true; };
    const G = d.slGroups.find(G => G.members.length >= 3 && open(G.x, G.y)); const q = G.members[0], W = d.whites[1]; W.x = G.x - 300; W.y = G.y; W.mode = 'chase'; W.t = 12; W.target = { G, q }; W.depth = 0.05; W.cool = 0; return { x: G.x, y: G.y }; });
  for (let k = 0; k < 10; k++) { const r = await p.evaluate(() => { for (let i = 0; i < 12; i++) { __park(); Wildlife.update(1 / 30); } const W = Wildlife.debug().whites[1]; return { x: W.x, y: W.y, mode: W.mode }; }); await shot('sl_chase_' + k, r.x, r.y); console.log('sl_chase_' + k, r.mode); }
  // an otter out of the kelp
  const o = await p.evaluate(() => { const d = Wildlife.debug(); const kelp = state.course.islands.filter(s => VenueDoc.traits(s).veg === 'kelp'), inK = (x, y) => kelp.some(K => pointInPoly(x, y, K.vertices));
    const open = (x, y) => { for (let r = 0; r <= 300; r += 50) for (let i = 0; i < 8; i++) { const px = x + Math.cos(i * 0.785) * r, py = y + Math.sin(i * 0.785) * r; if (pointOnLand(px, py) || inK(px, py)) return false; } return true; };
    const G = d.seaOtterRafts[1], m = G.members.find(q => !q.pup); let sp = null; for (let r = 400; r < 1200 && !sp; r += 50) for (let i = 0; i < 16 && !sp; i++) { const x = G.cx + Math.cos(i * 0.39) * r, y = G.cy + Math.sin(i * 0.39) * r; if (open(x, y)) sp = { x, y }; }
    m.mode = 'travel'; m.x = sp.x; m.y = sp.y; m.tx = G.cx; m.ty = G.cy; m.away = true; m.homeG = G; m.leg = 'home';
    const W = d.whites[0]; const a = Math.atan2(sp.x - G.cx, -(sp.y - G.cy)); W.x = m.x + Math.sin(a) * 260; W.y = m.y - Math.cos(a) * 260; W.mode = 'chaseOtter'; W.otter = m; W.t = 12; W.depth = 0.05; return { x: m.x, y: m.y }; });
  for (let k = 0; k < 10; k++) { const r = await p.evaluate(() => { for (let i = 0; i < 12; i++) { __park(); Wildlife.update(1 / 30); } const W = Wildlife.debug().whites[0]; return { x: W.x, y: W.y, mode: W.mode }; }); await shot('otter_chase_' + k, r.x, r.y); console.log('otter_chase_' + k, r.mode); }
  console.log(errs.length ? 'errors: ' + errs.join(' | ') : 'no page errors'); await b.close();
  require('child_process').execFileSync('python3', ['-c', `
import glob,sys
from PIL import Image
for f in glob.glob(sys.argv[1]+'/*.png'):
    if f.endswith('_x2.png'): continue
    im=Image.open(f); w,h=im.size; im.crop((w//2-240,h//2-160,w//2+240,h//2+160)).resize((960,640)).save(f[:-4]+'_x2.png')`, out]);
})();
