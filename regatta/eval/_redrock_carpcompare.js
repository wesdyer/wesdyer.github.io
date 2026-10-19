// Probe: the DRAWN carp against the PAINTED one at game size in the real Redrock view — the same leap at the same
// moments (coming out, the top, falling flat, the slap, the rings), drawn (window.__CARP_DRAWN) and painted, 1x and 3x.
// Writes <out>.png.   node regatta/eval/_redrock_carpcompare.js <out.png>
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
(async () => { const out = process.argv[2]; const dir = out + '_f'; fs.mkdirSync(dir, { recursive: true });
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 400, height: 300 } });
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
  await p.evaluate(async () => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'redrock', soundEnabled: false, musicEnabled: false, bgSoundEnabled: false }));
    resetGame(); startRace(); await new Promise(r => setTimeout(r, 400)); window.showRaceMessage = () => {};
    for (const el of document.querySelectorAll('.overlay, [id$="-overlay"], #pre-race, #hub, .hud, #minimap')) el.style.display = 'none'; });
  await p.waitForTimeout(1500);
  // a spot near a wall, on water
  await p.evaluate(() => { state.paused = true; for (const o of state.boats) { o.x = 1e5; o.y = 1e5; }
    let spot = null; for (let k = 0; k < 4000 && !spot; k++) { const x = -1800 + (Math.random() - 0.5) * 1600, y = -700 + (Math.random() - 0.5) * 1600;
      if (pointOnLand(x, y)) continue; let near = false, clear = true; for (let a = 0; a < 16; a++) { const ca = Math.cos(a / 16 * 6.283), sa = Math.sin(a / 16 * 6.283); if (pointOnLand(x + ca * 90, y + sa * 90)) near = true; if (pointOnLand(x + ca * 40, y + sa * 40)) clear = false; } if (near && clear) spot = { x, y }; }
    window.__spot = spot; });
  const moments = [['out', 0.06], ['rising', 0.12], ['top', 0.17], ['falling', 0.27], ['slap', 0.4], ['rings', 1.2]];
  for (const drawn of [true, false]) for (const [nm, t] of moments) {
    await p.evaluate(({ drawn, t }) => { window.__CARP_DRAWN = drawn; const s = window.__spot, L = { kind: 'carp', x: s.x, y: s.y, h: 0.6, t, dur: 0.34, size: 1, hop: 22, roll: 1, silver: false, i: 3 };
      state.camera.x = s.x + 4; state.camera.y = s.y - 4; state.camera.rotation = 0; const d = Wildlife.debug(); d.leaps.length = 0; d.leaps.push(L); Wildlife.art.setT && 0; draw(); }, { drawn, t });
    await p.screenshot({ path: path.join(dir, `${drawn ? 'drawn' : 'painted'}_${nm}.png`) });
  }
  await b.close();
  const { execSync } = require('child_process');
  execSync(`python3 -c "
from PIL import Image, ImageDraw
ms=['out','rising','top','falling','slap','rings']
W=6*130; out=Image.new('RGB',(W,2*(130+150)+20),(30,30,34)); d=ImageDraw.Draw(out)
for r,kind in enumerate(['drawn','painted']):
  for i,m in enumerate(ms):
    im=Image.open('${dir}/'+kind+'_'+m+'.png')
    a=im.crop((135,85,265,215)); out.paste(a,(i*130,r*280+16))
    b2=im.crop((175,125,225,175)).resize((150,150),Image.LANCZOS); out.paste(b2,(i*130-10 if i else 0,r*280+150))
  d.text((4,r*280+2),kind+'  (top: game scale 1x; below: 3x)',fill=(240,240,240))
for i,m in enumerate(ms): d.text((i*130+4,555),m,fill=(240,240,0))
out.save('${out}')"`);
  console.log('ok'); })();
