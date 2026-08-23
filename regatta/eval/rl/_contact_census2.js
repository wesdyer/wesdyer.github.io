// POST-SHIP CONTACT CENSUS (2026-08-23, the sub-1.5x contact-economics push,
// Phase 1.1). EVERY floe-contact EPISODE (0.5s dedup — rule 2) on the b3
// HEAD, classified by ANTECEDENT with primary precedence:
//   PEN-BLIND    penalty spin active at contact or within the prior 3s
//                (the 27b early return: a spinning boat runs no avoidance)
//   LATCH-THRASH episode starts <=10s after the previous contact episode on
//                the same boat (rule 29: iceEscapeTimer freezes wherever
//                applyAvoidance is skipped — recorded, not assumed)
//   RIVAL-FED    a live rival resolution (role != NONE or threatBoat) with a
//                real deflection (|dev| > 0.09) in the prior 5s (D1v2's
//                remainder)
//   HOT-ENTRY    residue with speed >= 60 u/s at touch AND incidence >= 30deg
//                (approach-pose: the boat sailed hard into the edge)
//   NAV-RESIDUE  everything else (glancing shaves at low speed included;
//                pose stats printed for the residue split)
// Overlap flags are ALSO reported (a contact can be pen+latch etc.) so the
// precedence isn't hiding mass. COST per episode: dwell40 = seconds inside a
// 12s post-touch window with speed*60 < 40 (the STUCK line; window closes
// early at the next episode). s/boat AND episodes/boat per class (rule 2:
// both). Fleet, __CHAR unset (rule 18b — the fleet-bench attribution mirror).
//   node _contact_census2.js <trials> <seed0> <tree>
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
    const EPS = [];
    for (let i = 0; i < TRIALS; i++) {
        const seed = SEED0 + i;
        const r = await page.evaluate(async (seed) => {
            const segD = (px, py, ax, ay, bx, by) => {
                const dx = bx - ax, dy = by - ay; const L2 = dx * dx + dy * dy;
                let t = L2 ? ((px - ax) * dx + (py - ay) * dy) / L2 : 0; t = Math.max(0, Math.min(1, t));
                return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
            };
            // nearest hull segment: returns {d, segAng} for pose incidence
            const floeSeg = (f, px, py) => {
                if (!f.localHull || !f.localHull.length) return { d: Math.hypot(px - f.x, py - f.y) - (f.radius || 0), segAng: null };
                const c = Math.cos(f.spin || 0), s = Math.sin(f.spin || 0);
                const pts = f.localHull.map(p => [f.x + p.x * c - p.y * s, f.y + p.x * s + p.y * c]);
                let best = Infinity, ang = null;
                for (let i2 = 0; i2 < pts.length; i2++) {
                    const a = pts[i2], b = pts[(i2 + 1) % pts.length];
                    const d = segD(px, py, a[0], a[1], b[0], b[1]);
                    if (d < best) { best = d; ang = Math.atan2(b[0] - a[0], -(b[1] - a[1])); }
                }
                return { d: best, segAng: ang };
            };
            window.evalHarness.seed = seed;
            window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const pl = state.boats.find(b => b.isPlayer); if (pl) { pl.x = 1e6; pl.y = 1e6; }
            const eps = [];
            const hist = new Map();   // id -> ring of {t, pen, spin, role, threat, dev, ice}
            const lastC = new Map();  // id -> last contact t (0.5s dedup)
            const lastEpEnd = new Map(); // id -> last episode's last-contact t
            const open = new Map();   // id -> open episode (dwell window)
            const floes = () => (state.course.islands || []).filter(i2 => i2.isFloe);
            const norm = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
            const inner = window.onRaceEvent;
            window.onRaceEvent = (ty, d) => {
                try {
                    if (d && d.boat && !d.boat.isPlayer && ty === 'collision_island' && d.isFloe
                        && state.race.status === 'racing') {
                        const bt = d.boat, t = state.race.timer;
                        if (t - (lastC.get(bt.id) || -10) > 0.5) {
                            const c = bt.controller || {};
                            const h = hist.get(bt.id) || [];
                            const spin3 = h.some(x => t - x.t <= 3.0 && x.spin) || !!c.penaltySpin;
                            const pen3 = h.some(x => t - x.t <= 3.0 && x.pen) || !!(bt.raceState.penalty);
                            const rival5 = h.some(x => t - x.t <= 5.0 && (x.role || x.threat) && x.dev > 0.09);
                            const prevEnd = lastEpEnd.get(bt.id);
                            const latch10 = prevEnd != null && (t - prevEnd) <= 10.0;
                            // pose: velocity vs nearest floe edge
                            let pose = null;
                            const FL = floes(); let bd = Infinity, bAng = null;
                            for (const f of FL) {
                                if (Math.hypot(bt.x - f.x, bt.y - f.y) > (f.radius || 0) + 300) continue;
                                const r2 = floeSeg(f, bt.x, bt.y);
                                if (r2.d < bd) { bd = r2.d; bAng = r2.segAng; }
                            }
                            const vAng = Math.atan2(bt.velocity ? bt.velocity.x : Math.sin(bt.heading),
                                -(bt.velocity ? bt.velocity.y : Math.cos(bt.heading)));
                            if (bAng != null) {
                                let inc = Math.abs(norm(vAng - bAng));
                                if (inc > Math.PI / 2) inc = Math.PI - inc;   // segment is undirected
                                pose = +(inc * 180 / Math.PI).toFixed(0);     // 0 = glancing, 90 = head-on
                            }
                            const spd = (bt.velocity ? Math.hypot(bt.velocity.x, bt.velocity.y) : bt.speed) * 60;
                            const prev = open.get(bt.id);
                            if (prev) { eps.push(prev); }
                            const ep = { seed, n: bt.name, t0: +t.toFixed(1), leg: bt.raceState.leg,
                                spin3: spin3 ? 1 : 0, pen3: pen3 ? 1 : 0, rival5: rival5 ? 1 : 0,
                                latch10: latch10 ? 1 : 0, iceT: +(c.iceEscapeTimer || 0).toFixed(2),
                                spd: +spd.toFixed(0), pose, armed: bt.raceState.roundArmed ? 1 : 0,
                                roleNow: c.avoidanceRole || 'NONE', dwell40: 0, lastT: t };
                            open.set(bt.id, ep);
                        }
                        lastC.set(bt.id, t);
                        lastEpEnd.set(bt.id, t);
                        const ep = open.get(bt.id); if (ep) ep.lastT = t;
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
                    let h = hist.get(bt.id); if (!h) { h = []; hist.set(bt.id, h); }
                    h.push({ t, pen: bt.raceState.penalty ? 1 : 0, spin: c.penaltySpin ? 1 : 0,
                        role: c.avoidanceRole && c.avoidanceRole !== 'NONE' ? 1 : 0,
                        threat: c.threatBoat ? 1 : 0, dev: Math.abs(c.lastAvoidDeviationSigned || 0) });
                    if (h.length > 320) h.splice(0, h.length - 320);
                    const ep = open.get(bt.id);
                    if (ep) {
                        if (t - ep.t0 > 12.0) { eps.push(ep); open.delete(bt.id); }
                        else {
                            const spd = (bt.velocity ? Math.hypot(bt.velocity.x, bt.velocity.y) : bt.speed) * 60;
                            if (spd < 40) ep.dwell40 += dt;
                        }
                    }
                }
            }
            for (const ep of open.values()) eps.push(ep);
            return eps;
        }, seed);
        EPS.push(...r);
        console.log(`seed ${seed}: ${r.length} contact episodes`);
    }
    await browser.close();
    const nb = TRIALS * 9;
    const cls = (e) => e.spin3 || e.pen3 ? 'PEN-BLIND' : e.latch10 ? 'LATCH-THRASH'
        : e.rival5 ? 'RIVAL-FED' : (e.spd >= 60 && e.pose != null && e.pose >= 30) ? 'HOT-ENTRY' : 'NAV-RESIDUE';
    console.log(`\n=== CONTACT CENSUS v2 (${TRIALS} seeds, ${path.basename(ROOT)}) ===`);
    console.log(`episodes ${EPS.length} = ${(EPS.length / nb).toFixed(2)}/boat-race; dwell40 total ${(EPS.reduce((s, e) => s + e.dwell40, 0) / nb).toFixed(1)} s/boat`);
    const by = {};
    for (const e of EPS) { const k = cls(e); (by[k] = by[k] || []).push(e); }
    console.log('class         eps  eps/boat  dwell s/boat  medSpd  medPose  leg1/2/3+');
    for (const [k, v] of Object.entries(by).sort((a, b) => b[1].length - a[1].length)) {
        const dw = v.reduce((s, e) => s + e.dwell40, 0) / nb;
        const sp = v.map(e => e.spd).sort((a, b) => a - b)[Math.floor(v.length / 2)];
        const po = v.filter(e => e.pose != null).map(e => e.pose).sort((a, b) => a - b);
        const l1 = v.filter(e => e.leg <= 1).length, l2 = v.filter(e => e.leg === 2).length;
        console.log(`${k.padEnd(13)} ${String(v.length).padStart(4)}  ${(v.length / nb).toFixed(2).padStart(8)}  ${dw.toFixed(2).padStart(12)}  ${String(sp).padStart(6)}  ${po.length ? String(po[Math.floor(po.length / 2)]).padStart(7) : '      -'}  ${l1}/${l2}/${v.length - l1 - l2}`);
    }
    const f = (p) => `${EPS.filter(p).length} (${(100 * EPS.filter(p).length / EPS.length).toFixed(0)}%)`;
    console.log(`\noverlap flags: spin3 ${f(e => e.spin3)}  pen3 ${f(e => e.pen3)}  rival5 ${f(e => e.rival5)}  latch10 ${f(e => e.latch10)}  iceT>0 ${f(e => e.iceT > 0)}  armed ${f(e => e.armed)}`);
    const spds = EPS.map(e => e.spd).sort((a, b) => a - b);
    const poses = EPS.filter(e => e.pose != null).map(e => e.pose).sort((a, b) => a - b);
    const q = (a, p) => a[Math.floor(a.length * p)];
    console.log(`entry speed p25/med/p75: ${q(spds, .25)}/${q(spds, .5)}/${q(spds, .75)} u/s   incidence p25/med/p75: ${q(poses, .25)}/${q(poses, .5)}/${q(poses, .75)} deg`);
    fs.writeFileSync(path.join(__dirname, `_contact_census2_${path.basename(ROOT)}.json`), JSON.stringify(EPS, null, 1));
    console.log('wrote JSON');
})();
