// LAB TRAJECTORY READOUT: run one scenario, then walk the RECORDING (the
// same frames the asserts judge) — per-second per-boat pose, dev, role,
// mark distance, pair distance, and the umpire's row/rule/markRoom. The
// honest "what actually happened" view for scenario debugging.
//   node _lab_traj.js "<scenario>" [seedIndex]
const { chromium } = require('playwright');
const { newLabPage } = require('../_drive');
const name = process.argv[2] || 'Zone Entry';
const seedIx = parseInt(process.argv[3] || '0');
(async () => {
    const browser = await chromium.launch();
    const page = await newLabPage(browser);
    const ok = await page.evaluate((n) => { try { window.__LAB.testAPI.load(n); return true; } catch (e) { return String(e); } }, name);
    if (ok !== true) { console.error('load failed:', ok); await browser.close(); process.exit(2); }
    const out = await page.evaluate((six) => {
        window.__LAB.testAPI.run();
        const LAB = window.__LAB;
        const seed = LAB.seeds[six] >>> 0;
        const rec = LAB.recs[seed];
        const marks = LAB.marks.map(m => ({ x: m.x, y: m.y, zone: m.zone }));
        const rows = [];
        for (let f = 0; f <= rec.nF; f += 60) {
            const fr = rec.frames[f];
            rows.push({
                t: +(f / 60).toFixed(0),
                boats: fr.boats.map((b, i) => ({
                    n: rec.names[i], x: Math.round(b.x), y: Math.round(b.y),
                    hDeg: Math.round((b.h * 57.29577) % 360),
                    spdKt: +((b.s || 0) * 4).toFixed(1),
                    dev: Math.round((b.dev || 0) * 57.3),
                    role: b.role, gi: b.gi,
                    dMark: marks[0] ? Math.round(Math.hypot(b.x - marks[0].x, b.y - marks[0].y)) : null,
                })),
                pairs: fr.pairs,
            });
        }
        return { seed, rows, marks };
    }, seedIx);
    await browser.close();
    console.log(`seed ${out.seed} — mark ${JSON.stringify(out.marks[0] || null)}`);
    for (const r of out.rows) {
        const bs = r.boats.map(b =>
            `${b.n}(${b.x},${b.y}) h${b.hDeg} ${b.spdKt}kt dev${b.dev} ${b.role || '-'} gi${b.gi} dM${b.dMark}`).join(' | ');
        const pr = (r.pairs || []).map(p => `${p.row || '-'}${p.rule ? '(' + p.rule + ')' : ''}${p.mk ? ' mk:' + p.mk : ''}`).join(' ');
        console.log(`t=${String(r.t).padStart(2)} ${bs}  ${pr}`);
    }
})();
