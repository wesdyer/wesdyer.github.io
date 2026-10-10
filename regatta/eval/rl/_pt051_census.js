// PT-051 STUCK CENSUS (Oct 2026) — where the fleet stops, across the venues Wes saw it.
//
// Wes: Pulse "just sitting there" and Crush unable to start (Gatorgrass); Jester circling 2.5 min before the
// line in the current (Sockeye); Pearl and Crush into Redrock's walls "with nobody there", Sable lost up a side
// channel; Wick into an iceberg and the fleet struggling through Glacier Sound's ice.
//
// Ten bots (ocean_bench's construction: the player converted to a full bot), seeded, per venue. Per race:
//   START     a boat still on leg 0 at gun + START_LATE s — when it finally crossed, where it sat
//   STALL     racing, unfinished, under STALL_D units made good in STALL_W s; the episode runs until the boat has
//             made 200 u in 10 s. Where, which leg, how long, the land hits during it, and the controller's
//             state as it began (liveness, escape, ice escape)
//   HITS      every land contact (debounced 0.5 s per boat) with its position, for the hotspot list
// Then hotspots: episodes and hits clustered within 160 u.
//
//   node _pt051_census.js <trials> <seed0> <tree|.> venue[,venue...]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const TRIALS = parseInt(process.argv[2]) || 8;
const SEED0 = parseInt(process.argv[3]) || 9400;
const ROOT = process.argv[4] && process.argv[4] !== '.' ? path.join(__dirname, process.argv[4]) : path.resolve(__dirname, '../../..');
const VENUES = (process.argv[5] || 'swamp,river,redrock,arctic').split(',');
const START_LATE = 25, STALL_W = 15, STALL_D = 80;

(async () => {
    const browser = await chromium.launch();
    const out = {};
    for (const venue of VENUES) {
        const page = await browser.newPage();
        page.on('console', m => { if (/^\[sim/.test(m.text())) console.log(venue, m.text()); });
        page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
        await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
        await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
        await page.evaluate((v) => localStorage.setItem('regatta_settings', JSON.stringify({ venue: v, character: AI_CONFIG[0].name })), venue);   // LATE, as ocean_bench: reproducible across processes
        await page.evaluate(() => {
            const inner = window.onRaceEvent; window.__hits = [];
            window.onRaceEvent = (ty, d) => {
                try { if (d && d.boat && !d.boat.isPlayer && !d.boat.raceState.finished && ty === 'collision_island') {
                    const k = d.boat.name + (d.isFloe ? ':ice' : ''), t = state.race.timer, last = window.__hitT[k];
                    if (last == null || t - last >= 0.5) { window.__hitT[k] = t; window.__hits.push([k, Math.round(d.boat.x), Math.round(d.boat.y), +t.toFixed(1), d.boat.raceState.leg, d.isFloe ? 1 : 0]); } } } catch (e) {}
                return inner && inner(ty, d);
            };
        });
        const races = [];
        for (let i = 0; i < TRIALS; i++) {
            const seed = SEED0 + i;
            races.push(await page.evaluate(({ seed, START_LATE, STALL_W, STALL_D }) => {
                window.evalHarness.seed = seed;
                window.resetGame(); window.startRace();
                window.__hits = []; window.__hitT = {};
                state.course.cutoff = 900;
                const pl = state.boats.find(b => b.isPlayer);
                applyBoatIdentity(pl, playerCharacter(), false);
                pl.isPlayer = false; pl.manualTrim = false;
                const nine = state.boats.filter(b => b !== pl);
                pl.ai.startLinePct = Math.max(0.05, Math.min(0.90, nine.reduce((a, b) => a + b.ai.startLinePct, 0) / nine.length));
                pl.ai.setupDist = 300;
                const bots = state.boats, dt = 1 / 60, W = Math.round(STALL_W * 2);
                const hist = bots.map(() => []), eps = [], open = bots.map(() => null), starts = [];
                const ctl = (b) => { const c = b.controller || {}; return { live: c.livenessState || null, esc: +(c.escSustain || 0).toFixed(1), ice: (c.iceEscapeTimer || 0) > 0,
                    wig: (c.lowSpeedTimer || 0) > 0 ? +c.lowSpeedTimer.toFixed(1) : 0 }; };
                const nearLand = (b) => { let best = null; for (const isl of state.course.islands || []) { if (isl.isFloe || !isl.vertices) continue; const V = isl.vertices; let d = Infinity;
                    for (let a = 0, c = V.length - 1; a < V.length; c = a++) { const p = V[a], q = V[c], dx = q.x - p.x, dy = q.y - p.y, L = dx * dx + dy * dy || 1, t = Math.max(0, Math.min(1, ((b.x - p.x) * dx + (b.y - p.y) * dy) / L)); d = Math.min(d, Math.hypot(p.x + t * dx - b.x, p.y + t * dy - b.y)); }
                    if (!best || d < best.d) best = { d: Math.round(d), id: isl.id || null, kind: isl.kind || null }; } return best; };
                let lateDone = false, k = 0;
                for (let it = 0; it < 60 * 940; it++) {
                    window.update(dt);
                    if (state.race.status === 'finished') break;
                    if (state.race.status !== 'racing') continue;
                    const t = state.race.timer; if (t > 900) break;
                    if (it % 3600 === 0) console.log(`[sim ${t.toFixed(0)} s, wall ${((performance.now() - (window.__w0 || (window.__w0 = performance.now()))) / 1000).toFixed(0)} s]`);
                    if (!lateDone && t >= START_LATE) { lateDone = true;
                        bots.forEach((b, j) => { if (b.raceState.leg === 0) starts.push({ boat: b.name, x: Math.round(b.x), y: Math.round(b.y), ...ctl(b), near: nearLand(b), j }); }); }
                    if (it % 30 !== 0) continue;   // every 0.5 s
                    k++;
                    bots.forEach((b, j) => {
                        const H = hist[j], last = H[H.length - 1], cum = (last ? last[2] + Math.hypot(b.x - last[0], b.y - last[1]) : 0);
                        H.push([b.x, b.y, cum]); if (H.length > W + 1) H.shift();
                        if (b.raceState.finished) { if (open[j]) { open[j].end = +t.toFixed(1); eps.push(open[j]); open[j] = null; } return; }
                        if (H.length <= W) return;
                        const made = Math.hypot(b.x - H[0][0], b.y - H[0][1]), sailed = H[H.length - 1][2] - H[0][2];
                        // SLOW: barely sailing at all. LOOP: sailing, but back where she was — and not a rounding
                        // (a hairpin round a mark comes back past itself; that is the course, not a fault).
                        const rmS = (typeof legRoundMark === 'function') ? legRoundMark(b.raceState.leg) : null;
                        const rmPrev = (typeof legRoundMark === 'function') ? legRoundMark(b.raceState.leg - 1) : null;
                        const nearMk = (m) => m && Math.hypot(b.x - m.x, b.y - m.y) < 450;
                        const spinning = b.raceState.penalty && b.controller && b.controller.penaltySpin;
                        const kind = sailed < 150 ? 'slow' : (made < STALL_D && !nearMk(rmS) && !nearMk(rmPrev)) ? 'loop' : null;
                        if (!open[j] && kind && !spinning) {
                            open[j] = { boat: b.name, kind, t0: +(t - STALL_W).toFixed(1), x: Math.round(b.x), y: Math.round(b.y), leg: b.raceState.leg, ...ctl(b), near: nearLand(b),
                                cur: (typeof getCurrentAt === 'function') ? (() => { const c = getCurrentAt(b.x, b.y); return c ? +(c.speed || 0).toFixed(1) : 0; })() : null };
                        } else if (open[j]) {
                            const H10 = H[Math.max(0, H.length - 21)], m10 = Math.hypot(b.x - H10[0], b.y - H10[1]);
                            if (m10 > 200) { open[j].end = +t.toFixed(1); eps.push(open[j]); open[j] = null; }
                        }
                    });
                }
                const tEnd = state.race.timer;
                open.forEach(e => { if (e) { e.end = +tEnd.toFixed(1); e.unfinished = true; eps.push(e); } });
                starts.forEach(s => { const lt = bots[s.j].raceState.startTimeDisplay; s.crossed = lt > 0 ? +lt.toFixed(1) : null; delete s.j; });
                const dnf = bots.filter(b => !b.raceState.finished).map(b => b.name);
                return { seed, eps, starts, hits: window.__hits.slice(), dnf };
            }, { seed, START_LATE, STALL_W, STALL_D }));
            const r = races[races.length - 1];
            console.log(`${venue} ${seed}: slow ${r.eps.filter(e => e.kind === 'slow').length} (${r.eps.filter(e => e.kind === 'slow').reduce((a, e) => a + (e.end - e.t0), 0).toFixed(0)} boat-s), loops ${r.eps.filter(e => e.kind === 'loop').length} (${r.eps.filter(e => e.kind === 'loop').reduce((a, e) => a + (e.end - e.t0), 0).toFixed(0)} boat-s), late starts ${r.starts.length}, land hits ${r.hits.filter(h => !h[5]).length}, ice hits ${r.hits.filter(h => h[5]).length}, DNF ${r.dnf.join(',') || '-'}`);
        }
        out[venue] = races;
        await page.close();
    }
    await browser.close();
    const file = path.join(__dirname, `_pt051_census_${VENUES.join('-')}_${SEED0}.json`);
    fs.writeFileSync(file, JSON.stringify(out));
    // HOTSPOTS: stall episodes and land hits clustered within 160 u
    for (const [venue, races] of Object.entries(out)) {
        const pts = [];
        for (const r of races) { for (const e of r.eps) pts.push({ x: e.x, y: e.y, kind: 'stall', s: e.end - e.t0, e, seed: r.seed });
            for (const h of r.hits) pts.push({ x: h[1], y: h[2], kind: h[5] ? 'ice' : 'hit', s: 0, seed: r.seed, leg: h[4] }); }
        const cl = [];
        for (const p of pts) { let c = cl.find(c => Math.hypot(c.x - p.x, c.y - p.y) < 160); if (!c) { c = { x: p.x, y: p.y, stalls: 0, stallS: 0, hits: 0, ice: 0, seeds: new Set(), legs: new Set(), ex: [] }; cl.push(c); }
            c.seeds.add(p.seed); if (p.kind === 'stall') { c.stalls++; c.stallS += p.s; c.legs.add(p.e.leg); if (c.ex.length < 3) c.ex.push(p.e); } else { if (p.kind === 'ice') c.ice++; else c.hits++; c.legs.add(p.leg); } }
        cl.sort((a, b) => (b.stallS + (b.hits + b.ice) * 3) - (a.stallS + (a.hits + a.ice) * 3));
        const N = races.length, stallS = races.reduce((a, r) => a + r.eps.filter(e => e.kind === 'slow').reduce((x, e) => x + (e.end - e.t0), 0), 0), loopS = races.reduce((a, r) => a + r.eps.filter(e => e.kind === 'loop').reduce((x, e) => x + (e.end - e.t0), 0), 0);
        const late = races.flatMap(r => r.starts);
        console.log(`\n== ${venue}: ${N} races · SLOW boat-s/race ${(stallS / N).toFixed(0)} · LOOP boat-s/race ${(loopS / N).toFixed(0)} · late starts ${late.length} (worst crossed ${Math.max(0, ...late.map(s => s.crossed || 999))} s) · land hits/race ${(races.reduce((a, r) => a + r.hits.length, 0) / N).toFixed(1)} · DNF ${races.reduce((a, r) => a + r.dnf.length, 0)}`);
        for (const c of cl.slice(0, 8)) console.log(`  (${Math.round(c.x)}, ${Math.round(c.y)})  stalls ${c.stalls} / ${c.stallS.toFixed(0)} s · hits ${c.hits}${c.ice ? ' + ice ' + c.ice : ''} · in ${c.seeds.size}/${N} races · legs ${[...c.legs].join(',')}`
            + (c.ex.length ? `  e.g. ${c.ex.map(e => `${e.kind} ${e.boat} t${e.t0}-${e.end} live=${e.live} esc=${e.esc}${e.ice ? ' ICE' : ''} near ${e.near && e.near.kind}@${e.near && e.near.d}u cur ${e.cur}kt`).join(' | ')}` : ''));
        if (late.length) console.log('  late starts: ' + late.slice(0, 8).map(s => `${s.boat} crossed ${s.crossed}s at (${s.x},${s.y}) live=${s.live} near ${s.near && s.near.kind}@${s.near && s.near.d}u`).join(' | '));
    }
    console.log('\nsaved', file);
})();
