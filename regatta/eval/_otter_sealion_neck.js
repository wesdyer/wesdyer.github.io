// Probe: the sea lions' NECK JOINT under stress — heads-up looking hard left and right, barking, the gallop's
// bob at both ends and the walk's widest head swing, for the cow and the bull, close up on a bright magenta
// ground so any gap between the head and the body shows at once (Wes: "the head sometimes separates").
//   node regatta/eval/_otter_sealion_neck.js <out.png>     (from the repo root)
const { chromium } = require('playwright'); const path = require('path');
(async () => { const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1680, height: 560 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
  await p.evaluate(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'otter' })); resetGame(); });
  await p.waitForTimeout(900);
  await p.evaluate(() => { const c = document.createElement('canvas'); c.width = 1680; c.height = 560; c.style.cssText = 'position:fixed;left:0;top:0;z-index:99999'; document.body.appendChild(c);
    const g = c.getContext('2d'); g.fillStyle = '#ff00ff'; g.fillRect(0, 0, 1680, 560); state.camera = { x: 0, y: 0, rotation: 0 };
    const base = (bull) => ({ i: 0, x: 0, y: 0, h: 0, mode: 'lie', t: 5, up: 0, bark: 0, wet: 0, curl: 0, bob: 0.13, bull, size: bull ? 1.25 : 1, gait: null, look: null });
    const st = [['up, look left', { up: 1, look: -1.5 }], ['up, look right', { up: 1, look: 1.5 }], ['barking', { up: 1, bark: 2, bob: 0.13 }], ['gallop top', { mode: 'shuffle', gait: 0 }], ['gallop bottom', { mode: 'shuffle', gait: Math.PI }], ['walk swing', { mode: 'climb', gait: Math.PI / 2 }], ['walk swing other', { mode: 'climb', gait: Math.PI * 1.5 }]];
    st.forEach(([lab, o], i) => [false, true].forEach((bull, r) => { const m = Object.assign(base(bull), o), x = 120 + i * 236, y = 160 + r * 270;
      g.save(); g.translate(x, y + 70); g.scale(5.5, 5.5); Wildlife.art.drawSeaLion(g, m, {}); g.restore();
      g.fillStyle = '#000'; g.font = '13px sans-serif'; g.fillText((bull ? 'bull — ' : 'cow — ') + lab, x - 90, y + 115); })); });
  await p.screenshot({ path: process.argv[2] }); console.log(errs.length ? 'errors: ' + errs.join(' | ') : 'ok'); await b.close(); })();
