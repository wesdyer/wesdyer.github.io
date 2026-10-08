// HAIRPINS AND MARKS ROUNDED TWICE — the rounding line (PT-081/PT-062) credited both early (Oct 8 2026).
//
//   node regatta/eval/test_rounding_hairpin.js
//
// A hairpin comes in from where it goes back to (Bay's beat between two marks), so its in and out bearings
// from the mark nearly coincide: the turn is the whole way round plus the sliver, and the wrap into
// (0, 2π] left only the sliver — half of all hairpins were credited the moment the boat ARRIVED. And a
// course that rounds one mark twice (Bay's legs 2 and 4) handed the second rounding the first one's line,
// so the fleet was credited kilometres from the mark and finished 40-80 s early.
//
//   geometry   every turn (straight, 90° either way, 135°, three hairpins), both sides: a boat circling the
//              mark the required way is credited partway ROUND it, never on the approach; the wrong way, never
//   race       a full ten-boat Bay race: no rounding credited more than 500 u from its mark
const { chromium } = require('playwright'); const path = require('path');
let fails = 0;
const check = (n, ok, d) => { console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${n}${d ? ' — ' + d : ''}`); if (!ok) fails++; };
(async () => {
    const b = await chromium.launch(); const p = await b.newPage();
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.addInitScript(() => localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'bay' })));
    await p.goto('file://' + path.resolve('regatta/index.html'));
    await p.waitForFunction(() => window.state && state.boats.length > 0);

    const geo = await p.evaluate(() => {
        // y-down world: circling with the bearing angle DECREASING keeps the mark to port
        const run = (side, from, to, R, wrongWay) => {
            const rm = { x: 0, y: 0, zone: 165, radius: 12, side };
            const dir = (side === 'port' ? -1 : 1) * (wrongWay ? -1 : 1);
            const aIn = Math.atan2(from.y, from.x), aOut = Math.atan2(to.y, to.x);
            let sweep = (aOut - aIn) * dir; while (sweep <= 0) sweep += 2 * Math.PI; while (sweep > 2 * Math.PI) sweep -= 2 * Math.PI;
            if (sweep < 0.35) sweep += 2 * Math.PI;
            const pts = [], P0 = { x: R * Math.cos(aIn), y: R * Math.sin(aIn) };
            for (let i = 0; i <= 60; i++) pts.push({ x: from.x + (P0.x - from.x) * i / 60, y: from.y + (P0.y - from.y) * i / 60 });
            for (let i = 1; i <= 120; i++) { const a = aIn + dir * sweep * i / 120; pts.push({ x: R * Math.cos(a), y: R * Math.sin(a) }); }
            const last = pts[pts.length - 1];
            for (let i = 1; i <= 80; i++) pts.push({ x: last.x + (to.x - last.x) * i / 80, y: last.y + (to.y - last.y) * i / 80 });
            const boat = { x: pts[0].x, y: pts[0].y };
            const tr = { roundSweep: 0, roundArmed: false, roundBanked: false, roundRebased: false, roundEntryB: null,
                         roundFrom: { x: from.x, y: from.y }, roundWrong: 0, _wrongRound: false, lastPos: { x: pts[0].x, y: pts[0].y } };
            rm.reqSweep = CoursePath.requiredSweepPts ? CoursePath.requiredSweepPts(rm, from, to) : null;
            for (let i = 1; i < pts.length; i++) {
                boat.x = pts[i].x; boat.y = pts[i].y; const res = roundingStep(boat, tr, rm, to); tr.lastPos = { x: boat.x, y: boat.y };
                if (res.done) return i <= 60 ? 'approach' : i <= 180 ? 'round' : 'exit';
            }
            return 'never';
        };
        const cases = [[{ x: 0, y: 2000 }, { x: 0, y: -2000 }, 'straight'], [{ x: 0, y: 2000 }, { x: 2000, y: 0 }, '90 right'],
                       [{ x: 0, y: 2000 }, { x: -2000, y: 0 }, '90 left'], [{ x: 0, y: 2000 }, { x: 2000, y: 1900 }, '135'],
                       [{ x: 0, y: 2000 }, { x: 150, y: 2000 }, 'hairpin a'], [{ x: 0, y: 2000 }, { x: -150, y: 2000 }, 'hairpin b'],
                       [{ x: 0, y: 2000 }, { x: 0, y: 2500 }, 'hairpin c']];
        const right = [], wrong = [];
        for (const side of ['port', 'starboard']) for (const [f, t, n] of cases) {
            const a = run(side, f, t, 150, false), w = run(side, f, t, 150, true);
            if (a !== 'round') right.push(`${side} ${n}: ${a}`);
            if (w !== 'never') wrong.push(`${side} ${n}: ${w}`);
        }
        return { right, wrong, n: cases.length * 2 };
    });
    check(`the required way round, every turn and side, is credited partway ROUND (${geo.n} cases)`, !geo.right.length, geo.right.join('; '));
    check('the wrong way round is never credited', !geo.wrong.length, geo.wrong.join('; '));

    const race = await p.evaluate(() => {
        let s = 9400; Math.random = () => { let t = s += 0x6D2B79F5; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
        resetGame(); startRace(); for (const bt of state.boats) bt.isPlayer = false;
        const prevLeg = state.boats.map(bt => bt.raceState.leg), far = [];
        for (let i = 0; i < 60 * 420 && state.race.status !== 'finished'; i++) {
            update(1 / 60);
            state.boats.forEach((bt, k) => { const L = bt.raceState.leg;
                if (L !== prevLeg[k]) { const e = state.course.route[prevLeg[k]]; if (e && e.kind === 'round' && e.mark) far.push(Math.hypot(bt.x - e.mark.x, bt.y - e.mark.y)); prevLeg[k] = L; } });
        }
        far.sort((a, b) => a - b);
        return { n: far.length, max: Math.round(far[far.length - 1] || 0), over: far.filter(d => d > 500).length };
    });
    check(`Bay, ten boats: no rounding credited more than 500 u from its mark (${race.n} roundings, farthest ${race.max} u)`, race.n >= 40 && race.over === 0, `${race.over} over 500 u`);
    check('no page errors', !errs.length, errs.slice(0, 2).join(' | '));
    console.log(`\n${fails ? 'FAIL' : 'PASS'} — ${fails} failure(s)`);
    await b.close(); process.exit(fails ? 1 : 0);
})();
