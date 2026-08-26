// RIVER ENTRY PUSH — does the TIER-AWARE router (pathSailable, what bots
// actually call for gridPath) thread the notch where strict pathBetween
// cannot? And do racing bots on legs 3-4 CARRY a gridPath near the entry
// clusters? (2026-08-26)   node _rv_sail.js <tree> <venue> <seed>
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const TREE = process.argv[2] || 'treeRW';
const ROOT = path.join(__dirname, TREE);
const VENUE = process.argv[3] || 'river';
const SEED = parseInt(process.argv[4] || '9400');
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    await page.evaluate((v) => {
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: v, character: AI_CONFIG[0].name }));
    }, VENUE);
    const out = await page.evaluate(async (seed) => {
        window.evalHarness.seed = seed;
        window.resetGame(); window.startRace();
        const pl = state.boats.find(b => b.isPlayer);
        if (pl) {
            applyBoatIdentity(pl, playerCharacter(), false);
            pl.isPlayer = false; pl.manualTrim = false;
            const nine = state.boats.filter(b => b !== pl);
            pl.ai.startLinePct = Math.max(0.05, Math.min(0.90,
                nine.reduce((a, b) => a + b.ai.startLinePct, 0) / nine.length));
            pl.ai.setupDist = 300;
        }
        const g = state.course.botGrid;
        if (!g._clear) g._clear = window.SailCheck.clearanceField(g);
        const res = {};
        // static: pathSailable across the leg-3 chord endpoints
        const l3 = state.course.dmc.legs[3].pts;
        const A = l3[0], B = l3[l3.length - 1];
        const seg = window.SailCheck.pathSailable(g, [A.x, A.y], [B.x, B.y]);
        if (seg && seg.length > 1) {
            let L = 0, nT = 0, cls = [];
            for (let k = 0; k < seg.length; k++) {
                if (k) L += Math.hypot(seg[k][0] - seg[k-1][0], seg[k][1] - seg[k-1][1]);
                const c = g.cell(seg[k][0], seg[k][1]); const id = c[1] * g.n + c[0];
                if (g._tight && g._tight[id]) nT++;
                cls.push(g._clear[id]);
            }
            cls.sort((a, b) => a - b);
            res.sail = { pts: seg.length, len: Math.round(L), tightPts: nT, minClr: cls[0], medClr: cls[cls.length >> 1] };
        } else res.sail = null;
        // dynamic: 10Hz sampling of bots on legs>=3 — gridPath presence + tight threading + dist to path
        const S = { frames: 0, hasPath: 0, tightThread: 0, farFromPath: 0, noPathNearWall: 0 };
        const DT = 1 / 60; let it = 0;
        while (it < 60 * 700) {
            update(DT); it++;
            if (state.race.status !== 'racing') continue;
            if (state.race.timer > 700) break;
            if (it % 6) continue;
            for (const b of state.boats) {
                if (b.isPlayer || b.raceState.finished || b.raceState.leg < 3) continue;
                S.frames++;
                const c = b.controller;
                const gp = c && c.gridPath;
                if (gp && gp.length) {
                    S.hasPath++;
                    let thr = 0;
                    for (let pi = 0; pi < Math.min(12, gp.length); pi++) {
                        const pc = g.cell(gp[pi].x, gp[pi].y);
                        if (g._tight && g._tight[pc[1] * g.n + pc[0]]) { thr = 1; break; }
                    }
                    S.tightThread += thr;
                    let bd = Infinity;
                    for (let ii = 0; ii < Math.min(6, gp.length); ii++)
                        bd = Math.min(bd, Math.hypot(b.x - gp[ii].x, b.y - gp[ii].y));
                    if (bd > 200) S.farFromPath++;
                } else {
                    const cc = g.cell(b.x, b.y);
                    const cl = g._clear[cc[1] * g.n + cc[0]];
                    if (cl != null && cl <= 2) S.noPathNearWall++;
                }
            }
            if (state.boats.every(b => b.isPlayer || b.raceState.finished)) break;
        }
        res.dyn = S;
        return res;
    }, SEED);
    console.log(`tree ${TREE} venue ${VENUE} seed ${SEED}`);
    console.log('pathSailable leg3-endpoints:', JSON.stringify(out.sail));
    console.log('legs>=3 10Hz:', JSON.stringify(out.dyn));
    await browser.close();
})();
