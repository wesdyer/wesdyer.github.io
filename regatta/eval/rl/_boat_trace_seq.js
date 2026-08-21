// One-boat race trace, BENCH-SEQUENCE-FAITHFUL (rule 34: a bench race is
// reproduced by its seed SEQUENCE, not its seed). _boat_trace.js runs the target
// seed COLD, and river's cross-race in-process state makes a cold 9402 a
// different race from the bench's third — last session a "zero-contact DNF"
// finished under a cold trace and the anomaly vanished. This replays the bench:
// full races at seed0..target-1 in the same process, then traces the target.
//   node _boat_trace_seq.js <seed0> <targetSeed> <boatName> <tree> <venue>
// Richer rows than _boat_trace: leg, dist-to-next-objective, penalties, OCS,
// role, and a leg-transition log — built for the "sails all race, never
// finishes" class, where WHICH objective she cannot close is the question.
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const SEED0 = parseInt(process.argv[2]) || 9400;
const TARGET = parseInt(process.argv[3]) || 9402;
const NAME = process.argv[4] || 'Petal';
const ROOT = path.join(__dirname, process.argv[5] || 'treeBASE');
const VENUE = process.argv[6] || 'river';
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    await page.evaluate((v) => localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })), VENUE);
    // burn through the bench prefix so cross-race state matches the bench
    for (let s = SEED0; s < TARGET; s++) {
        const fins = await page.evaluate(async (seed) => {
            window.evalHarness.seed = seed; window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const pl = state.boats.find(b => b.isPlayer); pl.x = 1e6; pl.y = 1e6;
            const dt = 1 / 60;
            for (let it = 0; it < 60 * 940; it++) {
                window.update(dt);
                if (state.race.status === 'finished') break;
                if (state.race.status === 'racing' && state.race.timer > 900) break;
            }
            return state.boats.filter(b => !b.isPlayer && b.raceState.finished).length;
        }, s);
        console.log(`prefix seed ${s}: ${fins} finishers`);
    }
    const r = await page.evaluate(async ({ seed, name }) => {
        window.evalHarness.seed = seed; window.resetGame(); window.startRace();
        state.course.cutoff = 900;
        const pl = state.boats.find(b => b.isPlayer); pl.x = 1e6; pl.y = 1e6;
        const b = state.boats.find(x => x.name === name);
        if (!b) return { err: 'no boat ' + name };
        // ── instrument the crossing test for THIS boat ──────────────────────
        const hLog = [];
        const orig = window.hullCrossedLine;
        window.hullCrossedLine = function (boat, ax, ay, bx, by) {
            const res = orig(boat, ax, ay, bx, by);
            // fine window: log EVERY call for the target boat with stage internals
            if (boat === b) {
                const t0 = state.race.status === 'racing' ? state.race.timer : -state.race.timer;
                if (t0 > 19 && t0 < 23) {
                    const rs = boat.raceState;
                    const prev = hullPolygonAt(rs.lastPos.x, rs.lastPos.y, boat.heading);
                    const cur = hullPolygonAt(boat.x, boat.y, boat.heading);
                    const ex = bx - ax, ey = by - ay;
                    let mP = Infinity, MP = -Infinity, mC = Infinity, MC = -Infinity;
                    for (let i = 0; i < prev.length; i++) {
                        const sp = (prev[i].x - ax) * ey - (prev[i].y - ay) * ex;
                        if (sp < mP) mP = sp; if (sp > MP) MP = sp;
                        const sc = (cur[i].x - ax) * ey - (cur[i].y - ay) * ex;
                        if (sc < mC) mC = sc; if (sc > MC) MC = sc;
                    }
                    const lead = ((MP <= 0 && MC > 0) || (mP >= 0 && mC < 0));
                    hLog.push(`t${t0.toFixed(2)} call line(${ax.toFixed(0)},${ay.toFixed(0)}) mP/MP=${(mP / 1000).toFixed(1)}/${(MP / 1000).toFixed(1)}k mC/MC=${(mC / 1000).toFixed(1)}/${(MC / 1000).toFixed(1)}k lead=${lead ? 1 : 0} res=${res ? 1 : 0} lastPos=(${rs.lastPos.x.toFixed(0)},${rs.lastPos.y.toFixed(0)}) pos=(${boat.x.toFixed(0)},${boat.y.toFixed(0)})`);
                }
            }
            if (boat === b && res) {
                const rs = boat.raceState;
                const ex2 = bx - ax, ey2 = by - ay;
                const nx = ey2, ny = -ex2;
                const mdx = boat.x - rs.lastPos.x, mdy = boat.y - rs.lastPos.y;
                hLog.push(`t${(state.race.status === 'racing' ? state.race.timer : -state.race.timer).toFixed(2)} HIT line(${ax.toFixed(0)},${ay.toFixed(0)})-(${bx.toFixed(0)},${by.toFixed(0)}) dir=${(mdx * nx + mdy * ny) > 0 ? 1 : -1} ocs=${rs.ocs ? 1 : 0} leg=${rs.leg} status=${state.race.status}`);
            }
            return res;
        };
        const dt = 1 / 60, out = [], legLog = [], xLog = [];
        let lastLeg = -1, lastSide = null;
        // start line geometry, exactly as the crossing code reads it
        const entry0 = state.course.route && state.course.route[0];
        const gm = entry0 && entry0.marks ? entry0.marks.map(i => state.course.marks[i]) : null;
        for (let it = 0; it < 60 * 940; it++) {
            window.update(dt);
            if (state.race.status === 'finished') break;
            const t = state.race.status === 'racing' ? state.race.timer : -state.race.timer;
            if (t > 900) break;
            const rs = b.raceState;
            if (gm && gm.length === 2) {
                const [m1, m2] = gm;
                const ldx = m2.x - m1.x, ldy = m2.y - m1.y, len = Math.hypot(ldx, ldy) || 1;
                const perp = ((b.x - m1.x) * ldy - (b.y - m1.y) * ldx) / len;
                const side = perp > 0 ? 1 : -1;
                // along-line parameter of the closest point, to see segment vs extension
                const s = ((b.x - m1.x) * ldx + (b.y - m1.y) * ldy) / (len * len);
                if (lastSide !== null && side !== lastSide)
                    xLog.push(`t${t.toFixed(1)} side ${lastSide}->${side} s=${s.toFixed(2)} ocs=${rs.ocs ? 1 : 0} leg=${rs.leg} dirReq=${entry0.dir}`);
                lastSide = side;
            }
            if (state.race.status !== 'racing') continue;
            if (rs.leg !== lastLeg) { legLog.push(`t${t.toFixed(1)} -> leg ${rs.leg}`); lastLeg = rs.leg; }
            if (it % 120 === 0) {
                const c = b.controller;
                const w = (typeof getWindAt === 'function') ? getWindAt(b.x, b.y) : null;
                const twa = w ? Math.abs(normalizeAngle(b.heading - w.direction)).toFixed(2) : '-';
                const cur = (typeof getCurrentAt === 'function') ? getCurrentAt(b.x, b.y) : null;
                out.push([+t.toFixed(0), Math.round(b.x), Math.round(b.y), rs.leg,
                    Math.round(b.speed * 60), rs.roundArmed ? 1 : 0,
                    rs.totalPenalties || 0, rs.penalty ? 1 : 0, rs.ocs ? 1 : 0,
                    c ? (c.avoidanceRole || '-')[0] : '-',
                    c ? (c.escActive ? 'ESC' + c.escTimer.toFixed(0) : (c.iceEscapeTimer > 0 ? 'latch' : '-')) : '-',
                    twa,
                    cur ? (cur.speed || 0).toFixed(1) : '-',
                    c && c.wiggleActive ? 'W' : '-']);
            }
        }
        const fins = state.boats.filter(x => !x.isPlayer && x.raceState.finished).length;
        return { rows: out, legLog, xLog, hLog, fin: b.raceState.finished ? 1 : 0, leg: b.raceState.leg,
                 finT: b.raceState.finishTime || null, fins,
                 col: (window.__cc && window.__cc[name]) || null };
    }, { seed: TARGET, name: NAME });
    if (r.err) { console.log(r.err); await browser.close(); return; }
    console.log(`\n${NAME} seed ${TARGET} (seq from ${SEED0}) ${VENUE}: finished=${r.fin} final leg=${r.leg} finT=${r.finT} race finishers=${r.fins}`);
    console.log('leg transitions:', r.legLog.join('  '));
    console.log(`start-line side changes (${r.xLog.length}):`);
    for (const x of r.xLog) console.log('  ' + x);
    console.log(`hullCrossedLine HITS for this boat (${(r.hLog || []).length}):`);
    for (const x of r.hLog || []) console.log('  ' + x);
    for (const row of r.rows) console.log('t' + String(row[0]).padStart(3), `(${row[1]},${row[2]})`, 'leg', row[3], String(row[4]).padStart(3) + 'u/s', row[5] ? 'ARM' : '   ', 'pen', row[6], row[7] ? 'PENALTY' : '', row[8] ? 'OCS' : '', row[9], row[10] || '', 'twa' + (row[11] || '-'), 'cur' + (row[12] || '-'), row[13] || '');
    await browser.close();
})();
