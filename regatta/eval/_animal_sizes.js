// Drawn size of every venue animal at game scale: the solid-pixel (alpha > 150) bounding
// box of each Wildlife.art draw function, so shadows, rings and wakes are left out (the ray at
// alpha > 40, so its thin whip tail counts: the eye reads it tip to tail). The
// numbers guidelines/scale.md checks against (true size x 3, floor 20 units).
//   node regatta/eval/_animal_sizes.js     (from the repo root)
//   (served over http: the painted sprites taint a file:// canvas and getImageData would throw)
const { chromium } = require('playwright'); const path = require('path'); const { spawn } = require('child_process');
(async () => {
  const port = 8700 + Math.floor(Math.random() * 90);
  const srv = spawn('python3', ['-m', 'http.server', String(port)], { cwd: path.resolve('.'), stdio: 'ignore' }); await new Promise(r => setTimeout(r, 800));
  const b = await chromium.launch(); const p = await b.newPage();
  await p.goto(`http://localhost:${port}/regatta/index.html`); await p.waitForFunction(() => window.Wildlife && Wildlife.art);
  // ask for the painted sprites, and give them a moment to load
  await p.evaluate(() => { const g = document.createElement('canvas').getContext('2d'); const c = state.camera; state.camera = null;
    Wildlife.art.drawWhiteShark(g, { x: 0, y: 0, h: 0, depth: 0, mode: 'patrol', ph: 0, trail: [], trailT: 0, z: 0, roll: 0, jaw: 0, slick: 0, turn: 0 }, 'water');
    for (const k of ['orca', 'orca-b', 'orca-calf']) Wildlife.art.drawOrca(g, { kind: k, x: 0, y: 0, h: 0, z: 0, up: -1, beat: 0, turn: 0, trail: [], j: 0 });
    Wildlife.art.drawBlueWhale(g, { j: 0, len: 360, x: 0, y: 0, h: 0, mode: 'under', t: 10, depth: 0.5, ph: 0, fluke: 0, turn: 0, lunge: 0, sd: 1, mott: [] });
    Wildlife.art.drawSpinner(g, { live: true, i: 0, x: 0, y: 0, h: 0, spin: 0, breath: 0 });
    Wildlife.art.drawAlbatross(g, { x: 0, y: 0, h: 0, z: 0, bank: 0 });
    Wildlife.art.drawFlyfish(g, { x0: 0, y0: 0, h: 0, len: 0.001, t: 0.5, dur: 1, z: 8, size: 1 }); Wildlife.art.drawMahi(g, { x: 0, y: 0, h: 0, size: 1, mode: 'patrol', t: 0, i: 0, leap: 0, trail: [] });
    for (const calf of [false, true]) Wildlife.art.drawWhale(g, { j: 0, calf, len: 50, x: 0, y: 0, h: 0, mode: 'surface', depth: 0, ph: 0 });
    // Glowtide's paintings (Oct 18 2026)
    Wildlife.art.drawManta(g, { x: 0, y: 0, h: 0, mode: 'travel', beat: 0, pitch: 0, i: 0, sparks: [] });
    Wildlife.art.drawFlyingFox(g, { x: 0, y: 0, h: 0, z: 0, flap: 0 });
    Wildlife.art.drawHawksbill(g, { x: 0, y: 0, h: 0, mode: 'swim', beat: 0, i: 0, sand: [], tracks: [] });
    Wildlife.art.drawDugong(g, { x: 0, y: 0, h: 0, len: 52, beat: 0, trail: [], calf: { x: 0, y: 0, h: 0, len: 28.6, beat: 0 } }); state.camera = c; });
  await p.waitForTimeout(900);
  const r = await p.evaluate(() => {
    const A = Wildlife.art;
    const mk = (o) => Object.assign({ x: 0, y: 0, h: 0, sink: 0, flap: 0, yaw: 0, trail: [], bob: 0, stick: false, splash: 0, slap: 0, rise: 0, swim: 0 }, o);
    const items = {
      'gull (flying, span)': g => A.drawGullFlying(g, 0, 0, Math.PI / 2, 0, 0),
      'gull (perched)': g => A.drawGullPerched(g, 0, 0, 0),
      'pelican (flying, span)': g => A.drawPelicanFlying(g, 0, 0, Math.PI / 2, 0, 0, false),
      'pelican (sitting)': g => A.drawPelicanSitting(g, 0, 0, 0, 0),
      'porpoise': g => A.drawPorpoise(g, { phase: 0.5, sx: 0, sy: 0, sh: 0 }),
      'turtle': g => A.drawTurtle(g, 0, 0, 0, 1, 0),
      'grebe': g => A.drawGrebe(g, mk({})),
      'loon': g => A.drawLoon(g, mk({})),
      'beaver': g => A.drawBeaver(g, mk({})),
      'moose': g => A.drawMoose(g, { x: 0, y: 0, h: 0, alpha: 1, dip: 0, drip: 0, bob: 0, sway: 0, mode: 'alert', ashore: true }),
      'duckling': g => A.drawDuckling(g, mk({}), 0, 0),
      'green sea turtle': g => A.drawCruiser(g, { kind: 'seaturtle', x: 0, y: 0, h: 0, depth: 0, ph: 0, size: 1, mode: 'cruise' }),
      'eagle ray (span wide × snout-to-tail-tip long)': g => A.drawCruiser(g, { kind: 'eagleray', x: 0, y: 0, h: 0, depth: 0, ph: 0, size: 1, mode: 'cruise' }),
      'reef shark': g => A.drawCruiser(g, { kind: 'reefshark', x: 0, y: 0, h: 0, depth: 0, ph: 0, size: 1, mode: 'cruise' }),
      'alligator (nose to tail tip)': g => A.drawGator(g, { x: 0, y: 0, h: 0, mode: 'float', sink: 0, bob: 0, i: 0 }),
      'egret standing': g => A.drawEgret(g, { x: 0, y: 0, h: 0, mode: 'stand', bob: 0, neck: 0 }),
      'egret flying (span)': g => A.drawEgret(g, { x: 0, y: 0, h: Math.PI / 2, mode: 'fly', flap: 0, z: 0 }),
      'anhinga drying (span)': g => A.drawAnhinga(g, { px: 0, py: 0, x: 0, y: 0, ph: 0, mode: 'dry', flap: 0, t: 0, sink: 0, splash: 0 }),
      'brown bear (nose to rump)': g => A.drawBear(g, { i: 0, x: 0, y: 0, h: 0, up: 0, mode: 'watch', rear: 0, lunge: 0, look: 0, splash: 0, fish: 0 }),
      'sockeye': g => A.drawSockeye(g, 0, 0, 0, 1, 0, 0),
      'bald eagle (span)': g => A.drawEagle(g, { i: 0, x: 0, y: 0, h: Math.PI / 2, z: 0, mode: 'soar', flap: 0, fish: 0, splash: 0 }),
      'river otter (with tail)': g => A.drawOtter(g, { i: 0, x: 0, y: 0, h: 0, rh: 0, size: 1, dip: 0, ring: 0, trail: [], trailT: 0, curl: 0 }, true),
      'sea otter (on its back, nose to hind feet)': g => A.drawSeaOtter(g, { i: 0, x: 0, y: 0, h: 0, mode: 'float', t: 5, bob: 0, roll: 0, paws: 'rest', food: null, tap: 0, ring: 0, ring2: 0, look: 0, kelp: false, size: 1, head: 0.8, trail: [], trailT: 0, dive: 0, pup: false, ph: 0 }),
      'sea lion cow (nose to hind flippers)': g => A.drawSeaLion(g, { i: 0, x: 0, y: 0, h: 0, mode: 'lie', up: 0, bark: 0, wet: 0, curl: 0, bob: 0, bull: false, size: 1 }),
      'sea lion bull': g => A.drawSeaLion(g, { i: 0, x: 0, y: 0, h: 0, mode: 'lie', up: 0, bark: 0, wet: 0, curl: 0, bob: 0, bull: true, size: 1.25 }),
      'orca bull (snout to fluke tips)': g => { const c = state.camera; state.camera = null; A.drawOrca(g, { kind: 'orca', x: 0, y: 0, h: 0, z: 0, up: 0.5, term: true, beat: Math.PI / 2, turn: 0, trail: [], j: 0 }); state.camera = c; },
      'orca cow': g => { const c = state.camera; state.camera = null; A.drawOrca(g, { kind: 'orca-b', x: 0, y: 0, h: 0, z: 0, up: 0.5, term: true, beat: Math.PI / 2, turn: 0, trail: [], j: 0 }); state.camera = c; },
      'orca calf': g => { const c = state.camera; state.camera = null; A.drawOrca(g, { kind: 'orca-calf', x: 0, y: 0, h: 0, z: 0, up: 0.5, term: true, beat: Math.PI / 2, turn: 0, trail: [], j: 0 }); state.camera = c; },
      'great white (snout to tail tip)': g => { const c = state.camera; state.camera = null; A.drawWhiteShark(g, { x: 0, y: 0, h: 0, depth: 0, mode: 'patrol', ph: 0, trail: [], trailT: 0, z: 0, roll: 0, jaw: 0, slick: 0, turn: 0 }, 'water'); state.camera = c; },
      'spinner dolphin (beak to flukes)': g => { const c = state.camera; state.camera = null; A.drawSpinner(g, { live: true, i: 0, x: 0, y: 0, h: 0, spin: 0, breath: 0 }); state.camera = c; },
      'flying fish (span, airborne)': g => { const c = state.camera; state.camera = null; A.drawFlyfish(g, { x0: 0, y0: 0, h: Math.PI / 2, len: 0.001, t: 0.5, dur: 1, z: 8, size: 1 }); state.camera = c; },
      'mahi-mahi (leaping)': g => { const c = state.camera; state.camera = null; A.drawMahi(g, { x: 0, y: 0, h: 0, size: 1, mode: 'chase', t: 0, i: 0, leap: 0.5, trail: [] }); state.camera = c; },
      'albatross (span)': g => { const c = state.camera; state.camera = null; A.drawAlbatross(g, { x: 0, y: 0, h: Math.PI / 2, z: 0, bank: 0 }); state.camera = c; },
      'humpback (snout to flukes)': g => { const c = state.camera; state.camera = null; A.drawWhale(g, { j: 0, calf: false, len: 132, x: 0, y: 0, h: 0, mode: 'under', depth: 0, ph: 0, turn: 0 }); state.camera = c; },
      'humpback calf (snout to flukes)': g => { const c = state.camera; state.camera = null; A.drawWhale(g, { j: 0, calf: true, len: 48, x: 0, y: 0, h: 0, mode: 'under', depth: 0, ph: 0, turn: 0 }); state.camera = c; },
      // GLOWTIDE (Oct 18 2026). Painted animals drawn with the camera off (their own culling), each in its widest pose:
      // the manta and the flying fox gliding, wings flat; a dugong alone (its calf drawn far off the canvas) and a calf alone.
      'manta (span × head to tail, gliding)': g => { const c = state.camera; state.camera = null; A.drawManta(g, { x: 0, y: 0, h: 0, mode: 'travel', glide: 1, beat: 0, pitch: 0, bank: 0, i: 0, sparks: [], surfTip: 0, ceph: 0 }); state.camera = c; },
      'manta belly-up (somersault)': g => { const c = state.camera; state.camera = null; A.drawManta(g, { x: 0, y: 0, h: 0, mode: 'loop', glide: 1, beat: 0, pitch: Math.PI, bank: 0, i: 0, sparks: [], surfTip: 0, ceph: 1 }); state.camera = c; },
      'flying fox (span, gliding)': g => { const c = state.camera; state.camera = null; A.drawFlyingFox(g, { x: 0, y: 0, h: 0, z: 0, flap: 0, glideT: 1, bank: 0 }); state.camera = c; },
      'flying fox (top of the upstroke)': g => { const c = state.camera; state.camera = null; A.drawFlyingFox(g, { x: 0, y: 0, h: 0, z: 0, flap: -Math.PI / 2, glideT: 0, bank: 0 }); state.camera = c; },
      'hawksbill (swimming)': g => { const c = state.camera; state.camera = null; A.drawHawksbill(g, { x: 0, y: 0, h: 0, mode: 'swim', beat: 0, up: 1, i: 0, ring: 0, puff: 0, sand: [], tracks: [] }); state.camera = c; },
      'hawksbill (on the sand)': g => { const c = state.camera; state.camera = null; A.drawHawksbill(g, { x: 0, y: 0, h: 0, mode: 'crawlup', beat: 0, i: 0, sand: [], tracks: [] }); state.camera = c; },
      'dugong (muzzle to fluke tips)': g => { const c = state.camera; state.camera = null; A.drawDugong(g, { x: 0, y: 0, h: 0, len: 52, beat: Math.PI / 2, up: 1, trail: [], silt: 0, ring: 0, calf: { x: 9999, y: 0, h: 0, len: 28.6, beat: 0, up: 1 } }); state.camera = c; },
      'dugong calf': g => { const c = state.camera; state.camera = null; A.drawDugong(g, { x: 9999, y: 0, h: 0, len: 52, beat: 0, up: 1, trail: [], silt: 0, ring: 0, calf: { x: 0, y: 0, h: 0, len: 28.6, beat: Math.PI / 2, up: 1 } }); state.camera = c; },
      'golden jelly (largest bell, at the surface)': g => A.drawGoldJelly(g, { x: 0, y: 0, h: 0, size: 1.25, depth: 0, z: 0.3, pitch: 1.4, sq: 0, ph: 0, spots: 1 }),
      'golden jelly (smallest)': g => A.drawGoldJelly(g, { x: 0, y: 0, h: 0, size: 0.6, depth: 0, z: 0.3, pitch: 1.4, sq: 0, ph: 0, spots: 1 }),
      'blue whale (snout to flukes)': g => { const c = state.camera; state.camera = null; A.drawBlueWhale(g, { j: 0, len: 360, x: 0, y: 0, h: 0, mode: 'surface', t: 10, depth: 0, ph: 0, fluke: 0, rollT: 1.5, turn: 0, lunge: 0, sd: 1, mott: [] }); state.camera = c; },
    };
    const out = {};
    for (const [k, fn] of Object.entries(items)) {
      const c = document.createElement('canvas'); c.width = c.height = 400; const g = c.getContext('2d');
      g.translate(200, 200); try { fn(g); } catch (e) { out[k] = 'err ' + e.message; continue; }
      const d = g.getImageData(0, 0, 400, 400).data; let x0 = 400, x1 = -1, y0 = 400, y1 = -1;
      for (let y = 0; y < 400; y++) for (let x = 0; x < 400; x++) if (d[(y * 400 + x) * 4 + 3] > (/ray|alligator|jelly/.test(k) ? 40 : 150)) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      out[k] = x1 < 0 ? 'empty' : `${x1 - x0 + 1} wide × ${y1 - y0 + 1} long`;
    }
    return out;
  });
  console.log(JSON.stringify(r, null, 1)); await b.close(); srv.kill();
})();
