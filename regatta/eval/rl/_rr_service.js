// P0 measurement — REDROCK defile SERVICE RATE. The residual hypothesis after
// the congestion landing is one-lane throughput physics: how long does one
// boat take through the north thread SOLO vs in CONVOY? For every bot transit
// of the thread region (x -250..100, y 1100..1700) while racing: duration,
// occupancy at entry (other bots already inside), parked time (<1kt) inside,
// leg at entry (splits northbound leg-3 from the m5-return traffic), and
// whether the transit completed (exited) or the boat was still inside at cutoff.
// Also per-boat per-leg durations for the leg-1 start-class share.
//   node _rr_service.js <trials> <seed0> <tree>
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const TRIALS = parseInt(process.argv[2]) || 4;
const SEED0 = parseInt(process.argv[3]) || 9400;
const ROOT = path.join(__dirname, process.argv[4] || 'treeP4H');
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.addInitScript(() => {
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'redrock' }));
    });
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const all = [];
    for (let i = 0; i < TRIALS; i++) {
        const seed = SEED0 + i;
        const r = await page.evaluate(async (seed) => {
            window.evalHarness.seed = seed;
            window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const bots = state.boats.filter(b => !b.isPlayer);
            const pl = state.boats.find(b => b.isPlayer); pl.x = 1e6; pl.y = 1e6;
            const IN = b => b.x > -250 && b.x < 100 && b.y > 1100 && b.y < 1700;
            const st = {};          // name -> {inside, outCount, ep}
            const episodes = [];
            const legDur = {};      // name -> {leg: seconds}
            const dt = 1 / 60;
            for (let it = 0; it < 60 * 900; it++) {
                window.update(dt);
                if (state.race.status === 'finished') break;
                if (state.race.status !== 'racing') continue;
                const t = state.race.timer;
                if (t > 880) break;
                if (it % 15 !== 0) continue;
                const insideNow = bots.filter(b => !b.raceState.finished && IN(b));
                for (const b of bots) {
                    if (b.raceState.finished) continue;
                    const lg = b.raceState.leg;
                    if (it % 30 === 0)
                        (legDur[b.name] = legDur[b.name] || {})[lg] = (legDur[b.name][lg] || 0) + 0.5;
                    if (lg < 1) continue;
                    const s = st[b.name] = st[b.name] || { inside: false, outCount: 0, ep: null };
                    if (IN(b)) {
                        if (!s.inside) {
                            s.inside = true;
                            s.ep = { t0: t, leg: lg, occ: insideNow.length - 1, park: 0, minSpd: 99 };
                        }
                        s.outCount = 0;
                        const kt = b.speed * 4;
                        if (kt < 1.0) s.ep.park += 0.25;
                        if (kt < s.ep.minSpd) s.ep.minSpd = kt;
                    } else if (s.inside) {
                        s.outCount++;
                        if (s.outCount >= 8) {  // 2s clear = episode closed
                            s.inside = false;
                            s.ep.t1 = t - 2; s.ep.dur = s.ep.t1 - s.ep.t0;
                            episodes.push(s.ep); s.ep = null;
                        }
                    }
                }
                if (bots.every(b => b.raceState.finished)) break;
            }
            for (const n in st) if (st[n].inside && st[n].ep) {   // still inside at end
                st[n].ep.t1 = null; st[n].ep.dur = null; st[n].ep.stuck = true;
                episodes.push(st[n].ep);
            }
            const fins = bots.filter(b => b.raceState.finished).length;
            return { seed, episodes, legDur, fins, nBots: bots.length };
        }, seed);
        all.push(r);
        console.log('seed', r.seed, 'fins', r.fins + '/' + r.nBots, 'threadEpisodes', r.episodes.length,
            'stuck', r.episodes.filter(e => e.stuck).length);
    }
    // ---- pooled report ----
    const eps = all.flatMap(r => r.episodes);
    const done = eps.filter(e => !e.stuck);
    const med = a => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
    const p90 = a => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length * 0.9)]; };
    const f1 = x => x === null ? '—' : x.toFixed(1);
    console.log('\n=== THREAD SERVICE RATE (pooled', done.length, 'completed transits,',
        eps.filter(e => e.stuck).length, 'stuck-at-end) ===');
    for (const bucket of [[0, 0, 'solo (occ 0)'], [1, 1, 'occ 1'], [2, 2, 'occ 2'], [3, 99, 'occ 3+']]) {
        const g = done.filter(e => e.occ >= bucket[0] && e.occ <= bucket[1]);
        console.log(bucket[2].padEnd(12), 'n', String(g.length).padStart(4),
            '| dur med', f1(med(g.map(e => e.dur))), 'p90', f1(p90(g.map(e => e.dur))),
            '| parked med', f1(med(g.map(e => e.park))), 'p90', f1(p90(g.map(e => e.park))),
            '| minSpd med', f1(med(g.map(e => e.minSpd))));
    }
    console.log('\nby leg at entry:');
    const legs = [...new Set(done.map(e => e.leg))].sort((a, b) => a - b);
    for (const lg of legs) {
        const g = done.filter(e => e.leg === lg);
        console.log('leg', lg, 'n', String(g.length).padStart(4),
            '| dur med', f1(med(g.map(e => e.dur))), 'p90', f1(p90(g.map(e => e.dur))),
            '| parked med', f1(med(g.map(e => e.park))),
            '| occ med', f1(med(g.map(e => e.occ))));
    }
    // occupancy → duration curve (the service-rate law)
    console.log('\nocc → dur med (n):');
    for (let o = 0; o <= 6; o++) {
        const g = done.filter(e => e.occ === o);
        if (g.length) console.log('  occ', o, 'n', g.length, 'dur med', f1(med(g.map(e => e.dur))), 'parked med', f1(med(g.map(e => e.park))));
    }
    console.log('\n=== LEG DURATIONS (med across boat-races, s) ===');
    const legPool = {};
    for (const r of all) for (const n in r.legDur) for (const lg in r.legDur[n])
        (legPool[lg] = legPool[lg] || []).push(r.legDur[n][lg]);
    for (const lg of Object.keys(legPool).sort((a, b) => a - b))
        console.log('leg', lg, 'n', String(legPool[lg].length).padStart(4), 'med', f1(med(legPool[lg])), 'p90', f1(p90(legPool[lg])));
    await browser.close();
})();
