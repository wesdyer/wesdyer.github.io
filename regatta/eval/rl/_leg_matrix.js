// PER-LEG HUMAN-vs-BOT MATRIX (2026-08-08 night, THE SECTION PUSH P3a).
// The section push needs to know WHERE each venue's gap lives, not just how big it
// is. Redrock got this treatment and it found the mark-5 canyon (+89 s/boat on one
// leg of six); river/lagoon/lake have never had it.
//
//   node _leg_matrix.js <venue> <benchLabel> [benchLabel2 ...]
//
// HUMAN side: leg durations from the schema-2 corpus. A leg's duration is the
// difference of the sample CLOCK at the leg's first and last racing sample — the
// trajectory carries `t` per sample, so nothing is credited per-frame (rule 18: the
// first leganat run inflated every time statistic 6x by crediting N/60 s a sample).
// BOT side: `legT[k]` from the fleet bench is the clock at which leg k was ENTERED,
// so leg k's duration is legT[k+1] - legT[k] and the last leg runs to `fin`. Only
// boats that FINISHED contribute, and the per-leg medians are over boat-legs.
//
// ⚠️ The bot's leg indices and the human's come from the same course document
// (`dmc.legs`), so they line up by construction — but the human corpus stamps a
// venueFingerprint and the bench stamps its own; both are printed, never assumed.
//
// ⚠️ COMPARABILITY IS FILTERED, NOT ASSUMED (2026-08-08, the corpus audit): a lap
// recorded on a since-edited course is not a reference for a bench run on the frozen
// one. `_traj_fp.js` showed the river's quoted 161.3 "best" was sailed on a retired
// document and only the 172.1 lap is on the benched river. Pass a fingerprint as the
// FIRST argument (`fp=<hash:len>`) and only laps carrying it are used; unstamped
// schema-1 laps are reported separately and never silently pooled with stamped ones.
const fs = require('fs'); const path = require('path');
const args = process.argv.slice(2);
const FP = (args[0] || '').startsWith('fp=') ? args.shift().slice(3) : null;
const VENUE = args[0];
const LABELS = args.slice(1);
const q = (a, p) => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.floor(p * (s.length - 1))] : NaN; };
const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN;

// ── HUMAN ───────────────────────────────────────────────────────────────────────
const TD = path.join(__dirname, 'traj');
const files = fs.readdirSync(TD).filter(f => f.startsWith('traj_' + VENUE + '_'));
const humanLegs = {}, humanTot = [];
const perLap = [];
for (const f of files) {
    const j = JSON.parse(fs.readFileSync(path.join(TD, f), 'utf8'));
    if (FP && !FP.split(',').includes(String(j.venueFingerprint))) { console.log(`  SKIP ${f.slice(5, -5)} fin ${(j.finishTime || 0).toFixed(1)} fp ${j.venueFingerprint} (not ${FP})`); continue; }
    const F = j.format, gi = (s, k) => s[F.indexOf(k)];
    const S = j.samples.filter(s => gi(s, 'phase') === 1);
    if (!S.length) continue;
    const first = {}, last = {};
    for (const s of S) {
        const lg = gi(s, 'leg'), t = gi(s, 't');
        if (first[lg] == null) first[lg] = t;
        last[lg] = t;
    }
    const legIds = Object.keys(first).map(Number).sort((a, b) => a - b);
    const lap = {};
    for (let i = 0; i < legIds.length; i++) {
        const lg = legIds[i];
        // End the leg at the NEXT leg's first sample when there is one, so the
        // sampling interval between legs is not silently dropped from the lap.
        const end = i + 1 < legIds.length ? first[legIds[i + 1]] : last[lg];
        (humanLegs[lg] = humanLegs[lg] || []).push(end - first[lg]);
        lap[lg] = end - first[lg];
    }
    perLap.push(lap);
    humanTot.push(j.finishTime != null ? j.finishTime : (last[legIds[legIds.length - 1]] - first[legIds[0]]));
    console.log(`  human ${f.slice(5, -5)}  fin ${(j.finishTime || 0).toFixed(1)}  fp ${j.venueFingerprint}` +
        `  legs ${legIds.map(l => l + ':' + lap[l].toFixed(1)).join(' ')}`);
}
// ⚠️ With n <= 2 a "median" is a single lap. Say so rather than printing a column
// that reads like a distribution (rule 18: audit the probe before believing a unit).
if (humanTot.length <= 2) console.log(`  ⚠️ n=${humanTot.length} human lap(s): the "human med" column below IS one lap, not a distribution.`);

// ── BOT ─────────────────────────────────────────────────────────────────────────
const botLegs = {}, botTot = [];
let nLegs = 0;
for (const L of LABELS) {
    const p1 = path.join(__dirname, `ocean_bench_${L}.json`);
    const p2 = path.join(__dirname, `fleet_leg2_${L}.json`);
    const p = fs.existsSync(p1) ? p1 : p2;
    if (!fs.existsSync(p)) { console.log(`  (missing bench ${L})`); continue; }
    const trials = JSON.parse(fs.readFileSync(p, 'utf8'));
    const mp = path.join(__dirname, path.basename(p).replace('.json', '.meta.json'));
    const meta = fs.existsSync(mp) ? JSON.parse(fs.readFileSync(mp, 'utf8')) : {};
    console.log(`  bot   ${L}  trials ${trials.length}  fp ${meta.fingerprint}`);
    for (const t of trials) {
        nLegs = Math.max(nLegs, t.nLegs || 0);
        for (const b of t.info) {
            if (b.fin == null) continue;            // unfinished boats have no last leg
            botTot.push(b.fin);
            const ks = Object.keys(b.legT).map(Number).sort((a, b2) => a - b2);
            for (let i = 0; i < ks.length; i++) {
                const lg = ks[i];
                const end = i + 1 < ks.length ? b.legT[ks[i + 1]] : b.fin;
                (botLegs[lg] = botLegs[lg] || []).push(end - b.legT[lg]);
            }
        }
    }
}

// ── THE MATRIX ──────────────────────────────────────────────────────────────────
const all = [...new Set([...Object.keys(humanLegs), ...Object.keys(botLegs)])].map(Number).sort((a, b) => a - b);
console.log(`\n${VENUE.toUpperCase()} PER-LEG MATRIX   human n=${humanTot.length} laps, bot n=${botTot.length} finishing boats`);
console.log(`leg   human med   human best    bot med    bot p25   bot p75    DELTA med   RATIO   share of gap`);
const deltas = {};
for (const lg of all) {
    const H = humanLegs[lg] || [], B = botLegs[lg] || [];
    deltas[lg] = (q(B, 0.5) - q(H, 0.5)) || 0;
}
const gapTot = Object.values(deltas).reduce((a, b) => a + (b > 0 ? b : 0), 0);
for (const lg of all) {
    const H = humanLegs[lg] || [], B = botLegs[lg] || [];
    const hm = q(H, 0.5), bm = q(B, 0.5), d = deltas[lg];
    console.log(`${String(lg).padStart(3)}  ${hm.toFixed(1).padStart(9)}  ${Math.min(...H).toFixed(1).padStart(10)}` +
        `  ${bm.toFixed(1).padStart(9)}  ${q(B, 0.25).toFixed(1).padStart(9)}  ${q(B, 0.75).toFixed(1).padStart(8)}` +
        `  ${d.toFixed(1).padStart(10)}  ${(bm / hm).toFixed(2).padStart(6)}  ${d > 0 ? (100 * d / gapTot).toFixed(0) + '%' : '-'}`);
}
console.log(`TOT  ${q(humanTot, 0.5).toFixed(1).padStart(9)}  ${Math.min(...humanTot).toFixed(1).padStart(10)}` +
    `  ${q(botTot, 0.5).toFixed(1).padStart(9)}  ${q(botTot, 0.25).toFixed(1).padStart(9)}  ${q(botTot, 0.75).toFixed(1).padStart(8)}` +
    `  ${(q(botTot, 0.5) - q(humanTot, 0.5)).toFixed(1).padStart(10)}  ${(q(botTot, 0.5) / q(humanTot, 0.5)).toFixed(2).padStart(6)}`);
console.log(`\n  ⚠️ leg-sum vs total: human ${all.reduce((a, l) => a + (q(humanLegs[l] || [], 0.5) || 0), 0).toFixed(1)}` +
    ` bot ${all.reduce((a, l) => a + (q(botLegs[l] || [], 0.5) || 0), 0).toFixed(1)}` +
    ` (medians do not add to the median lap; read the columns, not the sum)`);

// ── THE SAME MATRIX ON MEANS, WHICH IS THE ONE THAT MAY BE APPORTIONED ──────────
// Standing rule 26: medians do not add, so a share-of-gap column computed from
// per-leg MEDIANS describes a boat that does not exist (redrock's median legs
// summed to 383 against a 459 lap). Every leg is right-skewed and DIFFERENT boats
// occupy the tail on DIFFERENT legs. Means DO add, so this is the table to
// apportion a gap with; keep the median table for the whole-lap headline.
// Published wrong once and caught by the owner — the fix belongs in the probe.
console.log(`\n${VENUE.toUpperCase()} PER-LEG MATRIX ON MEANS  ⭐ apportion the gap with THIS table`);
console.log(`leg   human mean    bot mean    DELTA mean   RATIO   share of gap`);
const dMean = {};
for (const lg of all) dMean[lg] = (mean(botLegs[lg] || []) - mean(humanLegs[lg] || [])) || 0;
const gapMean = Object.values(dMean).reduce((a, b) => a + (b > 0 ? b : 0), 0);
for (const lg of all) {
    const hm = mean(humanLegs[lg] || []), bm = mean(botLegs[lg] || []), d = dMean[lg];
    console.log(`${String(lg).padStart(3)}  ${hm.toFixed(1).padStart(10)}  ${bm.toFixed(1).padStart(10)}` +
        `  ${d.toFixed(1).padStart(11)}  ${(bm / hm).toFixed(2).padStart(6)}  ${d > 0 ? (100 * d / gapMean).toFixed(0) + '%' : '-'}`);
}
const hTotM = mean(humanTot), bTotM = mean(botTot);
console.log(`TOT  ${hTotM.toFixed(1).padStart(10)}  ${bTotM.toFixed(1).padStart(10)}` +
    `  ${(bTotM - hTotM).toFixed(1).padStart(11)}  ${(bTotM / hTotM).toFixed(2).padStart(6)}`);
console.log(`  leg-sum check (means SHOULD add): human ` +
    `${all.reduce((a, l) => a + (mean(humanLegs[l] || []) || 0), 0).toFixed(1)} vs lap ${hTotM.toFixed(1)}` +
    `   bot ${all.reduce((a, l) => a + (mean(botLegs[l] || []) || 0), 0).toFixed(1)} vs lap ${bTotM.toFixed(1)}`);
