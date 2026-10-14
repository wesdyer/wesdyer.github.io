// PT-090 probe: Spoonbill Flats waders over four tide cycles, no boat near, then a boat put on each
// flock in turn. Counts: FLICKER (a bird back 'up' within 0.25 s of landing), DEEP (flock-seconds with
// its patch past wading depth while 'feed'), MASS HOPS (>= 60% of a flock going 'up' inside 0.15 s while
// the flock itself is feeding), NO-FLUSH (a boat on a feeding flock and no bird up within 2 s), and
// flocks with no roost.            node eval/rl/_pt090_probe.js [seed]
const { chromium } = require('playwright'); const path = require('path');
const SEED = +(process.argv[2] || 3);
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve('index.html'));
  await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
  const r = await p.evaluate((SEED) => { let s = SEED;
    Math.random = () => { let t = s += 0x6D2B79F5; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'flats', soundEnabled: false, musicEnabled: false, bgSoundEnabled: false }));
    selectVenue('flats'); resetGame(); startRace();
    const park = () => { for (const bt of state.boats) { bt.x = 1e6; bt.y = 1e6; bt.speed = 0; } };
    const D = () => Wildlife.debug(), flocks = () => [...D().spoonFlocks, ...D().avoFlocks];
    const onLandAt = (x, y) => typeof pointOnLand === 'function' ? pointOnLand(x, y) : '?';
    const stat = { why: {}, relaunch: {}, flicker: 0, landings: 0, deepS: 0, massHops: 0, noFlush: 0, flushTests: 0, noRoost: flocks().filter(F => !F.roost).length, flocks: flocks().length };
    const dt = 1 / 30; let t = 0;
    const per = new Map();
    const step = () => { update(dt); t += dt;
      for (const F of flocks()) {
        const ups = [];
        for (const bd of F.birds) { const pm = per.get(bd) || { mode: bd.mode, landT: -9 };
          if (pm.mode !== 'wade' && bd.mode === 'wade') { stat.landings++; pm.landT = t; }
          if (pm.mode === 'wade' && bd.mode !== 'wade') { if (t - pm.landT < 0.25) { stat.flicker++; const k = `${F.kind}|flock ${F.mode}${F.roosting ? '/roost' : ''}|hop ${!!bd.hop}|land ${onLandAt(bd.x, bd.y)}`; stat.why[k] = (stat.why[k] || 0) + 1; } ups.push(bd); }
          pm.mode = bd.mode; per.set(bd, pm); }
        if (F._pm !== F.mode) { if (F.mode === 'fly' && F._pm === 'feed' && t - (F._feedT || -9) < 0.5) { const k = `relaunch ${F.kind} after ${(t - F._feedT).toFixed(2)}s roost ${F.roosting} wasRoost ${F._wasRoost} depth ${Tide && Tide.level ? Tide.level().toFixed(2) : '?'}`; stat.relaunch[k] = (stat.relaunch[k] || 0) + 1; } if (F.mode === 'feed') { F._feedT = t; F._wasRoost = F.roosting; } F._pm = F.mode; }
        F._ups = (F._ups || []).filter(u => t - u < 0.15).concat(ups.map(() => t));
        if (F.mode === 'feed' && F._ups.length >= 0.6 * F.birds.length && !F._massed) { stat.massHops++; F._massed = true; }
        if (F._ups.length === 0) F._massed = false;
        if (F.mode === 'feed' && !F.roosting) { const dep = Wildlife.debug && null; }
      } };
    for (let i = 0; i < 240 * 30; i++) { park(); step();
      if (i % 30 === 0) for (const F of flocks()) if (F.mode === 'feed' && !F.roosting && F.birds.some(bd => bd.mode !== 'wade')) stat.deepS++; }
    // a boat on each feeding flock
    const me = state.boats[0];
    for (const F of flocks()) {
      for (let i = 0; i < 30 * 3; i++) { park(); step(); }
      if (F.mode !== 'feed') continue;
      stat.flushTests++;
      let up = false;
      for (let i = 0; i < 60; i++) { park(); me.x = F.cx; me.y = F.cy; step(); if (F.birds.some(bd => bd.mode === 'up' || bd.mode === 'fly')) { up = true; break; } }
      if (!up) stat.noFlush++;
    }
    return stat;
  }, SEED);
  console.log(JSON.stringify(r)); console.log(errs.length ? 'errors: ' + errs.slice(0, 3).join(' | ') : 'no page errors'); await b.close(); })();
