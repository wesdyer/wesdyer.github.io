// Which ground lies under each shore vent at Emberfall (PT-095 diagnosis): per vent, the shapes its ellipse
// overlaps, their kind, and whether they are solid land or awash (sailable).   node regatta/eval/rl/_vent_ground.js
const { chromium } = require('playwright'); const path = require('path');
(async () => {
    const b = await chromium.launch(); const p = await b.newPage();
    await p.addInitScript(() => localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'volcanic' })));
    await p.goto('file://' + path.resolve(__dirname, '../../index.html')); await p.waitForTimeout(1500);
    const r = await p.evaluate(() => {
        TimeTrial.active = true; selectVenue('volcanic'); resetGame(); startRace(); while (state.race.status === 'prestart') update(1 / 30);
        const out = [];
        for (const vent of state.volcano.vents) {
            const hits = {};
            for (let a = 0; a < 40; a++) for (let rr = 1; rr <= 4; rr++) {
                const ang = a / 40 * 2 * Math.PI, u = Math.cos(ang) * rr / 4 * vent.a, w = Math.sin(ang) * rr / 4 * vent.b, cs = Math.cos(vent.ang), sn = Math.sin(vent.ang);
                const x = vent.x + u * cs - w * sn, y = vent.y + u * sn + w * cs;
                for (const isl of state.course.islands) { if (!isl.vertices || isl.vertices.length < 3) continue; if (!pointInVerts(x, y, isl.vertices)) continue;
                    const k = (isl.id || isl.shapeId || '?') + '|' + (isl.kind || isl.style || '?') + '|' + (isl.awash ? 'awash' : 'SOLID'); hits[k] = (hits[k] || 0) + 1; }
            }
            if (Object.keys(hits).length) out.push({ vent: vent.p.id, kind: vent.p.kind, hits });
        }
        return out;
    });
    console.log(JSON.stringify(r, null, 1));
    await b.close();
})();
