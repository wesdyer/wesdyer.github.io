// WHAT τ WOULD AN ORCA UNDERLAY NEED? — the CPA geometry at avoidance ONSET.
//
// Truncated velocity-obstacle methods are parameterised by a time horizon τ:
// too short and the escape vectors are violent, too long and every neighbour is
// a permanent constraint (the arctic `look360` probe cost 48s of median doing
// exactly that). The right τ is a property of the encounters, not a taste, and
// it is measurable: at the frame where avoidance FIRST engages on a boat, how
// far ahead is the closest point of approach with the rival that caused it?
//
// Also records DCPA (how close it would get if nobody moved) and the RRS role,
// which is what an ORCA responsibility split would key on.
//
// ⚠️ getRiskMetrics is pure math on positions and headings — no state written —
// so this is read-only and the race is byte-identical to an uninstrumented run.
//
// node _cpa_onset_probe.js <trials> <seed0> <tree> [venue]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const TRIALS = parseInt(process.argv[2]) || 8;
const SEED0 = parseInt(process.argv[3]) || 9100;
const ROOT = path.join(__dirname, process.argv[4] || 'treeA');
const VENUE = process.argv[5] || 'bay';
const med = a => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : NaN; };
const q = (a, f) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(f * (s.length - 1))] : NaN; };

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.addInitScript((v) => {
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: v }));
    }, VENUE);
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });

    const all = [];
    for (let i = 0; i < TRIALS; i++) {
        const seed = SEED0 + i;
        const r = await page.evaluate(async ([seed, venue]) => {
            window.evalHarness.seed = seed;
            window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const bots = state.boats.filter(b => !b.isPlayer);
            const pl = state.boats.find(b => b.isPlayer);
            if (pl) { pl.x = venue === 'arctic' ? -4500 : 5900; pl.y = venue === 'arctic' ? 4700 : -6100; }
            const wasOn = new Map();
            const out = [];
            const dt = 1 / 60;
            for (let it = 0; it < 60 * 940; it++) {
                window.update(dt);
                if (state.race.status === 'finished') break;
                if (state.race.status !== 'racing') continue;
                if (state.race.timer > 900) break;
                if (it % 6) continue;
                for (const b of bots) {
                    if (b.raceState.finished) continue;
                    const c = b.controller;
                    const on = Math.abs((c && c.lastAvoidDeviation) || 0) > 0.12;
                    const prev = wasOn.get(b) || false;
                    wasOn.set(b, on);
                    if (!on || prev) continue;              // ONSET only
                    // The rival with the soonest CPA, if any is in range.
                    let best = null;
                    for (const o of state.boats) {
                        if (o === b || o.raceState.finished) continue;
                        const d = Math.hypot(o.x - b.x, o.y - b.y);
                        if (d > 600) continue;
                        const m = getRiskMetrics(b, o);
                        if (!(m.tCPA > 0)) continue;
                        if (!best || m.tCPA < best.tCPA) best = m;
                    }
                    out.push({
                        dev: +Math.abs(c.lastAvoidDeviation).toFixed(2),
                        tCPA: best ? +best.tCPA.toFixed(2) : null,
                        dCPA: best ? Math.round(best.distCPA) : null,
                        dNow: best ? Math.round(best.distCurrent) : null,
                        role: (c && c.avoidanceRole) || 'NONE',
                        risk: (c && c.riskState) || 'LOW',
                    });
                }
            }
            return out;
        }, [seed, VENUE]);
        all.push(...r);
        console.log(`seed ${seed}: ${r.length} avoidance onsets`);
    }
    await browser.close();

    const withRival = all.filter(r => r.tCPA != null);
    const iceOnly = all.filter(r => r.tCPA == null);
    const t = withRival.map(r => r.tCPA), d = withRival.map(r => r.dCPA);
    console.log(`\nCPA AT AVOIDANCE ONSET — ${VENUE}, ${TRIALS} seeds, ${all.length} onsets`);
    console.log(`  with a closing rival in range: ${withRival.length} (${(100 * withRival.length / all.length).toFixed(0)}%)` +
                `   no closing rival (ice/land): ${iceOnly.length} (${(100 * iceOnly.length / all.length).toFixed(0)}%)`);
    if (withRival.length) {
        console.log(`  tCPA  p10 ${q(t, .1).toFixed(1)}  p25 ${q(t, .25).toFixed(1)}  MED ${med(t).toFixed(1)}` +
                    `  p75 ${q(t, .75).toFixed(1)}  p90 ${q(t, .9).toFixed(1)}  (seconds)`);
        console.log(`  dCPA  p10 ${q(d, .1)}  p25 ${q(d, .25)}  MED ${med(d)}  p75 ${q(d, .75)}  p90 ${q(d, .9)}  (units)`);
        console.log(`  dNow  MED ${med(withRival.map(r => r.dNow))}u`);
        const tally = k => {
            const m = {};
            for (const r of withRival) m[r[k]] = (m[r[k]] || 0) + 1;
            return Object.entries(m).sort((a, b) => b[1] - a[1])
                .map(([x, y]) => `${x} ${(100 * y / withRival.length).toFixed(0)}%`).join(' | ');
        };
        console.log(`  role at onset:  ${tally('role')}`);
        console.log(`  risk at onset:  ${tally('risk')}`);
        const within = f => (100 * t.filter(x => x <= f).length / t.length).toFixed(0);
        console.log(`  share of onsets with tCPA <= 4s: ${within(4)}%   <= 6s: ${within(6)}%   <= 10s: ${within(10)}%`);
    }
})();
