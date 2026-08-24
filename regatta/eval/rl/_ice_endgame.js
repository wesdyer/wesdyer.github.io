// ICE-IN-THE-ENDGAME PROBE (2026-08-22, C4 push, Phase 1.3 — SIZES D1
// BEFORE BUILDING, the _carrot_pin_cf lesson). Fleet arctic, __CHAR unset
// (rule 18b). Two censuses:
//  (a) FLOE CONTACT ATTRIBUTION: floe-contact episodes (0.5s dedup) per
//      boat, with a 5s lookback — was the boat under a live rival
//      resolution (avoidanceRole != NONE or threatBoat set) with a real
//      deflection (|dev| > 0.09) in the prior 5s? That share is the mass
//      D1 can touch. Also: role at contact, nearest rival at contact.
//  (b) ESCAPE-INTO-ICE census: episodes where a boat is resolving a rival
//      (role GIVE_WAY or threat set, rival < 300u) while ice is near
//      (floe clearance < 250u); within the episode, on how many does the
//      CHOSEN heading's 4s projection (with floe drift) cross a floe hull
//      (+25u pad)? Those are the frames where the endgame bought ice to
//      pay for a boat — D1's direct target.
//   node _ice_endgame.js <trials> <seed0> <tree>
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const TRIALS = parseInt(process.argv[2]) || 4;
const SEED0 = parseInt(process.argv[3]) || 9400;
const ROOT = path.join(__dirname, process.argv[4] || 'treeC2');
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.addInitScript(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'arctic' })); });
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const CONTACTS = [], RES = [];
    for (let i = 0; i < TRIALS; i++) {
        const seed = SEED0 + i;
        const r = await page.evaluate(async (seed) => {
            const segD = (px, py, ax, ay, bx, by) => {
                const dx = bx - ax, dy = by - ay; const L2 = dx * dx + dy * dy;
                let t = L2 ? ((px - ax) * dx + (py - ay) * dy) / L2 : 0; t = Math.max(0, Math.min(1, t));
                return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
            };
            const floeClr = (f, px, py, t) => {
                if (!f.localHull || !f.localHull.length) return Math.hypot(px - f.x, py - f.y) - (f.radius || 0);
                const fx = f.x + (f.driftVx || 0) * t, fy = f.y + (f.driftVy || 0) * t;
                const sp = (f.spin || 0) + (f.spinRate || 0) * t;
                const c = Math.cos(sp), s = Math.sin(sp);
                const pts = f.localHull.map(p => [fx + p.x * c - p.y * s, fy + p.x * s + p.y * c]);
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
            const contacts = [], res = [];
            const hist = new Map();   // id -> ring of {t, role, threat, dev}
            const lastC = new Map();  // id -> last contact t (dedup)
            const resSt = new Map();  // id -> live resolution episode
            const floes = () => (state.course.islands || []).filter(i2 => i2.isFloe);
            const inner = window.onRaceEvent;
            window.onRaceEvent = (ty, d) => {
                try {
                    if (d && d.boat && !d.boat.isPlayer && ty === 'collision_island' && d.isFloe
                        && state.race.status === 'racing') {
                        const bt = d.boat, t = state.race.timer;
                        if (t - (lastC.get(bt.id) || -10) > 0.5) {
                            const h = hist.get(bt.id) || [];
                            const look = h.filter(x => t - x.t <= 5.0);
                            const rival5 = look.some(x => (x.role || x.threat) && x.dev > 0.09);
                            const anyDefl5 = look.some(x => x.dev > 0.09);
                            let rng = Infinity;
                            for (const ob of state.boats) {
                                if (ob === bt || ob.isPlayer || ob.raceState.finished) continue;
                                rng = Math.min(rng, Math.hypot(ob.x - bt.x, ob.y - bt.y));
                            }
                            const c = bt.controller || {};
                            contacts.push({ t: +t.toFixed(1), n: bt.name, leg: bt.raceState.leg,
                                rival5: rival5 ? 1 : 0, anyDefl5: anyDefl5 ? 1 : 0,
                                roleNow: c.avoidanceRole || 'NONE',
                                rng: rng === Infinity ? null : Math.round(rng),
                                armed: bt.raceState.roundArmed ? 1 : 0,
                                pen: bt.raceState.penalty ? 1 : 0 });
                        }
                        lastC.set(bt.id, t);
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
                    const role = c.avoidanceRole && c.avoidanceRole !== 'NONE' ? c.avoidanceRole : null;
                    const dev = Math.abs(c.lastAvoidDeviationSigned || 0);
                    let h = hist.get(bt.id); if (!h) { h = []; hist.set(bt.id, h); }
                    h.push({ t, role, threat: c.threatBoat ? 1 : 0, dev });
                    if (h.length > 320) h.splice(0, h.length - 320);
                    // (b) resolution-near-ice episodes
                    let rng = Infinity;
                    for (const ob of state.boats) {
                        if (ob === bt || ob.isPlayer || ob.raceState.finished) continue;
                        rng = Math.min(rng, Math.hypot(ob.x - bt.x, ob.y - bt.y));
                    }
                    const FL = floes();
                    let nf = Infinity;
                    for (const f of FL) {
                        if (Math.hypot(bt.x - f.x, bt.y - f.y) > (f.radius || 0) + 700) continue;
                        nf = Math.min(nf, floeClr(f, bt.x, bt.y, 0));
                    }
                    const live = (role || c.threatBoat) && rng < 300 && nf < 250;
                    let s = resSt.get(bt.id);
                    if (live) {
                        // does the CHOSEN heading cross ice within 4s?
                        const hCh = c._lastAvoidChoice != null ? c._lastAvoidChoice : bt.heading;
                        const hx = Math.sin(hCh), hy = -Math.cos(hCh);
                        const v = Math.max(40, (bt.speed || 0) * 60);
                        let cross = false;
                        for (let k = 1; k <= 16 && !cross; k++) {
                            const tt = k * 0.25;
                            const px = bt.x + hx * v * tt, py = bt.y + hy * v * tt;
                            for (const f of FL) {
                                if (Math.hypot(px - f.x, py - f.y) > (f.radius || 0) + 400) continue;
                                if (floeClr(f, px, py, tt) < 25) { cross = true; break; }
                            }
                        }
                        if (s && t - s.lastT <= 1.0) {
                            s.lastT = t; s.dur = t - s.t0; if (cross) s.crossT += dt;
                            s.dev = Math.max(s.dev, dev);
                        } else {
                            if (s) res.push(s);
                            s = { seed, n: bt.name, leg: bt.raceState.leg, t0: +t.toFixed(1),
                                lastT: t, dur: dt, crossT: cross ? dt : 0, dev,
                                role: role || (c.threatBoat ? 'THREAT' : '?') };
                            resSt.set(bt.id, s);
                        }
                    } else if (s && t - s.lastT > 1.0) { res.push(s); resSt.set(bt.id, null); }
                }
            }
            for (const s of resSt.values()) if (s) res.push(s);
            return { contacts, res };
        }, seed);
        for (const c of r.contacts) c.seed = seed;
        CONTACTS.push(...r.contacts); RES.push(...r.res);
        console.log(`seed ${seed}: ${r.contacts.length} floe-contact episodes, ${r.res.length} resolution-near-ice episodes`);
    }
    await browser.close();
    const nb = TRIALS * 9;
    console.log(`\n=== ICE-IN-THE-ENDGAME (${TRIALS} seeds, ${path.basename(ROOT)}) ===`);
    console.log(`(a) floe-contact episodes: ${CONTACTS.length} (${(CONTACTS.length / nb).toFixed(1)}/boat-race)`);
    const r5 = CONTACTS.filter(c => c.rival5).length, d5 = CONTACTS.filter(c => c.anyDefl5).length;
    console.log(`    rival-resolution deflection in prior 5s: ${r5} (${(100 * r5 / CONTACTS.length).toFixed(0)}%)   any deflection in prior 5s: ${d5} (${(100 * d5 / CONTACTS.length).toFixed(0)}%)`);
    const roles = {};
    for (const c of CONTACTS) { const k = `${c.roleNow}${c.armed ? '/armed' : ''}${c.pen ? '/pen' : ''}`; roles[k] = (roles[k] || 0) + 1; }
    console.log('    role at contact:', Object.entries(roles).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}=${v}`).join('  '));
    const rr = CONTACTS.map(c => c.rng).filter(x => x != null).sort((a, b) => a - b);
    console.log(`    nearest rival at contact p25/med/p75: ${rr[Math.floor(rr.length * .25)]}/${rr[Math.floor(rr.length * .5)]}/${rr[Math.floor(rr.length * .75)]}u`);
    console.log(`\n(b) resolution-near-ice episodes (role/threat + rival<300 + floe<250): ${RES.length} (${(RES.length / nb).toFixed(1)}/boat-race)`);
    const withCross = RES.filter(e => e.crossT > 0.25);
    const totDur = RES.reduce((s, e) => s + e.dur, 0), totCross = RES.reduce((s, e) => s + e.crossT, 0);
    console.log(`    episodes where the CHOSEN heading crossed ice >0.25s: ${withCross.length} (${(100 * withCross.length / RES.length).toFixed(0)}%)`);
    console.log(`    time in-episode ${(totDur / nb).toFixed(1)} s/boat-race, of it chosen-crosses-ice ${(totCross / nb).toFixed(1)} s/boat-race (${(100 * totCross / totDur).toFixed(0)}%)`);
    fs.writeFileSync(path.join(__dirname, '_ice_endgame.json'), JSON.stringify({ CONTACTS, RES }, null, 1));
    console.log('wrote _ice_endgame.json');
})();
