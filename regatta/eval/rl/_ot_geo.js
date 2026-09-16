// OTTER MARK GEOMETRY (2026-09-14, the otter intake). What the engine and the ruler
// think the Otter Point rounding IS: zone, required sweep, side, the tight-orbit
// radius, the ruler's arc radius, the DMC leg-1 tail and leg-2 head around the
// mark, the wind at the mark and the approach / exit bearings as TWA.
//   node _ot_geo.js [tree] [venue]
const { chromium } = require('playwright');
const path = require('path'); const fs = require('fs');
const TREE = process.argv[2] || 'treeOT0', VENUE = process.argv[3] || 'otter';
const ROOT = path.join(__dirname, TREE);
(async () => {
    const br = await chromium.launch(); const p = await br.newPage();
    p.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await p.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await p.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    await p.evaluate((v) => localStorage.setItem('regatta_settings', JSON.stringify({ venue: v, character: AI_CONFIG[0].name })), VENUE);
    const out = await p.evaluate(() => {
        window.evalHarness.seed = 1; window.resetGame(); window.startRace();
        const c = state.course, route = c.route || [], o = { type: c.type, marks: [] };
        const deg = r => (r * 180 / Math.PI).toFixed(1);
        for (let i = 0; i < route.length; i++) { const e = route[i]; if (!e || e.kind !== 'round' || !e.mark) continue;
            const m = e.mark; const w = getWindAt(m.x, m.y);
            const rec = { leg: i, id: m.id, x: m.x, y: m.y, zone: m.zone, radius: m.radius, bodyR: m.bodyR, side: m.side, reqSweep: m.reqSweep, reqSweepDeg: deg(m.reqSweep || 0),
                orbitTightR: (typeof orbitTightR === 'function') ? orbitTightR(m) : 'n/a', roundR: CoursePath._roundR(m, c.botGrid), windDir: w.direction, windSpd: w.speed, wdeg: deg(w.direction) };
            const L = c.dmc && c.dmc.legs; const l1 = L && L[i], l2 = L && L[i + 1];
            const near = (leg, tag) => { if (!leg || !leg.pts) return; const P = leg.pts; const rows = []; for (let k = 0; k < P.length; k++) { const d = Math.hypot(P[k].x - m.x, P[k].y - m.y); if (d < m.zone * 2.2) rows.push({ k, x: +P[k].x.toFixed(0), y: +P[k].y.toFixed(0), d: +d.toFixed(0), cum: +leg.cum[k].toFixed(0) }); } rec[tag] = rows; rec[tag + '_len'] = +leg.length.toFixed(0); rec[tag + '_n'] = P.length; };
            near(l1, 'leg_in'); near(l2, 'leg_out');
            // approach: bearing from the leg-in point at 2.2 zone to the mark; exit: from mark to leg-out point at 2.2 zone
            if (l1 && l1.pts) { const P = l1.pts; let a = null; for (let k = P.length - 1; k >= 0; k--) { if (Math.hypot(P[k].x - m.x, P[k].y - m.y) > m.zone * 2.2) { a = P[k]; break; } } if (a) { const h = Math.atan2(m.x - a.x, -(m.y - a.y)); rec.approachHdg = deg(h); rec.approachTWA = deg(Math.abs(normalizeAngle(h - w.direction))); } }
            if (l2 && l2.pts) { const P = l2.pts; let b = null; for (let k = 0; k < P.length; k++) { if (Math.hypot(P[k].x - m.x, P[k].y - m.y) > m.zone * 2.2) { b = P[k]; break; } } if (b) { const h = Math.atan2(b.x - m.x, -(b.y - m.y)); rec.exitHdg = deg(h); rec.exitTWA = deg(Math.abs(normalizeAngle(h - w.direction))); } }
            // grid clearance around the mark: sample 16 radials at several radii
            const g = c.botGrid; if (g) { const ring = []; for (const rr of [0.5, 0.7, 0.85, 1.0, 1.25, 1.5]) { let clear = 0, soft = 0, blocked = 0; for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2; const cc = g.cell(m.x + Math.cos(a) * m.zone * rr, m.y + Math.sin(a) * m.zone * rr); const id = cc[1] * g.n + cc[0]; if (g.at(cc[0], cc[1])) clear++; else if (g._soft && g._soft[id] === 1) soft++; else blocked++; } ring.push({ rr, clear, soft, blocked }); } rec.ring = ring; rec.cell = g.cell ? g.cellSize || g.cs || null : null; }
            o.marks.push(rec);
        }
        o.hasFloes = c._hasFloes; o.ROUND = { NEAR: typeof ROUND_NEAR !== 'undefined' ? ROUND_NEAR : null, ACTIVE: typeof ROUND_ACTIVE !== 'undefined' ? ROUND_ACTIVE : null, EXIT_SLACK: typeof ROUND_EXIT_SLACK !== 'undefined' ? ROUND_EXIT_SLACK : null, GIVEBACK: typeof ROUND_GIVEBACK !== 'undefined' ? ROUND_GIVEBACK : null };
        return o;
    });
    console.log(JSON.stringify(out, null, 1));
    await br.close();
})();
