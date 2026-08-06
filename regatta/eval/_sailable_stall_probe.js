// WHY DOES A LEG STALL ON THE IDEAL PATH?
//
//   node regatta/eval/_sailable_stall_probe.js [venue]
//
// `test_sailable` reports that a leg never registered. This says WHY, per leg, in the
// engine's own terms: what the leg required, what the ideal path actually delivered, and
// which of the three completion conditions was the one still false when the path ran out.
//
//   required   `mark.reqSweep * ROUND_SWEEP_TOL` — the winding the course asks for
//   delivered  the running net `roundSweep`, its peak, and its value at the end
//   banked     whether the latch ever set (peak >= required)
//   wrapped    the string rule: did the track ever wrap the mark  (see the winding test)
//   departing  whether the path was outside the zone and moving away while banked
//
// Every rounding leg gets a line whether it passed or failed, so a change can be read as
// a delta rather than a pass/fail flip.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const ONLY = process.argv[2] || null;

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push(e.message));
    await page.goto('file://' + path.resolve('regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync('regatta/js/sailcheck.js', 'utf8') });
    await page.waitForTimeout(600);

    const venues = await page.evaluate(() => Object.keys(window.VENUE_DOC || {}));
    const list = ONLY ? [ONLY] : venues;

    for (const venue of list) {
        const r = await page.evaluate((v) => {
            localStorage.setItem('regatta_settings', JSON.stringify({ venue: v }));
            let s = 90210;
            Math.random = () => { let t = s += 0x6D2B79F5; t = Math.imul(t ^ (t >>> 15), t | 1);
                t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
            resetGame();

            const doc = window.VENUE_DOC[v];
            const S = window.SailCheck;
            const grid = S.buildGrid(window.VenueDoc.shapes(doc).filter(sh => window.VenueDoc.traits(sh).motion === 'fixed'), state.course.boundary, null);
            const marks = state.course.marks, route = state.course.route;
            const wps = S.routeWaypoints(marks, route, grid);
            const full = [];
            for (let k = 0; k + 1 < wps.length; k++) {
                const a = wps[k], b = wps[k + 1];
                if (Math.hypot(b.x - a.x, b.y - a.y) < 60) { full.push([b.x, b.y]); continue; }
                const seg = S.pathBetween(grid, [a.x, a.y], [b.x, b.y]);
                if (!seg) return { broken: `${a.tag} -> ${b.tag}` };
                for (const p of seg) full.push(p);
            }

            startRace();
            while (state.race.status === 'prestart') update(1 / 60);
            const boat = state.boats.find(b => b.isPlayer) || state.boats[0];
            for (const b of state.boats) if (b !== boat) { b.x = 1e6; b.y = 1e6; b.speed = 0; }
            boat.x = full[0][0]; boat.y = full[0][1];
            boat.raceState.lastPos = { x: boat.x, y: boat.y };

            // Per-leg accumulator, keyed by the leg index the boat is ON.
            const legs = {};
            const touch = (lg) => legs[lg] = legs[lg] || {
                leg: lg, peak: -99, trough: 99, last: 0, banked: false, wrapped: null,
                minD: 1e9, steps: 0, outSteps: 0, entered: false, req: null, side: null,
                startK: null, endK: null };
            const events = [];
            window.onRaceEvent = (t, d) => events.push({ t, leg: d.leg });

            for (let k = 1; k < full.length; k++) {
                const [tx, ty] = full[k];
                const sx = boat.x, sy = boat.y;
                const d = Math.hypot(tx - sx, ty - sy);
                const sub = Math.max(1, Math.ceil(d / 18));
                for (let q = 1; q <= sub; q++) {
                    boat.raceState.lastPos = { x: boat.x, y: boat.y };
                    boat.x = sx + (tx - sx) * (q / sub);
                    boat.y = sy + (ty - sy) * (q / sub);
                    boat.heading = Math.atan2(boat.x - boat.raceState.lastPos.x,
                                             -(boat.y - boat.raceState.lastPos.y));
                    updateBoatRaceState(boat, 1 / 60);
                    const rs = boat.raceState, lg = rs.leg;
                    const e = route[lg];
                    if (!e || e.kind !== 'round' || !e.mark) continue;
                    const L = touch(lg);
                    L.side = e.mark.side;
                    L.req = e.mark.reqSweep;
                    const sw = rs.roundSweep || 0;
                    if (sw > L.peak) L.peak = sw;
                    if (sw < L.trough) L.trough = sw;
                    L.last = sw;
                    if (rs.roundBanked) { L.banked = true; if (L.bankK == null) L.bankK = k; }
                    if (sw >= (L.req || 1e9) && L.reqK == null) L.reqK = k;
                    if (rs.roundWrapped !== undefined) L.wrapped = L.wrapped === false ? false : rs.roundWrapped;
                    const dm = Math.hypot(boat.x - e.mark.x, boat.y - e.mark.y);
                    if (dm > e.mark.zone && L.outK == null && L.entered) L.outK = k;
                    if (dm < L.minD) L.minD = dm;
                    if (dm < e.mark.zone) L.entered = true;
                    else L.outSteps++;
                    L.steps++;
                    if (L.startK === null) L.startK = k;
                    L.endK = k;
                }
                if (boat.raceState.finished) break;
            }
            return {
                venue: v, pathPts: full.length, wps: wps.length,
                legReached: boat.raceState.leg, totalLegs: state.race.totalLegs,
                finished: boat.raceState.finished,
                completes: events.filter(e => e.t === 'leg_complete').map(e => e.leg),
                tol: (typeof ROUND_SWEEP_TOL !== 'undefined') ? ROUND_SWEEP_TOL : null,
                legs: Object.values(legs).map(L => ({ ...L, zone: Math.round(route[L.leg].mark.zone),
                    mx: Math.round(route[L.leg].mark.x), my: Math.round(route[L.leg].mark.y) })),
                wpTags: wps.map(w => w.tag).filter((t, i, a) => t !== a[i - 1])
            };
        }, venue);

        if (r.broken) { console.log(`${venue}: no path — ${r.broken}\n`); continue; }
        const deg = (x) => x == null ? '  n/a' : String(Math.round(x * 180 / Math.PI)).padStart(5);
        console.log(`${venue}  reached leg ${r.legReached}/${r.totalLegs + 1}  finished=${r.finished}  completes=${JSON.stringify(r.completes)}`);
        console.log('   leg side  zone   required   peak   final  trough  banked wrapped  entered  minDist   mark          path pts');
        for (const L of r.legs) {
            console.log(`   ${String(L.leg).padStart(3)} ${String(L.side).slice(0,4).padEnd(5)}${String(L.zone).padStart(5)}     ${deg(L.req)}  ${deg(L.peak)}  ${deg(L.last)}  ${deg(L.trough)}    ${L.banked ? 'yes' : 'NO '}    ${L.wrapped === null ? ' - ' : L.wrapped ? 'yes' : 'NO '}     ${L.entered ? 'yes' : 'NO '}   ${String(Math.round(L.minD)).padStart(6)}   ${String(L.mx).padStart(6)},${String(L.my).padStart(6)}  ${L.startK}..${L.endK} of ${r.pathPts}  reqAt=${L.reqK} bankAt=${L.bankK} leftZoneAt=${L.outK}`);
        }
        console.log('   waypoints: ' + r.wpTags.join(' '));
        console.log('');
    }
    await browser.close();
    if (errs.length) console.log('page errors:', errs.slice(0, 3).join(' | '));
})();
