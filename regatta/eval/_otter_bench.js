// Bench: Otter Point's animals in their poses on plain venue water beside a hull, at game scale and
// enlarged — for judging shape, colour and size against the references.
//   node regatta/eval/_otter_bench.js out.png     (from the repo root)
const { chromium } = require('playwright'); const path = require('path');
(async () => { const out = process.argv[2] || '/tmp/otter_bench.png';
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1600, height: 1450 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
  const url = await p.evaluate(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'otter', soundEnabled: false, musicEnabled: false, bgSoundEnabled: false })); resetGame();
    const A = Wildlife.art, c = document.createElement('canvas'); c.width = 1600; c.height = 1450; const ctx = c.getContext('2d');
    const doc = state.course.doc, water = (doc.palette && (doc.palette.baseColor || doc.palette.heroColor)) || '#2a8f9a';
    ctx.fillStyle = water; ctx.fillRect(0, 0, 1600, 1450);
    const hull = (x, y, s) => { ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.fillStyle = '#f2f2f2'; ctx.strokeStyle = '#333'; ctx.lineWidth = 1 / s; ctx.beginPath(); ctx.moveTo(0, -27.5); ctx.quadraticCurveTo(10, -10, 8, 27.5); ctx.lineTo(-8, 27.5); ctx.quadraticCurveTo(-10, -10, 0, -27.5); ctx.fill(); ctx.stroke(); ctx.restore(); };
    const lab = (t, x, y) => { ctx.fillStyle = '#fff'; ctx.font = '13px sans-serif'; ctx.fillText(t, x, y); };
    const at = (x, y, s, f) => { ctx.save(); ctx.translate(x, y); ctx.scale(s, s); f(); ctx.restore(); };
    A.setT(10); const oc = state.camera; state.camera = null;
    // ── sea otters, x3
    const ot = (o) => Object.assign({ i: 0, x: 0, y: 0, h: 0, mode: 'float', t: 5, bob: 1, roll: 0, paws: 'rest', food: null, tap: 0, ring: 0, ring2: 0, look: 0, kelp: false, size: 1, head: 0.8, trail: [], trailT: 0, dive: 0, pup: false, ph: 0 }, o);
    const otters = [['on back', ot({})], ['kelp wrap', ot({ kelp: true, head: 1 })], ['eating urchin', ot({ mode: 'eat', paws: 'hold', food: 'urchin', tap: 1 })], ['grooming', ot({ paws: 'groom', ph: 0.3, head: 0.6 })],
      ['mother + pup', ot({ pup: true, head: 0.9 })], ['periscope', ot({ look: 1 })], ['rolling', ot({ mode: 'roll', roll: 0.4 })], ['diving', ot({ mode: 'dive', dive: 0.7 })], ['swimming', ot({ mode: 'swim', trail: [{ x: 0, y: 8 }, { x: 0, y: 16 }, { x: 0, y: 24 }, { x: 0, y: 32 }] })]];
    lab('SEA OTTERS x3 (hull x3 for scale)', 20, 24); hull(60, 130, 3);
    otters.forEach(([n, o], i) => { at(170 + i * 140, 130, 3, () => A.drawSeaOtter(ctx, o)); lab(n, 130 + i * 140, 230); });
    // ── sea lions, x3
    const sl = (o) => Object.assign({ i: 0, x: 0, y: 0, h: 0, mode: 'lie', t: 5, up: 0, bark: 0, wet: 0, curl: 0.3, bob: 1, bull: false, size: 1, trail: [], trailT: 0, j: 0, leap: 0 }, o);
    const lions = [['cow dry', sl({}), {}], ['cow wet', sl({ wet: 1, curl: -0.4 }), {}], ['bull', sl({ bull: true, size: 1.25, curl: 0.1 }), {}], ['heads up, bark', sl({ up: 1, bark: 2, bob: 0.15 }), {}],
      ['swimming', sl({ bob: 2 }), { swim: true }], ['porpoising', sl({}), { swim: true, leap: 0.9 }], ['rafting', sl({ flip: 1 }), { swim: true, raft: true }], ['galumph', sl({ mode: 'shuffle', gait: 1.2 }), {}]];
    lab('SEA LIONS x3', 20, 270); hull(60, 380, 3);
    lions.forEach(([n, o, opt], i) => { at(180 + i * 170, 380, 3, () => A.drawSeaLion(ctx, o, opt)); lab(n, 130 + i * 170, 500); });
    // ── great white, x1.8
    const ws = (o) => Object.assign({ x: 0, y: 0, h: 0, depth: 0.5, mode: 'patrol', ph: 1, trail: [], trailT: 0, z: 0, roll: 0, jaw: 0, slick: 0, turn: 0 }, o);
    lab('GREAT WHITE x1.8 (hull x1.8)', 20, 530); hull(60, 660, 1.8);
    const sharks = [['depth 0.8', ws({ depth: 0.8 })], ['patrol 0.5', ws({ depth: 0.5, ph: 2.5 })], ['shallow 0.2', ws({ depth: 0.2 })], ['finning', ws({ depth: 0.0, mode: 'fin', trail: [{ x: 0, y: 30 }, { x: 0, y: 45 }, { x: 0, y: 60 }, { x: 0, y: 75 }] })], ['banking', ws({ depth: 0.3, turn: 0.4 })]];
    sharks.forEach(([n, o], i) => { at(200 + i * 190, 660, 1.8, () => A.drawWhiteShark(ctx, o, 'water')); lab(n, 150 + i * 190, 790); });
    const br = ws({ mode: 'breach', z: 0.85, roll: 0.6, jaw: 1, depth: 0, bx: 0, by: 0 }); at(1190, 650, 1.8, () => A.drawWhiteShark(ctx, br, 'air')); lab('breach', 1150, 790);
    const br2 = ws({ mode: 'breach', z: 0.4, roll: 0.2, jaw: 1, depth: 0, bx: 0, by: 0 }); at(1420, 650, 1.8, () => A.drawWhiteShark(ctx, br2, 'air')); lab('breach rising', 1370, 790);
    // ── blue whale, x0.9
    lab('BLUE WHALE x0.6 (hull x0.6)', 20, 830); hull(40, 1000, 0.6);
    const mott = Array.from({ length: 150 }, (_, i) => [((i * 37) % 82) / 100 - 0.46, Math.sin(i * 7.1) * 0.9, 0.0015 + (i % 4) * 0.0009, i % 9 < 5]);
    const bw = (o) => Object.assign({ j: 0, len: 360, x: 0, y: 0, h: Math.PI / 2, mode: 'under', t: 10, depth: 0.5, ph: 1, fluke: 0, rollT: 99, turn: 0, lunge: 0, sd: 1, mott }, o);
    const whales = [['under 0.5', bw({})], ['surfacing roll', bw({ mode: 'surface', rollT: 1.2 })], ['back + dorsal', bw({ mode: 'surface', rollT: 3.6 })],  ['fluke up', bw({ mode: 'dive', t: 2.5, fluke: 0.9 })]];
    // the lunge, in stages: rolling in, gaping, pouch full, closing, righting
    [[0.3, 0, 0], [0.8, 0.8, 0.3], [1, 0.2, 1], [1, 0, 0.6], [0.4, 0, 0.1]].forEach(([r, g, pp], i) => { const o = bw({ mode: 'surface', lunge: r, roll: r, gape: g, pouch: pp, sd: 1 }); at(170 + i * 130, 1340, 0.45, () => A.drawBlueWhale(ctx, Object.assign(o, { h: 0 }))); lab('lunge ' + i, 140 + i * 130, 1440); });
    whales.forEach(([n, o], i) => { const x = 250 + (i % 3) * 460, y = 930 + Math.floor(i / 3) * 170; at(x, y, 0.6, () => A.drawBlueWhale(ctx, o)); lab(n, x - 60, y + 55); });
    [0.15, 0.8, 2, 4].forEach((t, i) => { at(1000 + i * 150, 1110, 0.6, () => A.drawBlueBlow(ctx, { x: 0, y: 0, t, s: 1, seed: 1 })); lab('blow ' + t + 's', 970 + i * 150, 1215); });
    state.camera = oc;
    return c.toDataURL('image/png'); });
  require('fs').writeFileSync(out, Buffer.from(url.split(',')[1], 'base64'));
  console.log(errs.length ? 'errors: ' + errs.join(' | ') : 'ok', out); await b.close(); })();
