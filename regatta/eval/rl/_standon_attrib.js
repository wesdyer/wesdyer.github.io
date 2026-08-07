// P2 (Aug 6 night+1) — WHERE DO THE FLEET'S RESIDUAL STAND-ON DEFLECTIONS
// COME FROM? Measure-first, no candidate. The human holds course in ~40% of
// encounters, the fleet (post VO-onset) 30%; the at-CPA residual is 11.2 vs
// her 8.0 deg. This probe attributes the STAND-ON side: at every deflection
// EPISODE (rising edge of |lastAvoidDeviation| > 2deg at 10Hz, 3s merge) while
// role === STAND_ON, record which risk state it fired in, what the threat
// geometry was (range, dCPA, tCPA, properCourseCPA — "did anything need
// doing"), whether the VO-onset set contained the threat, and what ELSE was
// nearby (non-threat rivals inside 250u — the soft nudge is per-rival and the
// STAND_ON exemption only covers the threat; marks inside their soft radius;
// grid clearance) — the alpha-split design frame needs to know whether the
// residual deflection is (a) the hold bonus not existing at LOW risk, (b)
// third-boat nudges, (c) statics coinciding with the encounter, or (d) the
// hard Rule-14 term (dCPA genuinely < pairSafe).
//
// Pure observer: reads controller state the engine already exposes; no tree
// patch, behavior untouched.
//   node _standon_attrib.js <trials> <seed0> <tree> [venue]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const TRIALS = parseInt(process.argv[2]) || 10;
const SEED0 = parseInt(process.argv[3]) || 9100;
const ROOT = path.join(__dirname, process.argv[4] || 'treeSCN');
const VENUE = process.argv[5] || 'bay';
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)));
    await page.addInitScript((v) => {
        localStorage.setItem('regatta_settings', JSON.stringify({ venue: v }));
    }, VENUE);
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });
    let all = [], frames = { standOn: 0, standOnDefl: 0, racing: 0 };
    for (let i = 0; i < TRIALS; i++) {
        const r = await page.evaluate(async (seed) => {
            window.evalHarness.seed = seed;
            window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const bots = state.boats.filter(b => !b.isPlayer);
            const pl = state.boats.find(b => b.isPlayer); pl.x = 1e6; pl.y = 1e6;
            const out = [], fr = { standOn: 0, standOnDefl: 0, racing: 0 };
            const openUntil = bots.map(() => -9);
            const dt = 1 / 60; let acc = 0;
            for (let it = 0; it < 60 * 940; it++) {
                window.update(dt);
                if (state.race.status === 'finished') break;
                if (state.race.status !== 'racing') continue;
                const t = state.race.timer;
                if (t > 900) break;
                if (++acc < 6) continue;      // 10 Hz
                acc = 0;
                fr.racing++;
                for (let k = 0; k < bots.length; k++) {
                    const b = bots[k], c = b.controller;
                    if (!c || b.raceState.finished || b.raceState.leg < 1) continue;
                    if (c.avoidanceRole !== 'STAND_ON') continue;
                    fr.standOn++;
                    const dev = Math.abs(c.lastAvoidDeviation || 0);
                    const deflected = dev > 0.035;
                    if (deflected) fr.standOnDefl++;
                    if (!deflected) continue;
                    if (t < openUntil[k]) { openUntil[k] = t + 3; continue; }  // same episode: extend
                    openUntil[k] = t + 3;
                    // --- episode onset: attribute ---
                    const th = c.threatBoat;
                    let m = null;
                    if (th && !th.raceState.finished) m = getRiskMetrics(b, th);
                    // non-threat rivals inside the 250u nudge radius
                    let n250 = 0, dNT = 1e9, ntVo = 0;
                    for (const o of state.boats) {
                        if (o === b || o.isPlayer || o.raceState.finished || o === th) continue;
                        const d = Math.hypot(o.x - b.x, o.y - b.y);
                        if (d < 250) { n250++; if (c._voIn && c._voIn.has(o)) ntVo++; }
                        if (d < dNT) dNT = d;
                    }
                    // statics: nearest mark (soft radius 103+bodyR), grid clearance here
                    let dMark = 1e9;
                    for (const mk of (state.course.marks || [])) {
                        const d = Math.hypot(mk.x - b.x, mk.y - b.y) - (mk.bodyR || 12);
                        if (d < dMark) dMark = d;
                    }
                    let clr = -1;
                    const g = state.course.botGrid;
                    if (g && g._clear) {
                        const cc = g.cell(b.x, b.y);
                        if (g.at(cc[0], cc[1])) clr = g._clear[cc[1] * g.n + cc[0]];
                    }
                    out.push({
                        t: +t.toFixed(1), dev: +(dev * 180 / Math.PI).toFixed(1),
                        risk: c.riskState, leg: b.raceState.leg,
                        rounding: !!(b.raceState.roundArmed || b.raceState.isRounding),
                        pcpa: c.properCourseCPA != null ? +c.properCourseCPA.toFixed(0) : null,
                        thRange: m ? +m.distCurrent.toFixed(0) : null,
                        thDcpa: m ? +m.distCPA.toFixed(0) : null,
                        thTcpa: m ? +m.tCPA.toFixed(1) : null,
                        thVo: !!(th && c._voIn && c._voIn.has(th)),
                        voActive: !!c._voActive,
                        n250, ntVo, dMark: +Math.min(dMark, 9999).toFixed(0),
                        clr: clr >= 0 ? +clr.toFixed(1) : null,
                    });
                }
                if (bots.every(b => b.raceState.finished)) break;
            }
            return { out, fr };
        }, SEED0 + i);
        all = all.concat(r.out);
        frames.standOn += r.fr.standOn; frames.standOnDefl += r.fr.standOnDefl; frames.racing += r.fr.racing;
        console.error(`seed ${SEED0 + i}: ${r.out.length} stand-on deflection episodes`);
    }
    fs.writeFileSync(path.join(__dirname, `standon_attrib_${VENUE}_${SEED0}.json`), JSON.stringify(all));
    const pct = (n, d) => d ? (100 * n / d).toFixed(1) + '%' : '-';
    console.log(`\nvenue=${VENUE} ${TRIALS} races: ${all.length} stand-on deflection episodes; ` +
        `stand-on frames deflected ${pct(frames.standOnDefl, frames.standOn)}`);
    const groups = [
        ['risk=LOW (no hold bonus exists)', e => e.risk === 'LOW'],
        ['risk=MEDIUM (hold 3000)', e => e.risk === 'MEDIUM'],
        ['risk=HIGH (hold 1000)', e => e.risk === 'HIGH'],
        ['risk=IMMINENT (no hold)', e => e.risk === 'IMMINENT'],
    ];
    const q = (arr, p) => { const s = [...arr].sort((a, b) => a - b); return s.length ? s[Math.floor(p * (s.length - 1))] : NaN; };
    for (const [name, sel] of groups) {
        const E = all.filter(sel);
        if (!E.length) { console.log(`  ${name.padEnd(34)} n=0`); continue; }
        const devs = E.map(e => e.dev);
        const pc = E.filter(e => e.pcpa != null).map(e => e.pcpa);
        console.log(`  ${name.padEnd(34)} n=${String(E.length).padStart(5)} (${pct(E.length, all.length)})` +
            `  dev med ${q(devs, .5).toFixed(1)}deg` +
            `  properCPA med ${pc.length ? q(pc, .5).toFixed(0) : '-'}u  needless(pCPA>110) ${pct(pc.filter(x => x > 110).length, pc.length)}` +
            `  thVO ${pct(E.filter(e => e.thVo).length, E.length)}` +
            `  3rdBoat<250u ${pct(E.filter(e => e.n250 > 0).length, E.length)}` +
            `  mark<115u ${pct(E.filter(e => e.dMark < 115).length, E.length)}` +
            `  rounding ${pct(E.filter(e => e.rounding).length, E.length)}`);
    }
    // The cross-tab that names the mechanism: among LOW-risk episodes (no hold
    // bonus in play), what share have NO static and NO third boat — i.e. pure
    // threat-nudge/hard-term residue?
    const low = all.filter(e => e.risk === 'LOW');
    const pure = low.filter(e => e.n250 === 0 && e.dMark >= 115 && !e.rounding && (e.clr == null || e.clr >= 3));
    console.log(`  LOW & no-static & no-3rd-boat & no-rounding: ${pure.length} (${pct(pure.length, all.length)} of all)` +
        (pure.length ? ` — dev med ${q(pure.map(e => e.dev), .5).toFixed(1)}deg, thVO ${pct(pure.filter(e => e.thVo).length, pure.length)}` : ''));
    await browser.close();
})();
