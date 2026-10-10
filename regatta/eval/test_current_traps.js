// CURRENT TRAPS — no pocket in the land may hold a boat that the current presses into it (PT-055).
//
//   node regatta/eval/test_current_traps.js            river, glowtide, bay, flats, lagoon
//   VENUES=river node regatta/eval/test_current_traps.js
//   VERBOSE=1 …                                         every candidate, not only the trapped ones
//   SWEEP=1 …                                           also every 40 u of shoreline (minutes, not seconds)
//
// Wes's design rule (Sockeye Run, Sep 30 2026): "we should not put cavities where the current
// is pushing into them". His R3 ended pinned 157 s in a notch on shape-34's west face, 3.3 kt
// running straight into it — and the AI campaign's "island-8 notch" DNFs were the same rock.
//
// Candidates: every reflex vertex of a hard collider (shapes and prop hit rings — a pocket seen
// from the water) turning by 20° or more, where the current 25 u off the vertex runs at least
// MIN_KT and presses at least MIN_INTO kt into the pocket.
// Test: a stopped boat is dropped there, alone on the course, and holds each of twelve headings
// for up to 15 s. The pocket passes if ANY heading carries it 140 u clear of the vertex. Holding
// one heading is a weaker sailor than a human (who can steer), so a pass here is a real pass.
// Plus Wes's exact trap point, named.
// Currents that move are tested at their worst: a tidal venue at peak flood AND peak ebb
// (Tide.flow pinned to ±1), and an oscillating stream at the moment, over ten minutes of
// race clock, it presses hardest into each pocket.
const { chromium } = require('playwright');
const path = require('path');

const VENUES = (process.env.VENUES || 'river,glowtide,bay,flats,lagoon').split(',');
const VERBOSE = !!process.env.VERBOSE;
const SWEEP = !!process.env.SWEEP;     // also every 40 u of shoreline (slow; see SWEEP below)
const MIN_KT = 1.0, MIN_INTO = 0.8;
// PT-051 (Oct 2026): shape-33's face pinned four bots for 20-78 s — the boats were steering into the rock
// (fixed in the bot), and the water itself is escapable; held here so it stays so.
const NAMED = { river: [{ name: 'PT-055 shape-34 notch (Wes R3)', x: 3668, y: -3510 }, { name: 'PT-051 shape-33 face (Pearl/Latch/Rake)', x: 4157, y: -3796 }] };
let fails = 0;
const check = (name, ok, detail) => {
    console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${name}${ok || !detail ? '' : ' — ' + detail}`);
    if (!ok) fails++;
};

(async () => {
    const browser = await chromium.launch();
    for (const venue of VENUES) {
        const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
        const errs = []; page.on('pageerror', e => errs.push(e.message));
        await page.addInitScript(v => localStorage.setItem('regatta_settings', JSON.stringify({ venue: v, musicEnabled: false, soundEnabled: false, bgSoundEnabled: false })), venue);
        await page.goto('file://' + path.resolve('regatta/index.html'));
        await page.waitForFunction(() => typeof state !== 'undefined' && state.boats && state.boats.length > 0, null, { timeout: 30000 });
        const r = await page.evaluate(({ venue, named, MIN_KT, MIN_INTO, sweep }) => {
            let s = 7; Math.random = () => { let t = s += 0x6D2B79F5; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
            selectVenue(venue); resetGame(); startRace();
            for (let i = 0; i < 3; i++) update(1 / 60);
            state.race.status = 'racing'; state.race.timer = 100;
            const P = state.boats.find(b => b.isPlayer);
            state.boats = [P];                       // alone: nothing to push off, nothing in the way

            const realFlow = window.Tide && Tide.flow;
            const tides = state.tide && realFlow ? [1, -1] : [null];
            const cands = [];
            for (const tf of tides) {
            if (tf != null) Tide.flow = () => tf;
            const tideName = tf == null ? '' : tf > 0 ? ' [flood]' : ' [ebb]';
            const T0 = state.time;
            for (const isl of state.course.islands) {
                if (isl.awash || !isl.vertices) continue;
                const V = isl.vertices, n = V.length;
                let A = 0; for (let i = 0; i < n; i++) { const a = V[i], b = V[(i + 1) % n]; A += a.x * b.y - b.x * a.y; }
                const sgn = Math.sign(A);
                for (let i = 0; i < n; i++) {
                    const p = V[(i + n - 1) % n], c = V[i], q = V[(i + 1) % n];
                    const cr = (c.x - p.x) * (q.y - c.y) - (c.y - p.y) * (q.x - c.x);
                    if (cr * sgn >= 0) continue;
                    const e1 = Math.hypot(c.x - p.x, c.y - p.y), e2 = Math.hypot(q.x - c.x, q.y - c.y);
                    if (e1 < 1 || e2 < 1) continue;
                    const turn = Math.abs(Math.atan2(cr, (c.x - p.x) * (q.x - c.x) + (c.y - p.y) * (q.y - c.y)));
                    if (turn < 0.35) continue;
                    let nx = (c.y - p.y) / e1 * sgn + (q.y - c.y) / e2 * sgn, ny = -(c.x - p.x) / e1 * sgn - (q.x - c.x) / e2 * sgn;
                    const nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl;
                    const px = c.x + nx * 25, py = c.y + ny * 25;
                    let best = null;
                    for (let k = 0; k < 20; k++) {               // the worst moment of an oscillating stream
                        state.time = T0 + k * 30;
                        const cur = getCurrentAt(px, py); if (!cur || !(cur.speed >= MIN_KT)) continue;
                        const into = -(Math.sin(cur.direction) * nx - Math.cos(cur.direction) * ny) * cur.speed;
                        if (into >= MIN_INTO && (!best || into > best.into)) best = { t: state.time, kt: cur.speed, into };
                    }
                    state.time = T0;
                    if (!best) continue;
                    cands.push({ name: `${isl.id} (${isl.kind || isl.style}) @ ${Math.round(c.x)},${Math.round(c.y)}${tideName}`, x: px, y: py, vx: c.x, vy: c.y, t: best.t, tf, kt: +best.kt.toFixed(1), into: +best.into.toFixed(1), deg: Math.round(turn * 180 / Math.PI) });
                }
            }
            // SWEEP: every 40 u of every hard shoreline, not only the reflex vertices — a pocket
            // made by TWO colliders (a rock against the bank: Wes's TT2 pin at 3795,-3687) has no
            // reflex vertex in either one. Points inside another collider are skipped, and the
            // survivors are thinned to one per 60 u, keeping the hardest-pressed.
            if (sweep) {
                const hard = state.course.islands.filter(i => !i.awash && i.vertices);
                const inPoly = (V, x, y) => { let c = false; for (let i = 0, j = V.length - 1; i < V.length; j = i++) { const a = V[i], b = V[j]; if (((a.y > y) !== (b.y > y)) && (x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x)) c = !c; } return c; };
                const wet = (x, y) => !hard.some(i => (x - i.x) ** 2 + (y - i.y) ** 2 < (i.radius + 5) ** 2 && inPoly(i.vertices, x, y));
                const pts = [];
                for (const isl of hard) {
                    const V = isl.vertices, n = V.length;
                    let A = 0; for (let i = 0; i < n; i++) { const a = V[i], b = V[(i + 1) % n]; A += a.x * b.y - b.x * a.y; }
                    const sgn = Math.sign(A);
                    for (let i = 0; i < n; i++) {
                        const a = V[i], b = V[(i + 1) % n], L = Math.hypot(b.x - a.x, b.y - a.y);
                        if (L < 1) continue;
                        const nx = (b.y - a.y) / L * sgn, ny = -(b.x - a.x) / L * sgn;
                        for (let d = 20; d < L; d += 40) {
                            const ex = a.x + (b.x - a.x) * d / L, ey = a.y + (b.y - a.y) * d / L;
                            const px = ex + nx * 25, py = ey + ny * 25;
                            let best = null;
                            for (let k = 0; k < 20; k += (state.course.currentRegions || []).some(r => r.period > 0) ? 1 : 20) {
                                state.time = T0 + k * 30;
                                const cur = getCurrentAt(px, py); if (!cur || !(cur.speed >= MIN_KT)) continue;
                                const into = -(Math.sin(cur.direction) * nx - Math.cos(cur.direction) * ny) * cur.speed;
                                if (into >= MIN_INTO && (!best || into > best.into)) best = { t: state.time, kt: cur.speed, into };
                            }
                            state.time = T0;
                            if (!best || !wet(px, py)) continue;
                            pts.push({ name: `${isl.id} (${isl.kind || isl.style}) face @ ${Math.round(ex)},${Math.round(ey)}${tideName}`, x: px, y: py, vx: ex, vy: ey, t: best.t, tf, kt: +best.kt.toFixed(1), into: +best.into.toFixed(1), deg: 0 });
                        }
                    }
                }
                pts.sort((p, q) => q.into - p.into);
                for (const p of pts) if (!cands.some(c => c.tf === p.tf && Math.hypot(c.x - p.x, c.y - p.y) < 60)) cands.push(p);
            }
            }
            if (realFlow) Tide.flow = realFlow;
            for (const nm of (named || [])) { const cur = getCurrentAt(nm.x, nm.y); cands.unshift({ name: nm.name, x: nm.x, y: nm.y, vx: nm.x, vy: nm.y, t: state.time, tf: null, kt: +(cur ? cur.speed : 0).toFixed(1), into: null, named: true }); }

            const res = [];
            for (const c of cands) {
                let freedAt = null, freedHdg = null;
                if (c.tf != null) Tide.flow = () => c.tf;
                for (let hdg = 0; hdg < 360 && freedAt == null; hdg += 30) {
                    const h = hdg * Math.PI / 180;
                    state.time = c.t;
                    P.x = c.x; P.y = c.y; P.speed = 0; P.heading = h; P.velocity = { x: 0, y: 0 };
                    for (let f = 0; f < 60 * 15; f++) {
                        P.heading = h; update(1 / 60);
                        if (Math.hypot(P.x - c.vx, P.y - c.vy) > 140) { freedAt = +(f / 60).toFixed(1); freedHdg = hdg; break; }
                    }
                }
                if (realFlow) Tide.flow = realFlow;
                res.push(Object.assign(c, { freedAt, freedHdg }));
            }
            return { res };
        }, { venue, named: NAMED[venue], MIN_KT, MIN_INTO, sweep: SWEEP });
        console.log(`\n${venue}: ${r.res.length} pocket(s) facing ≥${MIN_KT} kt`);
        for (const c of r.res) {
            const ok = c.freedAt != null;
            if (!ok || VERBOSE || c.named) check(`${c.name}  ${c.kt} kt${c.into != null ? `, ${c.into} kt in, ${c.deg}°` : ''}`, ok, ok ? '' : 'no heading escapes in 15 s');
            if (ok && (VERBOSE || c.named)) console.log(`        out on ${c.freedHdg}° in ${c.freedAt} s`);
        }
        if (r.res.every(c => c.freedAt != null)) check(`${venue}: every pocket can be sailed out of`, true);
        check(`${venue}: no page errors`, errs.length === 0, errs[0]);
        await page.close();
    }
    await browser.close();
    console.log(fails ? `\nFAIL — ${fails} failure(s)` : '\nPASS');
    process.exit(fails ? 1 : 0);
})();
