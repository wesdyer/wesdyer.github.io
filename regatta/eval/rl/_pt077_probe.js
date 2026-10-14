// PT-077 probe: Glacier Sound swimmers stuck against ice. Steps the race SECS with the boats parked
// away, samples every swimmer each second, and calls one STUCK when it has moved < 25 u over the
// last 8 s while it should be travelling: orca pods (leader) and members, leopard seals in the water
// (not hauled out), penguin swim groups. Reports per kind: animal-seconds stuck, distinct stuck
// animals, and the longest spell.        SECS=600 node eval/rl/_pt077_probe.js [seed]
const { chromium } = require('playwright'); const path = require('path');
const SEED = +(process.argv[2] || 5), SECS = +(process.env.SECS || 600);
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve('index.html'));
  await p.waitForFunction(() => window.state && window.Wildlife && typeof resetGame === 'function');
  const r = await p.evaluate(({ SEED, SECS }) => { let s = SEED;
    Math.random = () => { let t = s += 0x6D2B79F5; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'arctic', soundEnabled: false, musicEnabled: false, bgSoundEnabled: false }));
    selectVenue('arctic'); resetGame(); startRace();
    const park = () => { for (const bt of state.boats) { bt.x = 1e6; bt.y = 1e6; bt.speed = 0; } };
    const hist = new Map(), out = {}, spells = new Map(), where = {};
    const track = (kind, o, x, y, extra) => {
      const h = hist.get(o) || []; h.push([x, y]); if (h.length > 9) h.shift(); hist.set(o, h);
      const R = out[kind] || (out[kind] = { stuckS: 0, animals: new Set(), longest: 0, seen: new Set() }); R.seen.add(o);
      if (h.length === 9 && Math.hypot(x - h[0][0], y - h[0][1]) < 25) { R.stuckS++; R.animals.add(o); const sp = (spells.get(o) || 0) + 1; spells.set(o, sp); R.longest = Math.max(R.longest, sp);
        if (sp === 10) { const k = kind + ' @' + Math.round(x / 100) * 100 + ',' + Math.round(y / 100) * 100 + (extra ? ' ' + extra : ''); where[k] = (where[k] || 0) + 1; } }
      else spells.set(o, 0);
    };
    for (let sec = 0; sec < SECS; sec++) {
      for (let i = 0; i < 30; i++) { park(); update(1 / 30); }
      const D = Wildlife.debug();
      for (const W of D.orcaPods) { track('orca pod', W, W.x, W.y, 'wp' + W.wi); for (const m of W.members) track('orca member', m, m.x, m.y, 'pod ' + W.cfg.id); }
      for (const S of D.lseals) if (S.mode !== 'haul' && S.mode !== 'launch') track('leopard seal (' + S.mode + ')', S, S.x, S.y);
      for (const S of D.swimmers) track('penguin swim group', S, S.x, S.y);
    }
    const res = {}; for (const k in out) res[k] = { tracked: out[k].seen.size, stuckAnimals: out[k].animals.size, stuckSeconds: out[k].stuckS, longestS: out[k].longest };
    return { res, where };
  }, { SEED, SECS });
  console.log(JSON.stringify(r.res, null, 1)); console.log('stuck 10 s+ at:', JSON.stringify(r.where));
  console.log(errs.length ? 'errors: ' + errs.slice(0, 3).join(' | ') : 'no page errors'); await b.close(); })();
