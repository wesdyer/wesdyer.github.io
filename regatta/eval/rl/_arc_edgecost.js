// WHICH COST TERM BUYS THE +40%? For every pathSailable call a solo Glacier
// Sound boat makes on its racing legs, compare the CHOSEN route with the
// GEODESIC (unweighted shortest sailable path between the same endpoints,
// same passability incl. soft cells) — and price BOTH under the router's own
// cost model, decomposed per term. The term that inflates the geodesic's
// modeled cost above the chosen route's is the one that buys the berth.
//   node _arc_edgecost.js <tree> [seed] [maxPlans]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const ROOT = path.join(__dirname, process.argv[2] || 'treeCMB');
const SEED = parseInt(process.argv[3]) || 9400;
const MAXP = parseInt(process.argv[4]) || 14;
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    await page.evaluate((v) => localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })), 'arctic');
    const out = await page.evaluate(async ({ seed, maxP }) => {
        window.evalHarness.seed = seed; window.resetGame(); window.startRace();
        state.course.cutoff = 900;
        const bots = state.boats.filter(b => !b.isPlayer);
        const solo = bots[0];
        for (const o of state.boats) if (o !== solo) {
            o.x = 1e6; o.y = 1e6; o.raceState.finished = true; o.fadeTimer = 0;
        }
        const caps = [];
        const orig = window.SailCheck.pathSailable;
        window.SailCheck.pathSailable = function (grid, from, to) {
            const res = orig(grid, from, to);
            if (res && caps.length < maxP && state.race.status === 'racing'
                && solo.raceState.leg >= 1 && !solo.raceState.finished) {
                caps.push({ from: [...from], to: [...to], route: res.map(p => [...p]),
                    leg: solo.raceState.leg, t: +state.race.timer.toFixed(1),
                    gridRef: grid });
            }
            return res;
        };
        const dt = 1 / 60;
        for (let it = 0; it < 60 * 940; it++) {
            window.update(dt);
            if (state.race.status === 'finished' || solo.raceState.finished) break;
            if (state.race.status === 'racing' && state.race.timer > 900) break;
            if (caps.length >= maxP) break;
        }
        window.SailCheck.pathSailable = orig;

        // ── analysis per captured plan ──
        const L = [];
        for (const cap of caps) {
            const grid = cap.gridRef;
            const N = grid.n;
            if (!grid._clear && window.SailCheck) grid._clear = window.SailCheck.clearanceField(grid);
            const clear = grid._clear;
            const soft = grid._soft;
            const okC = (i, j) => grid.at(i, j) || (soft && i >= 0 && j >= 0 && i < N && j < N && soft[j * N + i] > 0);
            // geodesic: uniform-cost A* over the same passability
            const snap = (wx, wy) => {
                const [ci, cj] = grid.cell(wx, wy);
                if (okC(ci, cj)) return [ci, cj];
                for (let r = 1; r <= 18; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
                    if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
                    if (okC(ci + di, cj + dj)) return [ci + di, cj + dj];
                }
                return null;
            };
            const s = snap(cap.from[0], cap.from[1]), g = snap(cap.to[0], cap.to[1]);
            if (!s || !g) continue;
            const size = N * N;
            const gs = new Float64Array(size).fill(Infinity);
            const prev = new Int32Array(size).fill(-1);
            const si = s[1] * N + s[0], gi = g[1] * N + g[0];
            const gx = gi % N, gy = (gi - gx) / N;
            const heap = [[Math.hypot(si % N - gx, ((si - si % N) / N) - gy), si]];
            gs[si] = 0;
            const NB8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
            while (heap.length) {
                heap.sort((a, b) => a[0] - b[0]);
                const [f, cur] = heap.shift();
                if (cur === gi) break;
                const ci = cur % N, cj = (cur - ci) / N;
                for (const [di, dj] of NB8) {
                    const a = ci + di, b = cj + dj;
                    if (!okC(a, b)) continue;
                    if (di && dj && (!okC(a, cj) || !okC(ci, b))) continue;
                    const nid = b * N + a;
                    const cand = gs[cur] + (di && dj ? Math.SQRT2 : 1);
                    if (cand < gs[nid] - 1e-6) {
                        gs[nid] = cand; prev[nid] = cur;
                        heap.push([cand + Math.hypot(a - gx, b - gy), nid]);
                    }
                }
            }
            if (prev[gi] === -1 && gi !== si) continue;
            const geo = [];
            let cur = gi;
            while (cur !== si) { const ci = cur % N; geo.push([ci, (cur - ci) / N]); cur = prev[cur]; }
            geo.push(s); geo.reverse();

            // price a cell path under the router's model, decomposed.
            // Mirrors pathSailable's terms; TF table via SailCheck internals is
            // not exported, so TIME is approximated as distance (the time base
            // is common to both paths' comparison of HINT terms; hint shares
            // are exact, base shares approximate).
            const price = (cells) => {
                const PAD = 8;
                let steps = 0, base = 0, narrowC = 0, leeC = 0, floeC = 0, softC = 0, jamC = 0;
                for (let k = 1; k < cells.length; k++) {
                    const [a, b] = cells[k];
                    const di = a - cells[k - 1][0], dj = b - cells[k - 1][1];
                    const sl = Math.hypot(di, dj) || 1;
                    const nid = b * N + a;
                    const c = clear[nid];
                    const isSoft = !grid.at(a, b);
                    const narrow = c >= PAD ? 0 : (PAD - c) / PAD;
                    let extra = 1.0 * narrow, eN = 1.0 * narrow, eL = 0, eF = 0;
                    if (grid._leeW) { eL = Math.min(0.7, grid._leeW[nid] * 0.28); extra += eL; }
                    if (grid._floeRisk && grid._floeRisk[nid]) { eF = 0.55; extra += eF; }
                    const cap12 = Math.min(1.2, extra);
                    const scale = extra > 0 ? cap12 / extra : 0;
                    let w = 1 + cap12;
                    let sMul = 1, jMul = 1;
                    if (isSoft) { sMul = (soft[nid] === 1 ? 2.5 : 6); w *= sMul; }
                    if (grid._jam && grid._jam[nid]) { jMul = Math.min(6, 1.5 + 1.5 * grid._jam[nid]); w *= jMul; }
                    const step = sl * w;
                    steps += sl; base += sl;
                    narrowC += sl * eN * scale * (sMul * jMul);
                    leeC += sl * eL * scale * (sMul * jMul);
                    floeC += sl * eF * scale * (sMul * jMul);
                    softC += sl * (1 + cap12) * (sMul - 1) * jMul;
                    jamC += sl * (1 + cap12) * sMul * (jMul - 1);
                }
                return { steps, base, narrowC, leeC, floeC, softC, jamC,
                    total: base + narrowC + leeC + floeC + softC + jamC };
            };
            const routeCells = cap.route.map(p => grid.cell(p[0], p[1]));
            const pc = price(routeCells), pg = price(geo);
            L.push({ leg: cap.leg, t: cap.t,
                lenChosen: +pc.steps.toFixed(0), lenGeo: +pg.steps.toFixed(0),
                ratio: +(pc.steps / Math.max(1, pg.steps)).toFixed(2),
                chosen: pc, geo: pg });
        }
        return L;
    }, { seed: SEED, maxP: MAXP });
    console.log('leg  t     lenC  lenG  ratio | GEO cost split (base/narrow/floe/soft/jam)  | CHOSEN split | geoTotal vs chosenTotal');
    for (const r of out) {
        const f = (p) => `${p.base.toFixed(0)}/${p.narrowC.toFixed(0)}/${p.floeC.toFixed(0)}/${p.softC.toFixed(0)}/${p.jamC.toFixed(0)}`;
        console.log(String(r.leg).padStart(3), String(r.t).padStart(6),
            String(r.lenChosen).padStart(5), String(r.lenGeo).padStart(5), String(r.ratio).padStart(6),
            '|', f(r.geo).padEnd(28), '|', f(r.chosen).padEnd(24),
            '|', r.geo.total.toFixed(0), 'vs', r.chosen.total.toFixed(0),
            r.geo.total > r.chosen.total ? ' <- model prefers the detour' : ' <- GEODESIC CHEAPER UNDER OWN MODEL?!');
    }
    await browser.close();
})();
