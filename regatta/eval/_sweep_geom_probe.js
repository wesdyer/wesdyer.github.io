// WHAT DOES `CoursePath.requiredSweep` ASK FOR, ON GEOMETRY WE CHOSE?
//
//   node regatta/eval/_sweep_geom_probe.js
//
// `requiredSweep` ends with `if (sweep < 0.2) sweep = Math.PI * 2` — a degenerate-geometry
// guard. This asks which geometries actually land in it. The two candidates are an
// OUT-AND-BACK (previous and next anchors in the same place) and a COLLINEAR PASS-BY
// (previous and next anchors on opposite sides). Only one of them requires a full circle,
// and the guard is copied from `_arc`, which is fed RADIAL bearings while this is fed
// TANGENT bearings — so the degenerate case is not the same one.
//
// Also prints every authored venue's per-leg requirement, so the real courses are on the
// same page as the hand cases.
const { chromium } = require('playwright');
const path = require('path');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 200)));
    await page.goto('file://' + path.resolve('regatta/index.html'));
    await page.waitForTimeout(500);

    const r = await page.evaluate(() => {
        const deg = (x) => x == null ? null : +(x * 180 / Math.PI).toFixed(1);
        const out = { hand: [], venues: {} };
        // ── Hand geometry ───────────────────────────────────────────────────
        // Mark at the origin. `from`/`to` are the previous and next route anchors, which
        // is exactly what requiredSweep reads.
        const mk = (side) => ({ x: 0, y: 0, radius: 12, zone: 165, side });
        const cases = [
            ['out-and-back  (to == from)',        { x: -3000, y: 0 },   { x: -3000, y: 0 }],
            ['out-and-back  (to near from)',      { x: -3000, y: 0 },   { x: -2900, y: 300 }],
            ['collinear pass-by (opposite)',      { x: -3000, y: 0 },   { x: 3000, y: 0 }],
            ['near-collinear   (1 deg off)',      { x: -3000, y: 0 },   { x: 3000, y: 52 }],
            ['right-angle corner',                { x: -3000, y: 0 },   { x: 0, y: -3000 }],
            ['obtuse corner  (135 deg)',          { x: -3000, y: 0 },   { x: 2100, y: -2100 }],
            ['acute corner   (45 deg)',           { x: -3000, y: 0 },   { x: -2100, y: -2100 }],
        ];
        for (const [name, from, to] of cases) {
            const row = { name };
            for (const side of ['starboard', 'port']) {
                const m = mk(side);
                const route = [{ kind: 'gate', marks: [0, 1] },
                               { kind: 'round', mark: m },
                               { kind: 'gate', marks: [2, 3] }];
                const marks = [{ x: from.x, y: from.y }, { x: from.x, y: from.y },
                               { x: to.x, y: to.y }, { x: to.x, y: to.y }];
                row[side] = deg(CoursePath.requiredSweep(marks, route, 1));
            }
            out.hand.push(row);
        }
        // ── Every authored venue ────────────────────────────────────────────
        for (const v of Object.keys(window.VENUE_DOC || {})) {
            try {
                localStorage.setItem('regatta_settings', JSON.stringify({ venue: v }));
                window.resetGame();
                const rt = state.course.route || [];
                const legs = [];
                for (let i = 0; i < rt.length; i++) {
                    if (rt[i] && rt[i].kind === 'round' && rt[i].mark) {
                        const from = CoursePath.anchor(rt[i - 1], state.course.marks);
                        const to = CoursePath.anchor(rt[i + 1], state.course.marks);
                        // The angle the previous and next anchors subtend AT the mark:
                        // 0 = same place (out-and-back), 180 = opposite (pass-by).
                        let sub = null;
                        if (from && to) {
                            const m = rt[i].mark;
                            let d = Math.atan2(from.y - m.y, from.x - m.x) - Math.atan2(to.y - m.y, to.x - m.x);
                            while (d > Math.PI) d -= Math.PI * 2;
                            while (d < -Math.PI) d += Math.PI * 2;
                            sub = deg(Math.abs(d));
                        }
                        legs.push({ leg: i, side: rt[i].mark.side, subtend: sub,
                                    req: deg(CoursePath.requiredSweep(state.course.marks, rt, i)),
                                    zone: Math.round(rt[i].mark.zone), radius: Math.round(rt[i].mark.radius || 0) });
                    }
                }
                out.venues[v] = legs;
            } catch (e) { out.venues[v] = 'ERR ' + e.message; }
        }
        return out;
    });

    console.log('HAND GEOMETRY — requiredSweep, degrees\n');
    console.log('  ' + 'case'.padEnd(32) + 'starboard   port');
    for (const h of r.hand) console.log('  ' + h.name.padEnd(32) + String(h.starboard).padStart(6) + String(h.port).padStart(9));
    console.log('\nAUTHORED VENUES — per rounding leg (subtend: 0 = out-and-back, 180 = pass-by)\n');
    for (const [v, legs] of Object.entries(r.venues)) {
        if (typeof legs === 'string') { console.log(`  ${v.padEnd(11)} ${legs}`); continue; }
        if (!legs.length) { console.log(`  ${v.padEnd(11)} (no rounding legs)`); continue; }
        console.log(`  ${v.padEnd(11)} ` + legs.map(l => `leg${l.leg} ${l.side.slice(0,4)} subtend ${String(l.subtend).padStart(5)} req ${String(l.req).padStart(5)} (zone ${l.zone})`).join('\n              '));
    }
    await browser.close();
})();
