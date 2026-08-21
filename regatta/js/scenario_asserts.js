// SCENARIO ASSERTIONS — the shared evaluator. One pure function of the
// recording, used by BOTH the Scenario Lab page (chips after every run) and
// the headless runner (eval/run_scenario.js) — the battery's lesson applied:
// the page and the test must judge with the same code or they will drift.
//
// An assertion is a structured row saved in the scenario doc (boats by
// index, like goals):
//   { kind:'penalty', who: 0|-1, rule?: '15', t0?, t1?, xfail? }   who -1 = nobody
//   { kind:'row',     of: 0, over: 1, rule?: '13', t: 6.0, t1?, xfail? }
//   { kind:'clear',   a: 0, b: 1, min: 55, xfail? }
//   { kind:'tack',    who: 0, tack: 'port'|'stbd', t: 7.0, xfail? }
//   { kind:'goals',   who: 0, xfail? }
//   { kind:'proper',  who: 0, tol?: 10 (metres), xfail? }   needs ctx.proper
//   { kind:'deflect', who: 0, max?: 23 (degrees), t0?, t1?, xfail? }
//                     max recorded avoidance deviation over the window
//   { kind:'role',    who: 0, role: 'STAND_ON'|'GIVE_WAY'|'NONE', t: 1.0, t1?, xfail? }
//                     boat holds that avoidance role on every frame of [t, t1]
//   { kind:'steady',  who: 0, max?: 2, t0?, t1?, xfail? }
//                     avoidance deviation reverses at most max times over the
//                     window — a reversal is a SIGN FLIP of the recorded dev,
//                     or a quick re-arm (dev drops to zero and fires again
//                     within 0.5s). Catches the memoryless-argmin flap.
//   { kind:'nocollide', xfail? }   scenario-wide: no hull contact at all
//
// The recording (rec) is the lab's: frames[] of per-boat snapshots + pairs,
// plus names[], goalCounts[], pens[] ({t, boat, rule, kind} from the
// engine's own onRaceEvent hook — the umpire's CITED rule, not a guess).
//
// Result per row: { status: 'pass'|'fail'|'gap'|'fixed', why, atS }
//   gap   = xfail row that failed (a documented engine gap — the battery's
//           knownGap in lab clothes)
//   fixed = xfail row that PASSED (the gap closed; promote the row)
(function () {
    'use strict';

    function ruleMatches(want, got) {
        if (!want) return true;
        if (!got) return false;
        const w = String(want).replace(/rule\s*/i, '').trim().toLowerCase();
        const g = String(got).replace(/rule\s*/i, '').trim().toLowerCase();
        return g === w || g.startsWith(w + ' ') || g.startsWith(w + '(');
    }
    const fmtBoat = (names, i) => (names && names[i]) || ('boat ' + i);

    // FLAP COUNT — one implementation for the 'steady' assert AND the lab's
    // metrics panel (the battery's lesson: page and runner must judge with
    // the same code). A flap (reversal) is either
    //   · a QUICK RE-ARM: the recorded avoidance deviation (dev, radians,
    //     signed) collapses to zero and fires again within 0.5s, or
    //   · a TURNING POINT of the signed dev series with prominence ≥ 0.35
    //     rad (~20°): the helm swings out, back, out again — the 92/0/69/40°
    //     tick-to-tick anatomy. A monotone escalation (34° → 50° → 70° as
    //     range closes) has no turning point and counts nothing; a single
    //     decisive side switch, held, counts nothing either.
    // Sub-1.7° dev is jitter, not a side.
    // Returns null when the boat is missing from any frame of the window.
    function countFlaps(rec, who, t0, t1) {
        const frames = rec.frames || [];
        const nF = rec.nF != null ? rec.nF : frames.length - 1;
        const f0 = t0 != null ? Math.max(0, Math.round(t0 * 60)) : 0;
        const f1 = t1 != null ? Math.min(nF, Math.round(t1 * 60)) : nF;
        const EPS = 0.03;           // rad, ~1.7°
        const REARM_MAX = 30;       // frames of zero that still read as a flap
        const PROM = 0.35;          // rad, turning-point prominence (~20°)
        let flaps = 0, zeros = 0, armed = false;
        let lastVal = null, dir = 0, extremum = null;
        for (let f = f0; f <= f1; f++) {
            const b = frames[f] && frames[f].boats[who];
            if (!b) return null;
            const d = b.dev || 0;
            if (Math.abs(d) < EPS) { if (armed) zeros++; continue; }
            if (armed && zeros >= 1 && zeros <= REARM_MAX) flaps++;
            if (armed && zeros > REARM_MAX) { lastVal = null; dir = 0; extremum = null; }
            zeros = 0; armed = true;
            if (lastVal !== null) {
                const delta = d - lastVal;
                if (Math.abs(delta) >= 0.02) {
                    const newDir = delta > 0 ? 1 : -1;
                    if (dir !== 0 && newDir !== dir) {
                        if (extremum === null || Math.abs(lastVal - extremum) >= PROM) flaps++;
                        extremum = lastVal;
                    }
                    dir = newDir;
                }
            } else { extremum = d; }
            lastVal = d;
        }
        return flaps;
    }

    // one row against one recording — returns raw {pass, why, atS}.
    // ctx.proper (the PROPER COURSE composite) feeds the 'proper' kind.
    function evalOne(a, rec, ctx) {
        const frames = rec.frames || [];
        const nF = rec.nF != null ? rec.nF : frames.length - 1;
        const names = rec.names || [];
        const F = (t) => frames[Math.max(0, Math.min(nF, Math.round(t * 60)))];
        if (a.kind === 'penalty') {
            const pens = (rec.pens || []).filter(p =>
                (a.t0 == null || p.t >= a.t0) && (a.t1 == null || p.t <= a.t1));
            if (a.who === -1) {
                const hit = pens[0];
                return hit ? { pass: false, why: `${fmtBoat(names, hit.boat)} penalized (${hit.rule || 'contact'}) at ${hit.t.toFixed(1)}s`, atS: hit.t }
                           : { pass: true, why: 'nobody penalized' };
            }
            const hit = pens.find(p => p.boat === a.who && ruleMatches(a.rule, p.rule));
            if (hit) return { pass: true, why: `${fmtBoat(names, a.who)} penalized (${hit.rule || 'contact'}) at ${hit.t.toFixed(1)}s`, atS: hit.t };
            const other = pens.find(p => p.boat === a.who);
            return { pass: false, atS: other ? other.t : undefined,
                why: other ? `penalized under ${other.rule || 'contact'}, not ${a.rule}` : `${fmtBoat(names, a.who)} was not penalized` };
        }
        if (a.kind === 'row') {
            const t0 = a.t, t1 = a.t1 != null ? a.t1 : a.t;
            for (let f = Math.round(t0 * 60); f <= Math.min(nF, Math.round(t1 * 60)); f++) {
                const fr = frames[f];
                if (!fr) break;
                const nOf = names[a.of], nOver = names[a.over];
                const p = (fr.pairs || []).find(q =>
                    (q.a === nOf && q.b === nOver) || (q.a === nOver && q.b === nOf));
                const atS = f / 60;
                if (!p) return { pass: false, why: `no determination at ${atS.toFixed(1)}s (boats apart?)`, atS };
                if (p.row !== nOf) return { pass: false, why: `${p.row || 'nobody'} held rights at ${atS.toFixed(1)}s (${p.rule || '—'})`, atS };
                if (!ruleMatches(a.rule, p.rule)) return { pass: false, why: `rights via ${p.rule || '—'} at ${atS.toFixed(1)}s, not ${a.rule}`, atS };
            }
            return { pass: true, why: `${fmtBoat(names, a.of)} held rights${a.rule ? ' (' + a.rule + ')' : ''}` };
        }
        if (a.kind === 'clear') {
            const min = a.min != null ? a.min : 55;
            // atS = the FIRST frame the gap goes under min (when the assert
            // actually fails), not the closest approach — the worst moment
            // still reads out in the message
            let worst = Infinity, at = 0, firstBad = null;
            for (let f = 0; f <= nF; f++) {
                const A = frames[f].boats[a.a], B = frames[f].boats[a.b];
                if (!A || !B) return { pass: false, why: 'boat missing from recording' };
                const d = Math.hypot(A.x - B.x, A.y - B.y);
                if (d < worst) { worst = d; at = f / 60; }
                if (d < min && firstBad === null) firstBad = f / 60;
            }
            return worst >= min
                ? { pass: true, why: `closest ${Math.round(worst)}u at ${at.toFixed(1)}s` }
                : { pass: false, why: `under ${min}u from ${firstBad.toFixed(1)}s (closest ${Math.round(worst)}u at ${at.toFixed(1)}s)`, atS: firstBad };
        }
        if (a.kind === 'tack') {
            const fr = F(a.t);
            const b = fr && fr.boats[a.who];
            if (!b) return { pass: false, why: 'boat missing from recording' };
            const want = a.tack === 'stbd' ? 1 : -1;
            return b.ta === want
                ? { pass: true, why: `${fmtBoat(names, a.who)} on ${a.tack} at ${a.t.toFixed(1)}s` }
                : { pass: false, why: `on ${b.ta === 1 ? 'stbd' : b.ta === -1 ? 'port' : '?'} at ${a.t.toFixed(1)}s`, atS: a.t };
        }
        if (a.kind === 'proper') {
            // holds her proper course: per-frame deviation between this run's
            // track and the PROPER COURSE composite stays within tolerance.
            // Tolerance is authored in METRES (5 world units = 1 m).
            const pr = ctx && ctx.proper;
            if (!pr) return { pass: false, why: 'no proper-course recording to compare against' };
            const tolM = a.tol != null ? a.tol : 10;
            const tolU = tolM * 5;
            // atS = the FIRST frame she strays beyond tolerance (when the
            // assert actually fails) — the max deviation, which typically
            // grows to the end of the run, reads out in the message
            let worst = 0, at = 0, firstBad = null;
            const n = Math.min(nF, pr.nF != null ? pr.nF : pr.frames.length - 1);
            for (let f = 0; f <= n; f++) {
                const b = frames[f].boats[a.who], p = pr.frames[f].boats[a.who];
                if (!b || !p) return { pass: false, why: 'boat missing from a recording' };
                const d = Math.hypot(b.x - p.x, b.y - p.y);
                if (d > worst) { worst = d; at = f / 60; }
                if (d > tolU && firstBad === null) firstBad = f / 60;
            }
            const worstM = (worst / 5).toFixed(1);
            // tol 0 = EXACT match to the proper-course composite
            return worst <= tolU
                ? { pass: true, why: tolM === 0 ? 'matched proper course exactly'
                    : `held proper course (max ${worstM} m off at ${at.toFixed(1)}s)` }
                : { pass: false, why: `strayed past ${tolM} m at ${firstBad.toFixed(1)}s (max ${worstM} m at ${at.toFixed(1)}s)`, atS: firstBad };
        }
        if (a.kind === 'deflect') {
            // avoidance DEFLECTION budget: the controller's own recorded
            // avoidance deviation (frames[].boats[].dev, radians) never
            // exceeds a cap in degrees over the window. This is the helm's
            // commanded deflection, not a track comparison — it reads zero
            // for a boat whose avoidance never fires. atS = the FIRST frame
            // over the cap; the worst deflection reads out in the message.
            const maxDeg = a.max != null ? a.max : 23;
            const f0 = a.t0 != null ? Math.max(0, Math.round(a.t0 * 60)) : 0;
            const f1 = a.t1 != null ? Math.min(nF, Math.round(a.t1 * 60)) : nF;
            let worst = 0, at = 0, firstBad = null;
            for (let f = f0; f <= f1; f++) {
                const b = frames[f] && frames[f].boats[a.who];
                if (!b) return { pass: false, why: 'boat missing from recording' };
                const d = Math.abs(b.dev || 0) * 180 / Math.PI;
                if (d > worst) { worst = d; at = f / 60; }
                if (d > maxDeg && firstBad === null) firstBad = f / 60;
            }
            const worstS = Math.round(worst);
            return worst <= maxDeg
                ? { pass: true, why: worst === 0 ? 'no avoidance deflection'
                    : `deflected ≤ ${worstS}° (worst at ${at.toFixed(1)}s)` }
                : { pass: false, why: `deflected past ${maxDeg}° at ${firstBad.toFixed(1)}s (worst ${worstS}° at ${at.toFixed(1)}s)`, atS: firstBad };
        }
        if (a.kind === 'role') {
            // role WINDOW: the controller holds one avoidance role on every
            // frame of [t, t1] (t1 defaults to t). Catches the bimodal
            // STAND_ON latch — a seed that never latches fails here.
            const want = a.role || 'STAND_ON';
            const f0 = Math.max(0, Math.round((a.t || 0) * 60));
            const f1 = Math.min(nF, Math.round((a.t1 != null ? a.t1 : (a.t || 0)) * 60));
            for (let f = f0; f <= f1; f++) {
                const b = frames[f] && frames[f].boats[a.who];
                if (!b) return { pass: false, why: 'boat missing from recording' };
                if ((b.role || 'NONE') !== want)
                    return { pass: false, why: `${fmtBoat(names, a.who)} was ${b.role || 'NONE'} at ${(f / 60).toFixed(1)}s, not ${want}`, atS: f / 60 };
            }
            return { pass: true, why: `${fmtBoat(names, a.who)} held ${want} through ${(f0 / 60).toFixed(1)}–${(f1 / 60).toFixed(1)}s` };
        }
        if (a.kind === 'near') {
            // rounding TIGHTNESS: closest approach to a mark stays within a
            // budget (metres). ctx.marks = [{x,y}] in world units.
            const mk = ctx && ctx.marks && ctx.marks[a.mark];
            if (!mk) return { pass: false, why: 'mark ' + ((a.mark || 0) + 1) + ' missing' };
            const maxU = (a.max != null ? a.max : 15) * 5;
            let best = Infinity, at = 0;
            for (let f = 0; f <= nF; f++) {
                const b = frames[f].boats[a.who];
                if (!b) return { pass: false, why: 'boat missing from recording' };
                const d = Math.hypot(b.x - mk.x, b.y - mk.y);
                if (d < best) { best = d; at = f / 60; }
            }
            const bestM = (best / 5).toFixed(1);
            return best <= maxU
                ? { pass: true, why: `rounded ${bestM} m off at ${at.toFixed(1)}s` }
                : { pass: false, why: `never closer than ${bestM} m (> ${a.max != null ? a.max : 15} m)`, atS: at };
        }
        if (a.kind === 'turn') {
            // turn BUDGET: total integrated heading change over the run —
            // catches orbit overshoot and post-rounding unwinds that a
            // position assert can't see. atS = the FIRST frame the running
            // total crosses the cap (the moment the budget is spent), not
            // the end of the run.
            const max = a.max != null ? a.max : 360;
            const maxRad = max * Math.PI / 180;
            let tot = 0, prev = null, overAt = null;
            for (let f = 0; f <= nF; f++) {
                const b = frames[f].boats[a.who];
                if (!b) return { pass: false, why: 'boat missing from recording' };
                if (prev !== null) {
                    let d = (b.h - prev) % (Math.PI * 2);
                    if (d > Math.PI) d -= Math.PI * 2;
                    if (d < -Math.PI) d += Math.PI * 2;
                    tot += Math.abs(d);
                    if (tot > maxRad && overAt === null) overAt = f / 60;
                }
                prev = b.h;
            }
            const totDeg = Math.round(tot * 180 / Math.PI);
            return totDeg <= max
                ? { pass: true, why: `turned ${totDeg}° total` }
                : { pass: false, why: `passed ${max}° at ${overAt.toFixed(1)}s (${totDeg}° total by the end)`, atS: overAt };
        }
        if (a.kind === 'steady') {
            // STEADY HELM: avoidance deviation reverses at most `max` times
            // over the window (see countFlaps above for what a reversal is).
            const max = a.max != null ? a.max : 2;
            const n = countFlaps(rec, a.who, a.t0, a.t1);
            if (n == null) return { pass: false, why: 'boat missing from recording' };
            return n <= max
                ? { pass: true, why: n === 0 ? 'no reversals' : `${n} reversal${n === 1 ? '' : 's'}` }
                : { pass: false, why: `${n} avoidance reversals (max ${max}) — the flap` };
        }
        if (a.kind === 'nocollide') {
            // EXACT collision test: the engine's own hull-polygon contact
            // events (captured before the penalty debounce), orientation-
            // aware with zero tolerance — not a centre-distance proxy.
            const hit = (rec.pens || []).find(p => p.kind === 'contact');
            return hit
                ? { pass: false, why: `hull contact at ${hit.t.toFixed(1)}s (${fmtBoat(names, hit.boat)} penalized)`, atS: hit.t }
                : { pass: true, why: 'no hull contact' };
        }
        if (a.kind === 'goals') {
            const n = (rec.goalCounts || [])[a.who] || 0;
            if (!n) return { pass: false, why: `${fmtBoat(names, a.who)} has no goals` };
            const last = frames[nF] && frames[nF].boats[a.who];
            const gi = last ? (last.gi || 0) : 0;
            return gi >= n
                ? { pass: true, why: `all ${n} goals done` }
                : { pass: false, why: `${gi}/${n} goals by the end`, atS: nF / 60 };
        }
        return { pass: false, why: 'unknown assertion kind ' + a.kind };
    }

    function evaluate(asserts, rec, ctx) {
        return (asserts || []).map(a => {
            const r = evalOne(a, rec, ctx);
            const status = a.xfail ? (r.pass ? 'fixed' : 'gap') : (r.pass ? 'pass' : 'fail');
            return { status, why: r.why, atS: r.atS };
        });
    }

    // a one-line label for a row (UI + runner output share the wording)
    function label(a, names) {
        const nm = (i) => fmtBoat(names, i);
        if (a.kind === 'penalty') return a.who === -1 ? 'nobody is penalized'
            : `${nm(a.who)} penalized${a.rule ? ' · R' + String(a.rule).replace(/rule\s*/i, '') : ''}`;
        if (a.kind === 'row') return `${a.t.toFixed(1)}${a.t1 != null ? '–' + a.t1.toFixed(1) : ''}s ${nm(a.of)} rights over ${nm(a.over)}${a.rule ? ' · R' + String(a.rule).replace(/rule\s*/i, '') : ''}`;
        if (a.kind === 'clear') return `${nm(a.a)}·${nm(a.b)} clear ≥ ${a.min != null ? a.min : 55}u`;
        if (a.kind === 'tack') return `${a.t.toFixed(1)}s ${nm(a.who)} on ${a.tack}`;
        if (a.kind === 'goals') return `${nm(a.who)} completes goals`;
        if (a.kind === 'proper') return a.tol === 0 ? `${nm(a.who)} matches proper course exactly`
            : `${nm(a.who)} holds proper course \u00b1${a.tol != null ? a.tol : 10}m`;
        if (a.kind === 'nocollide') return 'no collisions';
        if (a.kind === 'deflect') {
            const win = a.t0 != null || a.t1 != null
                ? ` ${(a.t0 != null ? a.t0.toFixed(1) : '0')}–${a.t1 != null ? a.t1.toFixed(1) + 's' : 'end'}` : '';
            return `${nm(a.who)} deflects ≤ ${a.max != null ? a.max : 23}°${win}`;
        }
        if (a.kind === 'role') return `${(a.t || 0).toFixed(1)}${a.t1 != null ? '–' + a.t1.toFixed(1) : ''}s ${nm(a.who)} is ${a.role || 'STAND_ON'}`;
        if (a.kind === 'steady') {
            const win = a.t0 != null || a.t1 != null
                ? ` ${(a.t0 != null ? a.t0.toFixed(1) : '0')}–${a.t1 != null ? a.t1.toFixed(1) + 's' : 'end'}` : '';
            return `${nm(a.who)} steady helm ≤ ${a.max != null ? a.max : 2} reversals${win}`;
        }
        if (a.kind === 'near') return `${nm(a.who)} rounds within ${a.max != null ? a.max : 15}m of mark ${(a.mark || 0) + 1}`;
        if (a.kind === 'turn') return `${nm(a.who)} turns ≤ ${a.max != null ? a.max : 360}° total`;
        return a.kind;
    }

    const api = { evaluate, label, ruleMatches, countFlaps };
    if (typeof window !== 'undefined') window.ScenarioAsserts = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
