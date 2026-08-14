// WHAT KIND OF LEG IS EACH LEG — asked of the game, once per venue, no racing.
//
// The campaign's per-leg splits are only interpretable against a point of sail: a
// character who is fast on legs 2 and 4 has told you nothing until you know those are
// the beats. Pricing `upwind` / `reach` / `downwind` and auditing a `beat` line both
// depend on it.
//
// DO NOT RECONSTRUCT THIS FROM state.course.marks. That array is not the course order —
// at seatrials it is [startPin, startBoat, windwardPin, windwardBoat], so walking it
// pairwise calls the START LINE a reaching leg and reports "reach beat reach" for a
// windward-leeward course. The game keeps a route, and script.js:22762 warns that even
// the authored `beat` flag has disagreed with the geometry before (Glacier Sound had a
// rounding leg marked beat: true while the wind made it a run). So ask the route.
//
// Written as a separate one-off rather than folded into the harness because the answer
// is a venue constant and the campaign was already racing when the bug turned up —
// re-racing a day of work to record a per-venue lookup would be poor economics.

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const VENUES = process.argv.slice(2).length ? process.argv.slice(2)
    : ['seatrials', 'ocean', 'lake', 'lagoon', 'redrock', 'river', 'arctic', 'bay', 'swamp', 'glowtide'];
const OUT = 'regatta/eval/rating/legtypes.json';

(async () => {
    const browser = await chromium.launch();
    // MERGE, don't replace. Run once for four venues and once for six and a fresh
    // object silently drops the first four — which is exactly what happened, and the
    // only symptom was an empty `legs:` line in the report header.
    let out = {};
    try { out = JSON.parse(fs.readFileSync(OUT, 'utf8')); } catch (e) {}
    for (const v of VENUES) {
        const page = await browser.newPage();
        await page.addInitScript(vv => localStorage.setItem('regatta_settings',
            JSON.stringify({ venue: vv })), v);
        await page.goto('file://' + path.resolve('regatta/index.html'));
        await page.waitForFunction(() => window.state && window.Course && typeof window.resetGame === 'function');
        await page.waitForTimeout(600);

        const info = await page.evaluate(() => {
            resetGame(); startRace();
            const n = state.race.totalLegs;
            const norm = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
            const legs = [];
            for (let l = 1; l <= n; l++) {
                const to = window.Course.routeLeg(l) ? null : null;
                // Bearing from where this leg starts to where it is sailed to, using the
                // game's own target points, then the true wind angle of that bearing.
                // Heading convention: velocity is (sin h, -cos h), so h = atan2(dx, -dy).
                let twa = null, deg = null;
                const A = window.__legPt ? window.__legPt(l - 1) : null;
                legs.push({ leg: l, upwind: window.Course.legGoesUpwind(l),
                            role: (window.Course.routeLeg(l) || {}).role || null,
                            kind: (window.Course.routeLeg(l) || {}).kind || null });
            }
            return { totalLegs: n, windDir: state.wind.direction, legs,
                     marks: (state.course.marks || []).map(m => [Math.round(m.x), Math.round(m.y)]) };
        });

        // The angle needs legTargetPoint, which is module-private. Re-derive it through
        // the public route: a 'round' leg targets its mark, anything else the gate mid.
        const geo = await page.evaluate(() => {
            const norm = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
            const pt = (l) => {
                const r = window.Course.routeLeg(l);
                if (!r) return null;
                if (r.kind === 'round' && r.mark) return { x: r.mark.x, y: r.mark.y };
                const idx = window.Course.legMarks(l);
                if (!idx || !state.course.marks) return null;
                const a = state.course.marks[idx[0]], b = state.course.marks[idx[1]];
                if (!a || !b) return null;
                return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
            };
            const res = [];
            for (let l = 1; l <= state.race.totalLegs; l++) {
                const A = pt(l - 1), B = pt(l);
                if (!A || !B) { res.push(null); continue; }
                const h = Math.atan2(B.x - A.x, -(B.y - A.y));
                const twa = Math.abs(norm(h - state.wind.direction));
                res.push(Math.round(twa * 180 / Math.PI));
            }
            return res;
        });

        // The game's own thresholds, from the sailing model (script.js:2320) rather than
        // a convention invented here: upwind below PI/3.5 = 51 deg, downwind above
        // PI*0.7 = 126 deg.
        const kindOf = (deg) => deg == null ? '?' : deg < 51.4 ? 'beat' : deg > 126 ? 'run' : 'reach';
        info.legs.forEach((L, i) => { L.twaDeg = geo[i]; L.pointOfSail = kindOf(geo[i]); });
        out[v] = info;

        const summary = info.legs.map(L => `${L.pointOfSail}${L.upwind ? '^' : ''}`).join(' ');
        console.log(`${v.padEnd(10)} ${info.totalLegs} legs, wind ${(info.windDir * 180 / Math.PI).toFixed(0)}deg:  ${summary}`);
        console.log(`${' '.repeat(11)}twa: ${info.legs.map(L => String(L.twaDeg).padStart(4)).join('')}`);
        await page.close();
    }
    await browser.close();
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
    console.log(`\nwrote ${OUT}   ('^' marks legs the game itself calls upwind)`);
})();
