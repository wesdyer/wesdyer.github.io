// HOW DOES A BOAT GET ONTO THE BANK? (2026-08-10, river)
//
// Everything measured so far says river's gap is one state — corked against the
// shore — and that the state is nearly unrecoverable once entered: the stream
// there is 3.48 kt (52 u/s) against a boat doing 7 u/s, so 64% of contacts have
// no escaping heading at all. Meanwhile boats under navigation are doing 101
// u/s in 1.08 kt and their uncorrected set is 4.9째, so this is NOT a fleet
// being quietly ferried ashore (`_ferry.js` killed that).
//
// Two populations, then, and the interesting event is the TRANSITION. Rule 2
// says count EPISODES, not frames — 344k contact frames could be 20 long grinds
// or 5000 brief touches, and those want opposite fixes. Rule 28 says the entry
// frame is not the typical frame, so measure the entry on its own terms.
//
// An EPISODE = a land contact preceded by >= 2.0s clear of land. For each one:
//   * speed at entry, and 1.0s before (was she already stopped, or sailing?)
//   * who owned the helm through the second BEFORE entry (rule 27 precedence)
//   * was she being deflected by avoidance, and was a rival close aboard?
//   * was her own planned path ahead clear 1s out (grid), i.e. did the route
//     admit this, or did something push her off it?
//   * how long the episode then lasts, and what it costs against the leg mean
//
// The classification is the point: if entries happen at speed under navigation
// with a clear plan, it is the router; if they happen under avoidance with a
// rival aboard, it is the fleet-avoidance tax; if they happen already-slow, the
// grind is self-sustaining and entry is the wrong target.
//
// usage: node _riv_entry.js [venue] [trials] [seed0] [tree]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const VENUE = process.argv[2] || 'river';
const TRIALS = parseInt(process.argv[3]) || 4;
const SEED0 = parseInt(process.argv[4]) || 7300;
const ROOT = path.join(__dirname, process.argv[5] || 'treePROBE');

(async () => {
    const b = await chromium.launch(); const p = await b.newPage();
    p.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 200)));
    await p.addInitScript((v) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })); }, VENUE);
    await p.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await p.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });

    const eps = [];
    for (let t = 0; t < TRIALS; t++) {
        const r = await p.evaluate(({ seed }) => {
            const hit = {}; const inner = window.onRaceEvent;
            window.onRaceEvent = (ty, d) => {
                if (ty === 'collision_island' && d && d.boat && !d.boat.isPlayer) hit[d.boat.name] = 1;
                return inner && inner(ty, d);
            };
            window.evalHarness.seed = seed; window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const pl = state.boats.find(x => x.isPlayer); if (pl) { pl.x = 1e6; pl.y = 1e6; }
            const DT = 1 / 60, GAP = 2.0;
            const st = {};            // per boat rolling state
            const out = [];
            for (let it = 0; it < 60 * 900; it++) {
                for (const k in hit) delete hit[k];
                window.update(DT);
                if (state.race.status !== 'racing') { if (state.race.status === 'finished') break; continue; }
                for (const bo of state.boats) {
                    if (bo.isPlayer || bo.raceState.finished) continue;
                    const c = bo.controller; if (!c) continue;
                    const s = st[bo.name] || (st[bo.name] = { clear: 99, hist: [], ep: null });
                    const touching = !!hit[bo.name];
                    // rolling 1s history of pre-contact context
                    s.hist.push({
                        v: bo.speed * 60,
                        owner: c.penaltySpin ? 'spin' : c.escActive ? 'escape'
                             : c.iceEscapeTimer > 0 ? 'reflex' : c.wiggleActive ? 'wiggle'
                             : c.clearanceTimer > 0 ? 'clearance' : 'navigation',
                        defl: Math.abs(c.lastAvoidDeviation || 0) > 0.26 ? 1 : 0,
                        rival: (() => {
                            let m = Infinity;
                            for (const o of state.boats) {
                                if (o === bo || o.isPlayer || o.raceState.finished) continue;
                                const d = Math.hypot(o.x - bo.x, o.y - bo.y);
                                if (d < m) m = d;
                            }
                            return m;
                        })(),
                        clearAhead: (() => {
                            const g = state.course.botGrid; if (!g) return 1;
                            for (const d of [60, 120, 180, 240]) {
                                const cc = g.cell(bo.x + Math.sin(bo.heading) * d, bo.y - Math.cos(bo.heading) * d);
                                if (!g.at(cc[0], cc[1])) return 0;
                            }
                            return 1;
                        })(),
                    });
                    if (s.hist.length > 60) s.hist.shift();
                    if (touching) {
                        if (s.clear >= GAP) {
                            const h0 = s.hist[0] || s.hist[s.hist.length - 1];
                            const pre = s.hist.slice(0, Math.max(1, s.hist.length - 1));
                            const own = {};
                            for (const q of pre) own[q.owner] = (own[q.owner] || 0) + 1;
                            let top = 'navigation', tn = -1;
                            for (const k in own) if (own[k] > tn) { tn = own[k]; top = k; }
                            const cu = getCurrentAt(bo.x, bo.y);
                            s.ep = {
                                leg: bo.raceState.leg, x: Math.round(bo.x), y: Math.round(bo.y),
                                vEntry: bo.speed * 60, vBefore: h0.v,
                                owner: top,
                                defl: pre.some(q => q.defl) ? 1 : 0,
                                rival: Math.min(...pre.map(q => q.rival)),
                                planClear: pre.filter(q => q.clearAhead).length / pre.length,
                                cur: cu ? cu.speed : 0,
                                dur: 0, frames: 0,
                            };
                            out.push(s.ep);
                        }
                        s.clear = 0;
                        if (s.ep) { s.ep.frames++; }
                    } else {
                        s.clear += DT;
                        if (s.ep && s.clear >= GAP) s.ep = null;
                    }
                    if (s.ep) s.ep.dur += DT;
                }
                if (state.race.status === 'racing' && state.race.timer > 880) break;
            }
            return out;
        }, { seed: SEED0 + t });
        for (const q of r) eps.push(q);
        console.log(`seed ${SEED0 + t}: ${r.length} grounding episodes`);
    }
    await b.close();

    const q = (a, pp) => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.floor(pp * (s.length - 1))] : NaN; };
    const sum = a => a.reduce((x, y) => x + y, 0);
    const P = (n, d) => d ? (100 * n / d).toFixed(1).padStart(5) + '%' : '   -  ';

    console.log(`\n=== ${VENUE.toUpperCase()}: HOW BOATS GET ONTO THE BANK (${TRIALS} seeds) ===`);
    console.log(`episodes ${eps.length}   total grounded time ${sum(eps.map(e => e.dur)).toFixed(0)} boat-s   (${(sum(eps.map(e => e.dur)) / TRIALS).toFixed(0)} per race)`);
    console.log(`episode length: median ${q(eps.map(e => e.dur), 0.5).toFixed(1)}s  p90 ${q(eps.map(e => e.dur), 0.9).toFixed(1)}s  max ${q(eps.map(e => e.dur), 1).toFixed(1)}s`);
    const long = eps.filter(e => e.dur > 10);
    console.log(`episodes over 10s: ${long.length} (${P(long.length, eps.length).trim()}) but they own ${P(sum(long.map(e => e.dur)), sum(eps.map(e => e.dur))).trim()} of all grounded time`);

    console.log(`\n  ENTRY STATE (what she was doing in the second before first touch)`);
    console.log(`    speed AT entry    median ${q(eps.map(e => e.vEntry), 0.5).toFixed(0)} u/s   1s before: median ${q(eps.map(e => e.vBefore), 0.5).toFixed(0)} u/s`);
    const fast = eps.filter(e => e.vBefore > 60);
    console.log(`    entered while SAILING (>60 u/s 1s before)   ${P(fast.length, eps.length)}  -> these own ${P(sum(fast.map(e => e.dur)), sum(eps.map(e => e.dur))).trim()} of grounded time`);
    console.log(`    entered while already slow (<20 u/s)        ${P(eps.filter(e => e.vBefore < 20).length, eps.length)}`);
    const own = {};
    for (const e of eps) own[e.owner] = (own[e.owner] || 0) + 1;
    console.log(`\n  WHO WAS STEERING INTO IT (rule 27 precedence, modal owner of the pre-second)`);
    for (const k of Object.keys(own).sort((a, c) => own[c] - own[a])) {
        const sub = eps.filter(e => e.owner === k);
        console.log(`    ${k.padEnd(11)} ${P(own[k], eps.length)}   median dur ${q(sub.map(e => e.dur), 0.5).toFixed(1)}s   owns ${P(sum(sub.map(e => e.dur)), sum(eps.map(e => e.dur))).trim()} of grounded time`);
    }
    console.log(`\n  WAS SOMETHING PUSHING HER THERE?`);
    console.log(`    avoidance was deflecting her (>15째) in the pre-second   ${P(eps.filter(e => e.defl).length, eps.length)}`);
    console.log(`    a rival within 150u                                    ${P(eps.filter(e => e.rival < 150).length, eps.length)}`);
    console.log(`    a rival within 300u                                    ${P(eps.filter(e => e.rival < 300).length, eps.length)}`);
    console.log(`    her own path ahead was CLEAR the whole pre-second      ${P(eps.filter(e => e.planClear > 0.99).length, eps.length)}`);
    console.log(`    ...path clear AND no rival within 300u (nothing pushed her, nothing warned her)  ${P(eps.filter(e => e.planClear > 0.99 && e.rival >= 300).length, eps.length)}`);
    console.log(`\n  stream at the entry point: median ${q(eps.map(e => e.cur), 0.5).toFixed(2)} kt   p90 ${q(eps.map(e => e.cur), 0.9).toFixed(2)} kt`);
    const byLeg = {};
    for (const e of eps) byLeg[e.leg] = (byLeg[e.leg] || 0) + e.dur;
    console.log(`  grounded time by leg: ` + Object.keys(byLeg).sort().map(k => `${k}:${byLeg[k].toFixed(0)}s`).join('  '));
})();
