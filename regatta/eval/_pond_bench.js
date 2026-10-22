// Bench: Duckling Pond's painted animals, every pose at x8, then at x1 and x3 beside a hull:
//   turtle basking (dry, wet), the rowing stroke (four phases), under (half way, deep), the peek;
//   pied-billed grebe on top, with chicks, sinking (lo 0.5), hidden (lo 1), diving (sink 0.5), the hidden one going under;
//   duckling swimming, resting, mid-peck, tipped up.
//   node regatta/eval/_pond_bench.js out.png     (from the repo root)
const { chromium } = require('playwright'); const path = require('path');
(async () => { const out = process.argv[2] || '/tmp/pond_bench.png', W = 1800, H = 1000;
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: W, height: H } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.Wildlife && window.School);
  await p.evaluate(async () => { localStorage.setItem('regatta_settings', JSON.stringify({ soundEnabled: false, musicEnabled: false, bgSoundEnabled: false })); School.start(2); await new Promise(r => setTimeout(r, 2500)); });
  await p.evaluate(([W, H]) => { const A = Wildlife.art, c = document.createElement('canvas'); c.width = W; c.height = H; const ctx = c.getContext('2d');
    ctx.fillStyle = '#1f6f78'; ctx.fillRect(0, 0, W, H); const oc = state.camera; state.camera = null; A.setT(10);
    const lab = (t, x, y) => { ctx.fillStyle = '#fff'; ctx.font = '13px sans-serif'; ctx.fillText(t, x, y); };
    const at = (x, y, s, f) => { ctx.save(); ctx.translate(x, y); ctx.scale(s, s); f(); ctx.restore(); };
    const hull = (x, y, s) => at(x, y, s, () => { ctx.fillStyle = '#f2f2f2'; ctx.strokeStyle = '#333'; ctx.lineWidth = 1 / s; ctx.beginPath(); ctx.moveTo(0, -27.5); ctx.quadraticCurveTo(10, -10, 8, 27.5); ctx.lineTo(-8, 27.5); ctx.quadraticCurveTo(-10, -10, 0, -27.5); ctx.fill(); ctx.stroke(); });
    const S = 8, tu = (o) => Object.assign({ ux: 0, uy: 0, uh: 0, size: 1, stk: 0, dep: 0, peek: 0, mud: 0 }, o);
    const gr = (o) => Object.assign({ x: 0, y: 0, h: 0, mode: 'swim', sink: 0, lo: 0, bob: 0, trail: [] }, o);
    // a duckling's t for a tip-up / a peck (its own clocks, as drawDucklingPainted keeps them)
    const hsh = (n, i) => { const x = Math.sin(n * 127.1 + i * 311.7) * 43758.5453; return x - Math.floor(x); };
    let tDab = 0; for (let n = 0; n < 50; n++) if (hsh(n + 77, 0) < 0.55) { tDab = (n + 0.335) / 0.035; break; }
    let tPeck = 0; for (let n = 0; n < 50; n++) if (hsh(n, 0) < 0.75) { tPeck = (n + 0.46) / 0.45; break; }
    const row1 = [['bask', () => A.drawTurtle(ctx, 0, 0, 0, 1, 0, 1)], ['bask, wet', () => A.drawTurtle(ctx, 0, 0, 0, 1, 1, 1)],
      ...[0, 0.25, 0.5, 0.75].map(k => ['stroke ' + k, () => A.drawTurtleUnder(ctx, tu({ stk: k }))]),
      ['under, half', () => A.drawTurtleUnder(ctx, tu({ dep: 0.5, stk: 0.3 }))], ['deep + silt', () => A.drawTurtleUnder(ctx, tu({ dep: 1, mud: 0.6 }))], ['peek', () => A.drawTurtleUnder(ctx, tu({ dep: 0.04, peek: 2.6 }))]];
    row1.forEach(([n, f], i) => { at(90 + i * 180, 110, S, f); lab(n, 50 + i * 180, 205); });
    const row2 = [['grebe', gr({})], ['with chicks', gr({ chicks: true })], ['sinking 0.5', gr({ lo: 0.5 })], ['hidden', gr({ lo: 1 })], ['chicks hidden', gr({ lo: 1, chicks: true })],
      ['dive 0.3', gr({ mode: 'dive', sink: 0.3 })], ['dive 0.6', gr({ mode: 'dive', sink: 0.6 })], ['hidden, going under', gr({ mode: 'dive', lo: 1, sink: 0.5 })], ['coming up', gr({ sink: 0.6 })]];
    row2.forEach(([n, g], i) => { at(90 + i * 180, 330, S, () => A.drawGrebe(ctx, g)); lab(n, 50 + i * 180, 430); });
    const dk = (o) => Object.assign({ x: 0, y: 0, h: 0, swim: 0, trail: [] }, o);
    const row3 = [['duckling swim', 10, dk({ swim: 1 })], ['rest', 10.2, dk({})], ['peck', tPeck + 0.06 / 0.45, dk({})], ['tip-up', tDab + 0.035 / 0.035 * 0.035, dk({})], ['tip-up, end', tDab + 0.055 / 0.035, dk({})]];
    row3.forEach(([n, t, d], i) => { at(90 + i * 180, 560, S, () => A.drawDuckling(ctx, d, t, 0)); lab(n, 50 + i * 180, 650); });
    // game scale and x3 beside a hull: a turtle, the grebe, a duckling (and the drawn ones before, for comparison)
    for (const [x0, s] of [[60, 1], [600, 3]]) {
      hull(x0 + 20, 850, s);
      at(x0 + 40 * s + 20, 850, s, () => { A.drawTurtle(ctx, 0, 0, 0, 1, 0, 1); A.drawGrebe(ctx, gr({ x: 20 })); A.drawDuckling(ctx, dk({ x: 38 }), 10, 1); });
      window.__POND_DRAWN = true;
      at(x0 + 40 * s + 20, 850 + 22 * s, s, () => { A.drawTurtle(ctx, 0, 0, 0, 1, 0, 1); A.drawGrebe(ctx, gr({ x: 20 })); A.drawDuckling(ctx, dk({ x: 38 }), 10, 1); });
      window.__POND_DRAWN = false;
      lab('x' + s + ': hull, turtle, grebe, duckling (painted; the old drawn ones below)', x0, 985);
    }
    state.camera = oc; c.style.cssText = 'position:fixed;left:0;top:0;z-index:99999'; document.body.appendChild(c); }, [W, H]);
  await p.screenshot({ path: out, clip: { x: 0, y: 0, width: W, height: H } }); console.log(out, errs.length ? 'ERRORS: ' + errs.join(' | ') : 'no page errors'); await b.close(); })();
