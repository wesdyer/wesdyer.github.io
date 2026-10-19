// Drawn size of the Otter Point, Spoonbill Flats and Clubhouse Point animals and Emberfall's sooty tern, at sea level
// (z = 0), each venue loaded so its paintings are asked for: the solid-pixel (alpha > 150) box of each animal drawn
// alone heading up the frame — LENGTH (bill/nose/snout to tail tip) is the box's height, SPAN its width. Shadows, rings
// and wakes fall under the alpha cut. Served over http (the paintings taint file://). (Oct 18 2026, Wes: "1.5x or less")
//   node regatta/eval/_cap_sizes.js
const { chromium } = require('playwright'); const path = require('path'); const { spawn } = require('child_process');
(async () => {
  const port = 8700 + Math.floor(Math.random() * 90);
  const srv = spawn('python3', ['-m', 'http.server', String(port)], { cwd: path.resolve('.'), stdio: 'ignore' }); await new Promise(r => setTimeout(r, 800));
  const b = await chromium.launch(); const p = await b.newPage();
  await p.goto(`http://localhost:${port}/regatta/index.html`); await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
  const V = {
    otter: {
      'great white (snout to tail tip)': `A.drawWhiteShark(g, { x: 0, y: 0, h: 0, depth: 0, mode: 'patrol', ph: 0, trail: [], trailT: 0, z: 0, roll: 0, jaw: 0, slick: 0, turn: 0 }, 'water')`,
      'sea otter (size 1, on its back)': `A.drawSeaOtter(g, { i: 0, x: 0, y: 0, h: 0, mode: 'float', t: 5, bob: 0, roll: 0, paws: 'rest', food: null, tap: 0, ring: 0, ring2: 0, look: 0, kelp: false, size: 1, head: 0.8, trail: [], trailT: 0, dive: 0, pup: false, ph: 0 })`,
      'sea otter pup (alone, k as its mother at size 1)': `A.drawSeaOtterPup(g, 0, 0, 0, 19 / 32, 0, true)`,
      'sea lion cow (size 1)': `A.drawSeaLion(g, { i: 0, x: 0, y: 0, h: 0, mode: 'lie', up: 0, bark: 0, wet: 0, curl: 0, bob: 0, bull: false, size: 1 })`,
      'sea lion bull (size 1.25)': `A.drawSeaLion(g, { i: 0, x: 0, y: 0, h: 0, mode: 'lie', up: 0, bark: 0, wet: 0, curl: 0, bob: 0, bull: true, size: 1.25 })`,
    },
    flats: {
      'grey seal cow (size 0.91, mean)': `A.drawGreySeal(g, { i: 0, x: 0, y: 0, h: 0, size: 0.91, pal: 4, pup: false, mode: 'haul', side: 0, curl: 0, lift: 0, bob: 0, wet: 0, ring: 0, alert: 0, awashOv: 0, spots: [] })`,
      'grey seal bull (size 1.125, mean)': `A.drawGreySeal(g, { i: 0, x: 0, y: 0, h: 0, size: 1.125, pal: 0, pup: false, mode: 'haul', side: 0, curl: 0, lift: 0, bob: 0, wet: 0, ring: 0, alert: 0, awashOv: 0, spots: [] })`,
      'grey seal pup (size 0.44, mean)': `A.drawGreySeal(g, { i: 0, x: 0, y: 0, h: 0, size: 0.44, pal: 5, pup: true, mode: 'haul', side: 0, curl: 0, lift: 0, bob: 0, wet: 0, ring: 0, alert: 0, awashOv: 0, spots: [] })`,
      'spoonbill (wading)': `A.drawSpoonbill(g, { j: 0, x: 0, y: 0, h: 0, mode: 'wade', sw: 0, step: 0, roost: false, ring: 0 })`,
      'spoonbill (flying, wings out)': `A.drawSpoonbill(g, { j: 0, x: 0, y: 0, h: 0, mode: 'fly', flap: 0, z: 0, ring: 0 })`,
      'avocet (wading)': `A.drawAvocet(g, { j: 0, x: 0, y: 0, h: 0, mode: 'wade', sw: 0, step: 0, roost: false, ring: 0 })`,
      'avocet (flying, wings out)': `A.drawAvocet(g, { j: 0, x: 0, y: 0, h: 0, mode: 'fly', flap: 0, z: 0, ring: 0 })`,
      'shore crab (size 1, across the legs = span)': `A.drawShoreCrab(g, { x: 0, y: 0, h: 0, size: 1, phase: 0, burst: 0, leg: 0, rear: 0, ph: 0, pick: 0, bur: 0, dOv: 0 })`,
    },
    seatrials: {
      'great cormorant (swimming)': `A.drawCormorant(g, { j: 0, x: 0, y: 0, h: 0, mode: 'swim', t: 0, trail: [], vis: 1, ring: 0 })`,
      'great cormorant (flying, wings out)': `A.drawCormorant(g, { j: 0, x: 0, y: 0, h: 0, mode: 'fly', flap: 0, z: 0, trail: [], vis: 1, ring: 0 })`,
      'herring gull (afloat)': `A.drawGullFloat(g, { j: 0, x: 0, y: 0, h: 0, bob: 0, preen: 0, juv: false, splash: 0 })`,
      'herring gull (club, flying)': `A.drawClubGullFlying(g, { j: 0, x: 0, y: 0, h: 0, z: 0, flap: 0, glide: true, mode: 'fly', juv: false, splash: 0 })`,
      'common tern (club, flying)': `A.drawTern(g, { j: 0, club: true, x: 0, y: 0, h: 0, z: 0, flap: 0, mode: 'shift', a: 0, splash: 0 })`,
      'mackerel (in a boil, s 1)': `A.drawMackBoil(g, { i: 0, x: 0, y: 0, k: 1, a: 0, fish: [{ r: 0, a: -Math.PI / 2, v: 1, s: 1 }], leaps: [], pops: [] })`,
      'mackerel (thrown clear)': `A.drawMackBoil(g, { i: 0, x: 0, y: 0, k: 1, a: 0, fish: [], leaps: [{ x: 0, y: 0, h: 0, t: 0.5 }], pops: [] })`,
    },
    volcanic: {
      'sooty tern (glide)': `A.drawTern(g, { sooty: true, x: 0, y: 0, h: 0, z: 0, flap: Math.asin(0.95), gliding: true, mode: 'wheel', t: 1, splash: 0 })`,
    },
  };
  for (const [venue, items] of Object.entries(V)) {
    await p.evaluate((v) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })); selectVenue(v); resetGame(); }, venue);
    // a first pass asks for every painting; then a moment for them to load
    const run = async () => p.evaluate(([items, KK]) => {
      const A = Wildlife.art, oc = state.camera; state.camera = null; A.setT(10);
      const K = KK, out = {};
      for (const [name, src] of Object.entries(items)) {
        const c = document.createElement('canvas'); c.width = c.height = 900; const g = c.getContext('2d');
        g.translate(450, 450); g.scale(K, K);
        try { new Function('A', 'g', src)(A, g); } catch (e) { out[name] = 'err ' + e.message; continue; }
        const d = g.getImageData(0, 0, 900, 900).data; let x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1;
        for (let y = 0; y < 900; y++) for (let x = 0; x < 900; x++) if (d[(y * 900 + x) * 4 + 3] > 150) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
        out[name] = x1 < 0 ? 'nothing drawn' : { length: +((y1 - y0 + 1) / K).toFixed(1), span: +((x1 - x0 + 1) / K).toFixed(1) };
      }
      state.camera = oc; return out; }, [items, +(process.env.K || 4)]);
    await p.waitForTimeout(2500); await run(); await p.waitForTimeout(1200); await run(); await p.waitForTimeout(1200);   // (twice: a painted bird asks for its wings only once its body is in)
    const r = await run();
    console.log('── ' + venue); for (const [k, v] of Object.entries(r)) console.log('  ' + k.padEnd(44), JSON.stringify(v));
  }
  await b.close(); srv.kill(); })();
