// Probe (PT-044, "players may think they run over turtles"): how often an animal is UNDER A HULL. Every boat
// (the player on the autopilot, the fleet racing), stepped at 30 Hz to the finish (cap 600 s); each frame, every
// live animal object in Wildlife.debug() inside a hull's footprint (55 x 18 u, in the boat's own frame, plus the
// animal's own `pad`) is counted by kind and by its state (mode / depth / z), with whether the boat was the player's.
// Read the states: a frame under a hull only matters for an animal at the surface (not deep, not in the air).
//   node regatta/eval/_hull_contacts.js [venue ...] [--seed 100]     (from the repo root)
const { chromium } = require('playwright'); const path = require('path');
const argv = process.argv.slice(2), opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? +argv.splice(i, 2)[1] : d; };
const seed = opt('--seed', 100);
const venues = argv.length ? argv : ['lagoon', 'arctic', 'flats', 'pond', 'glowtide', 'otter', 'ocean', 'bay', 'lake', 'swamp', 'river', 'volcanic', 'seatrials', 'redrock'];
const SKIP = ['flyPatches', 'krill', 'visited', 'feats', 'woken', 'bedAt', 'prints', 'huntCool', 'boilsHit', 'flight', 'treks', 'frigFish', 'splashes', 'blows', 'blueBlows', 'foams', 'blood', 'leaps', 'rises', 'jellyBloom', 'velFleets', 'mackBoils', 'boil', 'stripers'];
(async () => { const b = await chromium.launch(); const p = await b.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
  for (const venue of venues) {
    const r = await p.evaluate(([venue, seed, SKIP]) => { let s = seed; SKIP = new Set(SKIP);
      Math.random = () => { let t = s += 0x6D2B79F5; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
      localStorage.setItem('regatta_settings', JSON.stringify({ venue, soundEnabled: false, musicEnabled: false, bgSoundEnabled: false }));
      selectVenue(venue); resetGame(); startRace();
      const me = state.boats[0]; me.controller = new BotController(me);
      const state_ = (o) => { const bits = []; if (o.mode != null) bits.push(o.mode); if (typeof o.depth === 'number') bits.push('d' + (o.depth > 0.5 ? 'deep' : o.depth > 0.15 ? 'mid' : 'top')); if (typeof o.z === 'number' && o.z > 3 && !(o.kind && /orca/.test(o.kind))) bits.push('air'); if (typeof o.sink === 'number' && o.sink > 0.5) bits.push('sunk'); if (o.gone) bits.push('gone'); if (typeof o.up === 'number' && (o.kind && /orca/.test(o.kind) ? o.up >= 0 : o.up > 0.3)) bits.push('SURF'); if (typeof o.dip === 'number' && o.dip > 0.5) bits.push('dip'); if (typeof o.surfTip === 'number' && o.surfTip > 0.3) bits.push('SURF'); return bits.join('/') || '-'; };
      const collect = (v, out, depth) => { if (!v || depth > 3) return;
        if (Array.isArray(v)) { for (const o of v) collect(o, out, depth + 1); return; }
        if (typeof v !== 'object') return;
        let kids = false;
        for (const k of ['birds', 'members', 'fish', 'items', 'seals', 'crabs', 'turtles', 'sharks', 'pack', 'kids', 'animals', 'herd', 'pups']) if (Array.isArray(v[k]) && v[k].length) { const n0 = out.length; collect(v[k], out, depth + 1); if (v.mode != null) for (let q = n0; q < out.length; q++) if (out[q].mode == null) out[q] = Object.assign(Object.create(out[q]), { x: out[q].x, y: out[q].y, mode: 'group:' + v.mode }); kids = true; }
        if (!kids && typeof v.x === 'number' && typeof v.y === 'number' && isFinite(v.x)) out.push(v); };
      const hits = {}; let frame = 0, sec = 0;
      while (!me.raceState.finished && sec < 600) {
        me.controller.update(1 / 30); const dd = normalizeAngle(me.controller.targetHeading - me.heading); state.keys.ArrowLeft = dd < -0.02; state.keys.ArrowRight = dd > 0.02;
        state.camera.x = me.x; state.camera.y = me.y;
        update(1 / 30); frame++; if (frame % 30 === 0) sec++;
        const D = Wildlife.debug();
        for (const k of Object.keys(D)) { if (SKIP.has(k)) continue; const objs = []; collect(D[k], objs, 0);
          for (const o of objs) for (const bt of state.boats) {
            const dx = o.x - bt.x, dy = o.y - bt.y; if (dx * dx + dy * dy > 1600) continue;
            const ca = Math.cos(bt.heading), sa = Math.sin(bt.heading), along = dx * sa - dy * ca, across = dx * ca + dy * sa;
            if (Math.abs(along) > 27.5 + 3 || Math.abs(across) > 9 + 3) continue;
            const key = k + ' [' + state_(o) + ']' + (bt === me ? ' PLAYER' : '');
            hits[key] = (hits[key] || 0) + 1; } }
      }
      return { venue, secs: sec, hits };
    }, [venue, seed, SKIP]);
    const rows = Object.entries(r.hits).sort((a, b) => b[1] - a[1]).map(([k, v]) => `    ${String(v).padStart(5)}  ${k}`);
    console.log(`${r.venue} (${r.secs}s, frames under any hull):\n${rows.join('\n') || '    none'}`);
  }
  if (errs.length) console.log('ERR', errs.slice(0, 3).join(' | ')); await b.close(); })();
