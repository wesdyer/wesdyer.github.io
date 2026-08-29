// WHY IS THE IN-BAND CANDIDATE LOSING? (2026-08-29, the re-entry push, after C1).
// On avoidance-owned out-of-band ticks (desired heading in-band, chosen heading
// out of it), read applyAvoidance's own per-candidate ledger (window.__AVDBG
// full rows) and classify the CHEAPEST in-band candidate (|TWA| 30-50 deg on
// either board): vetoed by a boat collision (bc), a static/land collision (sc),
// a rule violation (rv), or merely out-priced by proximity (prox) / base cost.
// This decides C2's shape: a return-trajectory can beat a PRICE, not a VETO.
//   node _re_why.js <venue> <leg> <trials> <seed0> <tree>
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const VENUE = process.argv[2] || 'bay', LEG = parseInt(process.argv[3] || '1');
const TRIALS = parseInt(process.argv[4] || '4'), SEED0 = parseInt(process.argv[5] || '9400');
const ROOT = path.join(__dirname, process.argv[6] || 'treeRE');
(async () => {
    const br = await chromium.launch(); const page = await br.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 200)));
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    await page.evaluate((v) => localStorage.setItem('regatta_settings',
        JSON.stringify({ venue: v, character: AI_CONFIG[0].name })), VENUE);
    const agg = { n: 0, cls: {}, board: {}, gap: [], sameBoardInBand: 0, otherBoardInBand: 0, chosenOff: [] };
    for (let t = 0; t < TRIALS; t++) {
        const r = await page.evaluate(async ({ seed, LEG }) => {
            window.evalHarness.seed = seed; window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const pl = state.boats.find(x => x.isPlayer);
            applyBoatIdentity(pl, playerCharacter(), false); pl.isPlayer = false; pl.manualTrim = false;
            const nine = state.boats.filter(x => x !== pl);
            pl.ai.startLinePct = Math.max(0.05, Math.min(0.90, nine.reduce((a, x) => a + x.ai.startLinePct, 0) / nine.length));
            pl.ai.setupDist = 300;
            window.__AVDBG = { full: 1 };
            const nm = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
            const out = []; const dt = 1 / 60;
            for (let it = 0; it < 60 * 940; it++) {
                window.__AVLOG = [];
                window.update(dt);
                if (state.race.status === 'finished') break;
                if (state.race.status !== 'racing') continue;
                if (state.race.timer > 900) break;
                for (const e of window.__AVLOG) {
                    const b = state.boats.find(x => x.name === e.n); if (!b || b.raceState.leg !== LEG || !e.full) continue;
                    const wd = getWindAt(b.x, b.y).direction;
                    const twa0 = Math.abs(nm(e.h0 - wd)) * 180 / Math.PI;
                    const best = e.full.reduce((m, r) => r.cost < m.cost ? r : m, e.full[0]);
                    const twaB = Math.abs(nm(e.h0 + best.off - wd)) * 180 / Math.PI;
                    if (!(twa0 >= 30 && twa0 < 50 && twaB >= 50)) continue;
                    const s0 = nm(e.h0 - wd) > 0 ? 1 : -1;
                    const inb = e.full.map(r => { const tw = nm(e.h0 + r.off - wd); return { r, twa: Math.abs(tw) * 180 / Math.PI, side: tw > 0 ? 1 : -1 }; })
                        .filter(x => x.twa >= 30 && x.twa < 50);
                    if (!inb.length) { out.push({ cls: 'none-in-fan', board: '-', gap: null, off: best.off }); continue; }
                    const ch = inb.reduce((m, x) => x.r.cost < m.r.cost ? x : m, inb[0]);
                    const cls = ch.r.sc ? 'static' : ch.r.bc ? 'boat' : ch.r.rv ? 'rule' : (ch.r.prox > (ch.r.cost - ch.r.prox) ? 'prox' : 'base');
                    out.push({ cls, board: ch.side === s0 ? 'same' : 'other', gap: ch.r.cost - best.cost, off: best.off,
                        anyClean: inb.some(x => !x.r.sc && !x.r.bc && !x.r.rv) ? 1 : 0 });
                }
                if (state.boats.every(x => x.raceState.finished)) break;
            }
            return out;
        }, { seed: SEED0 + t, LEG });
        for (const e of r) {
            agg.n++; agg.cls[e.cls] = (agg.cls[e.cls] || 0) + 1; agg.board[e.board] = (agg.board[e.board] || 0) + 1;
            if (e.gap != null) agg.gap.push(e.gap); agg.chosenOff.push(Math.abs(e.off));
            if (e.anyClean) agg.sameBoardInBand++;
        }
    }
    await br.close();
    const med = a => { if (!a.length) return NaN; const s = [...a].sort((x, y) => x - y); return s[(s.length - 1) >> 1]; };
    const pct = (o, n) => Object.entries(o).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${(100 * v / n).toFixed(0)}%`).join('  ');
    console.log(`\n══ ${VENUE} leg ${LEG} — why the cheapest IN-BAND candidate loses on avoidance-owned out-of-band ticks (tree ${path.basename(ROOT)}, ${agg.n} ticks)`);
    console.log(`  cheapest in-band candidate is: ${pct(agg.cls, agg.n)}`);
    console.log(`  ...on the ${pct(agg.board, agg.n)} board; some CLEAN (no veto) in-band candidate existed on ${(100 * agg.sameBoardInBand / agg.n).toFixed(0)}% of ticks`);
    console.log(`  cost gap (in-band − chosen) med ${med(agg.gap).toFixed(0)}; chosen |offset| med ${(med(agg.chosenOff) * 180 / Math.PI).toFixed(0)} deg`);
})();
