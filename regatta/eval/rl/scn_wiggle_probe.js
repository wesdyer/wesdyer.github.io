// P1 measurement — arctic stuck-recovery latency, classical tree, ALL wiggle
// scenes. On restore the controller is FRESH (lowSpeedTimer 0, no wiggle), so
// each scene re-lives detection from scratch: where does the 10-18s go?
//   - time to first wiggle activation (detector latency proper)
//   - time spent in the hysteresis DEAD BAND (1.0 <= kt < 2.5: timer frozen,
//     wiggle can never trigger) before recovery
//   - wiggle bursts before recovery; side flips
//   - time to sustained recovery (kt > 2.5 held 3s) and progress made
//   node scn_wiggle_probe.js [tree] [pages]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const { SHARED_SRC, SCN_SRC } = require('./scn_shared.js');
const ROOT = path.join(__dirname, process.argv[2] || 'treePH0');
const PAGES = parseInt(process.argv[3] || '4');
const OUTDIR = path.join(__dirname, 'scn_pool');
const WIN = 40;
const TRACE_SRC = `
window.__wigTrace = (scene, WIN) => {
    const ego = window.__scnRestore(scene);
    if (!ego) return null;
    window.__rltUninstall();
    const prog0 = window.__scnProgress(ego);
    const t0 = state.race.timer;
    const dt = 1 / 60;
    const tr = [];
    let lastS = -1;
    for (let it = 0; it < Math.ceil(60 * WIN) + 5; it++) {
        window.update(dt);
        const t = state.race.timer - t0;
        if (t >= WIN) break;
        if (ego.raceState.finished) break;
        if (t - lastS >= 0.25) {
            lastS = t;
            const c = ego.controller || {};
            tr.push([+t.toFixed(2), +(ego.speed * 4).toFixed(2),
                     c.wiggleActive ? 1 : 0, +(c.lowSpeedTimer || 0).toFixed(1),
                     c.wiggleFails || 0, c.wiggleSide || 0,
                     c.livenessState === 'normal' ? 0 : (c.livenessState === 'recovery' ? 1 : 2),
                     +(window.__scnProgress(ego) - prog0).toFixed(1)]);
        }
    }
    return { id: scene.id, tr, prog: +(window.__scnProgress(ego) - prog0).toFixed(1) };
};
`;
async function makePage(browser) {
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 200)));
    await page.addInitScript(() => {
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'arctic' }));
    });
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    await page.addScriptTag({ content: SHARED_SRC });
    await page.addScriptTag({ content: SCN_SRC });
    await page.addScriptTag({ content: TRACE_SRC });
    return page;
}
(async () => {
    const scenes = [];
    for (const f of fs.readdirSync(OUTDIR).filter(x => x.startsWith('scenes_')).sort()) {
        for (const s of JSON.parse(fs.readFileSync(path.join(OUTDIR, f), 'utf8'))) {
            if (s.cls !== 'wiggle') continue;
            s.id = `${s.seed}:${s.t}:${s.ego.name}`;
            scenes.push(s);
        }
    }
    console.log(`wiggle scenes: ${scenes.length}`);
    const browser = await chromium.launch();
    const pages = [];
    for (let i = 0; i < PAGES; i++) pages.push(await makePage(browser));
    const out = [];
    let next = 0;
    await Promise.all(pages.map(async (_p, slot) => {
        while (next < scenes.length) {
            const s = scenes[next++];
            for (let a = 0; a < 3; a++) {
                try {
                    const r = await pages[slot].evaluate(([s, w]) => window.__wigTrace(s, w), [s, WIN]);
                    if (r) out.push(r);
                    break;
                } catch (e) {
                    try { await pages[slot].close(); } catch (e2) {}
                    pages[slot] = await makePage(browser);
                }
            }
        }
    }));
    fs.writeFileSync(path.join(__dirname, 'wiggle_trace.json'), JSON.stringify(out));
    // ---- aggregate ----
    const med = a => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return +s[Math.floor(s.length / 2)].toFixed(1); };
    const q90 = a => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return +s[Math.floor(s.length * 0.9)].toFixed(1); };
    const firstWig = [], recT = [], bursts = [], deadT = [], stuckLowT = [], progs = [];
    let recovered = 0, neverWig = 0, stillStuck = 0;
    for (const r of out) {
        const tr = r.tr;
        progs.push(r.prog);
        let fw = null, rec = null, nb = 0, dead = 0, low = 0, prevW = 0, sustain = 0;
        for (const [t, kt, wig, lowT, fails, side, live, prog] of tr) {
            if (wig && !prevW) { nb++; if (fw == null) fw = t; }
            prevW = wig;
            if (rec == null) {
                if (kt >= 1.0 && kt < 2.5 && !wig) dead += 0.25;
                if (kt < 1.0) low += 0.25;
                if (kt > 2.5) { sustain += 0.25; if (sustain >= 3) rec = t; }
                else sustain = 0;
            }
        }
        if (fw != null) firstWig.push(fw); else neverWig++;
        if (rec != null) { recT.push(rec); recovered++; } else stillStuck++;
        bursts.push(nb); deadT.push(dead); stuckLowT.push(low);
    }
    console.log(`\nn=${out.length} scenes, window ${WIN}s`);
    console.log(`recovered (kt>2.5 for 3s): ${recovered} (${(100 * recovered / out.length).toFixed(0)}%), still stuck at window end: ${stillStuck}`);
    console.log(`time-to-first-wiggle: med ${med(firstWig)}s p90 ${q90(firstWig)}s  (never wiggled: ${neverWig})`);
    console.log(`time-to-recovery:     med ${med(recT)}s p90 ${q90(recT)}s`);
    console.log(`wiggle bursts:        med ${med(bursts)} p90 ${q90(bursts)}`);
    console.log(`pre-recovery dead-band time (1-2.5kt, no wiggle): med ${med(deadT)}s p90 ${q90(deadT)}s`);
    console.log(`pre-recovery sub-1kt time: med ${med(stuckLowT)}s p90 ${q90(stuckLowT)}s`);
    console.log(`progress over window: med ${med(progs)}u p90 ${q90(progs)}u`);
    await browser.close();
})();
