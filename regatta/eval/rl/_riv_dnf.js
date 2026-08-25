// RIVER ISLAND-8 NOTCH DNF ANATOMY (2026-08-25, thread D sizing for the
// next push). The residual: exactly 5/216 DNFs on the f1/r1 river benches,
// all with land 1350-1443, all reaching leg 3 fast then grinding the
// island-8 face to cutoff. Escape-side machinery is x8 dead (2026-08-16);
// entry was the lever (HZT landed). This probe replays a DNF seed BY ITS
// BENCH SEQUENCE (standing rule 34: a bench race is reproduced by its
// sequence, not its seed — replay from the bench's seed0) and instruments
// the DNF boats' leg-3 entry into the grind:
//   - the first land-contact episode: when, where, and what steered the boat
//     in the 6s before it (wiggle / escape / avoidance dev / nav);
//   - the grind: episodes (2s debounce), total contact time, net drift,
//     escape/wiggle counts inside it, speed profile;
//   - a matched control: the same seed's fastest finisher through the same
//     northing band.
//   node _riv_dnf.js <tree> <benchSeed0> <racesToRun> [namesCSV]
// e.g. node _riv_dnf.js treeF1 9408 2 Torrent,Muninn   (bench r1riv9408,
// race 2 = seed 9409 carried both DNFs)
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const ROOT = path.join(__dirname, process.argv[2] || 'treeF1');
const SEED0 = parseInt(process.argv[3] || '9408');
const NRACES = parseInt(process.argv[4] || '2');
const NAMES = (process.argv[5] || '').split(',').filter(Boolean);
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.addInitScript(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'river' })); });
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    for (let race = 0; race < NRACES; race++) {
        const seed = SEED0 + race;
        const last = race === NRACES - 1;
        const r = await page.evaluate(async ({ seed, last, NAMES }) => {
            window.evalHarness.seed = seed;
            window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            // land-contact via the engine's own event (rule 31b: ai.collisionData
            // is transient and not a contact ledger) — chain the existing handler
            window.__dnfLand = {};
            {
                const inner = window.onRaceEvent;
                window.onRaceEvent = (ty, d) => {
                    try {
                        if (ty === 'collision_island' && d && d.boat && !d.isFloe)
                            window.__dnfLand[d.boat.name] = state.race.timer;
                    } catch (e) {}
                    if (inner) return inner(ty, d);
                };
            }
            const pl = state.boats.find(b => b.isPlayer); if (pl) { pl.x = 1e6; pl.y = 1e6; }
            const norm = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
            const wrapAll = () => {
                for (const bo of state.boats) {
                    if (bo.isPlayer) continue;
                    const c = bo.controller;
                    if (!c || !c.applyAvoidance || c.__dwrap) continue;
                    const orig = c.applyAvoidance.bind(c);
                    c.applyAvoidance = (dh, sr) => { const out = orig(dh, sr); bo._avDev = Math.abs(norm(out - dh)); return out; };
                    c.__dwrap = 1;
                }
            };
            const S = new Map();
            const DT = 1 / 60; let it = 0;
            while (it < 900 * 60) {
                for (const bo of state.boats) bo._avDev = 0;
                wrapAll();
                update(DT); it++;
                if (state.race.status !== 'racing') continue;
                if (state.race.timer > 900) break;
                if (!last) { if (state.boats.every(b => b.isPlayer || b.raceState.finished)) break; continue; }
                if (it % 6) continue;   // 10Hz instrument on the last race only
                const t = state.race.timer;
                for (const b of state.boats) {
                    if (b.isPlayer || b.raceState.finished) continue;
                    let s = S.get(b.name);
                    if (!s) { s = { hist: [], grind: null, eps: [], legAt3: null, contactT: 0, wig: 0, esc: 0 }; S.set(b.name, s); }
                    const c = b.controller;
                    const lc = window.__dnfLand[b.name];
                    const contact = lc != null && (t - lc) < 0.15;
                    const row = { t: +t.toFixed(1), x: Math.round(b.x), y: Math.round(b.y),
                                  kt: +(b.speed * 4).toFixed(1), leg: b.raceState.leg,
                                  wig: c && c.wiggleActive ? 1 : 0, esc: c && c.escActive ? 1 : 0,
                                  av: Math.round((b._avDev || 0) * 57.3), ct: contact ? 1 : 0 };
                    s.hist.push(row); if (s.hist.length > 120) s.hist.shift();   // 12s window
                    if (b.raceState.leg === 3 && s.legAt3 == null) s.legAt3 = +t.toFixed(0);
                    if (contact) { s.contactT += 0.1; if (c && c.wiggleActive) s.wig += 0.1; if (c && c.escActive) s.esc += 0.1; }
                    // grind episodes: contact with 2s debounce
                    if (contact) {
                        if (!s.grind) { s.grind = { t0: +t.toFixed(1), x0: b.x, y0: b.y, clean: 0 };
                            s.grind.pre = s.hist.slice(0, Math.max(0, s.hist.length - 1)).slice(-60); }
                        else s.grind.clean = 0;
                    } else if (s.grind) {
                        s.grind.clean = (s.grind.clean || 0) + 0.1;
                        if (s.grind.clean >= 2) {
                            s.grind.t1 = +t.toFixed(1); s.grind.dx = Math.round(b.x - s.grind.x0); s.grind.dy = Math.round(b.y - s.grind.y0);
                            s.eps.push(s.grind); s.grind = null;
                        }
                    }
                }
                if (state.boats.every(b => b.isPlayer || b.raceState.finished)) break;
            }
            if (!last) return null;
            const out = [];
            for (const b of state.boats) {
                if (b.isPlayer) continue;
                const s = S.get(b.name); if (!s) continue;
                if (s.grind) { s.grind.t1 = 900; s.eps.push(s.grind); s.grind = null; }
                const focus = !NAMES.length || NAMES.includes(b.name);
                const eps = s.eps.map(e => ({ t0: e.t0, t1: e.t1, dur: +(e.t1 - e.t0).toFixed(0),
                    x: Math.round(e.x0), y: Math.round(e.y0), dx: e.dx, dy: e.dy,
                    preWig: e.pre ? e.pre.filter(r => r.wig).length / Math.max(1, e.pre.length) : null,
                    preEsc: e.pre ? e.pre.filter(r => r.esc).length / Math.max(1, e.pre.length) : null,
                    preAvMax: e.pre ? Math.max(0, ...e.pre.map(r => r.av)) : null,
                    preKt: e.pre && e.pre.length ? e.pre[0].kt : null }));
                out.push({ name: b.name, fin: b.raceState.finished ? 1 : 0, legAt3: s.legAt3,
                           contactT: +s.contactT.toFixed(0), wigInContact: +s.wig.toFixed(0), escInContact: +s.esc.toFixed(0),
                           nEps: eps.length, eps: focus ? eps.slice(0, 12) : eps.length });
            }
            return out;
        }, { seed, last, NAMES });
        if (r) {
            console.log(`\n== race ${race} (seed ${seed}) — instrumented`);
            for (const b of r) {
                console.log(`${b.fin ? '   ' : 'DNF'} ${b.name.padEnd(9)} leg3@${String(b.legAt3).padStart(4)}s  contactT ${String(b.contactT).padStart(4)}s (wig ${b.wigInContact}s esc ${b.escInContact}s)  grindEps ${b.nEps}`);
                if (Array.isArray(b.eps)) for (const e of b.eps) {
                    console.log(`      ep ${e.t0}-${e.t1}s (${e.dur}s) at (${e.x},${e.y}) drift(${e.dx},${e.dy})  PRE-6s: wig ${(100 * e.preWig).toFixed(0)}% esc ${(100 * e.preEsc).toFixed(0)}% avMax ${e.preAvMax}° kt@-6s ${e.preKt}`);
                }
            }
            fs.writeFileSync(path.join(__dirname, `_riv_dnf_${seed}.json`), JSON.stringify(r));
        } else console.log(`race ${race} (seed ${seed}) — warmup, done`);
    }
    await browser.close();
})();
