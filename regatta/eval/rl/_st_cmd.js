// PRESTART COMMAND-vs-BOAT TRACE (2026-08-27, THE START PUSH P1c). The branch
// census showed the fleet dead in the water (0.0 kt) from T-12 to T-6, 200 u
// behind the line, in 13-16 kt of breeze. Two candidate causes, and they need
// different fixes: (a) the CONTROLLER is commanding a no-go heading, or (b) the
// controller commands close-hauled and the BOAT cannot follow it — a stopped
// boat inside the irons brake (physics.js: |TWA| < 0.5 rad, 0.994^timeScale on
// a boat under 1.5 kt) has no way on to turn with.
// So: wrap getStartCommand and getStrategicHeading read-only and print, second
// by second, the COMMANDED TWA beside the boat's ACTUAL TWA and speed.
//   node _st_cmd.js <tree> <venue> <seed0> <nraces>
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const TREE = process.argv[2] || 'treeRW';
const ROOT = path.join(__dirname, TREE);
const VENUE = process.argv[3] || 'bay';
const SEED0 = parseInt(process.argv[4] || '9400');
const NRACES = parseInt(process.argv[5] || '2');
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    await page.evaluate((v) => {
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: v, character: AI_CONFIG[0].name }));
    }, VENUE);
    const races = [];
    for (let race = 0; race < NRACES; race++) {
        const r = await page.evaluate(async ({ seed }) => {
            window.evalHarness.seed = seed;
            window.resetGame(); window.startRace();
            const pl = state.boats.find(b => b.isPlayer);
            applyBoatIdentity(pl, playerCharacter(), false);
            pl.isPlayer = false; pl.manualTrim = false;
            const nine = state.boats.filter(b => b !== pl);
            pl.ai.startLinePct = Math.max(0.05, Math.min(0.90,
                nine.reduce((a, b) => a + b.ai.startLinePct, 0) / nine.length));
            pl.ai.setupDist = 300;
            const boats = state.boats.slice();
            const norm = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
            const dt = 1 / 60; const trace = []; let it = 0;
            const wrap = () => { for (const b of boats) { const c = b.controller; if (!c || c.__cw) continue;
                const g1 = c.getStartCommand.bind(c), g2 = c.getStrategicHeading.bind(c);
                c.getStartCommand = () => { const o = g1(); b._sc = o; return o; };
                c.getStrategicHeading = (t) => { const o = g2(t); b._sh = o; return o; };
                c.__cw = 1; } };
            while (state.race.status === 'prestart' && it < 60 * 120) {
                window.update(dt); wrap(); it++;
                if (it % 30) continue;
                const t = state.race.timer;
                const [m0, m1] = startLinePts();
                const s = [];
                for (const b of boats) {
                    const wdir = getWindAt(b.x, b.y).direction;
                    const sc = b._sc;
                    const cmdH = (sc && sc.heading != null) ? sc.heading : b._sh;
                    s.push({ n: b.name, be: +Math.max(0, -hullLineOffset(b, m0, m1, true)).toFixed(0),
                        kt: +(b.speed * 4).toFixed(2),
                        aTwa: +Math.abs(norm(b.heading - wdir)).toFixed(2),
                        cTwa: cmdH == null ? null : +Math.abs(norm(cmdH - wdir)).toFixed(2),
                        mode: sc ? (sc.heading != null ? 'H' : 'T') : '?',
                        sReq: sc ? sc.speed : null,
                        turn: +Math.abs(norm(b.heading - (b.prevHeading != null ? b.prevHeading : b.heading))).toFixed(4) });
                }
                trace.push({ t: +t.toFixed(1), s });
            }
            return { seed, trace };
        }, { seed: SEED0 + race });
        races.push(r);
    }
    await browser.close();
    const med = a => { const z = a.filter(x => x != null).sort((x, y) => x - y); return z.length ? z[Math.floor(z.length / 2)] : NaN; };
    const byT = {};
    for (const r of races) for (const s of r.trace) (byT[s.t] = byT[s.t] || []).push(...s.s);
    const ts = Object.keys(byT).map(Number).sort((a, b) => b - a);
    console.log(`\n══ ${VENUE} ${TREE} — commanded vs actual through the pre-start (${races.length} races)`);
    console.log('   T-      behind   kt    actualTWA  commandedTWA   cmdMode  speedReq');
    for (const t of ts) {
        const g = byT[t];
        const modes = {}; for (const x of g) modes[x.mode] = (modes[x.mode] || 0) + 1;
        console.log(`   T-${String(t.toFixed(0)).padStart(2)}  ${String(med(g.map(x=>x.be))).padStart(6)}  ${med(g.map(x=>x.kt)).toFixed(2).padStart(5)}   ${med(g.map(x=>x.aTwa)).toFixed(2).padStart(6)}     ${med(g.map(x=>x.cTwa)).toFixed(2).padStart(6)}       ${Object.entries(modes).map(([k,v])=>k+v).join('/')}    ${med(g.map(x=>x.sReq)).toFixed(2)}`);
    }
    fs.writeFileSync(path.join(__dirname, `_st_cmd_${TREE}_${VENUE}_${SEED0}.json`), JSON.stringify(races));
})();
