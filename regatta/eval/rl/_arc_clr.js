// ARCTIC CLEARANCE-DEMAND MEASUREMENT (P0 measure-first, 2026-08-08 push).
// The router's PAD 8 ≈ 400u desired clearance vs the human's revealed ~200u
// (26 laps, med 200u from floe edges, 6.2% of race < 50u — _ice_exposure.py).
// One physical line, three questions, all from the router's OWN output in a
// SOLO arctic race (no traffic, same setup as _arc_solo):
//   1. Clearance histogram along pathSailable's CHOSEN routes (plan-time floe
//      positions, sampled every 30u) vs along the boat's SAILED track — does
//      the router demand ~2x the clearance she sails?
//   2. REFUSED LEADS: per plan, the straight from→to line's min floe clearance
//      (land-free lines only). A straight option with ≥150u of floe clearance
//      that the router answers with a ≥1.3x-length route is a refused lead.
//   3. The _soft===1 "opening lead" ×2.5 bet: every route point planned through
//      an opening-lead cell is a bet that the water clears by arrival. Resolve
//      each bet when the boat first comes within 50u (WIN = point clear of
//      floes, FAIL = still inside a floe) or mark it abandoned (replanned away).
// Clearance definition MATCHES _ice_exposure.py: signed distance to the nearest
// floe edge among floes within 1200u (poly hulls exact, circles r-dist).
//   node _arc_clr.js <trials> <seed0> <tree>
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const TRIALS = parseInt(process.argv[2]) || 4;
const SEED0 = parseInt(process.argv[3]) || 9100;
const ROOT = path.join(__dirname, process.argv[4] || 'treeHD9');
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.addInitScript(() => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'arctic' })); });
    // NEUTRAL BOT (owner-directed 2026-08-08). This probe promotes bots[0] to
    // hero, and bots[0] is a DIFFERENT CHARACTER per seed (9100 Fathom, 9101
    // Nimbus, 9102 Anvil...). Paired deltas are unaffected — the pair shares the
    // character — but every ABSOLUTE number this probe reports ("the solo bot
    // sails 1.6-2.5x her rhumb", "leg-1 tacks 21-23 against her 5") was a mixed
    // roster draw measured against her ONE unmodified boat. Strip the sailor:
    // identical stats and no archetype persona for every rival, at the shipped
    // difficulty (AI_STAT_BONUS still on — that is a separate knob, `bonusOff`).
    await page.addInitScript(() => { window.__CHAR = { neutral: 1 }; });
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    // Instrument the router once per page: wrap pathSailable, log route + straight
    // line clearance profiles at plan time, and stage opening-lead bets.
    await page.evaluate(() => {
        const clrTo = (px, py) => {
            // signed distance to nearest floe edge among floes within 1200u
            let best = null;
            for (const f of (state.course._floeObjs || [])) {
                const cd = Math.hypot(px - f.x, py - f.y);
                if (f.vertices && f.vertices.length >= 3) {
                    let maxr = 0;
                    for (const v of f.vertices) maxr = Math.max(maxr, Math.hypot(v.x - f.x, v.y - f.y));
                    if (cd - maxr > 1200 || (best !== null && cd - maxr > best)) continue;
                    let d2 = Infinity;
                    const V = f.vertices, n = V.length;
                    let inside = false;
                    for (let i = 0, j = n - 1; i < n; j = i++) {
                        const ax = V[j].x, ay = V[j].y, bx = V[i].x, by = V[i].y;
                        const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy;
                        const t = L2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / L2)) : 0;
                        const ex = ax + t * dx, ey = ay + t * dy;
                        d2 = Math.min(d2, (px - ex) ** 2 + (py - ey) ** 2);
                        if ((V[i].y > py) !== (V[j].y > py)) {
                            const xin = (V[j].x - V[i].x) * (py - V[i].y) / (V[j].y - V[i].y) + V[i].x;
                            if (px < xin) inside = !inside;
                        }
                    }
                    const d = Math.sqrt(d2) * (inside ? -1 : 1);
                    if (d < 1200 && (best === null || d < best)) best = d;
                } else {
                    const d = cd - (f.radius || 0);
                    if (d < 1200 && (best === null || d < best)) best = d;
                }
            }
            return best;   // null = no floe within 1200u
        };
        window.__clrTo = clrTo;
        const orig = window.SailCheck.pathSailable;
        window.SailCheck.pathSailable = function (grid, from, to) {
            const out = orig(grid, from, to);
            const L = window.__clrLog;
            if (!L || !out || out.length < 2) return out;
            // sample the chosen route every 30u
            let routeLen = 0;
            for (let i = 1; i < out.length; i++) {
                const ax = out[i - 1][0], ay = out[i - 1][1], bx = out[i][0], by = out[i][1];
                const seg = Math.hypot(bx - ax, by - ay);
                routeLen += seg;
                const nSamp = Math.max(1, Math.floor(seg / 30));
                for (let s = 0; s < nSamp; s++) {
                    const t = (s + 0.5) / nSamp;
                    const c = clrTo(ax + t * (bx - ax), ay + t * (by - ay));
                    if (c !== null) L.routeClr.push(Math.round(c));
                }
            }
            // straight-line alternative
            const sx = from[0], sy = from[1], gx2 = to[0], gy2 = to[1];
            const straight = Math.hypot(gx2 - sx, gy2 - sy);
            if (straight > 200) {
                let minC = Infinity, landBlocked = false;
                const gS = state.course._botGridStatic;
                const nS = Math.max(2, Math.floor(straight / 30));
                for (let s = 0; s < nS; s++) {
                    const t = (s + 0.5) / nS;
                    const wx = sx + t * (gx2 - sx), wy = sy + t * (gy2 - sy);
                    const c = clrTo(wx, wy);
                    if (c !== null && c < minC) minC = c;
                    if (gS) { const cc = gS.cell(wx, wy); if (!gS.at(cc[0], cc[1])) landBlocked = true; }
                }
                L.plans.push({ ratio: +(routeLen / straight).toFixed(2), straight: Math.round(straight),
                    minC: minC === Infinity ? null : Math.round(minC), landBlocked });
            }
            // opening-lead bets: route points in _soft===1 cells
            if (grid._soft) {
                for (const p of out) {
                    const cc = grid.cell(p[0], p[1]);
                    const id = cc[1] * grid.n + cc[0];
                    if (cc[0] >= 0 && cc[1] >= 0 && cc[0] < grid.n && cc[1] < grid.n && grid._soft[id] === 1) {
                        if (L.bets.length < 4000) L.bets.push({ x: p[0], y: p[1], t: state.race.timer, res: null });
                    }
                }
            }
            return out;
        };
    });
    const races = [];
    for (let i = 0; i < TRIALS; i++) {
        const seed = SEED0 + i;
        const r = await page.evaluate(async (seed) => {
            window.evalHarness.seed = seed;
            window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const bots = state.boats.filter(b => !b.isPlayer);
            const pl = state.boats.find(b => b.isPlayer); pl.x = 1e6; pl.y = 1e6;
            const hero = bots[0];
            for (let k = 1; k < bots.length; k++) { bots[k].x = 1e6 + k * 500; bots[k].y = 1e6; bots[k].raceState.finished = true; }
            const L = window.__clrLog = { routeClr: [], plans: [], bets: [], trackClr: [] };
            const dt = 1 / 60; let fr = 0; let fin = null;
            for (let it = 0; it < 60 * 900; it++) {
                window.update(dt);
                if (state.race.status === 'finished') break;
                if (state.race.status !== 'racing') continue;
                const t = state.race.timer;
                if (t > 880) break;
                fr = (fr + 1) % 6;
                if (fr !== 0) continue;
                const c = window.__clrTo(hero.x, hero.y);
                if (c !== null) L.trackClr.push(Math.round(c));
                // resolve opening-lead bets the boat has arrived at
                for (const b of L.bets) {
                    if (b.res !== null) continue;
                    if (Math.hypot(hero.x - b.x, hero.y - b.y) < 50) {
                        const cb = window.__clrTo(b.x, b.y);
                        b.res = (cb !== null && cb < 0) ? 'FAIL' : 'WIN';
                    } else if (t - b.t > 120) b.res = 'ABANDONED';
                }
                if (hero.raceState.finished && fin == null) { fin = +t.toFixed(1); break; }
            }
            window.__clrLog = null;   // stop logging between races
            const pct = (v, p) => { if (!v.length) return null; const s = [...v].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(s.length * p / 100))]; };
            const hist = (v) => { const h = {}; for (const th of [0, 50, 100, 200, 400]) h['<' + th] = +(100 * v.filter(x => x < th).length / (v.length || 1)).toFixed(1); return h; };
            const bets = { win: 0, fail: 0, abandoned: 0, open: 0 };
            for (const b of L.bets) { if (b.res === 'WIN') bets.win++; else if (b.res === 'FAIL') bets.fail++; else if (b.res === 'ABANDONED') bets.abandoned++; else bets.open++; }
            const refused = L.plans.filter(p => !p.landBlocked && p.minC !== null && p.minC >= 150 && p.ratio >= 1.3).length;
            const straightOK = L.plans.filter(p => !p.landBlocked && p.minC !== null && p.minC >= 150).length;
            return {
                seed, fin, name: hero.name,
                route: { n: L.routeClr.length, med: pct(L.routeClr, 50), p25: pct(L.routeClr, 25), p75: pct(L.routeClr, 75), hist: hist(L.routeClr) },
                track: { n: L.trackClr.length, med: pct(L.trackClr, 50), p25: pct(L.trackClr, 25), p75: pct(L.trackClr, 75), hist: hist(L.trackClr) },
                plans: { n: L.plans.length, ratioMed: pct(L.plans.map(p => p.ratio), 50), ratioP90: pct(L.plans.map(p => p.ratio), 90),
                         straightOK, refused },
                bets
            };
        }, seed);
        races.push(r);
        console.log('seed', seed, 'fin', r.fin,
            '\n  ROUTE clr med', r.route.med, 'p25', r.route.p25, 'hist', JSON.stringify(r.route.hist), '(n', r.route.n + ')',
            '\n  TRACK clr med', r.track.med, 'p25', r.track.p25, 'hist', JSON.stringify(r.track.hist), '(n', r.track.n + ')',
            '\n  PLANS', r.plans.n, 'lenRatio med', r.plans.ratioMed, 'p90', r.plans.ratioP90,
            'straight-had-150u+', r.plans.straightOK, 'REFUSED(ratio>=1.3)', r.plans.refused,
            '\n  OPENING-LEAD BETS', JSON.stringify(r.bets));
    }
    const med = a => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };
    console.log('\nSUMMARY over', races.length, 'solo races: fin med', med(races.map(r => r.fin).filter(x => x != null)));
    console.log('  route clr med (per-race meds):', races.map(r => r.route.med).join(' '));
    console.log('  track clr med (per-race meds):', races.map(r => r.track.med).join(' '));
    console.log('  HUMAN REF (_ice_exposure.py): clearance med 200u, 6.2% of race < 50u, p25 ~100u.');
    const bw = races.reduce((a, r) => a + r.bets.win, 0), bf = races.reduce((a, r) => a + r.bets.fail, 0), ba = races.reduce((a, r) => a + r.bets.abandoned, 0);
    console.log('  bets pooled: win', bw, 'fail', bf, 'abandoned', ba,
        ' fail share of resolved', bw + bf ? (100 * bf / (bw + bf)).toFixed(0) + '%' : '-');
    await browser.close();
})();
