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
        return a.kind;
    }

    const api = { evaluate, label, ruleMatches };
    if (typeof window !== 'undefined') window.ScenarioAsserts = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
