// ⭐ SIZE THE RULE 19 "DENIED ROOM AT OBSTRUCTION" FOUL BEFORE CHANGING IT (2026-08-13)
//
// OWNER RULING: "penalties are sometimes erroneously assigned when collisions don't
// happen... we should be conservative here."  `_foul_cause.js` established that
// 90% of no-contact fouls come from the RULE 19 path, not the stand-on detector —
// but its counterfactual arm only fires on the stand-on path (n=1-6), so nothing
// yet says what FRACTION of Rule 19 fouls are unearned. This is that measurement.
//
// THE TRIGGER (script.js ~21023, inside checkIslandCollisions, per FRAME of overlap):
//   when boat B hits island I, blame any other boat O with
//     |O - B| < 130                                  (close aboard)
//     (O - B) . normalize(B - I.centre) >= 45        ("clearly outside us")
//     Rules.isOverlapped(B, O)
//   -> triggerPenalty(O, Rule 19).  No persistence. No test that O had room to
//   give. No test that O caused it. No test that B's "open water side" is water.
//
// WHAT THIS PROBE MEASURES, per penalty EPISODE (rising edge of raceState.penalty,
// rule 2 — triggerPenalty emits its event BEFORE its own debounce):
//   * PERSISTENCE   how long the full trigger predicate had held continuously
//                   before the grounding (0.05 s history, 2 s deep). Guard 1.
//   * ROOM          the accused's own clearance, and the water on HER outboard
//                   side — could she have given room at all? Guard 2.
//   * DIRECTION     is the claimer's "open water side" actually open? The escape
//                   direction is taken from the ISLAND CENTROID, and glowtide's
//                   rocks are concave `fromMask` shapes, so the centroid ray can
//                   point into more rock. If it does, "she was between me and
//                   open water" is false by construction.
//   * SELF-INFLICTED  was the claimer already aground / already in the contact
//                   escape / steering INTO the island under her own helm in the
//                   second before?
//   * CONTACT       did a boat-boat contact follow within 5 s (i.e. was it real)?
//
//   node _r19_audit.js <venue> <trials> <seed0> <tree>
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const VENUE = process.argv[2] || 'glowtide';
const TRIALS = parseInt(process.argv[3]) || 4;
const SEED0 = parseInt(process.argv[4]) || 9400;
const ROOT = path.join(__dirname, process.argv[5] || 'treeGLB');
(async () => {
    const br = await chromium.launch(); const p = await br.newPage();
    p.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await p.addInitScript((v) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })); }, VENUE);
    await p.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await p.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const A = [];
    for (let t = 0; t < TRIALS; t++) {
        const r = await p.evaluate((seed) => {
            const ev = [];                       // ordered events within the current frame
            const inner = window.onRaceEvent;
            window.onRaceEvent = (ty, d) => {
                if (ty === 'collision_island' && d && d.boat) ev.push({ ty, name: d.boat.name });
                else if (ty === 'penalty' && d && d.boat)
                    ev.push({ ty, name: d.boat.name, kind: String(d.kind || '?'), rule: d.rule || '?', flagged: !!d.boat.raceState.penalty });
                else if (ty === 'collision_boat' && d && d.boat) ev.push({ ty, name: d.boat.name });
                return inner && inner(ty, d);
            };
            window.evalHarness.seed = seed; window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const pl = state.boats.find(x => x.isPlayer); if (pl) { pl.x = 1e6; pl.y = 1e6; }

            const g = () => state.course.botGrid;
            // free run along a heading until the grid says blocked (capped at cap)
            const freeRun = (x, y, h, cap) => {
                const G = g(); if (!G) return cap;
                const sx = Math.sin(h), sy = -Math.cos(h);
                for (let d = 25; d <= cap; d += 25) {
                    const c = G.cell(x + sx * d, y + sy * d);
                    if (!G.at(c[0], c[1])) return d;
                }
                return cap;
            };
            // ring clearance in units (as _foul_cause does)
            const clr = (x, y) => {
                const G = g(); if (!G) return -1;
                const R = G.res || 50;
                for (let ring = 0; ring <= 6; ring++)
                    for (let dx = -ring; dx <= ring; dx++) for (let dy = -ring; dy <= ring; dy++) {
                        if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue;
                        const cc = G.cell(x + dx * R, y + dy * R);
                        if (!G.at(cc[0], cc[1])) return ring * R;
                    }
                return 6 * R;
            };
            const navAt = (x, y) => { const G = g(); if (!G) return 1; const c = G.cell(x, y); return G.at(c[0], c[1]) ? 1 : 0; };

            // ── rolling history, 0.05 s x 40 = 2.0 s ────────────────────────────
            const HIST = 40, HSTEP = 3;
            const hist = {};            // name -> ring of {t,x,y,hd,spd,esc,spin,agr}
            let hi = 0;
            const boatsOf = () => state.boats.filter(b => !b.isPlayer);
            const pushHist = () => {
                for (const b of boatsOf()) {
                    const q = hist[b.name] = hist[b.name] || [];
                    q[hi % HIST] = {
                        t: state.race.timer, x: b.x, y: b.y, hd: b.heading, spd: b.speed * 60,
                        esc: b.controller ? ((b.controller.iceEscapeTimer || 0) > 0 ? 1 : 0) : 0,
                        spin: b.controller ? (b.controller.penaltySpin ? 1 : 0) : 0,
                        agr: (b.ai && b.ai.collisionData && b.ai.collisionData.type === 'island') ? 1 : 0,
                        thr: (b.controller && b.controller.threatBoat) ? b.controller.threatBoat.name : null,
                        dev: b.controller ? +(b.controller.lastAvoidDeviation || 0) : 0
                    };
                }
                hi++;
            };
            const back = (name, k) => {           // k samples ago (k>=0)
                const q = hist[name]; if (!q) return null;
                const idx = ((hi - 1 - k) % HIST + HIST) % HIST;
                return q[idx] || null;
            };

            const out = []; const rubs = [];
            const DT = 1 / 60;
            let frame = 0;
            for (let it = 0; it < 60 * 900; it++) {
                ev.length = 0;
                window.update(DT);
                if (state.race.status === 'finished') break;
                if (state.race.status !== 'racing') { if (frame++ % HSTEP === 0) pushHist(); continue; }

                // pair each Rule-19 penalty with the collision_island immediately before it
                for (let i = 0; i < ev.length; i++) {
                    const E = ev[i];
                    if (E.ty === 'collision_boat') { rubs.push({ t: state.race.timer, name: E.name }); continue; }
                    if (E.ty !== 'penalty') continue;
                    const isR19 = E.kind === 'no-contact';
                    const rec = { t: +state.race.timer.toFixed(1), kind: E.kind, rule: E.rule, episode: E.flagged ? 0 : 1, r19: isR19 ? 1 : 0 };
                    if (!isR19 || E.flagged) { out.push(rec); continue; }   // count only new episodes in detail
                    let claimerName = null;
                    for (let j = i - 1; j >= 0; j--) if (ev[j].ty === 'collision_island') { claimerName = ev[j].name; break; }
                    const acc = state.boats.find(b => b.name === E.name);
                    const cl = claimerName ? state.boats.find(b => b.name === claimerName) : null;
                    rec.paired = cl ? 1 : 0;
                    if (!cl || !acc) { out.push(rec); continue; }
                    rec.claimer = cl.name; rec.accused = acc.name; rec.leg = cl.raceState.leg;

                    // the island she hit: nearest island whose hull she is inside/near
                    let isl = null, bd = 1e18;
                    for (const I of (state.course.islands || [])) {
                        if (I.awash) continue;
                        const d2 = (cl.x - I.x) ** 2 + (cl.y - I.y) ** 2;
                        if (d2 < (I.radius + 50) ** 2 && d2 < bd) { bd = d2; isl = I; }
                    }
                    if (!isl) { rec.noIsland = 1; out.push(rec); continue; }
                    rec.islR = Math.round(isl.radius); rec.mask = isl.fromMask ? 1 : 0;
                    const bx = cl.x - isl.x, by = cl.y - isl.y, bl = Math.max(1, Math.hypot(bx, by));
                    const ax = bx / bl, ay = by / bl;                     // the code's escape direction
                    const dx2 = acc.x - cl.x, dy2 = acc.y - cl.y;
                    rec.dist = Math.round(Math.hypot(dx2, dy2));
                    rec.outb = Math.round(dx2 * ax + dy2 * ay);           // "clearly outside us" margin (>=45)

                    // ── PERSISTENCE: how long did the full predicate hold, going back? ──
                    let persistFull = 0, persistOv = 0;
                    for (let k = 1; k < HIST; k++) {
                        const hc = back(cl.name, k), ha = back(acc.name, k);
                        if (!hc || !ha || hc.t == null) break;
                        const px = ha.x - hc.x, py = ha.y - hc.y;
                        const d = Math.hypot(px, py);
                        const ov = window.Rules.isOverlapped({ x: hc.x, y: hc.y, heading: hc.hd }, { x: ha.x, y: ha.y, heading: ha.hd });
                        const bx2 = hc.x - isl.x, by2 = hc.y - isl.y, bl2 = Math.max(1, Math.hypot(bx2, by2));
                        const full = d < 130 && (px * (bx2 / bl2) + py * (by2 / bl2)) >= 45 && ov;
                        if (ov && persistOv === k - 1) persistOv = k;
                        if (full && persistFull === k - 1) persistFull = k;
                        if (!ov && !full) break;
                    }
                    rec.persFull = +(persistFull * 0.05).toFixed(2);   // seconds the WHOLE predicate held
                    rec.persOv = +(persistOv * 0.05).toFixed(2);       // seconds mere overlap held

                    // ── ROOM: could the accused have given any? ──
                    rec.accClr = clr(acc.x, acc.y);
                    rec.accOutRun = freeRun(acc.x, acc.y, Math.atan2(ax, -ay), 200);  // free water along HER outboard side
                    let accPinned = 0;
                    for (const o of state.boats) {
                        if (o === acc || o === cl || o.isPlayer || o.raceState.finished) continue;
                        const ox = o.x - acc.x, oy = o.y - acc.y;
                        if (ox * ox + oy * oy > 130 * 130) continue;
                        if (ox * ax + oy * ay >= 45) { accPinned = 1; break; }        // someone outboard of HER
                    }
                    rec.accPinned = accPinned;

                    // ── DIRECTION: is the claimer's "open water side" actually open? ──
                    rec.escRun = freeRun(cl.x, cl.y, Math.atan2(ax, -ay), 250);
                    rec.escNav130 = navAt(cl.x + ax * 130, cl.y + ay * 130);
                    // best direction available to the claimer, and how far the centroid ray is from it
                    let bestH = null, bestRun = -1;
                    for (let a = 0; a < 16; a++) {
                        const h = a * Math.PI / 8;
                        const f = freeRun(cl.x, cl.y, h, 250);
                        if (f > bestRun) { bestRun = f; bestH = h; }
                    }
                    let dh = bestH - Math.atan2(ax, -ay);
                    while (dh > Math.PI) dh -= 2 * Math.PI; while (dh < -Math.PI) dh += 2 * Math.PI;
                    rec.escErrDeg = Math.round(Math.abs(dh) * 180 / Math.PI);
                    rec.bestRun = bestRun;

                    // ── SELF-INFLICTED: what was the claimer doing in the second before? ──
                    const h20 = back(cl.name, 20);   // 1.0 s ago
                    if (h20) {
                        rec.wasAgr = h20.agr; rec.wasEsc = h20.esc; rec.wasSpin = h20.spin;
                        rec.spdBefore = Math.round(h20.spd);
                        // did she close on the island under her own helm?
                        const dBefore = Math.hypot(h20.x - isl.x, h20.y - isl.y);
                        rec.closedBy = Math.round(dBefore - bl);
                        rec.thrWasAcc = h20.thr === acc.name ? 1 : 0;
                    }
                    rec.spd = Math.round(cl.speed * 60);
                    rec.clClr = clr(cl.x, cl.y);
                    // how many frames of THIS grounding episode have already fired
                    let agrRun = 0;
                    for (let k = 1; k < HIST; k++) { const h2 = back(cl.name, k); if (!h2 || !h2.agr) break; agrRun = k; }
                    rec.agrRun = +(agrRun * 0.05).toFixed(2);
                    out.push(rec);
                }
                if (frame++ % HSTEP === 0) pushHist();
                if (state.race.timer > 895) break;
            }
            // did a boat-boat contact follow the claim within 5 s?
            for (const o of out) if (o.r19 && o.episode && o.t != null)
                o.rubAfter = rubs.some(r => r.t >= o.t && r.t - o.t <= 5 && (r.name === o.claimer || r.name === o.accused)) ? 1 : 0;
            return out;
        }, SEED0 + t);
        A.push(...r);
        const eps = r.filter(x => x.episode);
        console.log(`seed ${SEED0 + t}: ${eps.length} penalty EPISODES, ${eps.filter(x => x.r19).length} Rule 19`);
    }
    await br.close();
    // ⚠️ STAMP THE TREE IN THE FILENAME. Two arms of the same venue overwrite each
    // other otherwise — a baseline audit and a candidate audit ran concurrently on
    // 2026-08-13 and the second silently clobbered the first.
    fs.writeFileSync(path.join(__dirname, `_r19_audit_${VENUE}_${path.basename(ROOT)}.json`), JSON.stringify(A));

    const eps = A.filter(x => x.episode);
    const r19 = eps.filter(x => x.r19 && x.claimer);
    const q = (arr, f) => { if (!arr.length) return NaN; const s = arr.slice().sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(f * s.length))]; };
    const pct = (n, d) => d ? (100 * n / d).toFixed(1) + '%' : '-';
    console.log(`\n=== ${VENUE}, ${TRIALS} seeds from ${SEED0} — RULE 19 AUDIT ===`);
    console.log(`penalty EPISODES ${eps.length}   of which Rule 19 ${eps.filter(x => x.r19).length} (${pct(eps.filter(x => x.r19).length, eps.length)})   paired to a grounding ${r19.length}`);
    if (!r19.length) { console.log('no paired Rule 19 episodes'); return; }
    const col = (k) => r19.map(x => x[k]).filter(v => v != null && !isNaN(v));
    const line = (label, k, unit = '') => {
        const c = col(k);
        console.log(`  ${label.padEnd(30)} p25 ${String(q(c, .25)).padStart(6)}  med ${String(q(c, .5)).padStart(6)}  p75 ${String(q(c, .75)).padStart(6)}  max ${String(Math.max(...c)).padStart(6)} ${unit}`);
    };
    console.log('\n GUARD 1 — PERSISTENCE (seconds the trigger predicate held BEFORE the grounding)');
    line('full predicate held for', 'persFull', 's');
    line('mere overlap held for', 'persOv', 's');
    for (const T of [0.05, 0.2, 0.4, 0.8]) console.log(`   would SURVIVE a ${T}s persistence guard: ${pct(r19.filter(x => x.persFull >= T).length, r19.length)}`);
    console.log('\n GUARD 2 — DID THE ACCUSED HAVE ROOM TO GIVE?');
    line('accused clearance to land', 'accClr', 'u');
    line('free water outboard of her', 'accOutRun', 'u');
    console.log(`   accused herself had a boat outboard: ${pct(r19.filter(x => x.accPinned).length, r19.length)}`);
    console.log(`   accused within 1 cell (<=50u) of land: ${pct(r19.filter(x => x.accClr <= 50).length, r19.length)}`);
    console.log(`   accused had <100u of outboard water: ${pct(r19.filter(x => x.accOutRun < 100).length, r19.length)}`);
    console.log(`   EITHER (pinned or against land or no outboard water): ${pct(r19.filter(x => x.accPinned || x.accClr <= 50 || x.accOutRun < 100).length, r19.length)}`);
    console.log('\n DIRECTION — IS THE "OPEN WATER SIDE" ACTUALLY OPEN?');
    line('free run along the escape ray', 'escRun', 'u');
    line('best free run available', 'bestRun', 'u');
    line('centroid ray vs best water', 'escErrDeg', 'deg');
    console.log(`   the escape ray is BLOCKED within 130u: ${pct(r19.filter(x => x.escRun < 130).length, r19.length)}`);
    console.log(`   cell at claimer+130u along it is LAND: ${pct(r19.filter(x => !x.escNav130).length, r19.length)}`);
    console.log(`   centroid ray >90 deg off the best water: ${pct(r19.filter(x => x.escErrDeg > 90).length, r19.length)}`);
    console.log(`   islands blamed that are concave masks: ${pct(r19.filter(x => x.mask).length, r19.length)}`);
    console.log('\n SELF-INFLICTED — WHAT WAS THE CLAIMER DOING 1 s EARLIER?');
    console.log(`   already aground 1 s before: ${pct(r19.filter(x => x.wasAgr).length, r19.length)}`);
    console.log(`   in the contact escape 1 s before: ${pct(r19.filter(x => x.wasEsc).length, r19.length)}`);
    console.log(`   penalty-spinning 1 s before: ${pct(r19.filter(x => x.wasSpin).length, r19.length)}`);
    console.log(`   her avoidance named the accused as threat: ${pct(r19.filter(x => x.thrWasAcc).length, r19.length)}`);
    line('this grounding already running for', 'agrRun', 's');
    line('she CLOSED on the island by', 'closedBy', 'u');
    line('claimer speed at the trigger', 'spd', 'u/s');
    line('claimer clearance at the trigger', 'clClr', 'u');
    console.log('\n WAS IT REAL? boat-boat contact within 5 s: ' + pct(r19.filter(x => x.rubAfter).length, r19.length));
    const byLeg = {}; for (const x of r19) byLeg[x.leg] = (byLeg[x.leg] || 0) + 1;
    console.log(' by leg: ' + Object.keys(byLeg).sort().map(k => `${k}:${byLeg[k]}`).join('  '));
})();
