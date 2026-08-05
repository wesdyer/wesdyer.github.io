// THE WINDING A ROUNDING LEG REQUIRES — three ways of asking, side by side.
//
//   node regatta/eval/_sweep_rule_check.js
//
//   raw        the tangent-to-tangent arc BEFORE the degenerate guard fires
//   engine     `CoursePath.requiredSweep` — raw, with `if (sweep < 0.2) sweep = 2*pi`
//   string     the rule itself: the signed angle from (mark -> previous anchor) to
//              (mark -> next anchor), taken the required way round, in (0, 2*pi].
//              This is what the taut string asks for and what the engine's own winding
//              test (`rs.roundWrapped`) compares against.
//
// Also prints the two anchors' distances from the mark, because the tangent construction
// is distance-dependent and the string rule is not — which is the whole disagreement.
const { chromium } = require('playwright');
const path = require('path');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 200)));
    await page.goto('file://' + path.resolve('regatta/index.html'));
    await page.waitForTimeout(500);

    const out = await page.evaluate(() => {
        const res = {};
        for (const v of Object.keys(window.VENUE_DOC || {})) {
            localStorage.setItem('regatta_settings', JSON.stringify({ venue: v }));
            window.resetGame();
            const rt = state.course.route || [], mk = state.course.marks;
            const rows = [];
            for (let i = 0; i < rt.length; i++) {
                const e = rt[i];
                if (!e || e.kind !== 'round' || !e.mark) continue;
                const m = e.mark;
                const P = CoursePath.anchor(rt[i - 1], mk), Q = CoursePath.anchor(rt[i + 1], mk) || P;
                if (!P || !Q) continue;
                const sgn = m.side === 'port' ? -1 : 1;
                const R = CoursePath._roundR(m, null);
                // raw tangent-to-tangent, guard NOT applied
                const a0 = CoursePath._tangent(m, P, sgn, true).a;
                const a1 = CoursePath._tangent(m, Q, sgn, false).a;
                let raw = (a1 - a0) * sgn;
                while (raw < 0) raw += Math.PI * 2;
                while (raw > Math.PI * 2) raw -= Math.PI * 2;
                // the string rule
                const bP = Math.atan2(P.y - m.y, P.x - m.x), bQ = Math.atan2(Q.y - m.y, Q.x - m.x);
                let str = (bQ - bP) * sgn;
                while (str <= 0) str += Math.PI * 2;
                while (str > Math.PI * 2) str -= Math.PI * 2;
                rows.push({ leg: i, side: m.side, R: Math.round(R),
                            dP: Math.round(Math.hypot(P.x - m.x, P.y - m.y)),
                            dQ: Math.round(Math.hypot(Q.x - m.x, Q.y - m.y)),
                            raw, eng: CoursePath.requiredSweep(mk, rt, i), str });
            }
            if (rows.length) res[v] = rows;
        }
        return res;
    });

    const d = (x) => String(Math.round(x * 180 / Math.PI)).padStart(4);
    console.log('venue       leg side  roundR   distP   distQ    raw  engine  string   guard fired?');
    for (const [v, rows] of Object.entries(out)) {
        for (const r of rows) {
            const fired = Math.abs(r.raw) < 0.2 ? 'YES' : '';
            console.log(`${v.padEnd(11)} ${String(r.leg).padStart(3)} ${r.side.slice(0,4).padEnd(5)}${String(r.R).padStart(6)}${String(r.dP).padStart(8)}${String(r.dQ).padStart(8)}   ${d(r.raw)}    ${d(r.eng)}    ${d(r.str)}   ${fired}`);
        }
    }
    await browser.close();
})();
