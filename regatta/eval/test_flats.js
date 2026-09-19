// Spoonbill Flats' tide (js/tide.js) and its ladder of cuts (art/build_flats.js): the field,
// the passages' entry windows, what each cut is worth, the bots' nerve, a grounding and
// the drawing. Drives the real game in a headless page, like test_volcano.
//
//   node regatta/eval/test_flats.js            (from the repo root, like every suite)
//   node regatta/eval/test_flats.js --race     also races the nine bots once (~40 s)
//
// What has to hold (Wes, Sep 16 2026): every cut is sailable under some conditions; the easy
// ones (risk 1) are open long, the extreme ones (risk 3) need speed and timing, the rest sit
// between; a big cut is "open only for a brief time — enough to traverse at speed, but little
// more", which is a window a few seconds longer than the traverse and never shorter; the
// bigger the gamble the more it saves; a bot's nerve keeps it off rungs above it; a bar never
// shoals the channel it meets; a grounded hull refloats and is shoved toward the channel.
const { chromium } = require('playwright');
const path = require('path');
const RACE = process.argv.includes('--race');

let failures = 0;
const check = (name, cond, detail) => {
    console.log(`  ${cond ? 'ok   ' : 'FAIL '} ${name}${cond || !detail ? '' : ' — ' + detail}`);
    if (!cond) failures++;
};
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const errs = [];
    page.on('pageerror', e => errs.push(e.message.split('\n')[0]));
    await page.goto('file://' + path.resolve('regatta/index.html'));
    await page.evaluate(() => localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'flats', musicEnabled: false, soundEnabled: false, bgSoundEnabled: false })));
    await page.reload();
    await page.waitForTimeout(700);

    const r = await page.evaluate(() => {
        window.requestAnimationFrame = () => 0;
        let s = 90210;
        Math.random = () => { let t = s += 0x6D2B79F5; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
        const out = { problems: [] };
        resetGame(); startRace();
        for (let i = 0; i < 30; i++) update(1 / 60);
        const T = state.tide, doc = state.course.doc;
        out.active = !!T;
        if (!T) return out;
        out.period = T.period; out.draft = T.draft; out.free = T.free;
        out.passages = (T.passages || []).map(p => ({ id: p.id, risk: p.risk }));
        const level = (t) => T.mid + T.amp * Math.sin(2 * Math.PI * t / T.period + T.phase0);
        let tHW = 0, best = -9; for (let t = 0; t < T.period; t += 0.1) { const l = level(t); if (l > best) { best = l; tHW = t; } }
        const rel = (t) => { let q = t - tHW; while (q > T.period / 2) q -= T.period; while (q < -T.period / 2) q += T.period; return q; };

        // ── the field ──────────────────────────────────────────────────────────────────
        // A bar leaves the channel alone (head sill west end: inside the channel ribbon at
        // (-593,-6610) — it read -0.8 m once, a shoal in the channel's own width), except the
        // creek sill, laid across the creek on purpose.
        out.headSillInChannel = +Tide.groundAt(-593, -6610).toFixed(2);
        out.creekSillCrest = +Tide.groundAt(1250, -7150).toFixed(2);
        out.creekBedAway = +Tide.groundAt(1350, -6600).toFixed(2);
        // The channel is deep along the baked path; the marsh is never wet.
        const paths = doc.course && doc.course.paths;
        let deepest = -9, pathN = 0;
        if (paths) for (const k in paths) { const pth = paths[k].pts || paths[k]; if (!Array.isArray(pth)) continue; for (const q of pth) { const z = Tide.groundAt(q[0] != null ? q[0] : q.x, q[1] != null ? q[1] : q.y); if (z > deepest) deepest = z; pathN++; } }
        out.pathHighest = pathN ? +deepest.toFixed(2) : null; out.pathN = pathN;
        // (an island, not the shore ring — a concave ring's centroid is in the water)
        const marsh = doc.shapes.find(sh => sh.kind === 'flats-marsh' && sh.id === 'isle-upper') || doc.shapes.find(sh => sh.kind === 'flats-marsh' && sh.outer.length < 40);
        if (marsh) { const cx = marsh.outer.reduce((a, q) => a + q[0], 0) / marsh.outer.length, cy = marsh.outer.reduce((a, q) => a + q[1], 0) / marsh.outer.length; out.marshZ = +Tide.groundAt(cx, cy).toFixed(2); out.marshId = marsh.id; }

        // ── the windows: sail every passage from every entry second (eval/_flats_windows.js) ──
        const V = 110;     // u/s: a run at VMG angles, which every big cut here is (eval/_flats_windows.js)
        out.windows = [];
        for (const p of T.passages) {
            const samples = []; let sAcc = 0;
            for (let i = 1; i < p.pts.length; i++) {
                const a = p.pts[i - 1], b = p.pts[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(L / 10));
                for (let k = 0; k < n; k++) { const f = k / n; samples.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, Tide.groundAt(a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f), sAcc + L * f]); }
                sAcc += L;
            }
            let zmax = -99; for (const q of samples) if (q[2] > zmax) zmax = q[2];
            const run = (t0) => { let t = t0, minMul = 1; for (let i = 0; i < samples.length; i++) { const q = samples[i]; const d = level(t) - q[2]; if (d < T.draft) return null; const m = Tide.mulForDepth(d); if (m < minMul) minMul = m; const ds = i + 1 < samples.length ? samples[i + 1][3] - q[3] : 0; t += ds / (V * m); } return { t: t - t0, minMul }; };
            const iTimed = samples.findIndex(q => q[2] > T.mid - T.amp - T.draft);   // the first sample that ever dries: the cut's real entrance
            const runFull = (t0) => { let t = t0, minMul = 1, tAtTimed = null; for (let i = 0; i < samples.length; i++) { const q = samples[i]; if (i === iTimed) tAtTimed = t; const d = level(t) - q[2]; if (d < T.draft) return null; const m = Tide.mulForDepth(d); if (m < minMul) minMul = m; const ds = i + 1 < samples.length ? samples[i + 1][3] - q[3] : 0; t += ds / (V * m); } return { t: t - t0, minMul, tAtTimed }; };
            let ok = 0, fast = 0, tFast = null, fastFrom = null, arrTimed = null;
            for (let t0 = 0; t0 < T.period; t0 += 0.25) { const q = runFull(t0); if (!q) continue; ok += 0.25; if (q.minMul >= 0.85) { fast += 0.25; if (tFast == null || q.t < tFast) tFast = q.t; } }
            // the at-speed window as an arc, for its early edge relative to HW, and when that
            // earliest boat reaches the cut's entrance
            const N = Math.round(T.period / 0.25), on = new Uint8Array(N);
            for (let i = 0; i < N; i++) { const q = runFull(i * 0.25); if (q && q.minMul >= 0.85) on[i] = 1; }
            for (let i = 0; i < N; i++) if (on[i] && !on[(i + N - 1) % N]) { fastFrom = +rel(i * 0.25).toFixed(1); const q = runFull(i * 0.25); arrTimed = q && q.tAtTimed != null ? +rel(q.tAtTimed).toFixed(1) : null; break; }
            // the moment the entrance is at speed (mul 0.85 ~ 0.84 m over it)
            const need = (iTimed >= 0 ? samples[iTimed][2] : zmax) + T.draft + 0.34; let tFlood = null;
            for (let t = tHW - T.period / 2; t < tHW + T.period / 2; t += 0.1) if (level(t) >= need) { tFlood = +rel(t).toFixed(1); break; }
            out.windows.push({ id: p.id, risk: p.risk, len: Math.round(sAcc), zmax: +zmax.toFixed(2), afloat: ok, fast, traverse: tFast == null ? null : +tFast.toFixed(1), fastFrom, arrTimed, tFlood });
        }

        // ── the ladder: what a cut saves against the channel it bypasses (router polar time) ──
        const c = state.course, base = c._botGridStatic || c.botGrid, safe = Tide.safeGrid(base);
        const HWl = T.mid + T.amp, keep = { mid: T.mid, amp: T.amp };
        const distToLine = (x, y, pts) => { let d = 1e9; for (let i = 1; i < pts.length; i++) { const ax = pts[i-1][0], ay = pts[i-1][1], bx = pts[i][0], by = pts[i][1]; const vx = bx-ax, vy = by-ay, L2 = vx*vx+vy*vy||1; let u = ((x-ax)*vx+(y-ay)*vy)/L2; u = Math.max(0, Math.min(1, u)); d = Math.min(d, Math.hypot(x-ax-u*vx, y-ay-u*vy)); } return d; };
        T.mid = 5; T.amp = 0;
        Tide.setNerve(3);
        out.ladder = [];
        for (const p of T.passages) {
            const A = p.pts[0], B = p.pts[p.pts.length - 1];
            const pc = SailCheck.pathSailable(safe, A, B);
            const N = safe.n, nav = safe.nav.slice();
            for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const k = j * N + i; if (!nav[k] && base.nav[k] && base._elev[k] <= HWl - T.draft - 0.34) { const [wx, wy] = base.world(i, j); if (distToLine(wx, wy, p.pts) <= 320) nav[k] = 1; } }
            const open = Object.assign({}, safe, { nav, _clear: null, _tight: null }); open.at = (i, j) => (i < 0 || j < 0 || i >= N || j >= N) ? 0 : nav[j * N + i];
            const po = SailCheck.pathSailable(open, A, B);
            const tOf = (pth) => pth && pth.times ? pth.times[pth.times.length - 1] : null;
            out.ladder.push({ id: p.id, risk: p.risk, saves: tOf(pc) != null && tOf(po) != null ? +(tOf(pc) - tOf(po)).toFixed(1) : null });
        }
        T.mid = keep.mid; T.amp = keep.amp;

        // ── the nerve: the same leg routed at each rung, at HW-15 when the cuts are open ──
        state.race.status = 'racing';           // the clock runs backward through the prestart
        state.race.timer = tHW + T.period - 15;
        const G = c.botGrid;
        out.riskCounts = [0, 0, 0, 0]; for (let k = 0; k < G.n * G.n; k++) if (base.nav[k]) out.riskCounts[G._risk[k]]++;
        out.nerveRoutes = {};
        for (const nv of [0, 1, 2, 3]) {
            Tide.setNerve(nv);
            const pth = SailCheck.pathSailable(G, [-1100, 100], [-600, -10750]);
            if (!pth) { out.nerveRoutes[nv] = null; continue; }
            let maxRisk = 0; for (const q of pth) { const cc = G.cell(q[0], q[1]); const rk = G._risk[cc[1] * G.n + cc[0]]; if (rk > maxRisk) maxRisk = rk; }
            out.nerveRoutes[nv] = { t: +pth.times[pth.times.length - 1].toFixed(1), maxRisk };
        }
        Tide.setNerve(3);
        // a boat standing on rung-3 ground plans off it, but not far across it
        Tide.setNerve(1, -700, -5300, 3, Tide.escapeReach(G, -700, -5300, 1));
        const esc = SailCheck.pathSailable(G, [-700, -5300], [-600, -10750]);
        out.escape = esc ? { n: esc.length, r3cells: esc.filter(q => { const cc = G.cell(q[0], q[1]); return G._risk[cc[1] * G.n + cc[0]] === 3; }).length, r3tail: esc.slice(24).filter(q => { const cc = G.cell(q[0], q[1]); return G._risk[cc[1] * G.n + cc[0]] === 3; }).length } : null;
        Tide.setNerve(3);

        // ── a grounding: the player set on the flats at low water refloats on the flood ──
        state.race.timer = tHW + T.period / 2;   // low water
        const me = state.boats.find(b => b.isPlayer);
        const gx = -1600, gy = -2000;             // the west bend's interior, ground about -0.5
        out.groundZ = +Tide.groundAt(gx, gy).toFixed(2);
        me.x = gx; me.y = gy; me.aground = false; me.speed = 2; me.heading = 0;
        me.velocity = me.velocity || { x: 0, y: 0 };
        Tide.afterMove(me, gx - 1, gy, 1 / 60);   // the move onto the mud
        out.agroundAtLW = !!me.aground;
        const d0 = Math.hypot(me.x - gx, me.y - gy);
        let refloatAt = null; const t0 = state.race.timer;
        out.agroundDepth0 = +Tide.depthAt(me.x, me.y).toFixed(2);
        for (let f = 0; f < 60 * 40 && me.aground; f++) { state.race.timer += 1 / 60; Tide.afterMove(me, me.x, me.y, 1 / 60); }
        out.agroundDepth1 = +Tide.depthAt(me.x, me.y).toFixed(2); out.agroundLevel1 = +Tide.level().toFixed(2);
        if (!me.aground) refloatAt = +(state.race.timer - t0).toFixed(1);
        out.refloatAfter = refloatAt; out.shoved = +Math.hypot(me.x - gx, me.y - gy).toFixed(0);
        out.shovedDeeper = Tide.groundAt(me.x, me.y) < out.groundZ;
        out.hud = Tide.hudInfo ? Tide.hudInfo(me) : null;

        // ── the eelgrass: beds in the document, tufts scattered, drawn in the pass their cell is in ──
        const beds = c.islands.filter(i => i.veg === 'eelgrass');
        out.eelBeds = beds.length;
        if (beds.length) {
            const b0 = beds[0];
            state.race.status = 'racing';
            state.race.timer = tHW;                          // high water: the bed is under water
            state.camera.x = b0.x; state.camera.y = b0.y; state.camera.fx = b0.x; state.camera.fy = b0.y;
            const g = canvas.getContext('2d');
            try { draw(); } catch (e) { out.problems.push('draw@bed: ' + e.message); }
            const mats = b0._liveMats || [];
            out.eelTufts = mats.length;
            out.eelWetAtHW = mats.filter(m => Tide.depthAt(m.x, m.y) > 0.03).length;
            state.race.timer = tHW + T.period / 2;           // low water: the bed dries (it lies at about -1 m)
            out.eelWetAtLW = mats.filter(m => Tide.depthAt(m.x, m.y) > 0.03).length;
            out.eelMul = b0.shoalMul;                        // the drag inverted: the speed multiplier at the bed's heart
        }
        // ── drawing: the wet and dry passes, the minimap, at three states of the tide ──
        for (const tt of [tHW, tHW + T.period / 4, tHW + T.period / 2]) {
            state.race.timer = tt;
            state.camera.x = -1300; state.camera.y = -1200;
            try { draw(); } catch (e) { out.problems.push(`draw@${tt.toFixed(0)}: ${e.message}`); }
        }
        return out;
    });

    console.log('Spoonbill Flats');
    check('tide active on the flats', r.active);
    if (!r.active) { console.log(`\n${failures} failure(s)`); await browser.close(); process.exit(1); }
    check('no page errors', errs.length === 0 && r.problems.length === 0, [...errs, ...r.problems].slice(0, 3).join(' | '));

    console.log('the field');
    check('a bar leaves the channel alone (head sill west end)', r.headSillInChannel <= -1.5, `${r.headSillInChannel} m at (-593,-6610)`);
    check('the creek sill lies across the creek (overChannel), no shallower than the creek is priced', r.creekSillCrest >= -1.2 && r.creekSillCrest <= -0.6 && r.creekBedAway < -1.0, `crest ${r.creekSillCrest}, creek ${r.creekBedAway}`);
    check('the baked path is always afloat', r.pathHighest != null && r.pathHighest <= -1.5 - 0.1, `highest ground under the path ${r.pathHighest} (${r.pathN} pts)`);
    check('the marsh is never wet', r.marshZ != null && r.marshZ >= 1.0, `${r.marshZ}`);

    console.log('the passages (entry windows at 110 u/s; "fast" = drag mul >= 0.85 all the way)');
    for (const w of r.windows) {
        const tag = `${w.id.padEnd(11)} risk ${w.risk}  ${String(w.len).padStart(5)}u  high ${String(w.zmax).padStart(5)}  traverse ${String(w.traverse).padStart(5)}s  fast ${String(w.fast).padStart(5)}s from HW${w.fastFrom >= 0 ? '+' : ''}${w.fastFrom}  afloat ${String(w.afloat).padStart(5)}s  entrance floods at speed HW${w.tFlood >= 0 ? '+' : ''}${w.tFlood}, the earliest fast boat is there at HW${w.arrTimed >= 0 ? '+' : ''}${w.arrTimed}`;
        console.log('    ' + tag);
        check(`${w.id}: sailable at speed`, w.fast >= 5, `${w.fast}s of entry`);
        check(`${w.id}: afloat window contains the fast one`, w.afloat >= w.fast);
        if (w.risk === 1) check(`${w.id}: rung 1 is open long (>= 15 s)`, w.fast >= 15, `${w.fast}s`);
        if (w.risk === 2) check(`${w.id}: rung 2 sits between (10..18 s)`, w.fast >= 10 && w.fast <= 18, `${w.fast}s`);
        if (w.risk === 3) check(`${w.id}: rung 3 is the gamble (5..12 s)`, w.fast >= 5 && w.fast <= 12, `${w.fast}s`);
        // "enter the moment it floods": the earliest fast boat reaches the entrance within a
        // few seconds of it flooding at speed — no cut asks a boat to hover for ten seconds
        // at a flooded entrance before the far end will let it out
        if (w.tFlood != null && w.arrTimed != null) check(`${w.id}: going as the entrance floods works`, w.arrTimed - w.tFlood >= -1 && w.arrTimed - w.tFlood <= 8, `entrance at speed HW${w.tFlood}, the earliest fast boat arrives HW${w.arrTimed}`);
    }
    console.log('the ladder (router polar time saved against the channel)');
    for (const l of r.ladder) console.log(`    ${l.id.padEnd(11)} risk ${l.risk}  saves ${l.saves}s`);
    const byRisk = (k) => r.ladder.filter(l => l.risk === k && l.saves != null).map(l => l.saves);
    check('rung 3 saves the most (>= 20 s each)', byRisk(3).length && byRisk(3).every(v => v >= 20), byRisk(3).join(','));
    check('rung 2 saves 8..20 s', byRisk(2).length && byRisk(2).every(v => v >= 8 && v <= 20), byRisk(2).join(','));
    check('rung 1 saves 1..12 s', byRisk(1).length && byRisk(1).every(v => v >= 1 && v <= 12), byRisk(1).join(','));

    console.log('the bots\' nerve');
    console.log(`    risk cells: ${r.riskCounts.join(' / ')} (0 always wet, 1 corners, 2 cuts and the open flats, 3 gambles)`);
    check('every rung has cells', r.riskCounts.every(n => n > 0));
    const nr = r.nerveRoutes;
    check('nerve 0 stays in always-wet water', nr[0] && nr[0].maxRisk === 0, JSON.stringify(nr[0]));
    check('nerve 1 touches nothing above rung 1', nr[1] && nr[1].maxRisk <= 1, JSON.stringify(nr[1]));
    check('nerve 3 finds a faster way at HW-15 (the head cut)', nr[3] && nr[0] && nr[3].t < nr[0].t - 8, `nerve 3 ${nr[3] && nr[3].t}s vs nerve 0 ${nr[0] && nr[0].t}s`);
    check('a boat on rung-3 ground plans off it, not across it', r.escape && r.escape.n > 1 && r.escape.r3cells <= 20 && r.escape.r3tail === 0, JSON.stringify(r.escape));

    console.log('the eelgrass');
    check('beds in the document', r.eelBeds >= 4, `${r.eelBeds}`);
    check('a bed scatters tufts', r.eelTufts > 100, `${r.eelTufts}`);
    check('the bed is under water at high water', r.eelWetAtHW === r.eelTufts, `${r.eelWetAtHW} of ${r.eelTufts}`);
    check('and the water leaves part of it at low water', r.eelWetAtLW < r.eelTufts * 0.9, `${r.eelWetAtLW} of ${r.eelTufts} still wet`);
    check('a light tax at its heart (a leaf round the centreboard)', r.eelMul != null && r.eelMul >= 0.8 && r.eelMul < 1, `shoalMul ${r.eelMul}`);

    console.log('a grounding');
    check('the flats interior is intertidal', r.groundZ > -1.0 && r.groundZ < 1.0, `${r.groundZ} m`);
    check('a hull on the mud at low water is aground', r.agroundAtLW);
    check('it refloats on the flood', r.refloatAfter != null && r.refloatAfter > 1.5 && r.refloatAfter < 40, `${r.refloatAfter}s (depth ${r.agroundDepth0} -> ${r.agroundDepth1} at level ${r.agroundLevel1})`);
    check('the crew shoved it toward deeper ground', r.shoved > 10 && r.shovedDeeper, `${r.shoved}u, deeper ${r.shovedDeeper}`);
    check('the HUD reads the tide', r.hud && typeof r.hud === 'object', JSON.stringify(r.hud).slice(0, 80));

    if (RACE) {
        console.log('the fleet (one race, nine bots)');
        const race = await page.evaluate(async () => {
            resetGame(); startRace();
            const pl = state.boats.find(b => b.isPlayer); pl.x = 1e6; pl.y = 1e6;
            state.course.cutoff = 900;
            const bots = state.boats.filter(b => !b.isPlayer);
            const fin = bots.map(() => null), agN = bots.map(() => 0), last = bots.map(() => false);
            for (let it = 0; it < 60 * 400; it++) {
                update(1 / 60);
                if (state.race.status !== 'racing') continue;
                for (let k = 0; k < bots.length; k++) { const b = bots[k]; if (fin[k] == null && b.raceState.finished) fin[k] = state.race.timer; if (fin[k] == null && b.aground && !last[k]) agN[k]++; last[k] = !!b.aground; }
                if (fin.every(f => f != null)) break;
            }
            return bots.map((b, k) => ({ name: b.name, nerve: b.traits && b.traits.nerve, fin: fin[k], agN: agN[k] }));
        });
        for (const b of race.slice().sort((a, b) => (a.fin || 1e9) - (b.fin || 1e9))) console.log(`    ${b.fin == null ? '  DNF' : mmss(b.fin)}  ${b.name.padEnd(10)} nerve ${b.nerve}  aground ${b.agN}x`);
        const fins = race.map(b => b.fin).filter(x => x != null).sort((a, b) => a - b);
        check('every bot finishes', fins.length === race.length);
        check('the winner is under 3:30', fins.length && fins[0] < 210, fins.length ? mmss(fins[0]) : '');
        check('the median is under 4:00', fins.length && fins[fins.length >> 1] < 240, fins.length ? mmss(fins[fins.length >> 1]) : '');
        check('nobody grounds more than six times', race.every(b => b.agN <= 6), race.filter(b => b.agN > 6).map(b => `${b.name} ${b.agN}`).join(','));
    }

    console.log(`\n${failures === 0 ? 'PASS' : 'FAIL'} — ${failures} failure(s)`);
    await browser.close();
    process.exit(failures ? 1 : 0);
})();
