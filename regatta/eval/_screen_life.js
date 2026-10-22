// Probe (PT-028): how much wildlife a sailor actually has ON SCREEN through a race. The player on the
// autopilot, stepped at 30 Hz to the finish (cap 900 s); once a second every live animal object in
// Wildlife.debug() within R of the player is counted, by kind. Reports the share of seconds with
// nothing alive in view, the longest empty stretch, and seconds-in-view per kind.
//   node regatta/eval/_screen_life.js [venue ...] [--R 750] [--seed 100]     (from the repo root)
// R 750 ~ half the short side of Wes's 2000x1500 window at 1 unit = 1 px.
const { chromium } = require('playwright'); const path = require('path');
const argv = process.argv.slice(2), opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? +argv.splice(i, 2)[1] : d; };
const R = opt('--R', 750), seed = opt('--seed', 100);
const venues = argv.length ? argv : ['seatrials', 'lake', 'river', 'otter', 'lagoon', 'bay'];
// bookkeeping that is not an animal on screen
const SKIP = new Set(['flyPatches', 'krill', 'visited', 'feats', 'woken', 'bedAt', 'prints', 'huntCool', 'boilsHit', 'flight', 'treks', 'frigFish']);
(async () => { const b = await chromium.launch(); const p = await b.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
  for (const venue of venues) {
    const r = await p.evaluate(([venue, seed, R, SKIP]) => { let s = seed; SKIP = new Set(SKIP);
      Math.random = () => { let t = s += 0x6D2B79F5; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
      localStorage.setItem('regatta_settings', JSON.stringify({ venue, soundEnabled: false, musicEnabled: false, bgSoundEnabled: false }));
      selectVenue(venue); resetGame(); startRace();
      const me = state.boats[0]; me.controller = new BotController(me);
      const near = (x, y) => (x - me.x) ** 2 + (y - me.y) ** 2 < R * R;
      // every object with a numeric x,y under a debug key, two levels down (flocks hold birds, pods members)
      const collect = (v, out, depth) => { if (!v || depth > 3) return;
        if (Array.isArray(v)) { for (const o of v) collect(o, out, depth + 1); return; }
        if (typeof v !== 'object') return;
        const x = v.x != null ? v.x : v.cx, y = v.y != null ? v.y : v.cy;
        let kids = false;
        for (const k of ['birds', 'members', 'fish', 'items', 'seals', 'crabs', 'turtles', 'sharks', 'pack', 'kids', 'animals', 'herd', 'pups']) if (Array.isArray(v[k]) && v[k].length) { collect(v[k], out, depth + 1); kids = true; }
        if (!kids && typeof x === 'number' && typeof y === 'number' && isFinite(x)) out.push([x, y]); };
      const per = {}, empty = []; let sec = 0, run = 0, maxRun = 0, nEmpty = 0, frame = 0;
      while (!me.raceState.finished && sec < 900) {
        me.controller.update(1 / 30); const dd = normalizeAngle(me.controller.targetHeading - me.heading); state.keys.ArrowLeft = dd < -0.02; state.keys.ArrowRight = dd > 0.02;
        state.camera.x = me.x; state.camera.y = me.y;
        update(1 / 30); frame++;
        if (frame % 30) continue; sec++;
        const D = Wildlife.debug(); let any = false;
        for (const k of Object.keys(D)) { if (SKIP.has(k)) continue; const pts = []; collect(D[k], pts, 0);
          if (pts.some(([x, y]) => near(x, y))) { per[k] = (per[k] || 0) + 1; any = true; } }
        if (any) run = 0; else { nEmpty++; run++; maxRun = Math.max(maxRun, run); if (run === 1) empty.push(Math.round(me.x) + ',' + Math.round(me.y) + '@' + sec); }
      }
      return { venue, secs: sec, finished: !!me.raceState.finished, emptyPct: Math.round(100 * nEmpty / sec), maxRun, per, emptyStarts: empty.slice(0, 12) };
    }, [venue, seed, R, [...SKIP]]);
    const per = Object.entries(r.per).sort((a, b) => b[1] - a[1]).map(([k, v]) => k + ' ' + Math.round(100 * v / r.secs) + '%').join(', ');
    console.log(`${r.venue.padEnd(10)} ${r.secs}s${r.finished ? '' : ' (cap)'}  nothing in view ${r.emptyPct}%  longest empty ${r.maxRun}s\n    in view: ${per}\n    empty stretches start at: ${r.emptyStarts.join('  ')}`);
  }
  if (errs.length) console.log('ERR', errs.slice(0, 3).join(' | ')); await b.close(); })();
