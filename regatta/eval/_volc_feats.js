// Probe: Emberfall's sailing objectives on the bot. `outer`: the player steered round the outside
// of every island (waypoints 300 u outside each gate's start, anticlockwise with the course);
// `plain`: the autopilot. Logs feats, time and wall contacts.
//   node regatta/eval/_volc_feats.js [outer|plain] [seed]     (from the repo root)
const { chromium } = require('playwright'); const path = require('path');
(async () => { const route = process.argv[2] || 'outer', seed = +(process.argv[3] || 100);
  const b = await chromium.launch(); const p = await b.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && typeof resetGame === 'function');
  const r = await p.evaluate(([route, seed]) => { let s = seed;
    Math.random = () => { let t = s += 0x6D2B79F5; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'volcanic', soundEnabled: false, musicEnabled: false, bgSoundEnabled: false })); selectVenue('volcanic'); resetGame(); startRace();
    const feats = []; GameEvents.on('player-feat', e => { if (/^volcanic:/.test(e.id)) feats.push(e.id + (e.value != null ? '=' + e.value : '') + '@' + Math.round(state.race.timer || 0)); });
    let contacts = 0; GameEvents.on('player-contact', () => contacts++);
    const G = _volcOuterGates(); let cx = 0, cy = 0; for (const g of G) { cx += g.a.x; cy += g.a.y; } cx /= G.length; cy /= G.length;
    const me = state.boats[0], ctl = me.controller = new BotController(me), base = ctl.update.bind(ctl);
    const brg = (x, y) => Math.atan2(x - cx, -(y - cy));
    let wps = [];
    if (route === 'outer') { const a0 = brg(me.x, me.y);
      const W0 = G.map(g => ({ g, a: ((a0 - brg(g.a.x, g.a.y)) % 6.2832 + 6.2832) % 6.2832, r: Math.hypot(g.a.x - cx, g.a.y - cy), ang: brg(g.a.x, g.a.y) })).sort((u, v) => u.a - v.a);
      // each waypoint as far out as the land on the neighbouring bearings (±25°), plus 350 u
      wps = W0.map(w => { let R0 = w.r; for (const o of W0) { const da = Math.abs(Math.atan2(Math.sin(o.ang - w.ang), Math.cos(o.ang - w.ang))); if (da < 0.44) R0 = Math.max(R0, o.r); } R0 += 350;
        return { x: cx + Math.sin(w.ang) * R0, y: cy - Math.cos(w.ang) * R0, a: w.a }; }); }
    let wi = 0;
    ctl.update = (d) => { base(d); if (state.race.status !== 'racing' || wi >= wps.length) return; const w = wps[wi];
      if (Math.hypot(w.x - me.x, w.y - me.y) < 250 || (wi + 1 < wps.length && Math.hypot(wps[wi + 1].x - me.x, wps[wi + 1].y - me.y) < Math.hypot(wps[wi + 1].x - w.x, wps[wi + 1].y - w.y))) { wi++; return; }
      let want = Math.atan2(w.x - me.x, -(w.y - me.y)); const up = state.wind.direction, off = normalizeAngle(want - up), close = 0.85;
      if (Math.abs(off) < close) { if (!ctl._tk || (Math.sign(off) !== ctl._tk && Math.abs(off) > 0.3)) ctl._tk = Math.sign(off) || 1; want = up + ctl._tk * close; } else ctl._tk = 0;
      ctl.targetHeading = want; };
    let t = 0; while (t < 600 && !me.raceState.finished) { ctl.update(1 / 30); const dd = normalizeAngle(ctl.targetHeading - me.heading); state.keys.ArrowLeft = dd < -0.02; state.keys.ArrowRight = dd > 0.02; update(1 / 30); t += 1 / 30; }
    return { t: me.raceState.finished ? Math.round(state.race.timer) : 'DNF', gates: G.length, hit: _volcRun ? _volcRun.hit.size : null, feats, contacts, wi, of: wps.length, pos: [Math.round(me.x), Math.round(me.y)] };
  }, [route, seed]);
  console.log(route, seed, JSON.stringify(r)); if (errs.length) console.log(errs[0]); await b.close(); })();
