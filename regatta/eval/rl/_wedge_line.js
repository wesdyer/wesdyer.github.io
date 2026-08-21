// WEDGE-ENTRY LINE DISCRIMINATOR (2026-08-21, the wedge push): for each
// sub-1kt collapse, was the COMMANDED line into the bank (a planning
// error) or was the commanded line clear while the SAILED track drifted
// in (execution under set/jam — the closed clearance-bar verdict's side)?
// At entry, over the 5s BEFORE the collapse began:
//   cmd  = the helm's commanded heading (controller.targetHeading), oldest
//          samples of the window
//   trk  = the actual track direction over the same span (positions)
// Each is projected ~4s ahead from the 5s-ago position and walked on the
// bot grid every 20u: does the line cross a blocked cell?
//   cmdIntoBank            — the plan itself aimed at the bank
//   cmdClear/trackIn       — plan clear, sailed track drifts in: EXECUTION
//   bothClear              — neither line blocked (collapse from jam/other)
//   bothIn                 — everything blocked (pocket — nowhere to plan)
//   node _wedge_line.js <venue> <trials> <seed0> <tree>
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const VENUE = process.argv[2] || 'river';
const TRIALS = parseInt(process.argv[3]) || 4;
const SEED0 = parseInt(process.argv[4]) || 9400;
const ROOT = path.join(__dirname, process.argv[5] || 'treeGWE');
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.addInitScript((v) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })); }, VENUE);
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const all = [];
    for (let i = 0; i < TRIALS; i++) {
        const seed = SEED0 + i;
        const rows = await page.evaluate(async (seed) => {
            window.evalHarness.seed = seed;
            window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const pl = state.boats.find(b => b.isPlayer); if (pl) { pl.x = 1e6; pl.y = 1e6; }
            const HISTN = 100;   // 5s at 20Hz
            const hist = new Map();
            const out = [];
            const lineBlocked = (x0, y0, hdg, len) => {
                const g = state.course.botGrid || state.course._botGridStatic;
                if (!g) return null;
                for (let d = 20; d <= len; d += 20) {
                    const px = x0 + Math.sin(hdg) * d, py = y0 - Math.cos(hdg) * d;
                    const c = g.cell(px, py);
                    if (!g.at(c[0], c[1])) return d;   // first blocked distance
                }
                return 0;
            };
            const dt = 1 / 60; let it = 0;
            while (it < 900 * 60) {
                if (state.race.status === 'racing' && state.boats.every(bb => bb.isPlayer || bb.raceState.finished)) break;
                update(dt); it++;
                if (state.race.status !== 'racing' || (it % 3)) continue;
                for (const bt of state.boats) {
                    if (bt.isPlayer || bt.raceState.finished || bt.raceState.leg < 1) continue;
                    let h = hist.get(bt.id);
                    if (!h) { h = { pos: [], cmd: [], slow: 0, lastEntryT: -99 }; hist.set(bt.id, h); }
                    const c = bt.controller || {};
                    h.pos.push([bt.x, bt.y]); if (h.pos.length > HISTN) h.pos.shift();
                    h.cmd.push(c.targetHeading != null ? c.targetHeading : bt.heading);
                    if (h.cmd.length > HISTN) h.cmd.shift();
                    const slowNow = (bt.speed * 4) < 1.0;
                    h.slow = slowNow ? h.slow + 3 / 60 : 0;
                    if (h.slow >= 3 && state.race.timer - h.lastEntryT > 10 && h.pos.length >= 80) {
                        h.lastEntryT = state.race.timer;
                        // the window BEFORE the collapse began: oldest 40
                        // samples (entry-5s .. entry-3s)
                        const p0 = h.pos[0], p1 = h.pos[39];
                        const cmds = h.cmd.slice(0, 40);
                        // circular mean of commanded heading
                        let sx = 0, sy = 0;
                        for (const a of cmds) { sx += Math.sin(a); sy += Math.cos(a); }
                        const cmdH = Math.atan2(sx, sy);
                        const trkH = Math.atan2(p1[0] - p0[0], -(p1[1] - p0[1]));
                        const spd = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) / 2;  // u/s over 2s
                        const len = Math.max(120, Math.min(500, spd * 4));
                        const cmdBlk = lineBlocked(p0[0], p0[1], cmdH, len);
                        const trkBlk = lineBlocked(p0[0], p0[1], trkH, len);
                        out.push({ t: +state.race.timer.toFixed(1), n: bt.name,
                                   leg: bt.raceState.leg,
                                   cmdBlk, trkBlk,
                                   driftDeg: Math.round(((trkH - cmdH + Math.PI * 3) % (Math.PI * 2) - Math.PI) * 57.3),
                                   spd: +(spd / 15).toFixed(1) });
                    }
                }
            }
            return out;
        }, seed);
        for (const r of rows) { r.seed = seed; all.push(r); }
        console.log(`seed ${seed}: ${rows.length} entries`);
    }
    await browser.close();
    const cls = {};
    for (const r of all) {
        if (r.cmdBlk == null) { cls.noGrid = (cls.noGrid || 0) + 1; continue; }
        const k = r.cmdBlk ? (r.trkBlk ? 'bothIn' : 'cmdIntoBank-trackClear') : (r.trkBlk ? 'cmdClear-trackIn' : 'bothClear');
        cls[k] = (cls[k] || 0) + 1;
    }
    console.log(`\n${all.length} entries — the line discriminator (5s-ago projection on the bot grid):`);
    for (const [k, v] of Object.entries(cls).sort((x, y) => y[1] - x[1]))
        console.log(`  ${String(v).padStart(4)}  ${(100 * v / all.length).toFixed(1).padStart(5)}%  ${k}`);
    const drifts = all.map(r => Math.abs(r.driftDeg)).sort((a, b) => a - b);
    console.log('|track-cmd| drift p50/p75:', drifts[Math.floor(drifts.length * .5)], drifts[Math.floor(drifts.length * .75)], 'deg');
    // DISTANCE-BINNED verdict: in a winding channel every long ray finds a
    // bank; only a SHORT blocked distance (inside ~1s of sailing) says the
    // line was genuinely into the wall. Bin the blocked distances.
    const bin = (d, spdKt) => d == null ? 'noGrid' : d === 0 ? 'clear'
        : d <= Math.max(60, spdKt * 15) ? 'wall<1s' : d <= Math.max(120, spdKt * 15 * 2.5) ? 'soon' : 'channel-far';
    const cls2 = {};
    for (const r of all) {
        const k = `cmd:${bin(r.cmdBlk, r.spd)}/trk:${bin(r.trkBlk, r.spd)}`;
        cls2[k] = (cls2[k] || 0) + 1;
    }
    console.log('distance-binned (wall<1s = blocked inside one second of sailing):');
    for (const [k, v] of Object.entries(cls2).sort((x, y) => y[1] - x[1]))
        console.log(`  ${String(v).padStart(4)}  ${(100 * v / all.length).toFixed(1).padStart(5)}%  ${k}`);
    const outPath = path.join(__dirname, `_wline_${VENUE}.json`);
    fs.writeFileSync(outPath, JSON.stringify(all));
    console.log('rows → ' + outPath);
    for (const r of all.slice(0, 8)) console.log(' ', JSON.stringify(r));
})();
