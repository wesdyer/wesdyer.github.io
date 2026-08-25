// THE ROUNDING-CRAFT CENSUS (2026-08-24 night, the rounding-craft + rights push).
// Owner raced 30 laps and reported: (1) OVER-ROUNDING — bots round further than
// needed instead of leaving the mark on the proper side and proceeding on a
// proper course; (2) NO ROUNDING PLANNING where the rounding is tight (redrock
// end of leg 2 = mark-6, lake end of leg 2 = mark-5).
//
// This measures every rounding episode on a venue with POSITION-DERIVED metrics
// computed identically for the fleet and for his fp-valid corpus laps, plus
// engine-flag diagnostics for the fleet only. Episode = (boat, round-leg L):
// window opens at first sample with d < 2.0*zone while on leg L, closes when
// leg > L and d > 2.0*zone receding (or +45 s after advance).
//   closest      closest approach to the mark (u)
//   ringTime     seconds spent within 1.5*zone during the window
//   ringDist     path length within 1.5*zone (u)
//   wMax         max winding in the REQUIRED direction since window open (rad)
//   excess       wMax - reqSweep (rad; positive = swept more than the leg asks)
//   beyond       max excursion past the mark AWAY from the next leg's target (u)
//   escapeTax    t(outside zone & receding, after earning 0.75*req) - t(earned)
//   wrongWay     winding 2 s after window open is negative (entered wrong way)
//   stuck        seconds under 20 u/s inside the window
// Fleet-only: tArm->tBank->tAdv engine times, sweepAtAdv, engine escape
// (tAdv - tBank), armed contact-frames proxy.
// Positions on both sides (standing rule 32); episodes not frames (rule 2);
// per-mark tables on MEANS for attribution (rule 26), medians beside them.
//   node _roundcraft.js <venue> <trials> <seed0> <tree>
// Writes _roundcraft_<venue>_<tree>.json with every episode row.
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path'); const vm = require('vm');
const VENUE = process.argv[2] || 'redrock';
const TRIALS = parseInt(process.argv[3]) || 3;
const SEED0 = parseInt(process.argv[4]) || 9400;
const TREE = process.argv[5] || 'treeN1';
const ROOT = path.join(__dirname, TREE);

// ── his fp-valid laps (same hash the game stamps: djb2 of the doc JSON) ──
const djb = (str) => { let h = 5381; for (let i = 0; i < str.length; i++) h = ((h * 33) ^ str.charCodeAt(i)) >>> 0; return h.toString(16) + ':' + str.length; };
const docFp = (p, v) => {
    const sandbox = { window: { VENUE_DOC: {} } };
    vm.createContext(sandbox);
    vm.runInContext(fs.readFileSync(p, 'utf8'), sandbox);
    const doc = sandbox.window.VENUE_DOC && sandbox.window.VENUE_DOC[v];
    return doc ? djb(JSON.stringify(doc)) : null;
};
const FP = docFp(path.resolve(__dirname, '../../assets/venues', VENUE + '.venue.js'), VENUE);

(async () => {
    const b = await chromium.launch(); const p = await b.newPage();
    p.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await p.addInitScript((v) => { localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })); }, VENUE);
    await p.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await p.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });

    // course geometry: every round leg + the next leg's endpoint (proper-course axis)
    const GEO = await p.evaluate(() => {
        window.evalHarness.seed = 1; window.resetGame(); window.startRace();
        const out = [];
        const route = state.course.route || [];
        for (let i = 0; i < route.length; i++) {
            const e = route[i];
            if (!e || e.kind !== 'round' || !e.mark) continue;
            let nx = null;
            const nleg = state.course.dmc && state.course.dmc.legs && state.course.dmc.legs[i + 1];
            if (nleg && nleg.pts && nleg.pts.length) nx = nleg.pts[nleg.pts.length - 1];
            out.push({ leg: i, x: e.mark.x, y: e.mark.y, zone: e.mark.zone, side: e.mark.side,
                       req: e.mark.reqSweep != null ? e.mark.reqSweep : null, next: nx });
        }
        return out;
    });
    if (!GEO.length) { console.log(VENUE + ': no rounding legs.'); await b.close(); return; }

    // ── shared episode engine (runs in node for his laps; mirrored in-page for the fleet) ──
    const mkEp = (g) => ({ open: false, done: false, t0: null, prevB: null, w: 0, wMax: 0, w2s: null,
        closest: 1e9, ring: 0, ringDist: 0, px: null, py: null, beyond: 0, stuck: 0,
        ringPost: 0, beyondPost: 0, stuckPost: 0,
        tEarn: null, tOut: null, prevD: null, advanced: false, tAdv: null });
    const stepEp = (E, g, t, x, y, dt, leg) => {
        const dx = x - g.x, dy = y - g.y, d = Math.hypot(dx, dy);
        const sgn = g.side === 'port' ? -1 : 1;
        if (!E.open) {
            if (leg === g.leg && d < g.zone * 2.0) { E.open = true; E.t0 = t; }
            else return;
        }
        if (E.done) return;
        const brg = Math.atan2(dy, dx);
        if (E.prevB != null) {
            let db = brg - E.prevB;
            while (db > Math.PI) db -= 2 * Math.PI;
            while (db < -Math.PI) db += 2 * Math.PI;
            E.w += db * sgn;
        }
        E.prevB = brg;
        if (E.w > E.wMax) E.wMax = E.w;
        if (E.w2s == null && t - E.t0 >= 2) E.w2s = E.w;
        if (d < E.closest) E.closest = d;
        const post = leg > g.leg;
        if (d < g.zone * 1.5) {
            E.ring += dt;
            if (post) E.ringPost += dt;
            if (E.px != null) E.ringDist += Math.hypot(x - E.px, y - E.py);
        }
        if (E.px != null) {
            const sp = Math.hypot(x - E.px, y - E.py) / dt;
            if (sp < 20) { E.stuck += dt; if (post) E.stuckPost += dt; }
        }
        if (g.next) {
            const nl = Math.hypot(g.next.x - g.x, g.next.y - g.y) || 1;
            const proj = -((dx * (g.next.x - g.x) + dy * (g.next.y - g.y)) / nl);
            if (proj > E.beyond) E.beyond = proj;
            if (post && proj > E.beyondPost) E.beyondPost = proj;
        }
        const req = g.req != null ? g.req : Math.PI / 2;
        if (E.tEarn == null && E.w >= req * 0.75) E.tEarn = t;
        if (leg > g.leg && !E.advanced) { E.advanced = true; E.tAdv = t; }
        if (E.tEarn != null && E.tOut == null && d > g.zone * 1.05 && E.prevD != null && d > E.prevD) E.tOut = t;
        if (E.advanced && ((d > g.zone * 2.0 && E.prevD != null && d > E.prevD) || (E.tAdv != null && t - E.tAdv > 45))) E.done = true;
        E.px = x; E.py = y; E.prevD = d;
    };
    const finEp = (E, g) => {
        if (!E.open) return null;
        const req = g.req != null ? g.req : Math.PI / 2;
        return { leg: g.leg, closest: Math.round(E.closest), ring: +E.ring.toFixed(1),
            ringDist: Math.round(E.ringDist), wMax: +E.wMax.toFixed(2), req: +req.toFixed(2),
            excess: +(E.wMax - req).toFixed(2), beyond: Math.round(E.beyond),
            escape: (E.tEarn != null && E.tOut != null) ? +(E.tOut - E.tEarn).toFixed(1) : null,
            wrongWay: E.w2s != null ? (E.w2s < -0.05 ? 1 : 0) : null,
            stuck: +E.stuck.toFixed(1), advanced: E.advanced ? 1 : 0,
            ringPost: +E.ringPost.toFixed(1), beyondPost: Math.round(E.beyondPost),
            stuckPost: +E.stuckPost.toFixed(1),
            armSpan: E.tAdv != null ? +(E.tAdv - E.t0).toFixed(1) : null };
    };

    // ── his corpus ──
    const HIS = [];
    const TD = path.join(__dirname, 'traj');
    for (const f of fs.readdirSync(TD).filter(x => x.startsWith('traj_' + VENUE + '_')).sort()) {
        const j = JSON.parse(fs.readFileSync(path.join(TD, f), 'utf8'));
        if (String(j.venueFingerprint) !== String(FP)) continue;
        const F = j.format, gi = (s, k) => s[F.indexOf(k)];
        const rows = j.samples.filter(s => gi(s, 'phase') === 1);
        const dts = [];
        for (let i = 1; i < rows.length; i++) { const d = Math.abs(gi(rows[i], 't') - gi(rows[i - 1], 't')); if (d > 0 && d < 1) dts.push(d); }
        dts.sort((a, c) => a - c); const DT = dts.length ? dts[Math.floor(dts.length / 2)] : 0.1;
        for (const g of GEO) {
            const E = mkEp(g);
            for (const s of rows) stepEp(E, g, gi(s, 't'), gi(s, 'x'), gi(s, 'y'), DT, gi(s, 'leg'));
            const r = finEp(E, g);
            if (r) HIS.push({ ...r, who: 'him', lap: f });
        }
    }

    // ── fleet ──
    const FLEET = [];
    for (let t = 0; t < TRIALS; t++) {
        const seed = SEED0 + t;
        const r = await p.evaluate(({ seed, GEO, epSrc }) => {
            const fns = eval('(' + epSrc + ')');
            window.evalHarness.seed = seed; window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const pl = state.boats.find(x => x.isPlayer); if (pl) { pl.x = 1e6; pl.y = 1e6; }
            const DT = 1 / 60;
            const eps = {}; const eng = {};
            for (let it = 0; it < 60 * 900; it++) {
                window.update(DT);
                if (state.race.status !== 'racing') { if (state.race.status === 'finished') break; continue; }
                const t = it * DT;
                for (const bo of state.boats) {
                    if (bo.isPlayer) continue;
                    const rs = bo.raceState;
                    for (const g of GEO) {
                        if (rs.leg < g.leg || rs.leg > g.leg + 1) continue;
                        const key = bo.name + ':' + g.leg;
                        const E = eps[key] || (eps[key] = fns.mkEp(g));
                        if (E.done) continue;
                        fns.stepEp(E, g, t, bo.x, bo.y, DT, rs.leg);
                        const N = eng[key] || (eng[key] = { tArm: null, tBank: null, tAdvE: null, swAdv: null });
                        if (rs.leg === g.leg) {
                            if (N.tArm == null && rs.roundArmed) N.tArm = t;
                            if (N.tBank == null && rs.roundBanked) N.tBank = t;
                            N.swLast = rs.roundSweep || 0;
                        } else if (N.tAdvE == null) { N.tAdvE = t; N.swAdv = N.swLast; }
                    }
                }
                if (state.race.status === 'racing' && state.race.timer > 895) break;
            }
            const out = [];
            for (const key of Object.keys(eps)) {
                const g = GEO.find(x => String(x.leg) === key.split(':')[1]);
                const r = fns.finEp(eps[key], g);
                if (!r) continue;
                const N = eng[key] || {};
                r.engEscape = (N.tBank != null && N.tAdvE != null) ? +(N.tAdvE - N.tBank).toFixed(1) : null;
                r.armLead = (N.tArm != null && N.tBank != null) ? +(N.tBank - N.tArm).toFixed(1) : null;
                r.swAdv = N.swAdv != null ? +N.swAdv.toFixed(2) : null;
                out.push(r);
            }
            return out;
        }, { seed, GEO, epSrc: `({ mkEp: ${mkEp.toString()}, stepEp: ${stepEp.toString()}, finEp: ${finEp.toString()} })` });
        for (const row of r) FLEET.push({ ...row, who: 'fleet', seed });
        console.log(`seed ${seed}: ${r.length} episodes`);
    }
    await b.close();

    fs.writeFileSync(path.join(__dirname, `_roundcraft_${VENUE}_${TREE}.json`), JSON.stringify({ VENUE, FP, GEO, HIS, FLEET }));

    // ── report ──
    const q = (a, pp) => { const v = a.filter(x => x != null && isFinite(x)); if (!v.length) return NaN; const s = v.slice().sort((x, y) => x - y); return s[Math.floor(pp * (s.length - 1))]; };
    const mn = a => { const v = a.filter(x => x != null && isFinite(x)); return v.length ? v.reduce((x, y) => x + y, 0) / v.length : NaN; };
    const D = r => (r * 180 / Math.PI).toFixed(0);
    console.log(`\n=== ${VENUE.toUpperCase()} ROUNDING-CRAFT CENSUS (fp ${FP}; his laps ${new Set(HIS.map(h => h.lap)).size}, fleet episodes ${FLEET.length}) ===`);
    for (const g of GEO) {
        const H = HIS.filter(x => x.leg === g.leg), Fl = FLEET.filter(x => x.leg === g.leg);
        console.log(`\nLEG ${g.leg} (${g.side} round, zone ${Math.round(g.zone)}, req ${D(g.req)}°) — him n=${H.length}, fleet n=${Fl.length} (advanced ${Fl.filter(x => x.advanced).length})`);
        const row = (label, k, fmt) => {
            const f = fmt || (v => isFinite(v) ? v.toFixed(1) : '—');
            console.log(`  ${label.padEnd(26)} him med ${f(q(H.map(x => x[k]), .5)).padStart(7)}  mean ${f(mn(H.map(x => x[k]))).padStart(7)}   fleet med ${f(q(Fl.map(x => x[k]), .5)).padStart(7)}  mean ${f(mn(Fl.map(x => x[k]))).padStart(7)}  p90 ${f(q(Fl.map(x => x[k]), .9)).padStart(7)}`);
        };
        row('ring time (s, <1.5z)', 'ring');
        row('ring POST-advance (s)', 'ringPost');
        row('open->advance span (s)', 'armSpan');
        row('ring dist (u)', 'ringDist', v => isFinite(v) ? v.toFixed(0) : '—');
        row('excess sweep (deg)', 'excess', v => isFinite(v) ? (v * 180 / Math.PI).toFixed(0) : '—');
        row('beyond-mark (u)', 'beyond', v => isFinite(v) ? v.toFixed(0) : '—');
        row('beyond POST-advance (u)', 'beyondPost', v => isFinite(v) ? v.toFixed(0) : '—');
        row('escape tax (s)', 'escape');
        row('stuck <20u/s (s)', 'stuck');
        row('closest (u)', 'closest', v => isFinite(v) ? v.toFixed(0) : '—');
        const ww = (A) => { const v = A.map(x => x.wrongWay).filter(x => x != null); return v.length ? (100 * v.reduce((a, c) => a + c, 0) / v.length).toFixed(0) + '%' : '—'; };
        console.log(`  wrong-way entry            him ${ww(H)}   fleet ${ww(Fl)}`);
        console.log(`  fleet engine: escape(bank->adv) med ${q(Fl.map(x => x.engEscape), .5)}s mean ${mn(Fl.map(x => x.engEscape)).toFixed(1)}s  arm->bank med ${q(Fl.map(x => x.armLead), .5)}s  sweepAtAdv med ${D(q(Fl.map(x => x.swAdv), .5))}°`);
    }
    // venue rollup on MEANS (rule 26): fleet-minus-him ring time per lap
    let tax = 0;
    for (const g of GEO) {
        const H = HIS.filter(x => x.leg === g.leg), Fl = FLEET.filter(x => x.leg === g.leg);
        if (H.length && Fl.length) tax += mn(Fl.map(x => x.ring)) - mn(H.map(x => x.ring));
    }
    console.log(`\nVENUE ROLLUP: fleet-minus-him RING TIME, mean basis, summed over rounding legs = ${tax.toFixed(1)} s/lap`);
})();
