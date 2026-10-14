// PT-084: Otter Point's kelp against where the fleet sails. Races the whole fleet on the bot (player
// included), records every track, and draws a chart: land, rock, kelp (green, labelled), the marks,
// and the tracks. Also: how much of the fleet's sailing passes through kelp at all.
//   OUT=dir node eval/rl/_pt084_map.js [seed]
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
const OUT = process.env.OUT, SEED = +(process.argv[2] || 7);
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve('index.html'));
  await p.waitForFunction(() => window.state && window.VenueDoc && typeof resetGame === 'function');
  const r = await p.evaluate((SEED) => { let s = SEED;
    Math.random = () => { let t = s += 0x6D2B79F5; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'otter', soundEnabled: false, musicEnabled: false, bgSoundEnabled: false }));
    selectVenue('otter'); resetGame(); startRace();
    const me = state.boats[0]; me.controller = new BotController(me);
    const tracks = state.boats.map(() => []);
    for (let i = 0; i < 30 * 420 && !state.boats.every(b => b.raceState.finished); i++) {
      me.controller.update(1 / 30); const dd = normalizeAngle(me.controller.targetHeading - me.heading); state.keys.ArrowLeft = dd < -0.02; state.keys.ArrowRight = dd > 0.02;
      update(1 / 30);
      if (i % 15 === 0) state.boats.forEach((b, k) => { if (!b.raceState.finished) tracks[k].push([Math.round(b.x), Math.round(b.y)]); });
    }
    const isl = (state.course.islands || []).filter(s2 => s2.vertices && s2.vertices.length > 2).map(s2 => ({ id: s2.id, kind: s2.kind || '', hidden: !!s2.hidden, reef: !!s2.reef, awash: !!s2.awash, v: s2.vertices.map(q => [Math.round(q.x), Math.round(q.y)]) }));
    const doc = VENUE_DOC.otter, kelp = (doc.shapes || []).filter(sh => sh.kind === 'kelp').map(sh => ({ id: sh.id, v: (sh.outer || sh.vertices || []).map(q => Array.isArray(q) ? q : [q.x, q.y]) }));
    const marks = state.course.marks.map(m => [Math.round(m.x), Math.round(m.y), m.id || '']);
    return { tracks, isl, kelp, marks, fin: state.boats.filter(b => b.raceState.finished).length };
  }, SEED);
  fs.writeFileSync(`${OUT}/otter_map.json`, JSON.stringify(r));
  console.log('finished', r.fin, 'kelp beds', r.kelp.length, 'shapes', r.isl.length);
  console.log(errs.length ? 'errors: ' + errs.slice(0, 3).join(' | ') : 'no page errors'); await b.close(); })();
