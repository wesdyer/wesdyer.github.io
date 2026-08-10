// BAY NDET HUNT step 3: deep state diff. Boats diverge (boat 5, frame 2257)
// with equal RNG counts, identical wind, no wall-clock in the update tree =>
// some deep state differed at reset and manifests late. Serialize the whole
// state tree (cycle-safe, skipping DOM/functions) in two processes at reset
// and at a pre-divergence frame; print divergent paths.
// node _bay_ndet3.js <seed> <captureFrame> [venue]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const SEED = parseInt(process.argv[2]) || 90210;
const CAP = parseInt(process.argv[3]) || 2250;
const VENUE = process.argv[4] || 'bay';
const ROOT = path.resolve(__dirname, '..', '..', '..');

const runRace = async (page, seed, cap) => page.evaluate(async ({ seed, cap }) => {
    window.evalHarness.seed = seed;
    window.resetGame(); window.startRace();
    const ser = (root) => {
        const seen = new WeakSet();
        const walk = (v, depth) => {
            if (v === null || typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean' || v === undefined) {
                return typeof v === 'number' ? (Number.isFinite(v) ? +v.toPrecision(12) : String(v)) : v;
            }
            if (typeof v === 'function') return '[fn]';
            if (typeof v !== 'object') return String(v);
            if (seen.has(v)) return '[cycle]';
            if (depth > 9) return '[deep]';
            if (v instanceof HTMLElement || v instanceof CanvasRenderingContext2D || (window.Image && v instanceof Image)) return '[dom]';
            if (v instanceof Float32Array || v instanceof Float64Array || v instanceof Uint8Array || v instanceof Int32Array || v instanceof Uint16Array || v instanceof Int8Array || v instanceof Uint32Array) {
                let h = 0; for (let i = 0; i < v.length; i++) { h = (h * 31 + Math.round(v[i] * 1e6)) | 0; }
                return `[ta:${v.length}:${h}]`;
            }
            seen.add(v);
            if (Array.isArray(v)) { const out = v.map(x => walk(x, depth + 1)); seen.delete(v); return out; }
            if (v instanceof Map) { const out = {}; for (const [k, val] of v) out['M:' + String(k)] = walk(val, depth + 1); seen.delete(v); return out; }
            if (v instanceof Set) { const out = [...v].map(x => walk(x, depth + 1)); seen.delete(v); return out; }
            const out = {};
            for (const k of Object.keys(v)) {
                if (k === 'el' || k === 'img' || k === 'canvas' || k === 'ctx' || k === 'sub' || k === 'gray') { out[k] = '[skip]'; continue; }
                try { out[k] = walk(v[k], depth + 1); } catch (e) { out[k] = '[err]'; }
            }
            seen.delete(v);
            return out;
        };
        return walk(root, 0);
    };
    const snap0 = ser({ course: state.course, wind: state.wind, race: state.race, boats: state.boats });
    const dt = 1 / 60;
    for (let it = 0; it <= cap; it++) window.update(dt);
    const b5 = state.boats[5];
    const snap1 = ser({ b5: b5, ctl: b5 && b5.controller, planner: state._dmcPlanner ? '[planner-present]' : null });
    return { snap0: JSON.stringify(snap0), snap1: JSON.stringify(snap1) };
}, { seed, cap });

const mkBrowserPage = async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.addInitScript((v) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })); }, VENUE);
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    return { browser, page };
};

// recursive diff of parsed JSON, print first 30 divergent paths
function diff(a, b, p, out) {
    if (out.length >= 30) return;
    if (typeof a !== typeof b) { out.push(`${p}: TYPE ${typeof a} vs ${typeof b}`); return; }
    if (a === null || typeof a !== 'object') {
        if (a !== b) out.push(`${p}: ${JSON.stringify(a)} vs ${JSON.stringify(b)}`);
        return;
    }
    const ka = Object.keys(a), kb = Object.keys(b);
    if (ka.length !== kb.length) out.push(`${p}: keycount ${ka.length} vs ${kb.length}`);
    for (const k of ka) { if (!(k in b)) { out.push(`${p}.${k}: only in A`); continue; } diff(a[k], b[k], `${p}.${k}`, out); }
    for (const k of kb) if (!(k in a)) out.push(`${p}.${k}: only in B`);
}

(async () => {
    const a = await mkBrowserPage(); const ra = await runRace(a.page, SEED, CAP); await a.browser.close();
    const b = await mkBrowserPage(); const rb = await runRace(b.page, SEED, CAP); await b.browser.close();
    console.log('=== RESET-STATE DIFF ===');
    const out0 = [];
    diff(JSON.parse(ra.snap0), JSON.parse(rb.snap0), 'state', out0);
    console.log(out0.length ? out0.join('\n') : '  identical');
    console.log(`\n=== FRAME-${CAP} BOAT5 DIFF ===`);
    const out1 = [];
    diff(JSON.parse(ra.snap1), JSON.parse(rb.snap1), 'f', out1);
    console.log(out1.length ? out1.join('\n') : '  identical');
})();
