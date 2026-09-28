// CLOSE RACING family — Pulse (Photo Finish), Latch (Inches), Popper (The Circle). Headless, real page.
//   node regatta/eval/test_close.js     (from the repo root)
const { chromium } = require('playwright'); const path = require('path');
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log('  FAIL ' + m); } else console.log('  ok   ' + m); };
(async () => { const b = await chromium.launch(); const p = await b.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve('regatta/index.html')); await p.waitForFunction(() => window.state && typeof resetGame === 'function');
  const r = await p.evaluate(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'seatrials', soundEnabled: false, musicEnabled: false, bgSoundEnabled: false }));
    selectVenue('seatrials'); resetGame(); startRace(); const out = {}, A = Unlocks.ACHIEVEMENTS.filter(a => a.family === 'close'); out.rows = A.map(a => a.char).join(',');
    const base = { finished: true, won: false, penalties: 0, feats: [], vals: {} }, T = (ch, o) => A.find(a => a.char === ch).test(Object.assign({}, base, o), {});
    out.pulse = T('Pulse', { won: true, feats: ['close:photo'] }) && !T('Pulse', { feats: ['close:photo'] }) && !T('Pulse', { won: true });
    out.latch = T('Latch', { feats: ['close:inches'] }) && !T('Latch', { feats: ['close:inches'], penalties: 1 }) && !T('Latch', {});
    out.popper = T('Popper', { feats: ['close:tight'] }) && !T('Popper', {}) && !T('Popper', { feats: ['close:tight', 'close:wide'] }) && !T('Popper', { feats: ['close:tight', 'close:touch'] }) && !T('Popper', { feats: ['close:tight'], finished: false });
    const feats = []; GameEvents.on('player-feat', e => { if (/^close:/.test(e.id)) feats.push(e.id); });
    for (let i = 0; i < 30 * 31; i++) update(1 / 30);   // past the gun
    const me = state.boats[0], o = state.boats[1]; state.race.status = 'racing'; me.raceState.finished = false;
    // INCHES: o on starboard (heading NW in the northerly), the player on port (NE) crossing its bow line 40 u ahead, then 120 u ahead
    const cross = (aheadU, myH, oH) => { feats.length = 0; checkCloseCrossing(); o.x = 0; o.y = -2000; o.heading = oH; me.heading = myH; _inchesSide.clear();
        const fx = Math.sin(oH), fy = -Math.cos(oH), px = -fy, py = fx;
        for (let k = -6; k <= 6; k++) { me.x = o.x + fx * (27.5 + aheadU) + px * k * 8; me.y = o.y + fy * (27.5 + aheadU) + py * k * 8; checkCloseCrossing(); }
        return feats.filter(f => f === 'close:inches').length; };
    out.inches40 = cross(40, 0.8, -0.8); out.inches120 = cross(120, 0.8, -0.8); out.inchesSameTack = cross(40, -0.8, -0.9); out.inchesWrongWay = cross(40, -0.8, 0.8);
    out.tacks = [Rules.getTack({ x: 0, y: 0, heading: 0.8, boomSide: 0 }), Rules.getTack({ x: 0, y: 0, heading: -0.8, boomSide: 0 })].join(',');
    // TOUCH: the player sat on a mark
    feats.length = 0; const m = state.course.marks[2]; me.x = m.x; me.y = m.y; update(1 / 30); out.touch = feats.includes('close:touch');
    return out; });
  ok(r.rows === 'Pulse,Latch,Popper', `the three rows (${r.rows})`);
  ok(r.pulse, 'Photo Finish: a win with the next boat inside a boat length of the line (not a loss, not a clear win)');
  ok(r.latch, 'Inches: the port-over-starboard crossing, no penalty (not with one, not without the crossing)');
  ok(r.popper, 'The Circle: tight roundings, none wide, no mark touched, finished (not a race with no roundings seen)');
  ok(r.tacks === '-1,1', `port = heading NE, starboard = NW in the northerly (${r.tacks})`);
  ok(r.inches40 === 1 && r.inches120 === 0, `crossing a starboard boat's bow 40 u ahead counts, 120 u does not (${r.inches40}, ${r.inches120})`);
  ok(r.inchesSameTack === 0 && r.inchesWrongWay === 0, `not on the same tack, not starboard crossing port (${r.inchesSameTack}, ${r.inchesWrongWay})`);
  ok(r.touch, 'touching a mark is noted (close:touch)');
  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs[0] : ''));
  await b.close(); console.log(fails ? `\nFAIL — ${fails} failure(s)` : '\nPASS — 0 failure(s)'); process.exit(fails ? 1 : 0); })();
