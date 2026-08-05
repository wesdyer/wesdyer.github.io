// WHY DOES THE IDEAL PATH NOT FINISH THE COURSE?
//
// `test_sailable.js` walks a boat along the drawn ideal route — the DMC path the whole
// AI follows — and checks that every leg registers. On bay it reaches leg 4 of 7 and
// never finishes; on redrock, leg 1 of 6. Those failures predate the 2026-08-05
// rounding work (byte-identical on the pre-session HEAD) and nobody has looked at them.
//
// The test says WHICH leg stalls. This says WHY. For every leg it walks, it records:
//
//   sweptMax    the most net sweep the leg ever banked, against reqSweep
//   banked      whether roundBanked ever latched
//   dMax        the furthest the path ever gets from the mark, in zone radii — the
//               completion test needs her OUTSIDE the zone and moving away, so a path
//               that never leaves the circle can never complete the leg however
//               perfectly it rounds
//   ptsLeft     path points remaining when the walk ended — distinguishes "the path ran
//               out" from "the leg machinery refused"
//
// node _sailable_stall_probe.js <tree> [venue]
const { chromium } = require('playwright');
const path = require('path');
const ROOT = path.join(__dirname, process.argv[2] || 'treeBase');
const VENUE = process.argv[3] || 'bay';

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 250)));
    await page.addInitScript((v) => localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })), VENUE);
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    // sailcheck.js is an authoring tool, so index.html does not load it — inject it,
    // exactly as test_sailable does.
    await page.addScriptTag({ content: require('fs').readFileSync(path.resolve(ROOT, 'regatta/js/sailcheck.js'), 'utf8') });
    await page.waitForTimeout(600);

    const r = await page.evaluate(() => {
        // Same seeded RNG the test pins, so this walks the same course it does.
        let sd = 90210;
        Math.random = () => { let t = sd += 0x6D2B79F5; t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
        window.resetGame();
        const S = window.SailCheck;
        const doc = window.VENUE_DOC[settings.venue];
        const fixed = window.VenueDoc.shapes(doc).filter(sh => window.VenueDoc.traits(sh).motion === 'fixed');
        const grid = S.buildGrid(fixed, state.course.boundary, null);
        const route = state.course.route, marks = state.course.marks;

        // THE TEST'S OWN waypoint chain — SailCheck.routeWaypoints, not a rebuild of it.
        // The first version of this probe rolled its own and never crossed the start
        // line, which measured the probe rather than the course.
        const wps = S.routeWaypoints(marks, route, grid);
        const full = [];
        for (let k = 0; k + 1 < wps.length; k++) {
            const a = wps[k], b = wps[k + 1];
            if (Math.hypot(b.x - a.x, b.y - a.y) < 60) { full.push([b.x, b.y]); continue; }
            const seg = S.pathBetween(grid, [a.x, a.y], [b.x, b.y]);
            if (!seg) return { broken: `${a.tag} -> ${b.tag}` };
            for (const p of seg) full.push(p);
        }

        window.startRace();
        while (state.race.status === 'prestart') window.update(1 / 60);
        const boat = state.boats.find(b => b.isPlayer) || state.boats[0];
        for (const b of state.boats) if (b !== boat) { b.x = 1e6; b.y = 1e6; b.speed = 0; }
        boat.x = full[0][0]; boat.y = full[0][1];
        boat.raceState.lastPos = { x: boat.x, y: boat.y };

        const per = {};
        const note = () => {
            const rs = boat.raceState;
            const e = route[rs.leg];
            if (!e || e.kind !== 'round' || !e.mark) return;
            const p = per[rs.leg] = per[rs.leg] || {
                leg: rs.leg, req: +(e.mark.reqSweep || 0).toFixed(3), zone: e.mark.zone,
                sweptMax: -99, banked: false, dMaxZ: 0, dMinZ: 99,
            };
            const sw = rs.roundSweep || 0;
            if (sw > p.sweptMax) p.sweptMax = sw;
            if (rs.roundBanked) p.banked = true;
            const d = Math.hypot(boat.x - e.mark.x, boat.y - e.mark.y) / e.mark.zone;
            if (d > p.dMaxZ) p.dMaxZ = d;
            if (d < p.dMinZ) p.dMinZ = d;
        };

        let endedAt = 0;
        for (let k = 1; k < full.length; k++) {
            const [tx, ty] = full[k];
            const sx = boat.x, sy = boat.y;
            const sub = Math.max(1, Math.ceil(Math.hypot(tx - sx, ty - sy) / 18));
            for (let q = 1; q <= sub; q++) {
                boat.raceState.lastPos = { x: boat.x, y: boat.y };
                boat.x = sx + (tx - sx) * (q / sub);
                boat.y = sy + (ty - sy) * (q / sub);
                boat.heading = Math.atan2(boat.x - boat.raceState.lastPos.x, -(boat.y - boat.raceState.lastPos.y));
                window.updateBoatRaceState(boat, 1 / 60);
                note();
            }
            endedAt = k;
            if (boat.raceState.finished) break;
        }
        return {
            legs: Object.values(per), reached: boat.raceState.leg, total: state.race.totalLegs,
            finished: boat.raceState.finished, pathPts: full.length, endedAt,
            routeKinds: route.map(e => e.kind),
        };
    });

    console.log(`\nIDEAL-PATH STALL — ${VENUE}, tree ${path.basename(ROOT)}`);
    if (r.broken) { console.log(`  no hull-width path for ${r.broken}`); await browser.close(); return; }
    console.log(`  route ${r.routeKinds.join(' -> ')}`);
    console.log(`  reached leg ${r.reached} of ${r.total + 1}, finished=${r.finished}`);
    console.log(`  path points ${r.pathPts}, walk ended at ${r.endedAt}  ${r.endedAt >= r.pathPts - 1 ? '(RAN OUT OF PATH)' : '(stopped early)'}`);
    console.log('  per rounding leg:');
    console.log('    leg  reqSweep  sweptMax  banked  dist from mark (zone radii) min..max');
    for (const p of r.legs) {
        console.log(`    ${String(p.leg).padEnd(4)} ${String(p.req).padEnd(9)} ${p.sweptMax.toFixed(3).padEnd(9)} ${String(p.banked).padEnd(7)} ${p.dMinZ.toFixed(2)} .. ${p.dMaxZ.toFixed(2)}` +
                    (p.dMaxZ <= 1.0 ? '   <-- NEVER LEAVES THE ZONE: cannot complete' : ''));
    }
    await browser.close();
})();
