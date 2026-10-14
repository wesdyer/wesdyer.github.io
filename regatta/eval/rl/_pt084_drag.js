// PT-084: what a kelp bed costs. The player's boat, alone, held on the leg's heading straight across
// Otter's new kelp-r5 bed (sailed east, the way the fleet goes) (and the same line moved clear of it, for open water), for each kelp drag.
// Reports seconds lost across the line and the lowest speed.   node eval/rl/_pt084_drag.js
const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve('index.html'));
  await p.waitForFunction(() => window.state && window.VenueDoc && typeof resetGame === 'function');
  const out = await p.evaluate(async () => {
    const res = [];
    for (const [drag, grab] of [[0.65, 0], [0.65, 1], [0.75, 1], [0.85, 1]]) {
      VenueDoc.KINDS.kelp.drag = drag; VenueDoc.KINDS.kelp.grab = grab;
      for (const over of [true, false]) {
        let s = 9; Math.random = () => { let t = s += 0x6D2B79F5; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'otter', soundEnabled: false, musicEnabled: false, bgSoundEnabled: false }));
        selectVenue('otter'); resetGame(); startRace(); state.race.status = 'racing';
        const bed = state.course.islands.find(s2 => s2.id === 'kelp-r5');
        const me = state.boats[0];
        for (const o of state.boats) if (o !== me) { o.x = 1e6; o.y = 1e6; }
        // beam reach: heading square to the wind, across the bed's centre (or 900 u clear of it)
        const h = Math.PI / 2, fx = 1, fy = 0;   // east, along the coast as the fleet sails it here
        const cx = bed.x, cy = bed.y - (over ? 0 : 900);   // (clear: the same line 900 u offshore)
        me.x = cx - fx * 1100; me.y = cy - fy * 1100; me.heading = h; me.speed = 0;
        let t = 0, minKt = 99, crossed = null;
        for (let i = 0; i < 30 * 90; i++) {
          me.heading = h; state.keys.ArrowLeft = state.keys.ArrowRight = false;
          for (const o of state.boats) if (o !== me) { o.x = 1e6; o.y = 1e6; }
          update(1 / 30); t += 1 / 30;
          const along = (me.x - cx) * fx + (me.y - cy) * fy;
          if (t > 8 && along > -500 && along < 500) minKt = Math.min(minKt, me.speed * 4);
          if (along >= 1100) { crossed = t; break; }
        }
        res.push({ drag: drag + ' grab ' + grab, over, secs: crossed && +crossed.toFixed(2), minKt: +minKt.toFixed(1), bedR: Math.round(bed.radius) });
      }
    }
    return res;
  });
  const by = {}; for (const r of out) (by[r.drag] = by[r.drag] || {})[r.over ? 'over' : 'clear'] = r;
  for (const d in by) console.log(`drag ${d}: across the bed ${by[d].over.secs}s vs open ${by[d].clear.secs}s -> lost ${(by[d].over.secs - by[d].clear.secs).toFixed(1)}s, slowest ${by[d].over.minKt} kt (open ${by[d].clear.minKt}) [bed r ${by[d].over.bedR}]`);
  console.log(errs.length ? 'errors: ' + errs.slice(0, 3).join(' | ') : 'no page errors'); await b.close(); })();
