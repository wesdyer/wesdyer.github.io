// Probe: a leopard seal leaving the ice, frame by frame, in the real scene — a boat comes close
// to a hauled-out seal and it humps to the edge, arcs off, splashes, and goes down and away.
// Frames every 0.35 s, 3x crops around the seal (camera parked on it), stitched into one strip.
//   node regatta/eval/_arctic_sealdive.js <out.png>     (from the repo root)
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
(async () => { const out = process.argv[2] || '/tmp/sealdive.png', dir = out.replace(/\.png$/, '_f'); fs.mkdirSync(dir, { recursive: true });
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1400, height: 860 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
  await p.evaluate(async (process_env_HAUL) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'arctic', soundEnabled: false, musicEnabled: false, bgSoundEnabled: false }));
    resetGame(); startRace(); await new Promise(r => setTimeout(r, 600));
    window.requestAnimationFrame = () => 0; await new Promise(r => setTimeout(r, 100));   // stop the page's own loop: only our steps move the sim
    for (const el of document.querySelectorAll('.overlay, [id$="-overlay"], #pre-race, #hub')) el.style.display = 'none';
    const me = state.boats[0]; for (const o of state.boats.slice(1)) { o.x = 1e5; o.y = 1e5; }
    // wait until a seal is hauled out
    let S = null; for (let i = 0; i < 30 * 200 && !S; i++) { me.x = 1e5; me.y = 1e5; update(1 / 30); for (const o of state.boats.slice(1)) { o.x = 1e5; o.y = 1e5; } S = Wildlife.debug().lseals.find(q => q.mode === 'haul'); }
    window.__S = S;
    if (process_env_HAUL) { S.mode = 'swim'; S.t = 0.01; S.floe = null; S.hauling = null; }   // watch it haul OUT instead
    else S.t = 0.01;   // its rest is over
    me.opacity = 0.05; me.speed = 0; state.camera.mode = 'north'; state.camera.rotation = 0; }, !!process.env.HAUL);
  const frames = [];
  for (let k = 0; k < 21; k++) {
    const info = await p.evaluate(([k, process_env_HAUL]) => { const S = window.__S, me = state.boats[0];
      if (k) for (let i = 0; i < (process_env_HAUL ? (window.__S.mode === 'haul' || window.__S.mode === 'toFloe' && Math.hypot(window.__S.x - window.__S.floe.x, window.__S.y - window.__S.floe.y) < window.__S.floe.radius + 60 ? 5 : 30) : k < 14 ? 3 : 10); i++) { update(1 / 30); for (const o of state.boats.slice(1)) { o.x = 1e5; o.y = 1e5; } }
      const cx = S.sx !== undefined && S.mode !== 'launch' ? (S.sx + S.x) / 2 : S.x, cy = S.sx !== undefined && S.mode !== 'launch' ? (S.sy + S.y) / 2 : S.y;
      window.__c = window.__c ? { x: window.__c.x + (S.x - window.__c.x) * 0.35, y: window.__c.y + (S.y - window.__c.y) * 0.35 } : { x: S.x, y: S.y };   // follows the seal, lagging so its travel shows
      me.x = window.__c.x; me.y = window.__c.y; state.camera.fx = me.x; state.camera.fy = me.y; state.camera.x = me.x; state.camera.y = me.y; draw();
      return `${S.mode}${S.hauling ? ' in' : ''}${S.depth !== undefined && S.mode === 'dive' ? ' d' + S.depth.toFixed(2) : ''}`; }, [k, !!process.env.HAUL]);
    const f = path.join(dir, `f${k}.png`); await p.screenshot({ path: f, clip: { x: 700 - 110, y: 430 - 110, width: 220, height: 220 } }); frames.push([f, info]);
  }
  console.log(frames.map(f => f[1]).join(' → ')); console.log(errs.length ? errs[0] : 'no page errors'); await b.close();
  fs.writeFileSync(dir + '/list.json', JSON.stringify(frames));
  require('child_process').execFileSync('python3', ['-c', `
import json,sys
from PIL import Image, ImageDraw
fr=json.load(open(sys.argv[1])); W=330; im=Image.new('RGB',(W*7,(W+24)*3),(20,20,20)); d=ImageDraw.Draw(im)
for i,(f,l) in enumerate(fr):
  c=Image.open(f).resize((W,W)); x,y=(i%7)*W,(i//7)*(W+24); im.paste(c,(x,y)); d.text((x+6,y+W+4),'%.1fs %s'%((i*0.1) if i<14 else (1.3+(i-13)*0.333),l),fill=(255,255,255))
im.save(sys.argv[2])`, dir + '/list.json', out]);
})();
