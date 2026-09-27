// Probe: the Flats' animals — counts, placement, per-frame cost, and how they ride a tide cycle
// (hauled seals, flocks feeding/flying, crabs visible/buried), sampled over two minutes of race.
const { chromium } = require('playwright'); const path = require('path');
(async () => { const b = await chromium.launch(); const p = await b.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.Tide && typeof resetGame === 'function');
  const r = await p.evaluate(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'flats', soundEnabled: false, musicEnabled: false, bgSoundEnabled: false }));
    selectVenue('flats'); resetGame(); const t0 = performance.now(); Wildlife.init(); const tInit = performance.now() - t0; startRace();
    const d = Wildlife.debug(); for (const o of state.boats) { o.x = 1e6; o.y = 1e6; }
    const out = { init: Math.round(tInit), seals: d.gsealCols.map(C => [Math.round(C.cx), Math.round(C.cy), C.z.toFixed(2), C.seals.length]), spoon: d.spoonFlocks.map(F => F.birds.length).join(','), avo: d.avoFlocks.map(F => F.birds.length).join(','), crabs: d.scrabBeds.length + ' beds / ' + d.scrabBeds.reduce((n, B) => n + B.crabs.length, 0), log: [] };
    let ms = 0, n = 0;
    for (let i = 0; i < 30 * 120; i++) { const a = performance.now(); Wildlife.update(1 / 30); ms += performance.now() - a; n++; update(1 / 30);
      if (i % 150 === 0) { const hauled = d.gsealCols.map(C => C.seals.filter(s => s.mode === 'haul').length).join('/'); const sw = d.gsealCols.reduce((k, C) => k + C.seals.filter(s => s.mode === 'swim').length, 0);
        const fly = d.spoonFlocks.filter(F => F.mode === 'fly').length + '+' + d.avoFlocks.filter(F => F.mode === 'fly').length;
        const bad = d.spoonFlocks.concat(d.avoFlocks).reduce((k, F) => k + F.birds.filter(b2 => b2.mode === 'wade' && (Tide.depthAt(b2.x, b2.y) > 0.6)).length, 0);
        const onl = d.spoonFlocks.concat(d.avoFlocks).filter(F => F.roosting).length + ' roosting';
        out.log.push(`t${Math.round(state.race.timer)} lvl ${Tide.level().toFixed(2)} hauled ${hauled} swim ${sw} flocksFlying ${fly} deepWaders ${bad} onLand ${onl}`); } }
    out.msPerFrame = (ms / n).toFixed(2); return out; });
  console.log(JSON.stringify({ ...r, log: undefined }, null, 0)); console.log(r.log.join('\n')); if (errs.length) console.log('ERR', errs[0]); await b.close(); })();
