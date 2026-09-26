// Probe: what a sailor at Otter Point actually SEES of the wildlife in a race — the player on the
// autopilot, the camera on the player, stepped at 30 Hz to the finish. Counts each animal type in
// view, shark breaches and fins in view, a shark shadowing the player, stampedes, lunges and blows
// in view, and when Blue Water was earned (it should not be, sailing the normal line).
//   node regatta/eval/_otter_race_wild.js [seed ...]     (from the repo root)
const { chromium } = require('playwright'); const path = require('path');
(async () => { const seeds = process.argv.slice(2).map(Number); if (!seeds.length) seeds.push(100, 200, 300);
  const b = await chromium.launch(); const p = await b.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
  for (const seed of seeds) {
    const r = await p.evaluate((seed) => { let s = seed;
      Math.random = () => { let t = s += 0x6D2B79F5; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
      localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'otter', soundEnabled: false, musicEnabled: false, bgSoundEnabled: false }));
      selectVenue('otter'); resetGame(); startRace();
      const feats = []; GameEvents.on('player-feat', e => { const d0 = Wildlife.debug(); let wi = -1, bd = 1e9; d0.bluePods.forEach((W, i) => W.members.forEach(m => { const dd = Math.hypot(m.x - state.boats[0].x, m.y - state.boats[0].y); if (dd < bd) { bd = dd; wi = i; } })); feats.push([e.id, Math.round(state.race.timer || 0), 'pod' + wi, Math.round(state.boats[0].x) + ',' + Math.round(state.boats[0].y)]); });
      const me = state.boats[0]; me.controller = new BotController(me);
      const inView = (x, y) => Math.abs(x - me.x) < 700 && Math.abs(y - me.y) < 430;
      const secs = { otter: 0, lionRock: 0, lionSwim: 0, shark: 0, fin: 0, whale: 0, blow: 0 }, ev = { breach: 0, shadow: 0, stampede: 0, lunge: 0 };
      let t = 0, prevShadow = false; const seenBreach = new Set(), seenLunge = new Set(); let stamp0 = 0;
      while (t < 600 && !me.raceState.finished) {
        me.controller.update(1 / 30); const dd = normalizeAngle(me.controller.targetHeading - me.heading); state.keys.ArrowLeft = dd < -0.02; state.keys.ArrowRight = dd > 0.02;
        state.camera.x = me.x; state.camera.y = me.y;
        update(1 / 30); t += 1 / 30;
        const d = Wildlife.debug(), dt = 1 / 30;
        if (d.seaOtterRafts.some(G => G.members.some(m => m.mode !== 'under' && inView(m.x, m.y)))) secs.otter += dt;
        if (d.slHauls.some(H => H.members.some(m => m.mode !== 'gone' && inView(m.x, m.y)))) secs.lionRock += dt;
        if (d.slGroups.some(G => G.members.some(q => !q.gone && inView(q.x, q.y)))) secs.lionSwim += dt;
        if (d.whites.some(W => W.depth < 0.8 && inView(W.x, W.y))) secs.shark += dt;
        if (d.whites.some(W => W.depth < 0.12 && inView(W.x, W.y))) secs.fin += dt;
        if (d.bluePods.some(W => W.members.some(m => inView(m.x, m.y)))) secs.whale += dt;
        if (d.blueBlows.some(B => inView(B.x, B.y))) secs.blow += dt;
        for (const W of d.whites) if (W.mode === 'breach' && inView(W.x, W.y) && !seenBreach.has(W.sx + ',' + W.sy)) { seenBreach.add(W.sx + ',' + W.sy); ev.breach++; }
        const sh = d.whites.some(W => W.mode === 'shadow'); if (sh && !prevShadow) ev.shadow++; prevShadow = sh;
        const stamp = d.slGroups.filter(G => G.from).length; if (stamp > stamp0) ev.stampede += stamp - stamp0; stamp0 = stamp;
        for (const W of d.bluePods) for (const m of W.members) if (m.lunge > 0.5 && inView(m.x, m.y) && !seenLunge.has(m.evT < 1 ? t : m)) { seenLunge.add(m); ev.lunge++; }
      }
      const f = (o) => Object.entries(o).map(([k, v]) => k + ' ' + (typeof v === 'number' && v % 1 ? v.toFixed(0) + 's' : v)).join(', ');
      return { t: Math.round(t), secs: f(secs), ev: f(ev), feats: feats.map(x => x.join('@')).join(' ') };
    }, seed);
    console.log(`seed ${seed}: ${r.t}s  in view: ${r.secs}\n          events: ${r.ev}   feats: ${r.feats || '-'}`);
  }
  console.log(errs.length ? 'errors: ' + errs.join(' | ') : 'no page errors'); await b.close(); })();
