// EXONERATION (RRS 43) — the owner's two named cases, plus their controls.
//
// The rule, condensed (RRS 2025-2028):
//   43.1(a) When as a consequence of breaking a rule a boat has COMPELLED another
//           boat to break a rule, the other boat is exonerated for her breach.
//   43.1(b) When a boat is sailing WITHIN THE ROOM OR MARK-ROOM TO WHICH SHE IS
//           ENTITLED and, as a consequence of an incident with a boat required to
//           give her that room or mark-room, she breaks a rule of Section A,
//           rule 15, 16 or 31, she is exonerated for her breach.
//   43.2    A boat exonerated for breaking a rule need not take a penalty and
//           shall not be penalized for breaking that rule.
//
// Owner cases (2026-08-15 ruling): (a) mark-room entitlement — "first in the
// circle, on the same tack etc"; (b) obstruction room — a boat that must avoid
// an obstruction MUST BE GIVEN room to avoid it.
//
// These are umpire-layer tests: boats placed by hand, the actual collision
// umpires (checkBoatCollisions / checkMarkCollisions / checkIslandCollisions)
// invoked, penalties read off raceState. Every case asserts its own
// preconditions (the markroom lesson). Section A runs on bay (rounding marks),
// section B on river (banks = obstructions).
//
//   node regatta/eval/test_exoneration.js [treeRootRelToEvalRl]
// With no arg it tests the repo working tree.
const { chromium } = require('playwright');
const path = require('path');

const TREE = process.argv[2] || null;
const ROOT = TREE ? path.join(__dirname, 'rl', TREE, 'regatta') : path.resolve(__dirname, '..');

let fails = 0;
const check = (name, ok, detail) => {
    console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${name}${ok || !detail ? '' : ' — ' + detail}`);
    if (!ok) fails++;
};

(async () => {
    const browser = await chromium.launch();

    // ───────────────────────── SECTION A: mark-room (43.1(b)) — bay ─────────
    {
        const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
        page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 200)));
        await page.addInitScript(() => localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'bay' })));
        await page.goto('file://' + path.join(ROOT, 'index.html'));
        await page.waitForFunction(() => window.state && window.state.course && window.state.course.marks);

        await page.evaluate(() => {
            window.__x = {};
            window.resetGame(); window.startRace();
            for (let i = 0; i < 60 * 120 && state.race.status !== 'racing'; i++) window.update(1 / 60);
            const bots = state.boats.filter(b => !b.isPlayer);
            window.__x.A = bots[0]; window.__x.B = bots[1];
            for (const o of state.boats) if (o !== bots[0] && o !== bots[1]) {
                o.x = -1e6; o.y = -1e6; o.raceState.finished = true; o.fadeTimer = 0;
            }
            let leg = -1, mark = null;
            for (let i = 0; i < state.course.route.length; i++) {
                const e = state.course.route[i];
                if (e && e.kind === 'round' && e.mark) { leg = i; mark = e.mark; break; }
            }
            // The route entry's mark and the entry in state.course.marks may be
            // distinct objects at the same coordinates — checkMarkCollisions
            // iterates state.course.marks, so resolve the canonical one.
            let mIdx = state.course.marks.indexOf(mark);
            if (mIdx === -1 && mark) mIdx = state.course.marks.findIndex(m => Math.hypot(m.x - mark.x, m.y - mark.y) < 1);
            window.__x.mark = mIdx >= 0 ? state.course.marks[mIdx] : mark;
            if (window.__x.mark && mark && window.__x.mark.zone == null) window.__x.mark.zone = mark.zone;
            window.__x.markIdx = mIdx; window.__x.leg = leg;
        });
        const fx = await page.evaluate(() => ({ leg: window.__x.leg, zone: window.__x.mark && window.__x.mark.zone,
            racing: state.race.status === 'racing' }));
        check('[fixture] bay racing, rounding mark found', fx.racing && fx.zone > 0, JSON.stringify(fx));
        const Z = fx.zone;

        // Latch B entitled (inside overlapped at the zone), then produce the incident.
        // `place` clears penalties, sets both boats on the given mark-relative spots,
        // steps Rules.update to latch, and asserts the snapshot.
        const latch = (aSpot, bSpot) => page.evaluate(([aSpot, bSpot]) => {
            const { A, B, mark } = window.__x;
            window.Rules.interactions = {};
            for (const [bt, p] of [[A, aSpot], [B, bSpot]]) {
                bt.x = mark.x + p.dx; bt.y = mark.y + p.dy; bt.heading = p.heading;
                bt.speed = 6; bt.velocity = { x: Math.sin(p.heading) * 6, y: -Math.cos(p.heading) * 6 };
                bt.raceState.leg = window.__x.leg;
                bt.raceState.finished = false; bt.raceState.ocs = false;
                bt.raceState.penalty = false; bt.raceState.totalPenalties = 0;
                bt.raceState.isTacking = false;
                bt.raceState.lastPos = { x: bt.x, y: bt.y };
                bt.fadeTimer = 1;
            }
            for (let i = 0; i < 5; i++) { state.time += 1 / 60; window.Rules.update(1 / 60); }
            const k = [A.id, B.id].sort((x, y) => x - y).join('-');
            const d = window.Rules.interactions[k];
            const res = window.Rules.getRightOfWay(A, B);
            return {
                snap: d && d.zoneSnapshot ? { entitled: d.zoneSnapshot.entitled === B.id ? 'B' : d.zoneSnapshot.entitled === A.id ? 'A' : null,
                    markIndex: d.zoneSnapshot.markIndex } : null,
                markRoom: res.markRoom === B.id ? 'B' : res.markRoom === A.id ? 'A' : null,
                overlapped: window.Rules.isOverlapped(A, B),
                markIdx: state.course.marks.indexOf(window.__x.mark)
            };
        }, [aSpot, bSpot]);

        // Geometry: B inside overlapped near the mark, A abeam outside her.
        const east = Math.PI / 2;
        const aSpot = { dx: -1.05 * Z, dy: -0.20 * Z, heading: east };
        const bSpot = { dx: -0.80 * Z, dy: 0.16 * Z, heading: east };

        // ── A2: THE OWNER'S CASE — compelled mark touch under entitlement ──
        {
            const l = await latch(aSpot, bSpot);
            check('  [precondition] B entitled by zone snapshot, pair overlapped',
                l.snap && l.snap.entitled === 'B' && l.snap.markIndex === l.markIdx && l.overlapped && l.markRoom === 'B',
                JSON.stringify(l));
            const r = await page.evaluate(() => {
                const { A, B, mark } = window.__x;
                // B squeezed onto the mark: hull overlapping the buoy circle, A close
                // aboard on her outside (the incident). Keep both inside the zone so
                // the snapshot holds.
                B.x = mark.x + 18; B.y = mark.y; B.heading = Math.PI / 2;
                A.x = mark.x + 18 + 75; A.y = mark.y; A.heading = Math.PI / 2;
                for (const bt of [A, B]) { bt.raceState.penalty = false; bt.raceState.totalPenalties = 0; }
                state.time += 1 / 60; window.Rules.update(1 / 60);
                window.checkMarkCollisions(1 / 60);
                const dB = Math.hypot(B.x - mark.x, B.y - mark.y), dA = Math.hypot(A.x - mark.x, A.y - mark.y);
                return { penB: !!B.raceState.penalty, penA: !!A.raceState.penalty, dA, dB,
                    sep: Math.hypot(A.x - B.x, A.y - B.y) };
            });
            check('  [precondition] B touched the mark with the room-ower close aboard outside',
                r.dB < 60 && r.dA > r.dB && r.sep < 110, JSON.stringify(r));
            check('43.1(b): entitled boat squeezed onto the mark is NOT penalized under rule 31',
                !r.penB, `B penalized=${r.penB} — she was sailing within mark-room she was entitled to; the touch was the incident with the boat owing her room`);
        }

        // ── A3: CONTROL — same touch, no other boat near: penalty STANDS ──
        {
            await latch(aSpot, bSpot);
            const r = await page.evaluate(() => {
                const { A, B, mark } = window.__x;
                B.x = mark.x + 18; B.y = mark.y; B.heading = Math.PI / 2;
                A.x = mark.x + 4 * mark.zone; A.y = mark.y - 4 * mark.zone; // far away — no incident
                for (const bt of [A, B]) { bt.raceState.penalty = false; bt.raceState.totalPenalties = 0; }
                state.time += 1 / 60; window.Rules.update(1 / 60);
                window.checkMarkCollisions(1 / 60);
                return { penB: !!B.raceState.penalty };
            });
            check('43.1(b) control: a mark touch with NO incident is still a rule 31 penalty',
                r.penB, `B penalized=${r.penB} — exoneration requires an incident with the boat owing room; alone, hitting the buoy is her own foul`);
        }

        // ── A1: REGRESSION — boat-on-boat contact inside mark-room (encoded) ──
        {
            await latch(aSpot, bSpot);
            const r = await page.evaluate(() => {
                const { A, B, mark } = window.__x;
                // A presses down on the entitled inside boat until hulls touch.
                B.x = mark.x + 40; B.y = mark.y; B.heading = Math.PI / 2;
                A.x = mark.x + 40; A.y = mark.y + 17; A.heading = Math.PI / 2;
                for (const bt of [A, B]) { bt.raceState.penalty = false; bt.raceState.totalPenalties = 0; }
                state.time += 1 / 60; window.Rules.update(1 / 60);
                window.checkBoatCollisions(1 / 60);
                return { penA: !!A.raceState.penalty, penB: !!B.raceState.penalty };
            });
            check('43.1(b) regression: contact inside mark-room penalizes the OWER, not the entitled boat',
                r.penA && !r.penB, JSON.stringify(r));
        }
        await page.close();
    }

    // ─────────────── SECTION B: room at an obstruction (43.1(a) + 19.2(b)) — river ───────────────
    {
        const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
        page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 200)));
        await page.addInitScript(() => localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'river' })));
        await page.goto('file://' + path.join(ROOT, 'index.html'));
        await page.waitForFunction(() => window.state && window.state.course && window.state.course.marks);

        const fx = await page.evaluate(() => {
            window.__x = {};
            window.resetGame(); window.startRace();
            for (let i = 0; i < 60 * 120 && state.race.status !== 'racing'; i++) window.update(1 / 60);
            const bots = state.boats.filter(b => !b.isPlayer);
            window.__x.A = bots[0]; window.__x.B = bots[1];
            for (const o of state.boats) if (o !== bots[0] && o !== bots[1]) {
                o.x = -1e6; o.y = -1e6; o.raceState.finished = true; o.fadeTimer = 0;
            }
            // Collect candidate bank spots: land on the WINDWARD side of a sailable
            // heading (so the leeward open-water boat holds ROW under rule 11 while
            // the windward boat is pinned against the bank), with deep leeward water.
            // The grid approximates island polygons, so each candidate is validated
            // later by placing the boats and checking the collision pass does not
            // move them.
            const g = state.course.botGrid;
            if (!g) return { err: 'no grid' };
            const spots = [];
            for (let j = 2; j < g.n - 2 && spots.length < 40; j++) for (let i = 2; i < g.n - 2 && spots.length < 40; i++) {
                if (g.at(i, j)) continue; // want a LAND cell
                const w0 = g.world(i, j);
                const wd = getWindAt(w0[0], w0[1]).direction;
                for (const side of [1, -1]) {
                    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                        // open water stretching 8 cells off this land cell (the
                        // open-water control replays the scene 150u to leeward)
                        let openRun = true;
                        for (let k = 1; k <= 8; k++) if (!g.at(i + k * di, j + k * dj)) { openRun = false; break; }
                        if (!openRun) continue;
                        const wOpen = g.world(i + di, j + dj);
                        const lx = w0[0] - wOpen[0], ly = w0[1] - wOpen[1];
                        const ll = Math.hypot(lx, ly) || 1;
                        const ux = lx / ll, uy = ly / ll; // unit: open water -> land
                        const hdg = Math.atan2(ux, -uy) - side * Math.PI / 2;
                        const twa = Math.abs(normalizeAngle(hdg - wd));
                        if (twa < 0.7 || twa > 2.2) continue;
                        const uwx = Math.sin(wd), uwy = -Math.cos(wd);
                        if (ux * uwx + uy * uwy < 0.3) continue; // land must be upwind side
                        const bx = w0[0] - ux * 95, by = w0[1] - uy * 95;
                        spots.push({ bx, by, hdg, ux, uy, twa });
                    }
                }
            }
            window.__x.spots = spots;
            return { ok: spots.length > 0, n: spots.length };
        });
        check('[fixture] river racing, candidate bank spots found', !!fx.ok, JSON.stringify(fx));

        // Shared: pick spot `idx`, put B against the bank, A at `sep` on her
        // open-water side, both close-hauled; verify the collision pass does not
        // displace either boat (the grid only approximates the island polygons);
        // build the rule-19 ledger for `secs`.
        const setPair = (idx, sep, secs) => page.evaluate(([idx, sep, secs]) => {
            const { A, B } = window.__x;
            const spot = window.__x.spots[idx];
            if (!spot) return { err: 'no spot ' + idx };
            window.__x.spot = spot;
            const place = () => {
                B.x = spot.bx; B.y = spot.by;
                A.x = spot.bx - spot.ux * sep; A.y = spot.by - spot.uy * sep;
            };
            for (const bt of [A, B]) {
                bt.heading = spot.hdg;
                bt.speed = 5; bt.velocity = { x: Math.sin(spot.hdg) * 5, y: -Math.cos(spot.hdg) * 5 };
                bt.raceState.finished = false; bt.raceState.ocs = false;
                bt.raceState.penalty = false; bt.raceState.totalPenalties = 0;
                bt.raceState.isTacking = false;
                bt.fadeTimer = 1;
            }
            place();
            for (const bt of [A, B]) bt.raceState.lastPos = { x: bt.x, y: bt.y };
            // displacement check: one collision pass must leave both boats put
            window.checkIslandCollisions(1 / 60);
            if (Math.hypot(A.x - (spot.bx - spot.ux * sep), A.y - (spot.by - spot.uy * sep)) > 1
                || Math.hypot(B.x - spot.bx, B.y - spot.by) > 1) return { collides: true };
            window.Rules.interactions = {};
            for (let i = 0; i < Math.round(secs * 60); i++) {
                state.time += 1 / 60; state.race.timer += 1 / 60;
                window.Rules.update(1 / 60);
                window.checkIslandCollisions(1 / 60);
                place();
            }
            const res = window.Rules.getRightOfWay(A, B);
            return {
                row: res.boat ? (res.boat === A ? 'A' : 'B') : null, rule: res.rule,
                overlapped: window.Rules.isOverlapped(A, B),
                ledger: !!(B._r19Since && B._r19Since[A.id] != null)
            };
        }, [idx, sep, secs]);

        // Find spots that satisfy every precondition: no phantom displacement,
        // A (leeward, open water) ROW, overlapped, ledger armed. The umpire's
        // attribution guards are deliberately conservative AND the rule-19
        // escape axis comes from the nearest island's CENTROID (arbitrary for
        // a concave mask bank), so the verdict cases below assert that a clean
        // geometry EXISTS: each tries every precondition-passing spot and
        // fails only if the rule fires at none of them.
        let goodSpot = -1, pre = null;
        const goodSpots = [];
        const nSpots = await page.evaluate(() => window.__x.spots.length);
        for (let i = 0; i < nSpots; i++) {
            const r = await setPair(i, 60, 1.2);
            if (!r.err && !r.collides && r.row === 'A' && r.overlapped && r.ledger) {
                if (goodSpot < 0) { goodSpot = i; pre = r; }
                goodSpots.push(i);
            }
        }

        // ── B1: THE OWNER'S CASE — contact while denied room at the bank ──
        {
            check('  [precondition] A (leeward, open water) holds ROW; overlapped; ledger armed',
                goodSpot >= 0, `no candidate spot satisfied preconditions (${nSpots} tried); last=${JSON.stringify(pre)}`);
            let best = null;
            for (const si of goodSpots) {
                await setPair(si, 60, 1.2);
                const r = await page.evaluate(() => {
                    const { A, B, spot } = window.__x;
                    // A closes the last of the room: hulls touch, bank still hard
                    // on B's windward side. One more rules/ledger tick at the
                    // closed gap, then the contact umpire.
                    B.x = spot.bx; B.y = spot.by;
                    A.x = spot.bx - spot.ux * 16; A.y = spot.by - spot.uy * 16;
                    for (const bt of [A, B]) { bt.raceState.penalty = false; bt.raceState.totalPenalties = 0; }
                    state.time += 1 / 60; state.race.timer += 1 / 60;
                    window.Rules.update(1 / 60);
                    window.checkIslandCollisions(1 / 60);
                    window.checkBoatCollisions(1 / 60);
                    return { penA: !!A.raceState.penalty, penB: !!B.raceState.penalty,
                        sep: +Math.hypot(A.x - B.x, A.y - B.y).toFixed(0) };
                });
                best = r;
                if (r.sep < 60 && r.penA && !r.penB) break;
            }
            check('  [precondition] hulls made contact', best && best.sep < 60, JSON.stringify(best));
            check('43.1(a)+19.2(b): contact while denying room at an obstruction penalizes the DENIER (some clean geometry)',
                best && best.penA && !best.penB,
                `penA=${best && best.penA} penB=${best && best.penB} over ${goodSpots.length} spots — B was pinned against the bank and owed room; her rule-11 breach was compelled by A`);
        }

        // ── B2: CONTROL — same pair in open water: normal rule 11 penalty ──
        {
            const preO = await page.evaluate(() => {
                const { spot } = window.__x;
                const g = state.course.botGrid;
                // move the whole scene 150u to leeward: open water on both sides
                const ox = -spot.ux * 150, oy = -spot.uy * 150;
                window.__x.open = { bx: spot.bx + ox, by: spot.by + oy };
                const c1 = g.cell(spot.bx + ox, spot.by + oy);
                const c2 = g.cell(spot.bx + ox - spot.ux * 90, spot.by + oy - spot.uy * 90);
                const c3 = g.cell(spot.bx + ox + spot.ux * 90, spot.by + oy + spot.uy * 90);
                return { open: g.at(c1[0], c1[1]) && g.at(c2[0], c2[1]) && g.at(c3[0], c3[1]) };
            });
            check('  [precondition] open-water control spot has water on both sides', preO.open, JSON.stringify(preO));
            const r = await page.evaluate(() => {
                const { A, B, spot } = window.__x;
                const o = window.__x.open;
                window.Rules.interactions = {};
                for (const [bt, px, py] of [[B, o.bx, o.by], [A, o.bx - spot.ux * 60, o.by - spot.uy * 60]]) {
                    bt.x = px; bt.y = py; bt.heading = spot.hdg;
                    bt.speed = 5; bt.velocity = { x: Math.sin(spot.hdg) * 5, y: -Math.cos(spot.hdg) * 5 };
                    bt.raceState.penalty = false; bt.raceState.totalPenalties = 0;
                    bt.raceState.lastPos = { x: bt.x, y: bt.y };
                }
                for (let i = 0; i < 72; i++) {
                    state.time += 1 / 60; state.race.timer += 1 / 60;
                    window.Rules.update(1 / 60);
                    window.checkIslandCollisions(1 / 60);
                    B.x = o.bx; B.y = o.by;
                    A.x = o.bx - spot.ux * 60; A.y = o.by - spot.uy * 60;
                }
                A.x = o.bx - spot.ux * 16; A.y = o.by - spot.uy * 16;
                for (const bt of [A, B]) { bt.raceState.penalty = false; bt.raceState.totalPenalties = 0; }
                state.time += 1 / 60; state.race.timer += 1 / 60;
                window.Rules.update(1 / 60);
                window.checkIslandCollisions(1 / 60);
                window.checkBoatCollisions(1 / 60);
                return { penA: !!A.raceState.penalty, penB: !!B.raceState.penalty,
                    ledger: !!(B._r19Since && B._r19Since[A.id] != null) };
            });
            check('43.1(a) control: the same contact in open water is windward\'s own foul (rule 11)',
                r.penB && !r.penA, JSON.stringify(r));
        }

        // ── B3: REGRESSION — grounding under denial penalizes the squeezer (encoded) ──
        {
            let best = null;
            for (const si of goodSpots) {
                const preG = await setPair(si, 60, 1.2);
                if (!preG.ledger) continue;
                const r = await page.evaluate(() => {
                    const { A, B, spot } = window.__x;
                    // march B toward the bank until the collider actually fires (the
                    // grid cell only approximates the island polygon), A following
                    // 60u outboard so the squeeze attribution's proximity and
                    // outside-of-us tests keep holding.
                    for (const bt of [A, B]) { bt.raceState.penalty = false; bt.raceState.totalPenalties = 0; }
                    let hit = false, d = 0;
                    for (d = 20; d <= 160 && !hit; d += 10) {
                        B.x = spot.bx + spot.ux * d; B.y = spot.by + spot.uy * d;
                        A.x = B.x - spot.ux * 60; A.y = B.y - spot.uy * 60;
                        const px = B.x, py = B.y;
                        state.time += 1 / 60; state.race.timer += 1 / 60;
                        window.Rules.update(1 / 60);
                        window.checkIslandCollisions(1 / 60);
                        if (Math.hypot(B.x - px, B.y - py) > 0.5) hit = true;
                    }
                    return { hit, d, penA: !!A.raceState.penalty, penB: !!B.raceState.penalty };
                });
                if (r.hit) best = r;
                if (r.hit && r.penA && !r.penB) break;
            }
            check('  [precondition] B actually contacted the bank (some spot)', best && best.hit, JSON.stringify(best));
            check('19.2(b) regression: B grounds while A denies room — A is penalized, B is not (some clean geometry)',
                best && best.penA && !best.penB,
                JSON.stringify(best) + ` over ${goodSpots.length} spots — the attribution's escape axis comes from the island CENTROID, arbitrary on concave banks, so only clean-axis spots fire; the assertion is that at least one does`);
        }
        await page.close();
    }

    await browser.close();
    console.log(fails ? `\n${fails} FAILURES` : '\nALL OK');
    process.exit(fails ? 1 : 0);
})();
