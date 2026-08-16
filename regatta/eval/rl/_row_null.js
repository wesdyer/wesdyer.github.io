// HOW OFTEN IS RIGHT-OF-WAY UNDETERMINED, AND WHO GETS DOUBLE-PENALIZED FOR IT?
// (2026-08-15, the rules-inventory follow-up. Owner: "When is a case where there
// is an undetermined ROW... for [both-tacking] yes, but I would like to consider
// other cases to investigate.")
//
// Code enumeration says rowBoat === null happens on exactly one path: BOTH boats
// tacking (rule 13 third sentence) with the astern and port-side tiebreakers both
// failing. This measures the live incidence: every getRightOfWay call with a null
// result is logged with its context (isTacking flags, tacks, separation), and
// every triggerPenalty call is logged so double-penalties (two penalties, same
// frame, kind contact) can be counted and attributed.
//   node _row_null.js <trials> <seed0> <tree> <venue>
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const TRIALS = parseInt(process.argv[2]) || 4;
const SEED0 = parseInt(process.argv[3]) || 9400;
const ROOT = path.join(__dirname, process.argv[4] || 'treeBASE');
const VENUE = process.argv[5] || 'bay';

(async () => {
    const b = await chromium.launch(); const p = await b.newPage();
    p.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 200)));
    await p.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await p.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    await p.evaluate((v) => localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })), VENUE);

    const SUM = { calls: 0, nulls: 0, nullBothTacking: 0, nullOther: 0, pens: 0, doublePens: 0 };
    const nullCtx = [], doubles = [];
    for (let t = 0; t < TRIALS; t++) {
        const r = await p.evaluate(({ seed }) => {
            window.evalHarness.seed = seed; window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const pl = state.boats.find(x => x.isPlayer); if (pl) { pl.x = 1e6; pl.y = 1e6; }
            const out = { calls: 0, nulls: 0, nullBothTacking: 0, nullOther: 0,
                          pens: 0, doublePens: 0, nullCtx: [], doubles: [] };
            const origROW = window.Rules.getRightOfWay.bind(window.Rules);
            window.Rules.getRightOfWay = function (b1, b2) {
                const res = origROW(b1, b2);
                out.calls++;
                if (!res.boat) {
                    out.nulls++;
                    const both = b1.raceState.isTacking && b2.raceState.isTacking;
                    if (both) out.nullBothTacking++; else out.nullOther++;
                    if (out.nullCtx.length < 40) out.nullCtx.push({
                        t: +state.race.timer.toFixed(1),
                        both: both ? 1 : 0,
                        t1: b1.raceState.isTacking ? 1 : 0, t2: b2.raceState.isTacking ? 1 : 0,
                        rule: res.rule, reason: res.reason,
                        d: Math.round(Math.hypot(b1.x - b2.x, b1.y - b2.y))
                    });
                }
                return res;
            };
            const origPen = window.triggerPenalty;
            const penLog = [];
            window.triggerPenalty = function (boat, info) {
                // ⚠️ EFFECTIVE penalties only — triggerPenalty is a no-op while the
                // boat is already flagged, and grinding contact calls it every
                // frame. The first probe version counted raw calls and read 1039
                // "double penalties" that were one boat's no-op burst (rule 18).
                const effective = !boat.raceState.penalty && !boat.raceState.finished;
                if (effective) {
                    penLog.push({ t: state.race.timer, name: boat.name, rule: (info && info.rule) || '?', kind: (info && info.kind) || '?' });
                    out.pens++;
                }
                return origPen(boat, info);
            };
            const DT = 1 / 60;
            for (let it = 0; it < 60 * 900; it++) {
                window.update(DT);
                if (state.race.status === 'finished') break;
                if (state.race.status === 'racing' && state.race.timer > 900) break;
            }
            // double penalties: two entries, same t (within one frame), kind contact
            for (let i = 1; i < penLog.length; i++) {
                if (Math.abs(penLog[i].t - penLog[i - 1].t) < 0.02
                    && penLog[i].name !== penLog[i - 1].name
                    && penLog[i].kind === 'contact' && penLog[i - 1].kind === 'contact') {
                    out.doublePens++;
                    if (out.doubles.length < 20) out.doubles.push({
                        t: +penLog[i].t.toFixed(1), a: penLog[i - 1].name, b: penLog[i].name,
                        rule: penLog[i].rule });
                }
            }
            return out;
        }, { seed: SEED0 + t });
        for (const k of ['calls', 'nulls', 'nullBothTacking', 'nullOther', 'pens', 'doublePens']) SUM[k] += r[k];
        nullCtx.push(...r.nullCtx); doubles.push(...r.doubles);
        console.log(`seed ${SEED0 + t}: ROW calls ${r.calls}, null ${r.nulls} (bothTacking ${r.nullBothTacking}, OTHER ${r.nullOther}), pens ${r.pens}, doublePens ${r.doublePens}`);
    }
    await b.close();
    console.log(`\n=== ${VENUE}, ${TRIALS} seeds ===`);
    console.log(`ROW calls ${SUM.calls}; null ${SUM.nulls} (${(100 * SUM.nulls / Math.max(1, SUM.calls)).toFixed(3)}%)`);
    console.log(`  both-tacking nulls: ${SUM.nullBothTacking};  OTHER-cause nulls: ${SUM.nullOther}  ⚠️ any non-zero OTHER contradicts the code enumeration — investigate`);
    console.log(`penalties ${SUM.pens}; double-penalty contacts ${SUM.doublePens}`);
    if (nullCtx.length) { console.log('\nnull contexts (first 40/venue):'); for (const c of nullCtx.slice(0, 40)) console.log(' ', JSON.stringify(c)); }
    if (doubles.length) { console.log('\ndouble-penalty events:'); for (const d of doubles) console.log(' ', JSON.stringify(d)); }
})();
