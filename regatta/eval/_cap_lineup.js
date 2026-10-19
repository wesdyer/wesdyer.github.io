// Bench: a venue's animals in a row beside the hull, at race scale (x1.2) and x3 — sizes against the boat (Oct 18 2026,
// Wes: "1.5x or less" at sea level). Venues: otter, flats, seatrials, volcanic.
//   node regatta/eval/_cap_lineup.js otter out.png
const { chromium } = require('playwright'); const path = require('path');
const venue = process.argv[2] || 'otter', outPng = process.argv[3] || `/tmp/lineup_${venue}.png`;
(async () => { const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1600, height: 640 } });
  await p.goto('file://' + path.resolve('regatta/index.html')); await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
  await p.evaluate((v) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })); selectVenue(v); resetGame(); }, venue);
  const ROWS = {
    otter: `[['hull', () => hull()], ['great white', () => A.drawWhiteShark(g, { x: 0, y: 0, h: 0, depth: 0, mode: 'patrol', ph: 0, trail: [], trailT: 0, z: 0, roll: 0, jaw: 0, slick: 0, turn: 0 }, 'water')],
      ['sea otter', () => A.drawSeaOtter(g, { i: 0, x: 0, y: 0, h: 0, mode: 'float', t: 5, bob: 0, roll: 0, paws: 'rest', food: null, tap: 0, ring: 0, ring2: 0, look: 0, kelp: true, size: 1, head: 0.8, trail: [], trailT: 0, dive: 0, pup: true, ph: 0 })],
      ['otter pup alone', () => A.drawSeaOtterPup(g, 0, 0, 0, 19 / 32, 0, true)],
      ['sea lion cow', () => A.drawSeaLion(g, { i: 0, x: 0, y: 0, h: 0, mode: 'lie', up: 0, bark: 0, wet: 0, curl: 0, bob: 0, bull: false, size: 1 })],
      ['sea lion bull', () => A.drawSeaLion(g, { i: 0, x: 0, y: 0, h: 0, mode: 'lie', up: 0, bark: 0, wet: 0, curl: 0, bob: 0, bull: true, size: 1.24 })],
      ['sea lion swimming', () => A.drawSeaLion(g, { j: 0, x: 0, y: 0, h: 0, bob: 0, bull: false, size: 1 }, { swim: true })]]`,
    flats: `[['hull', () => hull()], ['grey seal cow', () => A.drawGreySeal(g, { i: 0, x: 0, y: 0, h: 0, size: 0.91, pal: 4, pup: false, mode: 'haul', side: 1, curl: 0.7, lift: 0, bob: 0, wet: 0, ring: 0, alert: 0, awashOv: 0, spots: [] })],
      ['grey seal bull', () => A.drawGreySeal(g, { i: 0, x: 0, y: 0, h: 0, size: 1.125, pal: 0, pup: false, mode: 'haul', side: 0, curl: 0, lift: 0, bob: 0, wet: 0, ring: 0, alert: 0, awashOv: 0, spots: [] })],
      ['seal pup', () => A.drawGreySeal(g, { i: 0, x: 0, y: 0, h: 0, size: 0.44, pal: 5, pup: true, mode: 'haul', side: 0, curl: 0, lift: 0, bob: 0, wet: 0, ring: 0, alert: 0, awashOv: 0, spots: [] })],
      ['spoonbill', () => A.drawSpoonbill(g, { j: 0, x: 0, y: 0, h: 0, mode: 'wade', sw: 1, step: 0, roost: false, ring: 0 })],
      ['spoonbill flying', () => A.drawSpoonbill(g, { j: 0, x: 0, y: 0, h: 0, mode: 'fly', flap: 0, z: 0, ring: 0 })],
      ['avocet', () => A.drawAvocet(g, { j: 0, x: 0, y: 0, h: 0, mode: 'wade', sw: 1, step: 0, roost: false, ring: 0 })],
      ['avocet flying', () => A.drawAvocet(g, { j: 0, x: 0, y: 0, h: 0, mode: 'fly', flap: 0, z: 0, ring: 0 })],
      ['shore crab', () => A.drawShoreCrab(g, { x: 0, y: 0, h: 0, size: 1, phase: 0, burst: 0, leg: 0, rear: 0, ph: 0, pick: 0, bur: 0, dOv: 0 })]]`,
    seatrials: `[['hull', () => hull()], ['cormorant', () => A.drawCormorant(g, { j: 0, x: 0, y: 0, h: 0, mode: 'swim', t: 0, trail: [], vis: 1, ring: 0 })],
      ['cormorant flying', () => A.drawCormorant(g, { j: 0, x: 0, y: 0, h: 0, mode: 'fly', flap: 0, z: 0, trail: [], vis: 1, ring: 0 })],
      ['gull afloat', () => A.drawGullFloat(g, { j: 0, x: 0, y: 0, h: 0, bob: 0, preen: 0, juv: false, splash: 0 })],
      ['gull flying', () => A.drawClubGullFlying(g, { x: 0, y: 0, h: 0, z: 0, flap: 0, glide: true, mode: 'fly', juv: false, splash: 0 })],
      ['tern', () => A.drawTern(g, { club: true, x: 0, y: 0, h: 0, z: 0, flap: 0, mode: 'shift', a: 0, splash: 0 })],
      ['mackerel boil', () => A.drawMackBoil(g, { i: 0, x: 0, y: 0, k: 1, a: 0, fish: Array.from({ length: 34 }, (_, i) => ({ r: (8 + (i * 13) % 34) * 0.7, a: i * 2.4, v: i % 2 ? 1 : -1, s: 0.8 + (i % 5) * 0.08 })), leaps: [{ x: 6, y: -8, h: 0.6, t: 0.5 }], pops: [] })]]`,
    volcanic: `[['hull', () => hull()], ['booby', () => A.drawBooby(g, { j: 1, x: 0, y: 0, h: 0, z: 0, flap: 1.3, gliding: true, mode: 'fly', t: 0, dive: 0, splash: 0 })],
      ['frigatebird', () => A.drawFrigate(g, { j: 0, x: 0, y: 0, h: 0, z: 0, flap: 0, beats: 0, mode: 'soar', fork: 0 })],
      ['sooty tern', () => A.drawTern(g, { sooty: true, x: 0, y: 0, h: 0, z: 0, flap: Math.asin(0.95), gliding: true, mode: 'wheel', t: 1, splash: 0 })],
      ['crab', () => A.drawCrab(g, { x: 0, y: 0, h: 0, t: 1, ph: 0, leg: 0, burst: 0, pick: 0, size: 1 })]]`,
  };
  const draw = (rowsSrc) => p.evaluate((rowsSrc) => { const A = Wildlife.art, oc = state.camera; state.camera = null; A.setT(10);
    let c = document.getElementById('__lineup'); if (!c) { c = document.createElement('canvas'); c.id = '__lineup'; c.width = 1600; c.height = 640; c.style.cssText = 'position:fixed;left:0;top:0;z-index:99999'; document.body.appendChild(c); }
    const g = c.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#1f4f63'; g.fillRect(0, 0, 1600, 640); g.fillStyle = '#c9b98f'; g.fillRect(0, 0, 1600, 60); g.fillRect(0, 300, 1600, 40);
    const hull = () => { g.fillStyle = '#f2f2f2'; g.strokeStyle = '#333'; g.lineWidth = 0.5; g.beginPath(); g.moveTo(0, -27.5); g.quadraticCurveTo(10, -10, 8, 27.5); g.lineTo(-8, 27.5); g.quadraticCurveTo(-10, -10, 0, -27.5); g.fill(); g.stroke(); };
    const row = new Function('A', 'g', 'hull', 'return ' + rowsSrc)(A, g, hull), cw = 1600 / row.length;
    for (const [sc, y0, lab] of [[1.2, 170, 'x1.2 (race scale)'], [3, 500, 'x3']]) {
      row.forEach(([n, f], i) => { g.save(); g.translate(cw * (i + 0.5), y0); g.scale(sc, sc); try { f(); } catch (e) { console.log(n, e.message); } g.restore(); g.fillStyle = '#fff'; g.font = '13px sans-serif'; g.fillText(n, cw * (i + 0.5) - 40, y0 + 120); });
      g.fillStyle = '#fff'; g.font = '14px sans-serif'; g.fillText(lab, 1460, y0 - 95); }
    state.camera = oc; }, rowsSrc);
  // (three passes: the paintings load on first ask, and a flyer asks for its wings once its body is in)
  await p.waitForTimeout(2500); await draw(ROWS[venue]); await p.waitForTimeout(1200); await draw(ROWS[venue]); await p.waitForTimeout(1200); await draw(ROWS[venue]);
  await p.screenshot({ path: outPng, clip: { x: 0, y: 0, width: 1600, height: 640 } }); await b.close(); })();
