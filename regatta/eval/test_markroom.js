// MARK-ROOM — WHO IS ENTITLED, AND WHY (RRS 18)
//
// Owner report: "they don't adhere to the priority as they enter the rounding circle
// — first in gets rights (still subject to tack rules)."
//
// The rule, verbatim (RRS 2025-2028):
//
//   18.2(a) When the first of two boats reaches the zone,
//     (1) if the boats are overlapped, the outside boat at that moment shall give
//         the inside boat mark-room;
//     (2) if the boats are not overlapped, the boat that has NOT REACHED THE ZONE
//         at that moment shall give the other boat mark-room.
//     When a boat is required to give mark-room by this rule, she shall continue to
//     do so for as long as this rule applies, even if later an overlap is broken or
//     a new overlap begins.
//   18.2(b) Rule 18.2(a) no longer applies if the boat entitled to mark-room passes
//         head to wind or leaves the zone.
//   18.1(a) ... However, it does not apply
//     (1) between boats on opposite tacks on a beat to windward, ...
//     (3) between a boat approaching a mark and one leaving it, ...
//
// Note what 18.2(a)(2) does NOT say: it does not say "the boat clear astern gives
// mark-room to the boat clear ahead". The test is REACHING THE ZONE. Those two
// coincide most of the time and come apart exactly when a boat is clear astern of
// another but nearer the mark — which is the ordinary approach to a mark that is off
// to one side, and is the case the owner is describing.
//
// These are unit tests on the rules engine: two boats placed by hand, Rules.update()
// stepped, Rules.getRightOfWay() read. No races, no seeds, no physics.
//
// node regatta/eval/test_markroom.js
const { chromium } = require('playwright');
const path = require('path');

let fails = 0;
const check = (name, ok, detail) => {
    console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${name}${ok || !detail ? '' : ' — ' + detail}`);
    if (!ok) fails++;
};

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
    const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.addInitScript(() => localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'bay' })));
    await page.goto('file://' + path.resolve('regatta/index.html'));
    await page.waitForFunction(() => window.state && window.state.course && window.state.course.marks);

    // Shared fixture: get the race racing, keep two boats, park the rest. Returns the
    // course's first rounding mark and the leg that rounds it, so the zone-latch code
    // (which is leg-aware) sees two boats that are actually going there.
    await page.evaluate(() => {
        window.__mr = {};
        window.resetGame(); window.startRace();
        for (let i = 0; i < 60 * 120 && state.race.status !== 'racing'; i++) window.update(1 / 60);
        const bots = state.boats.filter(b => !b.isPlayer);
        window.__mr.A = bots[0]; window.__mr.B = bots[1];
        for (const o of state.boats) if (o !== bots[0] && o !== bots[1]) {
            o.x = -1e6; o.y = -1e6; o.raceState.finished = true;
        }
        let leg = -1, mark = null;
        for (let i = 0; i < state.course.route.length; i++) {
            const e = state.course.route[i];
            if (e && e.kind === 'round' && e.mark) { leg = i; mark = e.mark; break; }
        }
        window.__mr.mark = mark; window.__mr.leg = leg;
        window.__mr.zone = mark ? mark.zone : null;
    });

    const fixture = await page.evaluate(() => ({ leg: window.__mr.leg, zone: window.__mr.zone,
        mark: window.__mr.mark ? { x: window.__mr.mark.x, y: window.__mr.mark.y, side: window.__mr.mark.side } : null }));
    if (!fixture.mark) { console.log('  (bay has no rounding mark — fixture broken)'); await browser.close(); process.exit(1); }

    // Place the two boats and let the rules engine latch. `place` is in mark-relative
    // coordinates so the cases read as geometry rather than as venue numbers.
    // Rules.update() is stepped a few times because the zone snapshot is taken on the
    // frame the first boat reaches the zone, and overlap state needs a frame to settle.
    const run = (setup, steps) => page.evaluate(([setup, steps]) => {
        const { A, B, mark } = window.__mr;
        const S = eval('(' + setup + ')');
        window.Rules.interactions = {};
        for (const [boat, p] of [[A, S.a], [B, S.b]]) {
            boat.x = mark.x + p.dx; boat.y = mark.y + p.dy;
            boat.heading = p.heading;
            boat.speed = 8; boat.velocity = { x: Math.sin(p.heading) * 8, y: -Math.cos(p.heading) * 8 };
            boat.raceState.leg = window.__mr.leg;
            boat.raceState.finished = false; boat.raceState.ocs = false;
            boat.raceState.penalty = 0; boat.raceState.isTacking = false;
            boat.raceState.lastPos = { x: boat.x, y: boat.y };
        }
        const out = [];
        for (let s = 0; s < (steps ? steps.length : 1); s++) {
            if (steps && steps[s]) {
                const mv = steps[s];
                for (const [boat, p] of [[A, mv.a], [B, mv.b]]) {
                    if (!p) continue;
                    boat.x = mark.x + p.dx; boat.y = mark.y + p.dy;
                    if (p.heading != null) boat.heading = p.heading;
                    if (p.tacking != null) boat.raceState.isTacking = p.tacking;
                }
            }
            window.Rules.update(1 / 60);
            const res = window.Rules.getRightOfWay(A, B);
            out.push({
                markRoom: res.markRoom === A.id ? 'A' : res.markRoom === B.id ? 'B' : null,
                rule: res.rule, reason: res.reason,
                row: res.boat ? (res.boat.id === A.id ? 'A' : 'B') : null,
                dA: Math.hypot(A.x - mark.x, A.y - mark.y),
                dB: Math.hypot(B.x - mark.x, B.y - mark.y),
                overlapped: window.Rules.isOverlapped(A, B),
                aAsternOfB: window.Rules.isClearAstern(A, B),
                bAsternOfA: window.Rules.isClearAstern(B, A),
                tackA: window.Rules.getTack(A), tackB: window.Rules.getTack(B),
                snapshot: (() => {
                    const k = [A.id, B.id].sort((x, y) => x - y).join('-');
                    const d = window.Rules.interactions[k];
                    return d && d.zoneSnapshot ? { reason: d.zoneSnapshot.reason,
                        entitled: d.zoneSnapshot.entitled === A.id ? 'A' : d.zoneSnapshot.entitled === B.id ? 'B' : null } : null;
                })(),
            });
        }
        return out;
    }, [setup, steps]);

    const Z = fixture.zone;
    console.log(`\nMARK-ROOM (RRS 18) — bay, rounding mark on leg ${fixture.leg}, zone ${Z.toFixed(0)}\n`);

    // ── 18.2(a)(2): NOT overlapped — the boat that has NOT REACHED THE ZONE gives
    // mark-room to the other. B is nearer the mark and inside the zone; A is outside
    // it and clear ahead of B. The rule entitles B: she is the one who has reached
    // the zone. "Clear ahead" is not the test.
    //
    // Geometry: the mark lies off A's bow to port. A sails past it at 1.9 zone radii,
    // B is astern of A but heading in, and crosses the zone first.
    {
        // A is sailing NORTH past the mark, well outside the zone and clear ahead of B.
        // B is astern of A's abeam line and is the one inside the zone. Both on the SAME
        // heading, so they are on the same tack and rule 18.1(a)(1) — which correctly
        // switches rule 18 off between boats on opposite tacks on a beat — cannot mask
        // the case. Rule 12 gives A right of way; 18.2(a)(2) is what should override it.
        const setup = `{
            a: { dx: ${-1.9 * Z}, dy: ${-1.2 * Z}, heading: 0 },
            b: { dx: ${-0.5 * Z}, dy: ${0.5 * Z}, heading: 0 }
        }`;
        const r = (await run(setup, null))[0];
        // A test that passes for the wrong reason is worse than no test, so the case's
        // preconditions are asserted, not assumed.
        check('  [precondition] not overlapped, same tack, B clear astern of A, B alone in the zone',
              !r.overlapped && r.bAsternOfA && r.dB < Z && r.dA > Z && r.tackA === r.tackB,
              `overlapped=${r.overlapped} bAsternOfA=${r.bAsternOfA} dA=${r.dA.toFixed(0)} dB=${r.dB.toFixed(0)} zone=${Z.toFixed(0)} tacks=${r.tackA}/${r.tackB} snapshot=${JSON.stringify(r.snapshot)} rule=${r.rule}`);
        check('18.2(a)(2): the boat FIRST INTO THE ZONE is entitled, not the boat clear ahead',
              r.markRoom === 'B',
              `entitled ${r.markRoom} — A is ${r.dA.toFixed(0)} from the mark (outside the ${Z.toFixed(0)} zone) and clear ahead; B is ${r.dB.toFixed(0)} (inside) and clear astern. 18.2(a)(2) asks who has REACHED THE ZONE, not who is ahead.`);
    }

    // ── 18.2(a)(1): OVERLAPPED at the moment the first reaches the zone — the OUTSIDE
    // boat gives the INSIDE boat mark-room. Both abeam, B nearer the mark.
    {
        const setup = `{
            a: { dx: ${-1.15 * Z}, dy: ${-0.24 * Z}, heading: ${Math.PI / 2} },
            b: { dx: ${-0.85 * Z}, dy: ${0.24 * Z}, heading: ${Math.PI / 2} }
        }`;
        const r = (await run(setup, null))[0];
        check('  [precondition] overlapped, B the inside boat and in the zone, A outside',
              r.overlapped && r.dB < Z && r.dA > Z,
              `overlapped=${r.overlapped} dA=${r.dA.toFixed(0)} dB=${r.dB.toFixed(0)} zone=${Z.toFixed(0)}`);
        check('18.2(a)(1): overlapped at the zone — the INSIDE boat is entitled',
              r.markRoom === 'B',
              `entitled ${r.markRoom}; overlapped=${r.overlapped}, dA ${r.dA.toFixed(0)} dB ${r.dB.toFixed(0)}`);
    }

    // ── 18.2(a) final sentence: the obligation CONTINUES "even if later an overlap is
    // broken or a new overlap begins". Latch it overlapped-and-inside, then break the
    // overlap by pulling A back. B must still be entitled.
    {
        const setup = `{
            a: { dx: ${-1.15 * Z}, dy: ${-0.24 * Z}, heading: ${Math.PI / 2} },
            b: { dx: ${-0.85 * Z}, dy: ${0.24 * Z}, heading: ${Math.PI / 2} }
        }`;
        const steps = [null, null,
            { a: { dx: -3.0 * Z, dy: -0.24 * Z }, b: { dx: -0.8 * Z, dy: 0.24 * Z } },
            { a: { dx: -3.2 * Z, dy: -0.24 * Z }, b: { dx: -0.75 * Z, dy: 0.24 * Z } }];
        const r = await run(setup, steps);
        const last = r[r.length - 1];
        check('18.2(a) last sentence: entitlement survives the overlap being broken',
              last.markRoom === 'B',
              `entitled ${last.markRoom} after the overlap broke (overlapped=${last.overlapped}, dB ${last.dB.toFixed(0)} still inside the zone)`);
    }

    // ── 18.2(b): it stops applying when the entitled boat LEAVES THE ZONE.
    {
        const setup = `{
            a: { dx: ${-1.15 * Z}, dy: ${-0.24 * Z}, heading: ${Math.PI / 2} },
            b: { dx: ${-0.85 * Z}, dy: ${0.24 * Z}, heading: ${Math.PI / 2} }
        }`;
        const steps = [null, null, { b: { dx: -2.4 * Z, dy: 0.24 * Z } }, { b: { dx: -2.6 * Z, dy: 0.24 * Z } }];
        const r = await run(setup, steps);
        const last = r[r.length - 1];
        check('18.2(b): entitlement ends when the entitled boat leaves the zone',
              last.markRoom === null,
              `still entitled ${last.markRoom} with dB ${last.dB.toFixed(0)} outside the ${Z.toFixed(0)} zone`);
    }

    // ── The zone is the MARK's zone. Marks do not all have the same one: Glacier
    // Sound's rounding mark is an island whose zone is 851, and a rules engine holding
    // a single hardcoded radius applies mark-room over a fifth of the water it should.
    {
        const zones = await page.evaluate(() => {
            const out = {};
            for (const v of ['bay', 'arctic']) {
                localStorage.setItem('regatta_settings', JSON.stringify({ venue: v }));
                window.resetGame();
                const e = state.course.route.find(r => r && r.kind === 'round' && r.mark);
                out[v] = e ? e.mark.zone : null;
            }
            localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'bay' }));
            window.resetGame();
            return out;
        });
        const engineZone = await page.evaluate(() => {
            // Probe the radius the engine actually uses on ARCTIC, by walking a boat out
            // from the rounding mark until inZone() flips. Bay would prove nothing: its
            // mark's zone happens to equal the engine's hardcoded constant.
            localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'arctic' }));
            window.resetGame();
            const m = state.course.route.find(r => r && r.kind === 'round' && r.mark).mark;
            const b = state.boats.find(x => !x.isPlayer);
            let r = 0;
            for (let d = 4; d < 6000; d += 4) { b.x = m.x + d; b.y = m.y; if (!window.Rules.inZone(b, m)) { r = d; break; } }
            return r;
        });
        check('the rules engine uses the MARK\'s own zone, not one hardcoded radius',
              Math.abs(engineZone - zones.arctic) <= 6,
              `on arctic the engine applies mark-room out to ${engineZone} units, but that mark's zone is ${zones.arctic ? zones.arctic.toFixed(0) : zones.arctic} — the island it is planted on is ${(zones.arctic / 2).toFixed(0)} across. Bay's mark zone is ${zones.bay}, which is why this only shows on arctic.`);
    }

    // ── 18.1(a)(4) + the definition of Continuing Obstruction. "Rule 18 ... does not
    // apply ... if the mark is a continuing obstruction, in which case rule 19
    // applies." Glacier Sound's rounding mark is an island 810 units across; a boat
    // rounding it passes alongside it for far more than three hull lengths. Bay's is a
    // 12-unit can, passed in half a boat length. So rule 18 governs at bay's mark and
    // rule 19 at arctic's — and the two rules are not interchangeable: 19.2(b) is room
    // BETWEEN her and the shore, 18.2 is room to round.
    {
        const r = await page.evaluate(() => {
            localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'arctic' }));
            window.resetGame(); window.startRace();
            for (let i = 0; i < 60 * 120 && state.race.status !== 'racing'; i++) window.update(1 / 60);
            const bots = state.boats.filter(b => !b.isPlayer);
            const A = bots[0], B = bots[1];
            for (const o of state.boats) if (o !== A && o !== B) { o.x = -1e6; o.y = -1e6; o.raceState.finished = true; }
            let leg = -1, mark = null;
            for (let i = 0; i < state.course.route.length; i++) {
                const e = state.course.route[i];
                if (e && e.kind === 'round' && e.mark) { leg = i; mark = e.mark; break; }
            }
            if (!mark) return { skip: true };
            const Z = mark.zone;
            window.Rules.interactions = {};
            // Overlapped, abeam, both well inside the island's zone — the geometry that
            // WOULD create an 18.2(a)(1) entitlement at an ordinary mark.
            const place = (boat, dx, dy) => {
                boat.x = mark.x + dx; boat.y = mark.y + dy; boat.heading = Math.PI / 2;
                boat.speed = 8; boat.velocity = { x: 8, y: 0 };
                boat.raceState.leg = leg; boat.raceState.finished = false;
                boat.raceState.ocs = false; boat.raceState.penalty = 0;
                boat.raceState.isTacking = false;
                boat.raceState.lastPos = { x: boat.x, y: boat.y };
            };
            place(A, -0.90 * Z, -40); place(B, -0.88 * Z, 40);
            for (let i = 0; i < 3; i++) window.Rules.update(1 / 60);
            const res = window.Rules.getRightOfWay(A, B);
            return {
                markRoom: res.markRoom === A.id ? 'A' : res.markRoom === B.id ? 'B' : null,
                overlapped: window.Rules.isOverlapped(A, B),
                dA: Math.hypot(A.x - mark.x, A.y - mark.y),
                dB: Math.hypot(B.x - mark.x, B.y - mark.y),
                zone: Z, radius: mark.radius,
                hasFn: typeof window.Rules.isContinuingObstruction === 'function',
                isCO: typeof window.Rules.isContinuingObstruction === 'function'
                    ? window.Rules.isContinuingObstruction(mark) : null,
            };
        });
        check('  [precondition] two boats overlapped inside the arctic island\'s zone',
              !r.skip && r.overlapped && r.dA < r.zone && r.dB < r.zone,
              `overlapped=${r.overlapped} dA=${r.dA && r.dA.toFixed(0)} dB=${r.dB && r.dB.toFixed(0)} zone=${r.zone && r.zone.toFixed(0)}`);
        check('the engine knows what a CONTINUING OBSTRUCTION is, and the island is one',
              r.hasFn === true && r.isCO === true,
              r.hasFn ? `Rules.isContinuingObstruction says ${r.isCO} for a mark of radius ${r.radius && r.radius.toFixed(0)}` : 'Rules.isContinuingObstruction is not implemented');
        check('18.1(a)(4): rule 18 does NOT apply at a mark that is a continuing obstruction',
              r.markRoom === null,
              `mark-room granted to ${r.markRoom} at a mark ${r.radius && r.radius.toFixed(0)} units in radius — a boat rounding it passes alongside it for far more than three hull lengths, so rule 19 governs and rule 18 does not`);
    }

    if (errs.length) check('no page errors', false, errs[0]);
    console.log(`\n${fails ? 'FAIL' : 'PASS'} — ${fails} failure(s)\n`);
    await browser.close();
    process.exit(fails ? 1 : 0);
})();
