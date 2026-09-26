// Probe: a boat at racing speed driven straight through an otter raft and a sea-lion group — frames
// every 0.3 s, camera on the boat, to see the animals get out of its way.
//   node regatta/eval/_otter_dodge.js <outdir>     (from the repo root)
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
(async () => { const out = process.argv[2]; fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1400, height: 860 } });
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
  await p.evaluate(async () => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'otter', soundEnabled: false, musicEnabled: false, bgSoundEnabled: false }));
    resetGame(); startRace(); await new Promise(r => setTimeout(r, 600)); window.requestAnimationFrame = () => 0;
    for (const el of document.querySelectorAll('.overlay, [id$="-overlay"], #pre-race, #hub')) el.style.display = 'none';
    for (const o of state.boats) { o.x = 1e5 + o.id * 300; o.y = 1e5; } for (let i = 0; i < 30 * 30; i++) Wildlife.update(1 / 30); });
  for (const [name, pick] of [['otters', 'd.seaOtterRafts[2].members[1]'], ['lions', 'd.slGroups.find(G => G.members.length >= 6).members[0]']]) {
    await p.evaluate((pick) => { const d = Wildlife.debug(), m = eval(pick), me = state.boats[0], h = 1.2; me.heading = h; me.speed = 130 / 60; me.velocity = { x: Math.sin(h) * me.speed, y: -Math.cos(h) * me.speed }; me.opacity = 1;
      me.x = m.x - Math.sin(h) * 420; me.y = m.y + Math.cos(h) * 420; for (const o of state.boats.slice(1)) { o.x = 1e5; o.y = 1e5; } window.__c = { x: m.x, y: m.y }; }, pick);
    for (let k = 0; k < 8; k++) { await p.evaluate(() => { const me = state.boats[0]; for (let i = 0; i < 9; i++) { me.x += me.velocity.x * 2; me.y += me.velocity.y * 2; Wildlife.update(1 / 30); }
        const c = state.camera; c.mode = 'north'; c.x = __c.x; c.y = __c.y; c.fx = c.x; c.fy = c.y; c.rotation = 0; draw(); });
      await p.screenshot({ path: path.join(out, `${name}_${k}.png`), clip: { x: 400, y: 230, width: 600, height: 400 } }); }
  }
  await b.close();
  require('child_process').execFileSync('python3', ['-c', `
import sys
from PIL import Image
for n in ['otters','lions']:
    ims=[Image.open(f'{sys.argv[1]}/{n}_{k}.png') for k in range(8)]
    out=Image.new('RGB',(600*4,400*2))
    for i,im in enumerate(ims): out.paste(im,((i%4)*600,(i//4)*400))
    out.save(f'{sys.argv[1]}/{n}_strip.png')`, out]); })();
