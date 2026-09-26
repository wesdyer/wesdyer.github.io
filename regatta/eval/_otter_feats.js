// Probe: Otter Point's two sailing objectives on the bot — the player on the autopilot, steered through
// waypoints: (a) inside the north-coast kelp beds, (b) round the NW tip, then the arch. Logs the feats,
// rock contacts and the race time against the plain autopilot.
//   node regatta/eval/_otter_feats.js [route] [seed]     route: plain | inside | tip   (from the repo root)
const { chromium } = require('playwright'); const path = require('path');
const ROUTES = {
  plain: [],
  // after the mark: into the inside of kelp-c1 ... c5 (gate midpoints), each approached from the west
  // after the mark: through the inside gates of kelp-c2..c5 (their midpoints), on an A* line kept 70 u off rock
  inside: 'astar:-591,-3941;1063,-4473;2796,-4803;4499,-4928;5600,-5300',
  // outside the tip on the beat, round the mark, then along to the arch and through it W->E
  tip: [[-5000, -1900], [-6100, -2300], [-6000, -3600], [-4600, -3900], [-3025, -3800], ['mark'], [-2500, -4500], [-2150, -4870], [-1855, -4890], [-1740, -4990], [-1500, -5250]],
};
(async () => { const route = process.argv[2] || 'plain', seed = +(process.argv[3] || 100);
  const b = await chromium.launch(); const p = await b.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && typeof resetGame === 'function');
  const r = await p.evaluate(([route, seed, wps0]) => { let s = seed;
    Math.random = () => { let t = s += 0x6D2B79F5; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'otter', soundEnabled: false, musicEnabled: false, bgSoundEnabled: false })); selectVenue('otter'); resetGame(); startRace();
    let wps = wps0;
    if (typeof wps0 === 'string') {
      // A* on a 30 u grid over water with 70 u of clearance from anything solid
      const solid = (x, y) => state.course.islands.some(q => !q.awash && VenueDoc.traits(q).hard && Math.hypot(x - q.x, y - q.y) < (q.radius || 1e9) + 80 && (pointInPoly(x, y, q.vertices) || [0, 1, 2, 3, 4, 5, 6, 7].some(i => pointInPoly(x + Math.cos(i * 0.785) * 70, y + Math.sin(i * 0.785) * 70, q.vertices))));
      const G = 30, key = (i, j) => i + ',' + j, memo = new Map(), free = (i, j) => { const k = key(i, j); if (!memo.has(k)) memo.set(k, !solid(i * G, j * G)); return memo.get(k); };
      const astar = (a, b) => { const si = Math.round(a[0] / G), sj = Math.round(a[1] / G), ti = Math.round(b[0] / G), tj = Math.round(b[1] / G);
        const open = [[0, si, sj]], g = new Map([[key(si, sj), 0]]), from = new Map(); let n = 0;
        while (open.length && n++ < 60000) { open.sort((p, q) => p[0] - q[0]); const [, i, j] = open.shift(); if (i === ti && j === tj) break;
          for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) { const ni = i + di, nj = j + dj, k = key(ni, nj); if (!free(ni, nj) && !(ni === ti && nj === tj)) continue;
            const ng = g.get(key(i, j)) + Math.hypot(di, dj); if (ng < (g.get(k) ?? 1e9)) { g.set(k, ng); from.set(k, [i, j]); open.push([ng + Math.hypot(ti - ni, tj - nj), ni, nj]); } } }
        const path = []; let c = [ti, tj]; while (c && !(c[0] === si && c[1] === sj)) { path.unshift([c[0] * G, c[1] * G]); c = from.get(key(c[0], c[1])); } return path.filter((_, i) => i % 4 === 3 || i === path.length - 1); };
      const pts = wps0.slice(6).split(';').map(q => q.split(',').map(Number));
      wps = []; let from = [-2900, -3900]; for (const q of pts) { wps.push(...astar(from, q)); from = q; }
    }
    const feats = []; GameEvents.on('player-feat', e => { if (/^otter:(inside|scraped|tip|arch)/.test(e.id)) feats.push(e.id + (e.value != null ? '=' + e.value : '') + '@' + Math.round(state.race.timer || 0)); });
    let contacts = 0; GameEvents.on('player-contact', () => contacts++);
    const me = state.boats[0], ctl = me.controller = new BotController(me), base = ctl.update.bind(ctl);
    let wi = 0; const legAtStart = () => me.raceState.leg;
    ctl.update = (d) => { base(d); if (state.race.status !== 'racing') return;
      while (wi < wps.length && wps[wi][0] === 'mark') { if (me.raceState.leg >= 2) wi++; else return; }
      if (route === 'inside' && me.raceState.leg < 2) return;   // the inside is on the run down the coast, after the mark
      if (wi < wps.length) { const [wx, wy] = wps[wi]; if (Math.hypot(wx - me.x, wy - me.y) < 90) { wi++; return; }
        let want = Math.atan2(wx - me.x, -(wy - me.y));
        // can't point: tack up to it — close-hauled on the tack nearer the bearing, with hysteresis
        const up = state.wind.direction, off = normalizeAngle(want - up), close = 0.85;
        if (Math.abs(off) < close) { if (!ctl._tk || (Math.sign(off) !== ctl._tk && Math.abs(off) > 0.3)) ctl._tk = Math.sign(off) || 1; want = up + ctl._tk * close; } else ctl._tk = 0;
        ctl.targetHeading = want; } };
    let t = 0; while (t < 600 && !me.raceState.finished) { ctl.update(1 / 30); const dd = normalizeAngle(ctl.targetHeading - me.heading); state.keys.ArrowLeft = dd < -0.02; state.keys.ArrowRight = dd > 0.02; update(1 / 30); t += 1 / 30; }
    return { nwp: wps.length, t: me.raceState.finished ? Math.round(state.race.timer) : 'DNF', feats, contacts, wi, of: wps.length, pos: [Math.round(me.x), Math.round(me.y)] };
  }, [route, seed, ROUTES[route]]);
  console.log(route, seed, JSON.stringify(r)); if (errs.length) console.log(errs[0]); await b.close(); })();
