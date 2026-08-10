// POCKET ARGMIN (2026-08-09): the redrock leg3-sub0 / river bin4 pockets are
// UNARMED transit stalls (landAhead 85%, wiggle 85%, armed ~0) — the ladder
// kill re-addressed them as execution-under-jam. Read the argmin's own ledger
// inside the pocket box: which term defeats the 0-rung, at what speeds/roles.
// Uses treePR2's window.__avBox trigger (no armed gate inside the box).
//   node _pocket_argmin.js <venue> <x0> <y0> <x1> <y1> <trials> <seed0> [tree=treePR2]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const VENUE = process.argv[2] || 'redrock';
const BOX = process.argv.slice(3, 7).map(Number);
const TRIALS = parseInt(process.argv[7]) || 3;
const SEED0 = parseInt(process.argv[8]) || 9400;
const ROOT = path.join(__dirname, process.argv[9] || 'treePR2');

(async () => {
    const b = await chromium.launch(); const p = await b.newPage();
    p.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 200)));
    await p.addInitScript((v) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })); }, VENUE);
    await p.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await p.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    const all = [];
    for (let t = 0; t < TRIALS; t++) {
        const rows = await p.evaluate(async ({ seed, BOX }) => {
            window.__avCap = 1; window.__avLog = []; window.__avBox = BOX;
            window.evalHarness.seed = seed;
            window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const pl = state.boats.find(x => x.isPlayer); pl.x = 1e6; pl.y = 1e6;
            const dt = 1 / 60;
            for (let it = 0; it < 60 * 900; it++) {
                window.update(dt);
                if (state.race.status === 'finished') break;
            }
            return window.__avLog;
        }, { seed: SEED0 + t, BOX });
        console.log(`seed ${SEED0 + t}: ${rows.length} pocket choices logged`);
        all.push(...rows);
    }
    await b.close();
    const reasons = {}, chosen = {}, slow = {}, slowScope = { n: 0 };
    const vp = { n: 0, allClosed: 0, oneSide: 0, bothSides: 0, revPresent: 0, revOpen: 0, revWon: 0, openCount: 0 };
    const arcWhy = {}; let arcN = 0, arcSlowN = 0;
    let n = 0, nSlow = 0, fullVeto = 0, fullBnd = 0, slowFullVeto = 0;
    const sdSlow = [];
    for (const r of all) {
        const fan = r.fan; if (!fan || !fan.length) continue;
        const f0 = fan.find(c => c.off === 0);
        const win = fan.reduce((a, c) => c.cost < a.cost ? c : a, fan[0]);
        if (!f0) continue;
        n++;
        if (fan.every(c => c.sc)) { fullVeto++; if (r.spd < 40) slowFullVeto++; if (fan.every(c => c.bn)) fullBnd++; }
        if (r.spd < 40 && typeof r.sdB === 'number' && r.sdB > -9999) sdSlow.push(r.sdB);
        chosen[win.off] = (chosen[win.off] || 0) + 1;
        let why;
        if (f0.sc && !win.sc) why = (f0.bn && !win.bn) ? 'BND_VETO' : 'STATIC_VETO';
        else if (f0.bc && !win.bc) why = 'BOAT_VETO';
        else if (f0.rv && !win.rv) why = 'RULE_VETO';
        else if (f0.px - win.px > (f0.cost - win.cost) * 0.5) {
            const dRival = (f0.pxr || 0) - (win.pxr || 0);
            const dStatic = (f0.px - (f0.pxr || 0)) - (win.px - (win.pxr || 0));
            why = dRival > dStatic ? 'PROX_RIVAL' : 'PROX_STATIC';
        }
        else if (f0.sc && win.sc) why = 'BOTH_STATIC';
        else if (f0.bc && win.bc) why = 'BOTH_BOAT';
        else why = 'OTHER_COST';
        reasons[why] = (reasons[why] || 0) + 1;
        if (r.arc || r.armed) { arcN++; arcWhy[why] = (arcWhy[why] || 0) + 1; if (r.spd < 40) arcSlowN++; }
        if (r.spd < 40) { nSlow++; slow[why] = (slow[why] || 0) + 1; }
        if (r.spd < 40 && (why === 'STATIC_VETO' || why === 'PROX_STATIC' || why === 'BND_VETO') && r.scope) {
            slowScope.n++;
            for (const k of Object.keys(r.scope)) slowScope[k] = (slowScope[k] || 0) + (r.scope[k] ? 1 : 0);
            // fan veto profile: is an escape side OPEN (unvetoed) and merely losing?
            const L = fan.filter(c => c.off < -0.05), R = fan.filter(c => c.off > 0.05);
            const openL = L.filter(c => !c.sc).length, openR = R.filter(c => !c.sc).length;
            const rev = fan.filter(c => Math.abs(c.off) > 1.7);
            const openRev = rev.filter(c => !c.sc).length;
            vp.n++;
            if (openL + openR === 0) vp.allClosed++;
            else if (openL === 0 || openR === 0) vp.oneSide++;
            else vp.bothSides++;
            vp.revPresent += rev.length ? 1 : 0; vp.revOpen += openRev ? 1 : 0;
            if (Math.abs(win.off) > 1.7) vp.revWon++;
            vp.openCount += openL + openR;
        }
    }
    console.log(`\n=== ${VENUE} pocket [${BOX}] : ${n} choices ===`);
    console.log('why 0-rung lost:', JSON.stringify(reasons));
    console.log(`FULL-FAN veto: ${fullVeto} (${Math.round(100 * fullVeto / Math.max(1, n))}%), of which all-boundary: ${fullBnd}; slow full-veto: ${slowFullVeto}`);
    if (sdSlow.length) {
        const s = sdSlow.slice().sort((a, c) => a - c);
        const q = p => s[Math.floor(p * (s.length - 1))];
        console.log(`boundary sd at slow choices (n=${s.length}): p10 ${q(.1)} p25 ${q(.25)} med ${q(.5)} p75 ${q(.75)}; within80: ${Math.round(100 * s.filter(v => v < 80).length / s.length)}% within120: ${Math.round(100 * s.filter(v => v < 120).length / s.length)}%`);
    }
    console.log('winning rungs:', Object.entries(chosen).sort((a, c) => c[1] - a[1]).slice(0, 8).map(([k, v]) => `${k}:${v}`).join(' '));
    console.log(`SLOW subset (n=${nSlow}):`, JSON.stringify(slow));
    console.log(`ARC/ARMED subset (n=${arcN}, slow ${arcSlowN}):`, JSON.stringify(arcWhy));
    if (vp.n) {
        console.log(`fan profile at slow-static choices (n=${vp.n}): allClosed ${Math.round(100 * vp.allClosed / vp.n)}%  oneSideOpen ${Math.round(100 * vp.oneSide / vp.n)}%  bothOpen ${Math.round(100 * vp.bothSides / vp.n)}%  | open rungs/choice ${(vp.openCount / vp.n).toFixed(1)}  | reversals present ${Math.round(100 * vp.revPresent / vp.n)}% open ${Math.round(100 * vp.revOpen / vp.n)}% WON ${Math.round(100 * vp.revWon / vp.n)}%`);
    }
    if (slowScope.n) {
        const pct = {};
        for (const k of Object.keys(slowScope)) if (k !== 'n') pct[k] = Math.round(100 * slowScope[k] / slowScope.n) + '%';
        console.log(`hard-zone scope at slow-static choices (n=${slowScope.n}, % TRUE):`, JSON.stringify(pct));
    }
})();
