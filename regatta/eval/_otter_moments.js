// Probe: Otter Point's big moments in the real game view — a great white hitting a sea lion (the
// breach, frame by frame), a great white shadowing the player's boat, a sea-lion stampede off a
// rock, the blue whales' blow and lunge. Writes frames and 2x crops round the subject.
//   node regatta/eval/_otter_moments.js <outdir>     (from the repo root)
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
(async () => { const out = process.argv[2] || '/tmp/otter_moments'; fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1400, height: 860 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
  await p.evaluate(async () => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'otter', soundEnabled: false, musicEnabled: false, bgSoundEnabled: false }));
    resetGame(); startRace(); await new Promise(r => setTimeout(r, 600)); window.requestAnimationFrame = () => 0; await new Promise(r => setTimeout(r, 100));
    for (const el of document.querySelectorAll('.overlay, [id$="-overlay"], #pre-race, #hub, #leaderboard, .leaderboard')) el.style.display = 'none';
    window.__park = () => { for (const o of state.boats.slice(1)) { o.x = 1e5 + o.id * 300; o.y = 1e5; } };
    window.__cam = (x, y) => { state.camera.mode = 'north'; state.camera.x = x; state.camera.y = y; state.camera.fx = x; state.camera.fy = y; state.camera.rotation = 0; };
    window.__step = (n, fx) => { for (let i = 0; i < n; i++) { __park(); if (fx) fx(); Wildlife.update(1 / 30); } };
    const me = state.boats[0]; me.x = 1e5; me.y = 1e5; __step(30 * 30); });
  const shot = async (name, cx, cy, note) => { await p.evaluate(({ cx, cy }) => { __cam(cx, cy); draw(); draw(); }, { cx, cy }); const f = path.join(out, name + '.png'); await p.screenshot({ path: f }); console.log(name, note || ''); return f; };
  // ── the hunt: a sea lion group in view, a shark sent after it; frames through the breach
  const g = await p.evaluate(() => { const d = Wildlife.debug(); const gi = d.slGroups.findIndex(G => G.members.filter(q => !q.gone).length >= 2); const G = d.slGroups[gi];
    // staged in clear water: the shark rightly never strikes by the rocks
    const open = (x, y) => { for (let r = 0; r <= 200; r += 40) for (let i = 0; i < 8; i++) if (pointOnLand(x + Math.cos(i * 0.785) * r, y + Math.sin(i * 0.785) * r)) return false; return true; };
    let sp = null; for (let r = 0; r < 2000 && !sp; r += 100) for (let i = 0; i < 16 && !sp; i++) { const x = G.x + Math.cos(i * 0.39) * r, y = G.y + Math.sin(i * 0.39) * r; if (open(x, y)) sp = { x, y }; }
    G.x = sp.x; G.y = sp.y; G.tx = sp.x; G.ty = sp.y; G.mode = 'raft'; G.t = 100; G.H = Object.assign({}, G.H, { sea: sp }); G.from = null; for (const q of G.members) { q.x = sp.x + q.ox * 0.5; q.y = sp.y + q.oy * 0.5; q.leap = 0; q.z = 0; }
    state.boats[0].x = G.x; state.boats[0].y = G.y + 150; state.boats[0].opacity = 0.05;
    Wildlife.forceHunt(0, gi); return { gi, x: G.x, y: G.y }; });
  let frames = 0;
  for (let k = 0; k < 40; k++) {
    const r = await p.evaluate(() => { const W = Wildlife.debug().whites[0]; let n = 0; while (n < 300 && W.mode === 'stalk') { __step(1); n++; } __step(['sprint', 'strike', 'breach'].includes(W.mode) ? 5 : W.mode === 'thrash' ? 12 : 30); state.camera.x = W.x; return { mode: W.mode, x: W.x, y: W.y, z: W.z, caught: W.caught, d: W.depth }; });
    if (['sprint', 'strike', 'breach', 'thrash', 'feed'].includes(r.mode) || (frames > 0 && frames < 14)) { frames++; await shot('hunt_' + String(frames).padStart(2, '0'), r.x, r.y, JSON.stringify(r)); }
    if (frames >= 14) break;
  }
  // ── after a take: the feeding and the blood plume (force a take)
  const fed = await p.evaluate(() => { const W = Wildlife.debug().whites[0]; if (W.mode === 'breach' || W.mode === 'patrol') { W.caught = true; W.mode = 'thrash'; W.t = 2.5; W.slick = 1; W.lx = W.x; W.ly = W.y; } return W.mode; });
  for (let k = 0; k < 6; k++) { const r = await p.evaluate(() => { for (let i = 0; i < 90; i++) __step(1); const W = Wildlife.debug().whites[0]; return { x: W.x, y: W.y, mode: W.mode, blood: Wildlife.debug().blood.length }; }); await shot('feed_' + k, r.x, r.y, JSON.stringify(r)); }
  // ── the shadow: the player sailing past a patrolling shark
  const sh = await p.evaluate(() => { const W = Wildlife.debug().whites[1]; W.cool = 0; W.mode = 'patrol'; const me = state.boats[0]; me.opacity = 1; me.x = W.x + 500; me.y = W.y + 60; me.heading = -Math.PI / 2; me.speed = 3;
    for (let i = 0; i < 30 * 14; i++) { __step(1, () => { me.x -= 50 / 30; }); } return { mode: W.mode, x: W.x, y: W.y, bx: me.x, by: me.y }; });
  await shot('shadow', (sh.x + sh.bx) / 2, (sh.y + sh.by) / 2, JSON.stringify(sh));
  // ── a stampede off the big bird rock
  const st = await p.evaluate(() => { const H = Wildlife.debug().slHauls.find(h => h.id === 'prop-458'); const me = state.boats[0]; me.x = H.C.x + 420; me.y = H.C.y; me.opacity = 1;
    for (let i = 0; i < 30 * 3; i++) __step(1, () => { me.x -= 60 / 30; }); return { x: H.C.x, y: H.C.y, modes: H.members.map(m => m.mode).join(',') }; });
  await shot('stampede', st.x + 150, st.y, st.modes);
  await p.evaluate(() => __step(30 * 3, () => {}));
  await shot('stampede2', st.x + 150, st.y);
  // ── the blue whales: a blow and a lunge
  const bw = await p.evaluate(() => { const m = Wildlife.debug().bluePods[0].members[0]; state.boats[0].x = 1e5; let n = 0; while (n < 30 * 120 && !(m.mode === 'surface' && m.rollT > 0.6 && m.rollT < 1.2)) { __step(1); n++; } return { x: m.x, y: m.y, mode: m.mode }; });
  await shot('blue_blow', bw.x, bw.y, JSON.stringify(bw));
  const lu = await p.evaluate(() => { const m = Wildlife.debug().bluePods[0].members[0]; let n = 0; while (n < 30 * 400 && !(m.lunge > 0.9)) { __step(1); n++; } return { x: m.x, y: m.y, lunge: m.lunge, n }; });
  await shot('blue_lunge', lu.x, lu.y, JSON.stringify(lu));
  console.log(errs.length ? 'errors: ' + errs.join(' | ') : 'no page errors'); await b.close();
  require('child_process').execFileSync('python3', ['-c', `
import glob,sys
from PIL import Image
for f in glob.glob(sys.argv[1]+'/*.png'):
    if f.endswith('_x2.png'): continue
    im=Image.open(f); w,h=im.size; im.crop((w//2-240,h//2-160,w//2+240,h//2+160)).resize((960,640)).save(f[:-4]+'_x2.png')`, out]);
})();
