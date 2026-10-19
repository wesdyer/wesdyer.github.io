// THE STRING RULE — does a rounding that did not go round get counted?
//
// RRS, Sail the Course: "a string representing her track until she finishes, when
// drawn taut, (1) passes each mark of the course for the race on the required
// side and in the correct order ... (2) TOUCHES each mark designated in the
// sailing instructions to be a ROUNDING MARK". There is no proximity requirement:
// going all the way round at a distance is a legal rounding, merely slow.
//
// How the engine decides it (PT-081, Oct 4 2026 — roundingStep in sim/physics.js):
// the MOMENT is the ROUNDING LINE, a ray off the mark along the bisector of the
// course's turn there; the SIDE is the string over the whole leg. Credit = she
// crosses the line the required way with the string wrapped. So:
//   * a full rounding counts at the ring AND well outside the zone, at the same point;
//   * a boat that turns back before the line, or goes round the wrong way, never counts.
//
// ⚠️ REWRITTEN Oct 17 2026. The August version scripted a boat round circles with
// window.update(), which ran it into land (Glacier Sound's 2.5-zone circle crosses the
// isle; at Bluewater, Cove and the lake even its ring rounding was shoved off course),
// measured "full" as the pre-PT-081 `reqSweep`, and left radially AWAY from the next mark
// — on Glacier Sound's hairpin that never reaches the rounding line, so the wide case
// failed for the script's reasons, not the rule's. This version drives roundingStep — the
// one judge the race and the School share — along land-free synthetic tracks at every
// rounding mark of every venue: in from the previous mark, round the mark at a radius,
// then on to the next mark (or back the way she came).
//
// node regatta/eval/test_rounding_string.js
const { chromium } = require('playwright');
const path = require('path');

const VENUES = ['arctic', 'bay', 'flats', 'glowtide', 'lagoon', 'lake', 'ocean', 'otter', 'pond', 'redrock', 'river', 'seatrials', 'swamp', 'volcanic'];
let fails = 0;
const check = (name, ok, detail) => {
    console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${name}${ok || !detail ? '' : ' — ' + detail}`);
    if (!ok) fails++;
};

(async () => {
    const browser = await chromium.launch();
    console.log('\nTHE STRING RULE — what counts as a rounding (every rounding mark, land-free tracks)\n');
    let marksSeen = 0;
    const errs = [];
    for (const v of VENUES) {
        const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
        page.on('pageerror', e => errs.push(v + ': ' + e.message));
        await page.addInitScript(v => localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })), v);
        await page.goto('file://' + path.resolve('regatta/index.html'));
        await page.waitForFunction(() => window.state && window.state.course && window.state.course.marks);
        const res = await page.evaluate(() => {
            window.requestAnimationFrame = () => 0;   // only this script moves anything
            window.resetGame(); window.startRace();
            const route = state.course.route, marks = state.course.marks, out = [];
            for (let L = 1; L < route.length - 1; L++) {
                const e = route[L];
                if (!e || e.kind !== 'round' || !e.mark) continue;
                const rm = e.mark, sgn = rm.side === 'port' ? -1 : 1;
                const prevA = CoursePath.anchor(route[L - 1], marks), nextA = CoursePath.anchor(route[L + 1], marks);
                if (!prevA || !nextA) continue;
                const aS = Math.atan2(prevA.y - rm.y, prevA.x - rm.x), aN = Math.atan2(nextA.y - rm.y, nextA.x - rm.x);
                // the turn the required way from the inbound bearing to the outbound one (a hairpin the whole way round)
                let arc = (aN - aS) * sgn;
                while (arc <= 0) arc += 2 * Math.PI;
                while (arc > 2 * Math.PI) arc -= 2 * Math.PI;
                if (arc < 0.35) arc += 2 * Math.PI;
                // in along the inbound bearing to radius R; round the mark through `sweep` (signed: the
                // required way is +); `retrace`: then back round the same arc to where she came in; then on
                // to `tgt`. Returns the step credit landed on (arc steps 0..400, then on), or -1 if never.
                // (Turning back means RETRACING: on a hairpin the straight line back to the previous mark
                // runs on round the mark toward the next one, which is a rounding.)
                const run = (R, sweep, tgt, retrace) => {
                    const pts = [], D0 = Math.hypot(prevA.x - rm.x, prevA.y - rm.y);
                    for (let k = 0; k <= 60; k++) { const d = D0 + (R - D0) * k / 60; pts.push([rm.x + Math.cos(aS) * d, rm.y + Math.sin(aS) * d]); }
                    for (let k = 1; k <= 400; k++) { const a = aS + sgn * sweep * k / 400; pts.push([rm.x + Math.cos(a) * R, rm.y + Math.sin(a) * R]); }
                    if (retrace) for (let k = 399; k >= 0; k--) { const a = aS + sgn * sweep * k / 400; pts.push([rm.x + Math.cos(a) * R, rm.y + Math.sin(a) * R]); }
                    const [ex, ey] = pts[pts.length - 1];
                    for (let k = 1; k <= 300; k++) pts.push([ex + (tgt.x - ex) * k / 300, ey + (tgt.y - ey) * k / 300]);
                    const rs = { leg: L, lastPos: { x: pts[0][0], y: pts[0][1] }, roundSweep: 0, roundWrong: 0 };
                    for (let i = 1; i < pts.length; i++) {
                        const [x, y] = pts[i];
                        if (roundingStep({ x, y, heading: 0 }, rs, rm, nextA).done) return i - 61;
                        rs.lastPos = { x, y };
                    }
                    return -1;
                };
                const z = rm.zone;
                const ring = run(z * 0.8, arc, nextA), wide = run(z * 2.5, arc, nextA);
                // turn back before the line: stop at 80% of the way to where the full rounding was credited
                const stop = ring >= 0 && ring <= 400 ? arc * (ring / 400) * 0.8 : arc * 0.4;
                out.push({
                    id: `${L}:${rm.side}`, ring, wide,
                    backRing: run(z * 0.8, stop, prevA, true), backWide: run(z * 2.5, stop, prevA, true),
                    wrongWay: run(z * 0.8, -(2 * Math.PI - arc), nextA),
                });
            }
            return out;
        });
        await page.close();
        for (const m of res) {
            marksSeen++;
            const tag = `${v} leg ${m.id}`;
            check(`${tag}: a full rounding at the ring completes`, m.ring >= 0, `never credited`);
            check(`${tag}: ...and well outside the zone (2.5x), at the same point`, m.wide >= 0 && Math.abs(m.wide - m.ring) <= 12,
                  m.wide < 0 ? 'never credited' : `credited at step ${m.wide} vs ${m.ring} at the ring`);
            check(`${tag}: turning back before the rounding line never completes`, m.backRing < 0 && m.backWide < 0,
                  `credited at ring ${m.backRing}, wide ${m.backWide}`);
            check(`${tag}: going round the wrong way never completes`, m.wrongWay < 0, `credited at step ${m.wrongWay}`);
        }
    }
    check('every venue with a rounding mark was tested', marksSeen >= 15, `${marksSeen} rounding marks`);
    if (errs.length) check('no page errors', false, errs[0]);
    console.log(`\n${fails ? 'FAIL' : 'PASS'} — ${fails} failure(s), ${marksSeen} rounding marks\n`);
    await browser.close();
    process.exit(fails ? 1 : 0);
})();
