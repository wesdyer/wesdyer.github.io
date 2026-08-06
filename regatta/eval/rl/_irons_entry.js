// WHAT PUT HER HEAD TO WIND? — attribute the ENTRY into irons, not the time spent there.
//
// `_stall_probe` says 31.5% of the fleet's sub-1-knot time on Stillwater Lake is spent
// head to wind, and blocking slow tacks did not remove it (episode count unchanged), so
// the tack DECISION is not the cause. This finds the moment each stall begins and asks
// what the boat was doing in the two seconds before it.
//
// The candidates, in the order the code could produce them:
//   TACK       the strategy layer commanded a heading across the wind
//   AVOID      applyAvoidance was deflecting her (lastAvoidDeviation) into the no-go
//   WIGGLE     the unstick manoeuvre was driving
//   ROUNDING   she is inside a mark's zone, where the target swings hard
//   PENALTY    serving a turn — legitimate
//   DRIFT      none of the above: she simply lost way and rounded up
//
//   node _irons_entry.js <trials> <seed0> <tree> [venue]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const TRIALS = parseInt(process.argv[2]) || 3;
const SEED0 = parseInt(process.argv[3]) || 9100;
const ROOT = path.join(__dirname, process.argv[4] || 'treeLANDED');
const VENUE = process.argv[5] || 'lake';
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.addInitScript((v) => {
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: v }));
    }, VENUE);
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const tot = { n: 0, tack: 0, avoid: 0, wiggle: 0, rounding: 0, penalty: 0, drift: 0,
                  durs: [], entrySpd: [] };
    for (let i = 0; i < TRIALS; i++) {
        const r = await page.evaluate(async (seed) => {
            window.evalHarness.seed = seed;
            window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const bots = state.boats.filter(b => !b.isPlayer);
            const pl = state.boats.find(b => b.isPlayer); pl.x = 1e6; pl.y = 1e6;
            const norm = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
            const out = { n: 0, tack: 0, avoid: 0, wiggle: 0, rounding: 0, penalty: 0,
                          drift: 0, durs: [], entrySpd: [] };
            const hist = bots.map(() => []);       // last 2 s of per-boat state
            const inIrons = bots.map(() => 0);
            const dt = 1 / 60; let acc = 0;
            for (let it = 0; it < 60 * 940; it++) {
                window.update(dt);
                if (state.race.status === 'finished') break;
                if (state.race.status !== 'racing') continue;
                if (state.race.timer > 900) break;
                if (++acc < 6) continue;
                acc = 0;
                for (let k = 0; k < bots.length; k++) {
                    const b = bots[k];
                    if (b.raceState.finished) continue;
                    const c = b.controller;
                    const w = getWindAt(b.x, b.y);
                    const twa = Math.abs(norm(b.heading - w.direction));
                    const kt = b.speed / 0.25;
                    const tgtTwa = c ? Math.abs(norm((c.targetHeading || b.heading) - w.direction)) : Math.PI;
                    const h = hist[k];
                    h.push({ twa, kt, tgtTwa,
                             avd: c ? Math.abs(c.lastAvoidDeviation || 0) : 0,
                             wig: c ? !!c.wiggleActive : false,
                             rnd: !!b.raceState.isRounding,
                             pen: (b.raceState.penaltyTurnsOwed || 0) > 0 });
                    if (h.length > 20) h.shift();
                    const stalled = twa < 35 * Math.PI / 180 && kt < 1.0;
                    if (stalled) {
                        if (inIrons[k] === 0) {
                            // ENTRY — look back two seconds
                            out.n++;
                            const back = h.slice(-21, -1);
                            const anyPen = back.some(q => q.pen) || h[h.length - 1].pen;
                            const anyWig = back.some(q => q.wig);
                            const anyRnd = back.some(q => q.rnd);
                            const anyAvd = back.some(q => q.avd > 0.15);
                            // a commanded tack: the TARGET heading crossed the no-go
                            // while the hull had not yet
                            const tackCmd = back.some((q, j) => j > 0 &&
                                q.tgtTwa < 45 * Math.PI / 180 && back[j - 1].twa > 55 * Math.PI / 180);
                            out.entrySpd.push(+(back.length ? back[0].kt : 0).toFixed(2));
                            if (anyPen) out.penalty++;
                            else if (anyRnd) out.rounding++;
                            else if (anyWig) out.wiggle++;
                            else if (tackCmd) out.tack++;
                            else if (anyAvd) out.avoid++;
                            else out.drift++;
                        }
                        inIrons[k] += 0.1;
                    } else if (inIrons[k] > 0) {
                        out.durs.push(+inIrons[k].toFixed(1));
                        inIrons[k] = 0;
                    }
                }
                if (bots.every(b => b.raceState.finished)) break;
            }
            return out;
        }, SEED0 + i);
        for (const k of ['n', 'tack', 'avoid', 'wiggle', 'rounding', 'penalty', 'drift']) tot[k] += r[k];
        tot.durs = tot.durs.concat(r.durs);
        tot.entrySpd = tot.entrySpd.concat(r.entrySpd);
        console.error('seed ' + (SEED0 + i) + ' irons entries=' + r.n);
    }
    const pc = (v) => `${(100 * v / Math.max(1, tot.n)).toFixed(1).padStart(5)}%`;
    console.log(`venue=${VENUE}  ${TRIALS} races  ${tot.n} entries into irons`);
    console.log(`  PENALTY TURN (legitimate)              ${pc(tot.penalty)}`);
    console.log(`  ROUNDING     (inside a mark's zone)    ${pc(tot.rounding)}`);
    console.log(`  WIGGLE       (the unstick manoeuvre)   ${pc(tot.wiggle)}`);
    console.log(`  TACK         (strategy crossed the wind) ${pc(tot.tack)}`);
    console.log(`  AVOID        (deflected into the no-go)  ${pc(tot.avoid)}`);
    console.log(`  DRIFT        (lost way and rounded up)   ${pc(tot.drift)}`);
    const d = tot.durs.sort((a, b) => a - b), e = tot.entrySpd.sort((a, b) => a - b);
    if (d.length) console.log(`  duration med ${d[d.length >> 1].toFixed(1)}s  p90 `
        + `${d[Math.floor(0.9 * (d.length - 1))].toFixed(1)}s  max ${d[d.length - 1].toFixed(1)}s`);
    if (e.length) console.log(`  speed 2 s BEFORE entry: med ${e[e.length >> 1].toFixed(2)} kt`
        + `  p90 ${e[Math.floor(0.9 * (e.length - 1))].toFixed(2)} kt`);
    await browser.close();
})();
