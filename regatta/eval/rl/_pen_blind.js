// PENALTY-BLIND SIZING PROBE (2026-08-23, sub-1.5x push, Phase 1.3 — SIZES
// E1 BEFORE BUILDING, the _carrot_pin_cf law). Fleet arctic, __CHAR unset.
// Three censuses on the b3 HEAD:
//  (a) SPIN EPISODES: every penaltySpin episode per boat — where it starts
//      (leg, dRM, mark<220u?, nearest rival, nearest floe clearance), how
//      long it runs, floe contacts DURING and <=3s AFTER, min floe clearance
//      reached while spinning, whether the spin PAUSED for IMMINENT.
//  (b) PENALIZED-NEAR-ICE TIME: per boat-race seconds with rs.penalty
//      active AND nearest floe clearance < 150u, split spinning/not.
//  (c) drift check: at each spin-time floe contact, was the floe drifting
//      toward the boat (relative closing speed) — the drift-into-floe
//      blindness E1 targets vs the boat driving into the pack herself.
//   node _pen_blind.js <trials> <seed0> <tree>
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const TRIALS = parseInt(process.argv[2]) || 4;
const SEED0 = parseInt(process.argv[3]) || 9400;
const ROOT = path.join(__dirname, process.argv[4] || 'treeBOTH3');
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.addInitScript(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'arctic' })); });
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const SPINS = [], NEAR = [];
    for (let i = 0; i < TRIALS; i++) {
        const seed = SEED0 + i;
        const r = await page.evaluate(async (seed) => {
            const segD = (px, py, ax, ay, bx, by) => {
                const dx = bx - ax, dy = by - ay; const L2 = dx * dx + dy * dy;
                let t = L2 ? ((px - ax) * dx + (py - ay) * dy) / L2 : 0; t = Math.max(0, Math.min(1, t));
                return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
            };
            const floeClr = (f, px, py) => {
                if (!f.localHull || !f.localHull.length) return Math.hypot(px - f.x, py - f.y) - (f.radius || 0);
                const c = Math.cos(f.spin || 0), s = Math.sin(f.spin || 0);
                const pts = f.localHull.map(p => [f.x + p.x * c - p.y * s, f.y + p.x * s + p.y * c]);
                let best = Infinity;
                for (let i2 = 0; i2 < pts.length; i2++) {
                    const a = pts[i2], b = pts[(i2 + 1) % pts.length];
                    best = Math.min(best, segD(px, py, a[0], a[1], b[0], b[1]));
                }
                return best;
            };
            window.evalHarness.seed = seed;
            window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const pl = state.boats.find(b => b.isPlayer); if (pl) { pl.x = 1e6; pl.y = 1e6; }
            const spins = [], nearAcc = new Map(); // id -> {penNear, penNearSpin, penTotal}
            const live = new Map();  // id -> live spin episode
            const floes = () => (state.course.islands || []).filter(i2 => i2.isFloe);
            const nearestFloe = (x, y) => {
                let best = Infinity, bf = null;
                for (const f of floes()) {
                    if (Math.hypot(x - f.x, y - f.y) > (f.radius || 0) + 700) continue;
                    const d = floeClr(f, x, y);
                    if (d < best) { best = d; bf = f; }
                }
                return { d: best, f: bf };
            };
            const inner = window.onRaceEvent;
            const contactLog = [];   // {t, id, closing}
            window.onRaceEvent = (ty, d) => {
                try {
                    if (d && d.boat && !d.boat.isPlayer && ty === 'collision_island' && d.isFloe
                        && state.race.status === 'racing') {
                        const bt = d.boat, t = state.race.timer;
                        const nf = nearestFloe(bt.x, bt.y);
                        let closing = null;
                        if (nf.f) {
                            // relative velocity of floe toward boat along the line floe->boat
                            const dx = bt.x - nf.f.x, dy = bt.y - nf.f.y;
                            const L = Math.hypot(dx, dy) || 1;
                            const fvx = (nf.f.driftVx || 0), fvy = (nf.f.driftVy || 0);
                            const bvx = (bt.velocity ? bt.velocity.x : 0) * 60, bvy = (bt.velocity ? bt.velocity.y : 0) * 60;
                            // floe closing = component of (floeV - boatV) along floe->boat dir
                            closing = ((fvx * 60 - bvx) * dx / L + (fvy * 60 - bvy) * dy / L);
                        }
                        contactLog.push({ t, id: bt.id, closing: closing == null ? null : +closing.toFixed(1),
                            floeDrift: nf.f ? +(Math.hypot(nf.f.driftVx || 0, nf.f.driftVy || 0) * 60).toFixed(1) : null });
                    }
                } catch (e) {}
                return inner && inner(ty, d);
            };
            const dt = 1 / 60;
            for (let it = 0; it < 60 * 900; it++) {
                window.update(dt);
                if (state.race.status === 'finished') break;
                if (state.race.status !== 'racing') continue;
                const t = state.race.timer;
                if (t > 880) break;
                for (const bt of state.boats) {
                    if (bt.isPlayer || bt.raceState.finished) continue;
                    const c = bt.controller; if (!c) continue;
                    const rs = bt.raceState;
                    let acc = nearAcc.get(bt.id);
                    if (!acc) { acc = { penNear: 0, penNearSpin: 0, penTotal: 0 }; nearAcc.set(bt.id, acc); }
                    let s = live.get(bt.id);
                    const needNf = rs.penalty || s;
                    const nf = needNf ? nearestFloe(bt.x, bt.y) : null;
                    if (rs.penalty) {
                        acc.penTotal += dt;
                        if (nf.d < 150) { acc.penNear += dt; if (c.penaltySpin) acc.penNearSpin += dt; }
                    }
                    if (c.penaltySpin && !s) {
                        let rng = Infinity;
                        for (const ob of state.boats) {
                            if (ob === bt || ob.isPlayer || ob.raceState.finished) continue;
                            rng = Math.min(rng, Math.hypot(ob.x - bt.x, ob.y - bt.y));
                        }
                        let dRM = null;
                        const mk = state.course.marks && state.course.marks[rs.leg != null ? Math.min(rs.leg, state.course.marks.length - 1) : 0];
                        let markNear = false;
                        if (state.course.marks) for (const m of state.course.marks)
                            if (Math.hypot(m.x - bt.x, m.y - bt.y) < 220) { markNear = true; break; }
                        if (mk) dRM = Math.round(Math.hypot(mk.x - bt.x, mk.y - bt.y));
                        s = { seed, n: bt.name, t0: +t.toFixed(1), leg: rs.leg, dRM, markNear: markNear ? 1 : 0,
                            rival0: rng === Infinity ? null : Math.round(rng),
                            floe0: nf.d === Infinity ? null : Math.round(nf.d),
                            minFloe: nf.d, dur: 0, contacts: 0, contactsAfter: 0, endT: null, paused: 0 };
                        live.set(bt.id, s);
                    }
                    if (s) {
                        if (c.penaltySpin) {
                            s.dur += dt; s.minFloe = Math.min(s.minFloe, nf.d);
                            if (c.riskState === 'IMMINENT') s.paused += dt;
                        } else {
                            s.endT = t; spins.push(s); live.delete(bt.id); s = null;
                        }
                    }
                }
            }
            for (const s of live.values()) { s.endT = 900; spins.push(s); }
            // attribute contacts to spins
            for (const s of spins) {
                for (const cc of contactLog) {
                    const bt = state.boats.find(b => b.name === s.n);
                    if (!bt || cc.id !== bt.id) continue;
                    if (cc.t >= s.t0 && cc.t <= (s.endT ?? 900)) s.contacts++;
                    else if (cc.t > (s.endT ?? 900) && cc.t <= (s.endT ?? 900) + 3) s.contactsAfter++;
                }
            }
            const near = [...nearAcc.values()];
            return { spins, near, nContacts: contactLog.length,
                closings: contactLog.map(c => c.closing), drifts: contactLog.map(c => c.floeDrift) };
        }, seed);
        SPINS.push(...r.spins); NEAR.push(...r.near);
        console.log(`seed ${seed}: ${r.spins.length} spin episodes, ${r.nContacts} floe contacts (all boats)`);
    }
    await browser.close();
    const nb = TRIALS * 9;
    console.log(`\n=== PENALTY-BLIND SIZING (${TRIALS} seeds, ${path.basename(ROOT)}) ===`);
    console.log(`spin episodes: ${SPINS.length} (${(SPINS.length / nb).toFixed(2)}/boat-race)`);
    const q = (a, p) => { const s = a.filter(x => x != null).sort((x, y) => x - y); return s.length ? s[Math.floor(s.length * p)] : NaN; };
    console.log(`  start: leg1 ${SPINS.filter(s => s.leg <= 1).length} / leg2 ${SPINS.filter(s => s.leg === 2).length} / leg3+ ${SPINS.filter(s => s.leg >= 3).length}; markNear ${SPINS.filter(s => s.markNear).length}; rival0 med ${q(SPINS.map(s => s.rival0), .5)}u; floe0 med ${q(SPINS.map(s => s.floe0), .5)}u`);
    console.log(`  dur p25/med/p75: ${q(SPINS.map(s => s.dur), .25).toFixed(1)}/${q(SPINS.map(s => s.dur), .5).toFixed(1)}/${q(SPINS.map(s => s.dur), .75).toFixed(1)}s; paused med ${q(SPINS.map(s => s.paused), .5).toFixed(1)}s`);
    console.log(`  minFloe during spin p10/p25/med: ${q(SPINS.map(s => s.minFloe), .1).toFixed(0)}/${q(SPINS.map(s => s.minFloe), .25).toFixed(0)}/${q(SPINS.map(s => s.minFloe), .5).toFixed(0)}u`);
    const withC = SPINS.filter(s => s.contacts > 0);
    console.log(`  spins with floe contact DURING: ${withC.length} (${(100 * withC.length / SPINS.length).toFixed(0)}%), total contacts during ${SPINS.reduce((x, s) => x + s.contacts, 0)} + <=3s after ${SPINS.reduce((x, s) => x + s.contactsAfter, 0)}  (${((SPINS.reduce((x, s) => x + s.contacts + s.contactsAfter, 0)) / nb).toFixed(2)}/boat-race)`);
    const pn = NEAR.reduce((x, a) => x + a.penNear, 0) / nb, pns = NEAR.reduce((x, a) => x + a.penNearSpin, 0) / nb, pt = NEAR.reduce((x, a) => x + a.penTotal, 0) / nb;
    console.log(`\npenalized time: total ${pt.toFixed(1)} s/boat; near ice (<150u) ${pn.toFixed(1)} s/boat, of it spinning ${pns.toFixed(1)} s/boat`);
    fs.writeFileSync(path.join(__dirname, `_pen_blind_${path.basename(ROOT)}.json`), JSON.stringify({ SPINS, NEAR }, null, 1));
    console.log('wrote JSON');
})();
