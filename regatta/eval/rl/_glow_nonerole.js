// A THIRD OF GLOWTIDE'S TACKS ARE SWERVES WITH NO RIGHTS ROLE. WHAT FOR? (2026-08-14)
//
// _glow_tackown: 70.6% of hull side-changes are avoidance-owned, and the single
// biggest owner — 33.9% of every tack on the venue, over half on legs 3 and 4 — is
// avoidance deflecting while `avoidanceRole === 'NONE'`. The vocabulary is exactly
// NONE | STAND_ON | GIVE_WAY (script.js:281), so no rights encounter has been
// adjudicated at that moment. Three very different things fit:
//
//   A. a RIVAL is there and the rule engine simply has not assigned a role yet
//      (too far, closing too slowly, or the adjudication has not run) — a role bug
//   B. no rival is near at all and the deflection is for LAND / a hazard, which the
//      same argmin also prices — a naming problem, not a rights problem
//   C. a rival is near and adjudication ran but returned nothing — the real gap
//
// A and C look identical in the flag; they differ in whether ANY rival is in range.
// This measures the world at each NONE-role deflection: nearest rival distance and
// closing rate, nearest land clearance, the deflection size, and where it happened.
//
// ⚠️ EPISODES, NOT FRAMES (rule 2): one deflection is one episode. The onset is the
// first frame with deviation > 0.08 after a clear frame; the episode is charged once
// at its onset and not re-counted while it persists.
// ⚠️ Sizes a POPULATION, not a fix. Nothing here is a candidate.
//
// ══ RESULT, glowtide treeFINAL, 4 seeds × 9 boats ══════════════════════════
// RULE 4 CONTROL — the properties DO move, so the NONE zero is real, not a dead read:
//   NONE      n=2051   threatBoat   0.0%   riskState LOW 100.0%
//   GIVE_WAY  n=1233   threatBoat 100.0%   riskState MEDIUM 71.6 / HIGH 15.0 / IMMINENT 13.4
//   STAND_ON  n= 566   threatBoat 100.0%   riskState HIGH 46.5 / IMMINENT 30.9 / MEDIUM 22.6
//
// THE NONE POPULATION (2051 onsets):
//   nearest rival  p10 140  p25 187  MED 297  p75 561  p90 1061 u
//   within 200u 30.2%   within 400u 62.7%   BEYOND 800u 15.8%
//   closing rate MED −1 u/s — the nearest boat is OPENING on 51.4%
//   deflection MED 0.2 rad (11.5°), p90 0.8 rad (46°)
//   per leg: L1 n=872 MED 246u · L2 n=491 348u · L3 n=355 302u · L4 n=303 394u
//
// ⇒ HYPOTHESIS A/C (a rights-adjudication gap) IS DEAD. These are not encounters the
// rule engine failed to grade — they are not encounters. Risk is LOW and threatBoat is
// null on every single one, while both graded roles carry a threat 100% of the time.
// A third of every tack on the venue is the proximity/argmin machinery steering around
// a boat the rules engine does not consider a threat at all — half of them already
// sailing AWAY, one in six more than 800u off.
//
// ⇒ THIS IS THE 0-RUNG / PROXIMITY FAMILY, NOT THE ROLE FAMILY. Fixing the role model
// would not touch it. That is a negative result for Phase 3 as a clock lever, and it
// points instead at a family whose defeat is already recorded as overdetermined
// (AV1 inert pooled) — so it is a MEASUREMENT, not an invitation to build.
//
//   node _glow_nonerole.js <venue> <trials> <seed0> <tree>
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const VENUE = process.argv[2] || 'glowtide';
const TRIALS = parseInt(process.argv[3]) || 4;
const SEED0 = parseInt(process.argv[4]) || 9400;
const ROOT = path.join(__dirname, process.argv[5] || 'treeFINAL');

(async () => {
    const br = await chromium.launch();
    const p = await br.newPage();
    p.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 200)));
    await p.addInitScript(v => localStorage.setItem('regatta_settings', JSON.stringify({ venue: v })), VENUE);
    await p.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await p.addScriptTag({ content: fs.readFileSync(path.resolve(ROOT, 'regatta/eval/eval_harness.js'), 'utf8') });

    let all = [];
    for (let t = 0; t < TRIALS; t++) {
        const r = await p.evaluate(async (seed) => {
            window.evalHarness.seed = seed; window.resetGame(); window.startRace();
            state.course.cutoff = 900;
            const pl = state.boats.find(x => x.isPlayer); if (pl) { pl.x = 1e6; pl.y = 1e6; }
            const DT = 1 / 60;
            const wasOn = {}, ev = [];
            const grid = state.course.botGrid || null;
            for (let it = 0; it < 60 * 900; it++) {
                window.update(DT);
                if (state.race.status === 'finished') break;
                if (state.race.status !== 'racing') continue;
                for (const b of state.boats) {
                    if (b.isPlayer || b.raceState.finished) continue;
                    const c = b.controller || {};
                    const dev = c.lastAvoidDeviation || 0;
                    const on = dev > 0.08;
                    const prev = wasOn[b.id] || false;
                    wasOn[b.id] = on;
                    if (!on || prev) continue;                     // ONSET only
                    // ⚠️ RULE 4: threatBoat and riskState come back EXACTLY constant on the
                    // NONE population, which is a bug signature until the OTHER roles are
                    // shown to move them. So record every role and report the control.
                    const role = c.avoidanceRole || 'NONE';
                    // nearest rival, and whether it is closing
                    let dMin = Infinity, closing = null;
                    for (const o of state.boats) {
                        if (o === b || o.isPlayer || o.raceState.finished) continue;
                        const dx = o.x - b.x, dy = o.y - b.y, d = Math.hypot(dx, dy);
                        if (d < dMin) {
                            dMin = d;
                            const rvx = (o.velocity.x - b.velocity.x) * 60, rvy = (o.velocity.y - b.velocity.y) * 60;
                            closing = -(rvx * dx + rvy * dy) / (d || 1);   // u/s, positive = closing
                        }
                    }
                    // land clearance: walk the grid outward if it is available
                    let clr = null;
                    if (grid && typeof grid.clearanceAt === 'function') { try { clr = grid.clearanceAt(b.x, b.y); } catch (e) { } }
                    ev.push({
                        role, leg: b.raceState.leg, dev: +dev.toFixed(3),
                        d: dMin === Infinity ? -1 : Math.round(dMin),
                        cl: closing == null ? -999 : Math.round(closing),
                        clr: clr == null ? -1 : Math.round(clr),
                        thr: !!c.threatBoat, risk: c.riskState || null
                    });
                }
            }
            return ev;
        }, SEED0 + t);
        all.push(...r);
        console.log(`seed ${SEED0 + t}: ${r.length} NONE-role deflection onsets`);
    }
    await br.close();

    const q = (a, pp) => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y); return s[Math.floor(pp * (s.length - 1))]; };
    const pc = (n, d) => `${(100 * n / d).toFixed(1)}%`;

    // ── RULE 4 CONTROL ──────────────────────────────────────────────────────
    // threatBoat / riskState read EXACTLY constant on the NONE population. That is a
    // bug signature unless the OTHER roles move them. Print all three roles first.
    console.log(`\n=== ${VENUE} — RULE 4 CONTROL: do threatBoat / riskState MOVE? ===`);
    for (const R of ['NONE', 'GIVE_WAY', 'STAND_ON']) {
        const s = all.filter(e => e.role === R);
        if (!s.length) { console.log(`  ${R.padEnd(9)} n=0`); continue; }
        const risks = {}; for (const e of s) risks[e.risk] = (risks[e.risk] || 0) + 1;
        console.log(`  ${R.padEnd(9)} n=${String(s.length).padStart(5)}   threatBoat set ${pc(s.filter(e => e.thr).length, s.length).padStart(6)}   ` +
            `riskState ${Object.entries(risks).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${pc(v, s.length)}`).join(' ')}`);
    }
    console.log(`  ⇒ if GIVE_WAY/STAND_ON DO set threatBoat, the NONE zero is a real finding.`);
    console.log(`    if NO role ever sets it, the probe is reading the wrong property (rule 4).`);

    all = all.filter(e => e.role === 'NONE');
    console.log(`\n=== ${VENUE} — NONE-ROLE DEFLECTION ONSETS (${all.length} episodes, ${TRIALS} seeds) ===`);
    const ds = all.map(e => e.d).filter(d => d >= 0);
    console.log(`nearest rival at onset:  p10 ${q(ds, .1)}  p25 ${q(ds, .25)}  MED ${q(ds, .5)}  p75 ${q(ds, .75)}  p90 ${q(ds, .9)} u`);
    console.log(`  within 200u ${pc(ds.filter(d => d < 200).length, ds.length)}   within 400u ${pc(ds.filter(d => d < 400).length, ds.length)}   beyond 800u ${pc(ds.filter(d => d >= 800).length, ds.length)}`);
    const cls = all.map(e => e.cl).filter(c => c > -999);
    console.log(`closing rate at onset:   MED ${q(cls, .5)} u/s   OPENING (rate <= 0) on ${pc(cls.filter(c => c <= 0).length, cls.length)}`);
    console.log(`threatBoat set: ${pc(all.filter(e => e.thr).length, all.length)}    deflection size: MED ${q(all.map(e => e.dev), .5)} rad  p90 ${q(all.map(e => e.dev), .9)} rad`);
    const clrs = all.map(e => e.clr).filter(c => c >= 0);
    if (clrs.length) console.log(`land clearance at onset:  MED ${q(clrs, .5)}  p10 ${q(clrs, .1)}  (n=${clrs.length})`);
    else console.log(`land clearance: grid.clearanceAt unavailable — not measured`);
    const risks = {}; for (const e of all) risks[e.risk] = (risks[e.risk] || 0) + 1;
    console.log(`riskState: ${Object.entries(risks).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${pc(v, all.length)}`).join('  ')}`);
    console.log(`\nby leg:`);
    for (const L of [...new Set(all.map(e => e.leg))].sort((a, b) => a - b)) {
        const s = all.filter(e => e.leg === L), sd = s.map(e => e.d).filter(d => d >= 0);
        console.log(`  leg ${L}: n=${String(s.length).padStart(4)}  nearest rival MED ${q(sd, .5)}u  within 400u ${pc(sd.filter(d => d < 400).length, sd.length)}  threatBoat ${pc(s.filter(e => e.thr).length, s.length)}`);
    }
    console.log(`\nREADING: a high "within 400u" with threatBoat set says the rival IS there and the`);
    console.log(`role simply is not assigned (hypothesis A/C — a rights gap). A high "beyond 800u"`);
    console.log(`or an OPENING rate says the swerve is not about that boat at all (hypothesis B).`);
    fs.writeFileSync(path.join(__dirname, `_glow_nonerole_${VENUE}.json`), JSON.stringify(all, null, 1));
})();
