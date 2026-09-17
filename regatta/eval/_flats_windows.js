// PASSAGE ENTRY WINDOWS — the question a long cut asks is not "does it fill" but "can a boat
// that enters now get OUT before the ebb strands it". For every marked passage (doc.tide
// .passages) this sails a point down the centreline at the polar's speed V times the shoal
// drag (Tide.mulForDepth) starting at every entry second of the cycle, and reports the set
// of entry times that get through afloat (depth >= draft the whole way) and the set that get
// through AT SPEED (drag multiplier >= 0.85 the whole way). Wes's rule for the big cuts
// (Sep 16): "enough time to traverse at speed, but little more".
//   NODE_PATH=node_modules node regatta/eval/_flats_windows.js [--v 140] [--dir both]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const ARGS = process.argv.slice(2);
const flag = (k, d) => { const i = ARGS.indexOf(k); return i >= 0 ? ARGS[i + 1] : d; };
const V = +flag("--v", 110);           // u/s: a run at VMG angles (bots ~108 through the neck); the fleet's median over the course is 134, reaches included
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('pageerror', e => console.log('PAGEERROR', String(e).slice(0, 200)));
  await page.goto('file://' + path.resolve('regatta/index.html'));
  await page.addScriptTag({ content: fs.readFileSync('regatta/eval/eval_harness.js', 'utf8') });
  await page.waitForTimeout(400);
  const out = await page.evaluate((V) => {
    localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'flats' }));
    window.resetGame(); window.startRace();
    const T = state.tide, P = state.course.doc.tide.passages || [];
    const level = (t) => T.mid + T.amp * Math.sin(2 * Math.PI * t / T.period + T.phase0);
    // HW phase: the t in [0, period) with the highest level
    let tHW = 0, best = -9; for (let t = 0; t < T.period; t += 0.1) { const l = level(t); if (l > best) { best = l; tHW = t; } }
    const res = [];
    for (const p of P) {
      const samples = [];       // [x, y, z, s]
      let sAcc = 0;
      for (let i = 1; i < p.pts.length; i++) {
        const a = p.pts[i - 1], b = p.pts[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(L / 10));
        for (let k = 0; k < n; k++) { const f = k / n; const x = a[0] + (b[0] - a[0]) * f, y = a[1] + (b[1] - a[1]) * f; samples.push([x, y, Tide.groundAt(x, y), sAcc + L * f]); }
        sAcc += L;
      }
      const Ltot = sAcc;
      // the timed part: samples that dry at some point of the cycle (z > LW - draft)
      const LW = T.mid - T.amp;
      const dries = samples.filter(s => s[2] > LW - T.draft);
      const timedU = dries.length * 10;
      let zmax = -99, at = null; for (const s of samples) if (s[2] > zmax) { zmax = s[2]; at = s; }
      // sail it from every entry time; forward and reverse
      const run = (t0, rev) => {
        const seq = rev ? samples.slice().reverse() : samples;
        let t = t0, minMul = 1, minDepth = 9, worst = null;
        for (let i = 0; i < seq.length; i++) {
          const s = seq[i];
          const d = level(t) - s[2];
          if (d < minDepth) { minDepth = d; worst = s; }
          if (d < T.draft) return { ok: false, t: t - t0, s: s[3], minDepth, minMul, worst };
          const m = Tide.mulForDepth(d); if (m < minMul) minMul = m;
          const ds = i + 1 < seq.length ? Math.abs(seq[i + 1][3] - s[3]) : 0;
          t += ds / (V * m);
        }
        return { ok: true, t: t - t0, minDepth, minMul, worst };
      };
      const rel = (t) => { let r = t - tHW; while (r > T.period / 2) r -= T.period; while (r < -T.period / 2) r += T.period; return r; };
      const both = {};
      for (const rev of [false, true]) {
        const okT = [], fastT = [], fastTimes = [];
        let bestRun = null;
        for (let t0 = 0; t0 < T.period; t0 += 0.25) {
          const r = run(t0, rev);
          if (r.ok) { okT.push(t0); if (r.minMul >= 0.85) { fastT.push(t0); fastTimes.push(r.t); } if (!bestRun || r.minDepth > bestRun.minDepth) bestRun = { ...r, t0 }; }
          else if (!bestRun) { /* keep looking */ }
        }
        // where the failures strand at the best entry ± the window edge
        const firstFail = (() => { if (!okT.length) return run(tHW, rev); const edge = okT[okT.length - 1] + 0.25; return run(edge % T.period, rev); })();
        // the windows as arcs of the cycle (they straddle t=0): start after the longest gap
        const arc = (ts) => { if (!ts.length) return [null, null]; const N = Math.round(T.period / 0.25); const on = new Uint8Array(N); for (const t of ts) on[Math.round(t / 0.25) % N] = 1;
          let start = -1; for (let i = 0; i < N; i++) if (on[i] && !on[(i + N - 1) % N]) { start = i; break; } if (start < 0) return [-T.period / 2, T.period / 2];
          let end = start; while (on[(end + 1) % N]) end++; return [+rel(start * 0.25).toFixed(1), +rel((end % N) * 0.25).toFixed(1)]; };
        const okA = arc(okT), fastA = arc(fastT);
        both[rev ? 'rev' : 'fwd'] = { okSecs: okT.length * 0.25, fastSecs: fastT.length * 0.25,
          okFrom: okA[0], okTo: okA[1], fastFrom: fastA[0], fastTo: fastA[1],
          traverse: fastTimes.length ? +Math.min(...fastTimes).toFixed(1) : (bestRun ? +bestRun.t.toFixed(1) : null),
          bestMinDepth: bestRun ? +bestRun.minDepth.toFixed(2) : null, bestMinMul: bestRun ? +bestRun.minMul.toFixed(2) : null,
          strandAt: firstFail && !firstFail.ok ? [Math.round(firstFail.worst[0]), Math.round(firstFail.worst[1]), Math.round(firstFail.s)] : null };
      }
      res.push({ id: p.id, name: p.name, len: Math.round(Ltot), timedU, zmax: +zmax.toFixed(2), at: [Math.round(at[0]), Math.round(at[1])], ...both });
    }
    // THE LADDER: what each cut is worth against the channel it bypasses — the router's own
    // polar time from the cut's first point to its last, once on the always-wet grid
    // (channel only) and once with the cut's cells opened (the tide flattened to deep water
    // for the pricing, so both are pure sailing time).
    const c = state.course, base = c._botGridStatic || c.botGrid;
    const safe = Tide.safeGrid(base);
    const HWl = T.mid + T.amp, keep = { mid: T.mid, amp: T.amp };
    const distToLine = (x, y, pts) => { let d = 1e9; for (let i = 1; i < pts.length; i++) { const ax = pts[i-1][0], ay = pts[i-1][1], bx = pts[i][0], by = pts[i][1]; const vx = bx-ax, vy = by-ay, L2 = vx*vx+vy*vy||1; let u = ((x-ax)*vx+(y-ay)*vy)/L2; u = Math.max(0, Math.min(1, u)); d = Math.min(d, Math.hypot(x-ax-u*vx, y-ay-u*vy)); } return d; };
    T.mid = 5; T.amp = 0;    // flatten: every stamped cell prices as deep water
    for (const r of res) {
      const p = P.find(q => q.id === r.id), A = p.pts[0], B = p.pts[p.pts.length - 1];
      const pc = SailCheck.pathSailable(safe, A, B);
      const N = safe.n, nav = safe.nav.slice();
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const k = j*N+i; if (!nav[k] && base.nav[k] && base._elev[k] <= HWl - T.draft - 0.34) { const [wx, wy] = base.world(i, j); if (distToLine(wx, wy, p.pts) <= 320) nav[k] = 1; } }
      const open = Object.assign({}, safe, { nav, _clear: null, _tight: null }); open.at = (i, j) => (i < 0 || j < 0 || i >= N || j >= N) ? 0 : nav[j*N+i];
      const po = SailCheck.pathSailable(open, A, B);
      const tOf = (pth) => pth && pth.times ? +pth.times[pth.times.length - 1].toFixed(1) : null;
      const lenOf = (pth) => { if (!pth) return null; let L = 0; for (let i = 1; i < pth.length; i++) L += Math.hypot(pth[i][0] - pth[i-1][0], pth[i][1] - pth[i-1][1]); return Math.round(L); };
      r.tChannel = tOf(pc); r.tCut = tOf(po); r.lenChannel = lenOf(pc); r.lenCut = lenOf(po);
    }
    T.mid = keep.mid; T.amp = keep.amp;
    return { V, draft: T.draft, free: T.free, period: T.period, tHW: +tHW.toFixed(1), res };
  }, V);
  console.log(`V ${out.V} u/s  draft ${out.draft}  free ${out.free}  period ${out.period}s  (entry times are relative to HW; "ok" = afloat all the way, "fast" = drag mul >= 0.85 all the way)`);
  for (const r of out.res) {
    const f = r.fwd, b = r.rev;
    console.log(`${r.id.padEnd(11)} ${String(r.len).padStart(5)}u (timed ${String(r.timedU).padStart(5)}u) high ${String(r.zmax).padStart(5)} at (${r.at})`);
    console.log(`    fwd: traverse ${String(f.traverse).padStart(5)}s  afloat entry ${String(f.okSecs).padStart(5)}s [${f.okFrom}..${f.okTo}]  at-speed entry ${String(f.fastSecs).padStart(5)}s [${f.fastFrom}..${f.fastTo}]  best minDepth ${f.bestMinDepth} minMul ${f.bestMinMul}  strands at ${f.strandAt}`);
    console.log(`    rev: traverse ${String(b.traverse).padStart(5)}s  afloat entry ${String(b.okSecs).padStart(5)}s [${b.okFrom}..${b.okTo}]  at-speed entry ${String(b.fastSecs).padStart(5)}s [${b.fastFrom}..${b.fastTo}]`);
  }
  console.log('\nTHE LADDER  (router polar time A->B: channel only vs the cut opened; window = at-speed entry slack)');
  for (const r of out.res.slice().sort((a, b) => (b.tChannel - b.tCut) - (a.tChannel - a.tCut)))
    console.log(`  ${r.id.padEnd(11)} channel ${String(r.tChannel).padStart(5)}s/${String(r.lenChannel).padStart(5)}u  cut ${String(r.tCut).padStart(5)}s/${String(r.lenCut).padStart(5)}u  saves ${String((r.tChannel - r.tCut).toFixed(1)).padStart(5)}s   at-speed window ${String(r.fwd.fastSecs).padStart(5)}s [${r.fwd.fastFrom}..${r.fwd.fastTo}]  afloat ${String(r.fwd.okSecs).padStart(5)}s`);
  await browser.close();
})();
