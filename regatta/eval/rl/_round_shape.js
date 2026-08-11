// WHY DOES THE FLEET SAIL 6.8x HER DISTANCE ROUND THIS MARK? (2026-08-10, lagoon)
//
// Lagoon's gap is 109.0 s/boat and **leg 2 is 36% of it at 2.92x**. Inside leg 2,
// sub-9 — the mark-4 rounding at (764,-1711) — is **43% of the leg, 16.5 s/boat,
// about 15% of the venue's whole gap**. And it is NOT slowness: the fleet is doing
// 114 u/s there against her 96, yet takes 19.9 s against her 3.5. That is ~2269u
// of track against her ~336u.
//
// So this asks what the extra 1900u IS. Per boat inside a radius of the mark:
//   * track length, and the straight-line distance it actually needed;
//   * ZONE ENTRIES — how many times it enters the rounding zone. >1 means it
//     came out and went back, which is an overshoot or a failed attempt;
//   * the furthest it gets from the mark while ARMED (an orbit radius);
//   * total heading turned — an orbit and an overshoot both cover distance, but
//     an orbit turns ~2pi and a bad approach turns much more;
//   * time armed vs unarmed, and contacts.
// Her recording is measured the same way, from the same geometry.
//
// ⚠️ Open water is read from the BOT GRID, not from island radii: the compiled
// `radius` is a BOUNDING radius (lagoon's shape-2 has r=2601 and would "cover" a
// mark 3047u away), and using it over-reports blockage badly.
//
//   node _round_shape.js <venue> <markId> <trials> <seed0> <tree> [radius]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const VENUE = process.argv[2] || 'lagoon';
const MARK = process.argv[3] || 'mark-4';
const TRIALS = parseInt(process.argv[4]) || 6;
const SEED0 = parseInt(process.argv[5]) || 7300;
const ROOT = path.join(__dirname, process.argv[6] || 'treeHD13');
const RAD = parseFloat(process.argv[7] || '400');
const q = (a, p) => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.floor(p * (s.length - 1))] : NaN; };
const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN;

(async () => {
    const b = await chromium.launch(); const p = await b.newPage();
    p.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 200)));
    await p.addInitScript((v) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })); }, VENUE);
    await p.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await p.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });

    const geo = await p.evaluate(({ MARK, RAD }) => {
        window.evalHarness.seed = 7300; window.resetGame(); window.startRace();
        for (let i = 0; i < 120; i++) window.update(1 / 60);
        const m = (state.course.marks || []).find(x => x.id === MARK);
        if (!m) return null;
        const g = state.course.botGrid;
        const rings = {};
        for (const rr of [120, 180, 240, 300, 400]) {
            let open = 0, tot = 0;
            for (let a = 0; a < 360; a += 5) {
                const x = m.x + rr * Math.cos(a * Math.PI / 180), y = m.y + rr * Math.sin(a * Math.PI / 180);
                const c = g.cell(x, y); tot++; if (g.at(c[0], c[1])) open++;
            }
            rings[rr] = Math.round(100 * open / tot);
        }
        return { x: m.x, y: m.y, zone: m.zone, radius: m.radius, rings };
    }, { MARK, RAD });
    if (!geo) { console.log('mark not found'); await b.close(); return; }

    const rows = [];
    for (let t = 0; t < TRIALS; t++) {
        const r = await p.evaluate(({ seed, MARK, RAD }) => {
            window.evalHarness.seed = seed; window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const pl = state.boats.find(x => x.isPlayer); if (pl) { pl.x = 1e6; pl.y = 1e6; }
            const m = (state.course.marks || []).find(x => x.id === MARK);
            const DT = 1 / 60; const st = {};
            for (let it = 0; it < 60 * 900; it++) {
                window.update(DT);
                if (state.race.status !== 'racing') { if (state.race.status === 'finished') break; continue; }
                for (const bo of state.boats) {
                    if (bo.isPlayer || bo.raceState.finished) continue;
                    const d = Math.hypot(bo.x - m.x, bo.y - m.y);
                    const s = st[bo.name] = st[bo.name] || { t: 0, dist: 0, turn: 0, entries: 0, inside: false,
                                                             maxR: 0, armedT: 0, px: bo.x, py: bo.y, ph: bo.heading, done: false };
                    if (s.done) continue;
                    if (d <= RAD) {
                        if (!s.inside) { s.inside = true; s.entries++; }
                        s.t += DT;
                        s.dist += Math.hypot(bo.x - s.px, bo.y - s.py);
                        let dh = bo.heading - s.ph; while (dh > Math.PI) dh -= 2 * Math.PI; while (dh < -Math.PI) dh += 2 * Math.PI;
                        s.turn += Math.abs(dh);
                        if (d > s.maxR) s.maxR = d;
                        if (bo.raceState.roundArmed) s.armedT += DT;
                    } else if (s.inside) {
                        s.inside = false;
                        if (s.entries >= 1 && s.t > 1 && bo.raceState.leg > 2) s.done = true;  // left for good
                    }
                    s.px = bo.x; s.py = bo.y; s.ph = bo.heading;
                }
            }
            return Object.entries(st).map(([n, s]) => ({ n, t: s.t, dist: s.dist, turn: s.turn, entries: s.entries, maxR: s.maxR, armedT: s.armedT }));
        }, { seed: SEED0 + t, MARK, RAD });
        for (const x of r) rows.push(x);
        console.log(`seed ${SEED0 + t}: ${r.length} boat-visits`);
    }
    await b.close();

    // her side, same geometry
    const dir = path.join(__dirname, 'traj');
    const H = [];
    for (const f of fs.readdirSync(dir).filter(x => x.startsWith('traj_' + VENUE + '_')).sort()) {
        const j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
        if (!j.format) continue;
        const F = j.format, I = n => F.indexOf(n);
        const rws = j.samples;
        let t = 0, dist = 0, turn = 0, entries = 0, inside = false, maxR = 0, px = null, py = null, ph = null;
        const span = Math.abs(rws[rws.length - 1][I('t')] - rws[0][I('t')]);
        const dt = span / Math.max(1, rws.length - 1);
        for (const r of rws) {
            const x = r[I('x')], y = r[I('y')], h = r[I('hdg')];
            const d = Math.hypot(x - geo.x, y - geo.y);
            if (d <= RAD) {
                if (!inside) { inside = true; entries++; }
                t += dt;
                if (px != null) { dist += Math.hypot(x - px, y - py); let dh = h - ph; while (dh > Math.PI) dh -= 2 * Math.PI; while (dh < -Math.PI) dh += 2 * Math.PI; turn += Math.abs(dh); }
                if (d > maxR) maxR = d;
            } else inside = false;
            px = x; py = y; ph = h;
        }
        if (t > 0) H.push({ t, dist, turn, entries, maxR });
    }

    console.log(`\n=== ${VENUE.toUpperCase()} ${MARK} ROUNDING SHAPE (r=${RAD}u, ${TRIALS} seeds, ${path.basename(ROOT)}) ===`);
    console.log(`mark at (${Math.round(geo.x)},${Math.round(geo.y)})  zone ${geo.zone}   OPEN WATER by ring (from the bot grid):`);
    console.log(`   ` + Object.entries(geo.rings).map(([k, v]) => `${k}u:${v}%`).join('   '));
    const F = (lbl, arr) => {
        if (!arr.length) { console.log(`${lbl}  (none)`); return; }
        console.log(`${lbl.padEnd(10)} n=${String(arr.length).padStart(3)}  time med ${q(arr.map(x => x.t), 0.5).toFixed(1)}s` +
            `  track med ${q(arr.map(x => x.dist), 0.5).toFixed(0)}u` +
            `  turned med ${(q(arr.map(x => x.turn), 0.5) * 57.3).toFixed(0)}deg` +
            `  ZONE ENTRIES med ${q(arr.map(x => x.entries), 0.5)} p90 ${q(arr.map(x => x.entries), 0.9)}` +
            `  maxR med ${q(arr.map(x => x.maxR), 0.5).toFixed(0)}u`);
    };
    F('HER', H); F('THE FLEET', rows);
    const multi = rows.filter(x => x.entries > 1).length;
    console.log(`\n  ⭐ boats entering the ${RAD}u circle MORE THAN ONCE: ${multi}/${rows.length} (${(100 * multi / rows.length).toFixed(0)}%)` +
        `   — hers ${H.filter(x => x.entries > 1).length}/${H.length}`);
    console.log(`  a clean rounding turns about 90-180 deg and enters once; more turn or more`);
    console.log(`  entries means orbiting or overshoot-and-return, which are different fixes.`);
})();
