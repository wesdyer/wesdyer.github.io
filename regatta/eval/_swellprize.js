// HOW MUCH OF THE SEA IS THE FLEET ACTUALLY COLLECTING?
//
//   node regatta/eval/_swellprize.js [races] [seed0]
//
// `_swellangle.js` says what a perfectly-held angle achieves in this sea. This says what
// the fleet achieves, in a real race, and runs the SAME seeds with the sea switched off
// so the swell's contribution is a paired difference rather than an absolute.
//
// The gap between the two is the size of the prize, and it is reported in the units that
// matter: knots of VMG and seconds of race.
//
// ⚠️ The sea is switched off by re-configuring `Swell` with a null document AFTER the
// course is built, so everything else about the race — course, fleet, seeds, wind — is
// identical. Nothing else in the venue document is touched.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const RACES = +(process.argv[2] || 6);
const SEED0 = +(process.argv[3] || 9300);

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  await p.addInitScript(() => localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'ocean' })));
  await p.goto('file://' + path.resolve('regatta/index.html'));
  await p.waitForFunction(() => window.state && window.updateBoat, null, { timeout: 20000 });
  await p.addScriptTag({ content: fs.readFileSync(path.resolve('regatta/eval/eval_harness.js'), 'utf8') });

  const runs = { sea: [], flat: [] };
  for (let i = 0; i < RACES; i++) {
    for (const mode of ['sea', 'flat']) {
      const r = await p.evaluate(async ([seed, mode]) => {
        window.evalHarness.seed = seed;
        window.resetGame(); window.startRace();
        if (mode === 'flat') window.Swell.configure(null, state.wind.baseDirection);
        state.course.cutoff = 900;
        const bots = state.boats.filter(b => !b.isPlayer);
        const pl = state.boats.find(b => b.isPlayer); pl.x = 1e6; pl.y = 1e6;
        const norm = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
        const inf = bots.map(bt => ({ name: bt.name, fin: null, upD: 0, upT: 0, dnD: 0, dnT: 0,
                                      face: 0, climb: 0, surf: 0 }));
        // VMG made GOOD, binned by the angle actually being sailed. This is what separates
        // "she chose the wrong angle" from "she sailed the right angle badly": bin by bin
        // it can be laid beside the held-angle curve, which has no traffic, no steering
        // error and no mark to lay.
        const BIN = 4, B0 = 100, NB = 21;                       // 100..184 in 4-degree bins
        const bins = Array.from({ length: NB }, () => ({ d: 0, t: 0, hdErr: 0, n: 0 }));
        const UB = 2, U0 = 28, UN = 24;                         // 28..76 in 2-degree bins
        const ubins = Array.from({ length: UN }, () => ({ d: 0, t: 0, hdErr: 0, n: 0 }));
        const dt = 1 / 60;
        for (let it = 0; it < 60 * 940; it++) {
          const prev = bots.map(bt => ({ x: bt.x, y: bt.y }));
          const wd = bots.map(bt => getWindAt(bt.x, bt.y).direction);
          window.update(dt);
          if (state.race.status === 'finished') break;
          if (state.race.status !== 'racing') continue;
          if (state.race.timer > 900) break;
          for (let k = 0; k < bots.length; k++) {
            const bt = bots[k], f = inf[k];
            if (bt.raceState.finished) { if (f.fin == null) f.fin = Math.round(state.race.timer); continue; }
            const twa = Math.abs(norm(bt.heading - wd[k])) * 180 / Math.PI;
            // ground travel resolved on the wind axis: + upwind, - downwind
            const ux = Math.sin(wd[k]), uy = -Math.cos(wd[k]);
            const vm = (bt.x - prev[k].x) * ux + (bt.y - prev[k].y) * uy;
            if (twa < 75) {
              f.upD += vm; f.upT += dt;
              const ui = Math.floor((twa - U0) / UB);
              if (ui >= 0 && ui < UN) {
                const q = ubins[ui];
                q.d += vm; q.t += dt; q.n++;
                const c = bt.controller;
                q.hdErr += Math.abs(norm(bt.heading - ((c && c.targetHeading != null) ? c.targetHeading : bt.heading))) * 180 / Math.PI;
              }
            }
            else if (twa > 105) {
              f.dnD += -vm; f.dnT += dt;
              if (bt.swell) {
                if (bt.swell.surfKt > 0) f.face++; else f.climb++;
                if (bt.swell.surf01 > 0.34 && bt.swell.withWave) f.surf++;
              }
              const bi = Math.floor((twa - B0) / BIN);
              if (bi >= 0 && bi < NB) {
                const q = bins[bi];
                q.d += -vm; q.t += dt; q.n++;
                // How far the helm is from where the controller pointed it — the steering
                // error the held-angle measurement assumes away.
                const c = bt.controller;
                const want = (c && c.targetHeading != null) ? c.targetHeading : bt.heading;
                q.hdErr += Math.abs(norm(bt.heading - want)) * 180 / Math.PI;
              }
            }
          }
          if (inf.every(f => f.fin != null)) break;
        }
        return { seed, mode, swellOn: !!(window.Swell.active && window.Swell.active()), inf,
                 bins: bins.map((q, i) => ({ twa: B0 + i * BIN + BIN / 2, ...q })),
                 ubins: ubins.map((q, i) => ({ twa: U0 + i * UB + UB / 2, ...q })) };
      }, [SEED0 + i, mode]);
      runs[mode].push(r);
    }
    const s = runs.sea[i], f = runs.flat[i];
    const fin = (r) => r.inf.filter(x => x.fin != null).length;
    console.log(`seed ${SEED0 + i}: sea ${fin(s)} finishers (swell=${s.swellOn}), flat ${fin(f)} (swell=${f.swellOn})`);
  }

  const agg = (rs) => {
    let upD = 0, upT = 0, dnD = 0, dnT = 0, face = 0, climb = 0, surf = 0, n = 0, fins = [];
    for (const r of rs) for (const f of r.inf) {
      upD += f.upD; upT += f.upT; dnD += f.dnD; dnT += f.dnT;
      face += f.face; climb += f.climb; surf += f.surf; n++;
      if (f.fin != null) fins.push(f.fin);
    }
    fins.sort((a, c) => a - c);
    return { upKt: (upD / upT) / 15, dnKt: (dnD / dnT) / 15,
             facePct: 100 * face / Math.max(1, face + climb),
             surfPct: 100 * surf / Math.max(1, face + climb),
             med: fins.length ? fins[Math.floor(fins.length / 2)] : null,
             mean: fins.length ? +(fins.reduce((a, c) => a + c, 0) / fins.length).toFixed(1) : null,
             nfin: fins.length, n, dnShare: 100 * dnT / (dnT + upT) };
  };
  const S = agg(runs.sea), F = agg(runs.flat);
  const binAgg = (rs, key) => {
    key = key || 'bins';
    const out = [];
    for (let i = 0; i < rs[0][key].length; i++) {
      let d = 0, t = 0, h = 0, n = 0;
      for (const r of rs) { d += r[key][i].d; t += r[key][i].t; h += r[key][i].hdErr; n += r[key][i].n; }
      out.push({ twa: rs[0][key][i].twa, kt: t > 0 ? (d / t) / 15 : null, hdErr: n ? h / n : null,
                 share: n });
    }
    const tot = out.reduce((a, c) => a + c.share, 0) || 1;
    for (const o of out) o.share = 100 * o.share / tot;
    return out;
  };
  const BS = binAgg(runs.sea), BF = binAgg(runs.flat);
  const US = binAgg(runs.sea, 'ubins'), UF = binAgg(runs.flat, 'ubins');
  // paired per boat
  const key = (r, f) => r.seed + ':' + f.name;
  const A = {}, B = {};
  for (const r of runs.flat) for (const f of r.inf) A[key(r, f)] = f.fin;
  for (const r of runs.sea) for (const f of r.inf) B[key(r, f)] = f.fin;
  const d = Object.keys(A).filter(k => A[k] != null && B[k] != null).map(k => A[k] - B[k]).sort((a, c) => a - c);

  console.log(`\nBluewater — ${RACES} races from ${SEED0}, sea vs the same race with the sea off\n`);
  console.log(`                          sea        flat`);
  console.log(`  upwind VMG made      ${S.upKt.toFixed(3)} kt   ${F.upKt.toFixed(3)} kt`);
  console.log(`  downwind VMG made    ${S.dnKt.toFixed(3)} kt   ${F.dnKt.toFixed(3)} kt`);
  console.log(`  on a face            ${S.facePct.toFixed(1)}%      ${F.facePct.toFixed(1)}%`);
  console.log(`  surfing              ${S.surfPct.toFixed(1)}%      ${F.surfPct.toFixed(1)}%`);
  console.log(`  finish median        ${S.med}         ${F.med}`);
  console.log(`  finish mean          ${S.mean}       ${F.mean}`);
  console.log(`  finishers            ${S.nfin}/${S.n}      ${F.nfin}/${F.n}`);
  console.log(`  share of race downwind  ${S.dnShare.toFixed(0)}%`);
  console.log(`\n  paired (positive = the sea makes her faster): median ${d.length ? d[Math.floor(d.length / 2)] : '-'}s  ` +
              `mean ${d.length ? (d.reduce((a, c) => a + c, 0) / d.length).toFixed(1) : '-'}s  over ${d.length} boats`);
  console.log('\n  DOWNWIND VMG MADE GOOD, BINNED BY THE ANGLE ACTUALLY SAILED');
  console.log('   TWA    sea kt   flat kt   sea-flat   share of downwind   helm error (sea/flat)');
  for (let i = 0; i < BS.length; i++) {
    if (BS[i].share < 0.5 && BF[i].share < 0.5) continue;
    const s1 = BS[i].kt, f1 = BF[i].kt;
    console.log(`  ${String(BS[i].twa).padStart(4)}   ${s1 == null ? '  -  ' : s1.toFixed(2).padStart(6)}   ${f1 == null ? '  -  ' : f1.toFixed(2).padStart(6)}    ` +
                `${(s1 != null && f1 != null) ? (s1 - f1).toFixed(2).padStart(6) : '   -  '}       ${BS[i].share.toFixed(1).padStart(5)}%          ` +
                `${BS[i].hdErr == null ? '-' : BS[i].hdErr.toFixed(1)} / ${BF[i].hdErr == null ? '-' : BF[i].hdErr.toFixed(1)}`);
  }
  console.log('\n  UPWIND VMG MADE GOOD, BINNED BY THE ANGLE ACTUALLY SAILED');
  console.log('   TWA    sea kt   flat kt   sea-flat   share of upwind   helm error (sea/flat)');
  for (let i = 0; i < US.length; i++) {
    if (US[i].share < 0.5 && UF[i].share < 0.5) continue;
    const s1 = US[i].kt, f1 = UF[i].kt;
    console.log(`  ${String(US[i].twa).padStart(4)}   ${s1 == null ? '  -  ' : s1.toFixed(2).padStart(6)}   ${f1 == null ? '  -  ' : f1.toFixed(2).padStart(6)}    ` +
                `${(s1 != null && f1 != null) ? (s1 - f1).toFixed(2).padStart(6) : '   -  '}       ${US[i].share.toFixed(1).padStart(5)}%          ` +
                `${US[i].hdErr == null ? '-' : US[i].hdErr.toFixed(1)} / ${UF[i].hdErr == null ? '-' : UF[i].hdErr.toFixed(1)}`);
  }
  if (errs.length) console.log('\nERRORS: ' + errs.slice(0, 4).join(' | '));
  await b.close();
})();
