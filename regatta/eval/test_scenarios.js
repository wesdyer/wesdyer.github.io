// THE SCENARIO BATTERY RUNNER — executes js/rule_scenarios.js.
//
// Scenarios are DATA (see the schema note in rule_scenarios.js); this runner
// materializes each one against a live page and asserts three layers:
//   pre       — the setup is what it claims (fixture layer)
//   oracle    — what Rules.getRightOfWay says (rules-as-encoded layer)
//   behavior  — what the umpire/engine does (enforcement layer)
// A failure prints its scenario, phase and LAYER — the rule-15 lesson is that
// oracle-green and behavior-green are different facts.
//
//   node regatta/eval/test_scenarios.js [treeRootRelToEvalRl]
// With no arg it tests the repo working tree. The visual page (rules.html)
// renders the same data.
const { chromium } = require('playwright');
const path = require('path');

const TREE = process.argv[2] || null;
const ROOT = TREE ? path.join(__dirname, 'rl', TREE, 'regatta') : path.resolve(__dirname, '..');
const DATA = TREE ? path.join(ROOT, 'js', 'rule_scenarios.js') : path.resolve(__dirname, '../js/rule_scenarios.js');
const SCN = require(DATA).scenarios;

let fails = 0, ran = 0;
const check = (label, ok, detail) => {
    console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}${ok || !detail ? '' : ' — ' + detail}`);
    if (!ok) fails++;
};

(async () => {
    const browser = await chromium.launch();
    const byVenue = {};
    for (const s of SCN) (byVenue[s.venue] = byVenue[s.venue] || []).push(s);

    for (const venue of Object.keys(byVenue)) {
        const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
        page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 200)));
        await page.addInitScript(v => localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })), venue);
        await page.goto('file://' + path.join(ROOT, 'index.html'));
        await page.waitForFunction(() => window.state && window.state.course && window.state.course.marks);

        // one-time fixture: get racing, keep two boats, index anchors
        const fixed = await page.evaluate(() => {
            window.__sb = {};
            window.resetGame(); window.startRace();
            for (let i = 0; i < 60 * 120 && state.race.status !== 'racing'; i++) window.update(1 / 60);
            const bots = state.boats.filter(b => !b.isPlayer);
            window.__sb.A = bots[0]; window.__sb.B = bots[1];
            for (const o of state.boats) if (o !== bots[0] && o !== bots[1]) {
                o.x = -1e6; o.y = -1e6; o.raceState.finished = true; o.fadeTimer = 0;
            }
            // roundMark anchor
            let leg = -1, mIdx = -1;
            for (let i = 0; i < state.course.route.length; i++) {
                const e = state.course.route[i];
                if (e && e.kind === 'round' && e.mark) {
                    leg = i;
                    mIdx = state.course.marks.indexOf(e.mark);
                    if (mIdx === -1) mIdx = state.course.marks.findIndex(m => Math.hypot(m.x - e.mark.x, m.y - e.mark.y) < 1);
                    if (mIdx >= 0 && state.course.marks[mIdx].zone == null) state.course.marks[mIdx].zone = e.mark.zone;
                    break;
                }
            }
            window.__sb.markIdx = mIdx; window.__sb.markLeg = leg;
            // bankSpot anchor candidates (land upwind of a sailable heading,
            // 8 cells of open leeward water) — validated per-scenario later
            const g = state.course.botGrid;
            const spots = [];
            if (g) {
                for (let j = 2; j < g.n - 2 && spots.length < 40; j++) for (let i = 2; i < g.n - 2 && spots.length < 40; i++) {
                    if (g.at(i, j)) continue;
                    const w0 = g.world(i, j);
                    const wd = getWindAt(w0[0], w0[1]).direction;
                    for (const side of [1, -1]) {
                        for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                            let ok = true;
                            for (let k = 1; k <= 8; k++) if (!g.at(i + k * di, j + k * dj)) { ok = false; break; }
                            if (!ok) continue;
                            const wO = g.world(i + di, j + dj);
                            const lx = w0[0] - wO[0], ly = w0[1] - wO[1], ll = Math.hypot(lx, ly) || 1;
                            const ux = lx / ll, uy = ly / ll;
                            const hdg = Math.atan2(ux, -uy) - side * Math.PI / 2;
                            const twa = Math.abs(normalizeAngle(hdg - wd));
                            if (twa < 0.7 || twa > 2.2) continue;
                            const uwx = Math.sin(wd), uwy = -Math.cos(wd);
                            if (ux * uwx + uy * uwy < 0.3) continue;
                            spots.push({ x: w0[0] - ux * 95, y: w0[1] - uy * 95, hdg, ux, uy });
                        }
                    }
                }
            }
            window.__sb.spots = spots;
            // openWater anchor: on grid venues, the first bank spot shifted 150u
            // to leeward; on open venues, the boundary/course center with the
            // upwind unit as the frame axis.
            return { racing: state.race.status === 'racing', spots: spots.length, markIdx: mIdx };
        });
        if (!fixed.racing) { check(`[${venue}] fixture racing`, false, JSON.stringify(fixed)); await page.close(); continue; }

        for (const s of byVenue[venue]) {
            ran++;
            console.log(`\n${s.rule} — ${s.title}  [${s.id}]`);

            // A scenario may need several anchor candidates (bankSpot search):
            // run it; on a fixture-layer miss with more spots to try, retry.
            const maxTries = s.anchor === 'bankSpot' || s.anchor === 'openWater' ? 40 : 1;
            let out = null;
            for (let attempt = 0; attempt < maxTries; attempt++) {
                out = await page.evaluate(([s, attempt]) => {
                    const { A, B } = window.__sb;
                    const boats = { A, B };
                    const L = [];
                    const fail = (layer, msg) => { L.push({ layer, msg }); };

                    // ── frame resolution ──
                    let origin, ux, uy, hx, hy, spotHdg, zone = null, mark = null;
                    if (s.anchor === 'roundMark') {
                        if (window.__sb.markIdx < 0) return { fixtureMiss: 'no rounding mark' };
                        mark = state.course.marks[window.__sb.markIdx];
                        zone = mark.zone;
                        origin = { x: mark.x, y: mark.y };
                    } else {
                        const g = state.course.botGrid;
                        if (g && window.__sb.spots.length) {
                            const spot = window.__sb.spots[attempt % window.__sb.spots.length];
                            if (!spot) return { fixtureMiss: 'spots exhausted' };
                            origin = { x: spot.x, y: spot.y };
                            ux = spot.ux; uy = spot.uy; spotHdg = spot.hdg;
                            if (s.anchor === 'openWater') { origin = { x: spot.x - ux * 150, y: spot.y - uy * 150 }; }
                        } else {
                            // open venue: course/boundary center, upwind unit
                            const b = state.course.boundary || { x: 0, y: 0 };
                            origin = { x: b.x, y: b.y };
                            const wd0 = getWindAt(origin.x, origin.y).direction;
                            ux = Math.sin(wd0); uy = -Math.cos(wd0); // toward the wind
                            spotHdg = wd0 - 0.66;
                        }
                        hx = Math.sin(spotHdg); hy = -Math.cos(spotHdg);
                    }
                    const wd = getWindAt(origin.x, origin.y).direction;
                    const hdgOf = (h) => {
                        if (typeof h === 'number') return h;
                        if (h === 'spot') return spotHdg;
                        if (h === 'stbdCH') return normalizeAngle(wd - 0.66);
                        if (h === 'portCH') return normalizeAngle(wd + 0.66);
                        if (h === 'stbdRun') return normalizeAngle(wd - 2.4);
                        if (h === 'portRun') return normalizeAngle(wd + 2.4);
                        const m = /^(wd|spot)([+-][\d.]+)$/.exec(h);
                        if (m) return normalizeAngle((m[1] === 'wd' ? wd : spotHdg) + parseFloat(m[2]));
                        throw new Error('bad heading ' + h);
                    };
                    const posOf = (p) => {
                        if (s.anchor === 'roundMark') {
                            if (p.du != null || p.dv != null) return { x: origin.x + (p.du || 0), y: origin.y + (p.dv || 0) };
                            return { x: origin.x + (p.dx || 0) * zone, y: origin.y + (p.dy || 0) * zone };
                        }
                        return { x: origin.x + ux * (p.dl || 0) + hx * (p.dh || 0),
                                 y: origin.y + uy * (p.dl || 0) + hy * (p.dh || 0) };
                    };

                    // ── initial placement ──
                    const home = {};
                    for (const bs of s.boats) {
                        const bt = boats[bs.name];
                        const P = posOf(bs);
                        bt.x = P.x; bt.y = P.y;
                        bt.heading = hdgOf(bs.heading);
                        bt.speed = 6; bt.velocity = { x: Math.sin(bt.heading) * 6, y: -Math.cos(bt.heading) * 6 };
                        bt.raceState.finished = false; bt.raceState.ocs = false;
                        bt.raceState.penalty = false; bt.raceState.totalPenalties = 0;
                        bt.raceState.isTacking = !!bs.isTacking;
                        bt.raceState.lastPos = { x: bt.x, y: bt.y };
                        bt.fadeTimer = 1;
                        if (s.anchor === 'roundMark' && window.__sb.markLeg >= 0) bt.raceState.leg = window.__sb.markLeg;
                        home[bs.name] = { x: P.x, y: P.y };
                    }
                    // bankSpot validation: one island pass must not displace anyone
                    if (s.anchor === 'bankSpot' || (s.anchor === 'openWater' && state.course.botGrid)) {
                        window.checkIslandCollisions(1 / 60);
                        for (const n of Object.keys(home)) {
                            if (Math.hypot(boats[n].x - home[n].x, boats[n].y - home[n].y) > 1) return { fixtureMiss: 'spot collides' };
                        }
                    }
                    window.Rules.interactions = {};

                    // ── phase execution ──
                    const snapshotOf = () => {
                        const k = [A.id, B.id].sort((x, y) => x - y).join('-');
                        const d = window.Rules.interactions[k];
                        return d && d.zoneSnapshot ? (d.zoneSnapshot.entitled === A.id ? 'A' : d.zoneSnapshot.entitled === B.id ? 'B' : null) : null;
                    };
                    const observe = () => {
                        const res = window.Rules.getRightOfWay(A, B);
                        return {
                            row: res.boat ? (res.boat === A ? 'A' : 'B') : null,
                            rule: res.rule || null,
                            markRoom: res.markRoom === A.id ? 'A' : res.markRoom === B.id ? 'B' : null,
                            overlapped: window.Rules.isOverlapped(A, B),
                            constraintR15: !!(res.constraints && res.constraints.indexOf('Rule 15') !== -1),
                            snapshotEntitled: snapshotOf(),
                            // Rules constants: STARBOARD = 1, PORT = -1
                            tackA: window.Rules.getTack(A) === 1 ? 'starboard' : 'port',
                            tackB: window.Rules.getTack(B) === 1 ? 'starboard' : 'port',
                            aAsternOfB: window.Rules.isClearAstern(A, B),
                            bAsternOfA: window.Rules.isClearAstern(B, A),
                            penA: !!A.raceState.penalty, penB: !!B.raceState.penalty,
                            isTackingA: !!A.raceState.isTacking, isTackingB: !!B.raceState.isTacking,
                            sep: Math.hypot(A.x - B.x, A.y - B.y),
                            ledgerBA: !!(B._r19Since && B._r19Since[A.id] != null),
                        };
                    };
                    const assertLayer = (phase, k, layer, spec, obs, extras) => {
                        if (!spec) return;
                        for (const key of Object.keys(spec)) {
                            const want = spec[key];
                            let got, ok;
                            if (key === 'dToMark') {
                                const bt1 = boats[want.boat], bt2 = boats[want.other];
                                const d1 = Math.hypot(bt1.x - mark.x, bt1.y - mark.y);
                                const d2 = Math.hypot(bt2.x - mark.x, bt2.y - mark.y);
                                ok = (want.ltZone == null || d1 < want.ltZone * zone)
                                  && (want.gtZone == null || d2 > want.gtZone * zone);
                                got = `d${want.boat}=${d1.toFixed(0)} d${want.other}=${d2.toFixed(0)} zone=${zone.toFixed(0)}`;
                            } else if (key === 'sep') {
                                ok = (want.lt == null || obs.sep < want.lt) && (want.gt == null || obs.sep > want.gt);
                                got = obs.sep.toFixed(0);
                            } else if (key === 'contact') {
                                ok = (obs.sep < 60) === want; got = 'sep ' + obs.sep.toFixed(0);
                            } else if (key === 'grounded') {
                                ok = extras.grounded === want; got = String(extras.grounded);
                            } else {
                                got = obs[key]; ok = got === want;
                            }
                            if (!ok) fail(layer, `phase ${k} ${layer}.${key}: want ${JSON.stringify(want)} got ${JSON.stringify(got)}`);
                        }
                    };

                    for (let k = 0; k < s.phases.length; k++) {
                        const ph = s.phases[k];
                        const extras = { grounded: null };
                        if (ph.move) {
                            for (const n of Object.keys(ph.move)) {
                                const mv = ph.move[n]; const bt = boats[n];
                                const P = posOf(mv);
                                bt.x = P.x; bt.y = P.y;
                                if (mv.heading != null) bt.heading = hdgOf(mv.heading);
                                home[n] = { x: P.x, y: P.y };
                            }
                        }
                        if (ph.clearPenalties) for (const n of Object.keys(boats)) {
                            boats[n].raceState.penalty = false; boats[n].raceState.totalPenalties = 0;
                        }
                        if (ph.marchToLand) {
                            // drive `boat` toward the bank until the collider fires,
                            // `follower` trailing on the open side
                            const bt = boats[ph.marchToLand.boat], fl = boats[ph.marchToLand.follower];
                            let hit = false;
                            for (let d = 20; d <= 160 && !hit; d += 10) {
                                bt.x = origin.x + ux * d; bt.y = origin.y + uy * d;
                                fl.x = bt.x - ux * ph.marchToLand.gap; fl.y = bt.y - uy * ph.marchToLand.gap;
                                const px = bt.x, py = bt.y;
                                state.time += 1 / 60; state.race.timer += 1 / 60;
                                window.Rules.update(1 / 60);
                                window.checkIslandCollisions(1 / 60);
                                if (Math.hypot(bt.x - px, bt.y - py) > 0.5) hit = true;
                            }
                            if (hit) extras.grounded = ph.marchToLand.boat;
                        }
                        const frames = ph.frames || 1;
                        const holdHdg = {};
                        if (ph.step === 'full') for (const n of Object.keys(boats)) holdHdg[n] = boats[n].heading;
                        for (let f = 0; f < frames; f++) {
                            if (ph.step === 'full') {
                                // the whole engine (physics + rules + umpires); the
                                // pose is re-pinned so only per-frame FLAGS evolve
                                window.update(1 / 60);
                            } else {
                                state.time += 1 / 60; state.race.timer += 1 / 60;
                                window.Rules.update(1 / 60);
                                if (ph.step === 'rules+islands' || ph.step === 'contact') window.checkIslandCollisions(1 / 60);
                                if (ph.step === 'contact') window.checkBoatCollisions(1 / 60);
                                if (ph.step === 'markContact') window.checkMarkCollisions(1 / 60);
                            }
                            if (ph.hold) for (const n of Object.keys(home)) {
                                boats[n].x = home[n].x; boats[n].y = home[n].y;
                                if (ph.step === 'full') boats[n].heading = holdHdg[n];
                            }
                        }
                        const obs = observe();
                        // fixture-layer misses on searchable anchors retry with the next
                        // spot; scenarios flagged retryScope:'any-layer' (the umpire's
                        // deliberately-conservative rules, whose guards are geometry-
                        // sensitive) retry on ANY miss — they assert a clean geometry
                        // EXISTS where the rule fires, and still fail if none does.
                        const savedFail = L.length;
                        assertLayer(ph, k, 'pre', ph.pre, obs, extras);
                        const searchable = (s.anchor === 'bankSpot' || s.anchor === 'openWater') && state.course.botGrid;
                        if (L.length > savedFail && searchable) {
                            return { fixtureMiss: L[savedFail].msg };
                        }
                        assertLayer(ph, k, 'oracle', ph.oracle, obs, extras);
                        assertLayer(ph, k, 'behavior', ph.behavior, obs, extras);
                        if (L.length > savedFail && searchable && s.retryScope === 'any-layer') {
                            return { fixtureMiss: L[savedFail].msg };
                        }
                    }
                    return { fails: L };
                }, [s, attempt]);
                if (!out.fixtureMiss) break;
            }
            if (out.fixtureMiss) { check(`[fixture] ${s.id}`, false, out.fixtureMiss + ' (all anchor candidates tried)'); continue; }
            if (!out.fails.length) check(`${s.id}: all layers`, true);
            else for (const f of out.fails) check(`${s.id} [${f.layer}]`, false, f.msg);
        }
        await page.close();
    }

    await browser.close();
    console.log(`\n${ran} scenarios, ${fails ? fails + ' FAILURES' : 'ALL OK'}`);
    process.exit(fails ? 1 : 0);
})();
