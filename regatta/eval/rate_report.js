// RATE REPORT — the character re-rating, read out of the campaign rows.
//
//   node regatta/eval/rate_report.js --venue seatrials
//   node regatta/eval/rate_report.js --all                 pooled order + venue agreement
//   node regatta/eval/rate_report.js --all --json out.json
//
// Reports, in the order the owner asked for them:
//   1. the total order, with confidence, and tiers
//   2. whether the venues agree enough for one order to be honest (Kendall's tau)
//   3. what each of the ten stats is worth, per venue, in seconds per point
//   4. an audit of every character's `beat` line against the measurement
//   5. outliers worth a stat edit
//
// Two ratings are reported side by side and they answer different questions.
// TIME is the physics: seconds faster or slower than an average character in the same
// race, and it is what the stat regression can be run against. POINTS is the owner's
// scoring rule — 9 down to 1 by finish order, DNF and DNS score 0 — and it is what a
// player experiences, because it counts a blown race as the disaster it is rather than
// as a slow time. Where they disagree, the character is inconsistent, and that is worth
// seeing rather than averaging away.

const fs = require('fs');
const path = require('path');
const L = require('./rate_lib.js');

const ARGS = process.argv.slice(2);
const argOf = (f, d) => { const i = ARGS.indexOf(f); return i >= 0 ? ARGS[i + 1] : d; };
const DIR = argOf('--dir', 'regatta/eval/rating');
const ALL = ARGS.includes('--all');
const REPS = parseInt(argOf('--boot', '200'), 10);
const JSONOUT = argOf('--json', null);
const VENUES = ALL
    ? ['seatrials', 'ocean', 'lake', 'lagoon', 'redrock', 'river', 'arctic', 'bay', 'swamp', 'glowtide']
    : [argOf('--venue', 'seatrials')];

// The roster, for stats, archetypes and the beat lines being audited.
const src = fs.readFileSync(path.resolve('regatta/js/ai/roster.js'), 'utf8');
const ROSTER = eval(src.match(/const AI_CONFIG = \[[\s\S]*?\n\];/)[0].replace('const AI_CONFIG =', ''));
const byName = new Map(ROSTER.map(c => [c.name, c]));
const STATS = ['acceleration', 'momentum', 'handling', 'upwind', 'reach', 'downwind',
               'pressure', 'lightAir', 'heavyAir', 'memory'];
const ARCHETYPES = [...new Set(ROSTER.map(c => c.archetype))].sort();

let LEGTYPES = {};
try { LEGTYPES = JSON.parse(fs.readFileSync(path.join(DIR, 'legtypes.json'), 'utf8')); }
catch (e) { console.warn('no legtypes.json — run rate_legtypes.js; per-leg analysis disabled'); }

// Same proportions tier_eval.js used, so "S tier" keeps meaning "top ~12% of the
// fleet" and the label survives the roster growing.
const TIER_SHAPE = [['S', 0.12], ['A', 0.21], ['B', 0.33], ['C', 0.21], ['D', 0.13]];
function assignTiers(rows) {
    let i = 0;
    for (const [tier, frac] of TIER_SHAPE) {
        const count = Math.round(frac * rows.length);
        for (let k = 0; k < count && i < rows.length; k++, i++) rows[i].tier = tier;
    }
    while (i < rows.length) rows[i++].tier = 'D';
    return rows;
}

function analyseVenue(venue) {
    const data = L.loadVenue(DIR, venue, { strict: false });
    if (!data.races.length) return null;
    if (data.skipped.length) for (const [f, why] of data.skipped) console.warn(`  skipped ${path.basename(f)}: ${why}`);
    if (data.dupes) console.warn(`  ⚠️  ${data.dupes} duplicate seeds — a race counted twice`);

    const races = data.races;
    const meanRace = races.reduce((a, r) => {
        const ts = r.b.map(b => b[1]).filter(t => t != null);
        return a + (ts.length ? ts.reduce((x, y) => x + y, 0) / ts.length : 0);
    }, 0) / races.length;

    const t = L.bootstrapSE(races, { value: 'time', reps: REPS });
    const p = L.fitFixedEffects(races, { value: 'pts' });
    const pIdx = new Map(p.names.map((n, i) => [n, i]));

    // Per-character counts of the things the time model cannot see.
    const meta = new Map();
    for (const r of races) for (const b of r.b) {
        const m = meta.get(b[0]) || { races: 0, fin: 0, dnf: 0, dns: 0, late: 0, pen: 0,
                                      wins: 0, pts: 0, legs: [], man: 0 };
        m.races++;
        if (b[4] === 'DNS') m.dns++; else if (b[4] === 'DNF') m.dnf++; else {
            m.fin++; if (b[6]) m.late++; if (b[2] === 1) m.wins++;
            const splits = b[8] || [];
            for (let i = 0; i < splits.length; i++) { (m.legs[i] = m.legs[i] || []).push(splits[i]); }
        }
        m.pts += b[3]; m.pen += b[5];
        m.man += (b[9] || []).reduce((x, y) => x + y, 0);
        meta.set(b[0], m);
    }

    const rows = t.names.map((name, j) => {
        const m = meta.get(name);
        return {
            name, venue,
            delta: t.effect[j],                       // seconds vs an average character
            deltaPct: 100 * t.effect[j] / meanRace,   // ... as % of a race, for pooling
            se: t.se[j],
            pts: p.effect[pIdx.get(name)] ?? 0,       // points vs an average character
            races: m.races, finPct: 100 * m.fin / m.races,
            dnfPct: 100 * (m.dnf + m.dns) / m.races,
            shippedDnfPct: 100 * (m.dnf + m.dns + m.late) / m.races,
            winPct: 100 * m.wins / m.races,
            penPer: m.pen / m.races,
            manPer: m.man / m.races,
            legMeans: m.legs.map(a => a.reduce((x, y) => x + y, 0) / a.length)
        };
    });
    rows.sort((a, b) => a.delta - b.delta);
    assignTiers(rows);

    // Leg types come from rate_legtypes.js, which asked the GAME (window.Course) rather
    // than walking state.course.marks pairwise. That array is not the course order —
    // seatrials is [startPin, startBoat, windwardPin, windwardBoat], so the naive walk
    // called a windward-leeward "reach beat reach".
    const legTypes = (LEGTYPES[venue] ? LEGTYPES[venue].legs.map(l => l.pointOfSail) : []);

    // Per-point-of-sail strength: the same fixed-effects fit, run on each leg
    // separately, then averaged within beat / reach / run. This is what makes the beat
    // lines auditable — a claim like "upwind he is merely mortal" is about one point of
    // sail, and a finish time cannot separate them.
    const posEffect = new Map();      // name -> {beat, reach, run} in seconds vs average
    if (legTypes.length) {
        const perLeg = [];
        for (let li = 0; li < legTypes.length; li++) {
            const sub = races.map(r => ({
                s: r.s,
                b: r.b.map(b => [b[0], (b[8] && b[8][li] != null) ? b[8][li] : null, b[2], b[3]])
            })).filter(r => r.b.some(b => b[1] != null));
            if (sub.length < 30) { perLeg.push(null); continue; }
            const f = L.fitFixedEffects(sub, { value: 'time', iters: 120 });
            perLeg.push({ type: legTypes[li], f });
        }
        for (const name of t.names) {
            const acc = { beat: [], reach: [], run: [] };
            for (const pl of perLeg) {
                if (!pl || !acc[pl.type]) continue;
                const j = pl.f.names.indexOf(name);
                if (j >= 0) acc[pl.type].push(pl.f.effect[j]);
            }
            const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
            posEffect.set(name, { beat: mean(acc.beat), reach: mean(acc.reach), run: mean(acc.run) });
        }
        for (const r of rows) r.pos = posEffect.get(r.name);
    }

    return { venue, races: races.length, meanRace, rows, residSd: t.residSd,
             legTypes, marks: data.marks, venueHash: data.venueHash };
}

// ── stat pricing ───────────────────────────────────────────────────────────────
// Regress the measured character effect on the ten authored stats plus archetype
// dummies. The coefficient on a stat is what one point of it is worth, in seconds,
// at this venue. `reach` measured -0.180 s/pt when last priced and was called
// decorative; the venues have grown reaching legs since, so it is re-asked here.
function priceStats(v) {
    const rows = v.rows.filter(r => byName.has(r.name));
    const X = [], y = [];
    for (const r of rows) {
        const c = byName.get(r.name);
        const row = [1];
        for (const s of STATS) row.push(c.stats[s] || 0);
        for (const a of ARCHETYPES.slice(1)) row.push(c.archetype === a ? 1 : 0);
        X.push(row); y.push(r.delta);
    }
    const fit = L.ols(X, y);
    const price = STATS.map((s, i) => ({ stat: s, beta: fit.beta[i + 1], se: fit.se[i + 1] }));
    const arch = ARCHETYPES.slice(1).map((a, i) => ({
        arch: a, beta: fit.beta[1 + STATS.length + i], se: fit.se[1 + STATS.length + i] }));
    return { price, arch, r2: fit.r2, resid: fit.resid, names: rows.map(r => r.name) };
}

// ── output ─────────────────────────────────────────────────────────────────────

// ── the beat-line audit ────────────────────────────────────────────────────────
//
// Every character carries a `beat` line telling the player how to sail against them,
// and a personality blurb. Both are promises about the race, and both were authored
// from the stat block rather than from a measurement — which is exactly how the last
// tier list ended up agreeing with reality 16 times out of 66, i.e. at chance.
//
// The audit is not a text-understanding problem. A beat line names a point of sail; the
// stat block says the character should be weak there; the campaign measured whether
// they are. So the test is: does the AUTHORED stat that the line is selling actually
// show up in the MEASURED per-point-of-sail effect? A line is flagged when the stat
// promises a weakness (or strength) the boat does not have.
//
// Direction: effects are seconds, so POSITIVE = slower = weaker at that point of sail.
// Stats run the other way (+5 upwind = strong upwind), hence the sign flip.
const POS_STAT = { beat: 'upwind', reach: 'reach', run: 'downwind' };

function auditBeatLines(analysed) {
    const rows = [];
    for (const c of ROSTER) {
        // Pool the per-point-of-sail effect across venues, weighting each venue equally
        // and normalising to percent of that venue's race so courses of different length
        // are commensurable.
        const acc = { beat: [], reach: [], run: [] };
        for (const v of analysed) {
            const r = v.rows.find(x => x.name === c.name);
            if (!r || !r.pos) continue;
            for (const k of ['beat', 'reach', 'run']) {
                if (r.pos[k] != null) acc[k].push(100 * r.pos[k] / v.meanRace);
            }
        }
        const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
        const meas = { beat: mean(acc.beat), reach: mean(acc.reach), run: mean(acc.run) };

        // Rank each character within the fleet on each point of sail later; here just
        // record the raw numbers and the authored stats they are supposed to reflect.
        rows.push({ name: c.name, beat: c.beat, personality: c.personality,
                    stats: c.stats, meas, n: acc.beat.length });
    }

    // Convert to within-fleet z-scores so "strong" and "weak" mean something relative.
    for (const k of ['beat', 'reach', 'run']) {
        const vals = rows.map(r => r.meas[k]).filter(v => v != null);
        if (vals.length < 10) continue;
        const m = vals.reduce((a, b) => a + b, 0) / vals.length;
        const sd = Math.sqrt(vals.reduce((a, b) => a + (b - m) * (b - m), 0) / (vals.length - 1));
        for (const r of rows) r.meas[k + 'Z'] = r.meas[k] == null ? null : (r.meas[k] - m) / sd;
    }

    // A claim is CONTRADICTED when the authored stat is extreme (|stat| >= 3, i.e. the
    // character is sold on it) and the measurement points the other way by at least
    // half a standard deviation. Half an sd is deliberately lenient: the point is to
    // catch lines that are backwards, not to relitigate every value.
    const findings = [];
    for (const r of rows) {
        for (const [pos, stat] of Object.entries(POS_STAT)) {
            const s = r.stats[stat] || 0;
            const z = r.meas[pos + 'Z'];
            if (z == null || Math.abs(s) < 3) continue;
            // stat positive = should be FAST = negative z. Product > 0 means they agree.
            const agrees = (s > 0 && z < 0) || (s < 0 && z > 0);
            if (!agrees && Math.abs(z) > 0.5) {
                findings.push({ name: r.name, pos, stat, value: s, z,
                                beat: r.beat, severity: Math.abs(z) * Math.abs(s) });
            }
        }
    }
    findings.sort((a, b) => b.severity - a.severity);
    return { rows, findings };
}

function printAudit(audit) {
    console.log('\n\n=== BEAT-LINE AUDIT — authored stat vs measured point of sail ===');
    console.log('A character sold on a stat of |3+| whose measurement points the other way.');
    console.log('z is measured strength at that point of sail, in fleet sd; POSITIVE z = SLOWER.\n');
    if (!audit.findings.length) { console.log('  nothing contradicted at this threshold.'); return; }
    for (const f of audit.findings.slice(0, 30)) {
        const dir = f.value > 0 ? 'strong' : 'weak';
        const real = f.z > 0 ? 'slower than fleet' : 'faster than fleet';
        console.log(`  ${f.name.padEnd(12)} ${f.stat} ${f.value >= 0 ? '+' : ''}${f.value} (${dir}) ` +
                    `but measures ${f.z >= 0 ? '+' : ''}${f.z.toFixed(2)} sd on the ${f.pos} — ${real}`);
        console.log(`      "${f.beat}"`);
    }
    console.log(`\n  ${audit.findings.length} contradiction(s) total.`);
}

function printVenue(v) {
    console.log(`\n=== ${v.venue.toUpperCase()} — ${v.races} races, mean race ${v.meanRace.toFixed(0)}s, ` +
                `${v.rows.length} characters, venue ${v.venueHash} ===`);
    console.log(`legs: ${v.legTypes.join(' ')}   within-race residual sd ${v.residSd.toFixed(1)}s`);
    console.log('delta = seconds vs an average character in the same race (negative = faster)');
    console.log('shipDNF% = would have failed to finish under the SHIPPED cutoff\n');
    console.log('  #  T  Name            Delta    ±SE     Pts   Races  Win%   DNF%  shipDNF%  Pen');
    console.log('-'.repeat(88));
    v.rows.forEach((r, i) => console.log(
        String(i + 1).padStart(3) + '  ' + (r.tier || '-') + '  ' + r.name.padEnd(14) +
        (r.delta >= 0 ? '+' : '') + r.delta.toFixed(2).padStart(6) + '  ' +
        ('±' + r.se.toFixed(2)).padStart(6) + '  ' +
        (r.pts >= 0 ? '+' : '') + r.pts.toFixed(2).padStart(5) + '  ' +
        String(r.races).padStart(5) + '  ' +
        r.winPct.toFixed(1).padStart(4) + '  ' +
        r.dnfPct.toFixed(1).padStart(5) + '  ' +
        r.shippedDnfPct.toFixed(1).padStart(7) + '  ' +
        r.penPer.toFixed(2).padStart(4)));
}

function printPrices(v, p) {
    console.log(`\n-- what a stat point is worth at ${v.venue} (negative = faster), R² ${p.r2.toFixed(3)} --`);
    const sorted = [...p.price].sort((a, b) => a.beta - b.beta);
    for (const s of sorted) {
        const sig = Math.abs(s.beta) > 2 * s.se ? '' : '   (not distinguishable from zero)';
        console.log(`  ${s.stat.padEnd(13)} ${(s.beta >= 0 ? '+' : '') + s.beta.toFixed(3)} s/pt  ±${s.se.toFixed(3)}${sig}`);
    }
}

(async () => {
    const analysed = [];
    for (const v of VENUES) {
        const a = analyseVenue(v);
        if (!a) { console.log(`(no data yet for ${v})`); continue; }
        analysed.push(a);
        printVenue(a);
        printPrices(a, priceStats(a));
    }
    if (!analysed.length) { console.log('no data'); return; }

    // ── do the venues agree? ───────────────────────────────────────────────────
    // The question the whole campaign turns on. If tau is high a single order is an
    // honest summary; if a pair goes low or negative, the venue x character matrix is
    // the result and the total order is a headline on top of it.
    if (analysed.length > 1) {
        console.log('\n\n=== DO THE VENUES AGREE? Kendall tau between per-venue orders ===');
        const maps = analysed.map(a => new Map(a.rows.map(r => [r.name, r.deltaPct])));
        const hdr = '            ' + analysed.map(a => a.venue.slice(0, 6).padStart(7)).join('');
        console.log(hdr);
        const taus = [];
        analysed.forEach((a, i) => {
            let line = a.venue.padEnd(12);
            analysed.forEach((b, j) => {
                if (i === j) { line += '      —'; return; }
                const t = L.kendallTau(maps[i], maps[j]);
                if (i < j) taus.push({ a: a.venue, b: b.venue, t });
                line += t.toFixed(2).padStart(7);
            });
            console.log(line);
        });
        taus.sort((x, y) => x.t - y.t);
        const mean = taus.reduce((s, x) => s + x.t, 0) / taus.length;
        console.log(`\nmean tau ${mean.toFixed(3)}   weakest pair ${taus[0].a}/${taus[0].b} ${taus[0].t.toFixed(3)}` +
                    `   strongest ${taus[taus.length-1].a}/${taus[taus.length-1].b} ${taus[taus.length-1].t.toFixed(3)}`);

        // ── the pooled total order ─────────────────────────────────────────────
        // Equal weight per venue, on deltaPct — seconds are not comparable across
        // courses of different length, percent of a race is.
        const pooled = new Map();
        for (const a of analysed) for (const r of a.rows) {
            const e = pooled.get(r.name) || { name: r.name, vals: [], ses: [], venues: [] };
            e.vals.push(r.deltaPct); e.ses.push(100 * r.se / a.meanRace); e.venues.push({ v: a.venue, d: r.deltaPct });
            pooled.set(r.name, e);
        }
        const order = [...pooled.values()].map(e => {
            const m = e.vals.reduce((a, b) => a + b, 0) / e.vals.length;
            const se = Math.sqrt(e.ses.reduce((a, b) => a + b * b, 0)) / e.vals.length;
            const spread = Math.max(...e.vals) - Math.min(...e.vals);
            const best = e.venues.reduce((a, b) => b.d < a.d ? b : a);
            const worst = e.venues.reduce((a, b) => b.d > a.d ? b : a);
            return { name: e.name, mean: m, se, spread, n: e.vals.length, best: best.v, worst: worst.v };
        }).sort((a, b) => a.mean - b.mean);
        assignTiers(order);

        console.log(`\n\n=== THE TOTAL ORDER — ${analysed.length} venues, equal weight ===`);
        console.log('mean = % of a race faster (negative) or slower than an average character');
        console.log('spread = the gap between this character\'s best and worst venue\n');
        console.log('  #  T  Name            Mean%    ±SE   Spread  Best at     Worst at');
        console.log('-'.repeat(76));
        order.forEach((r, i) => console.log(
            String(i + 1).padStart(3) + '  ' + r.tier + '  ' + r.name.padEnd(14) +
            (r.mean >= 0 ? '+' : '') + r.mean.toFixed(2).padStart(6) + '  ' +
            ('±' + r.se.toFixed(2)).padStart(6) + '  ' +
            r.spread.toFixed(2).padStart(6) + '  ' +
            r.best.padEnd(11) + r.worst));

        const audit = auditBeatLines(analysed);
        printAudit(audit);

        if (JSONOUT) {
            fs.writeFileSync(JSONOUT, JSON.stringify({ venues: analysed, order, taus, audit }, null, 2));
            console.log(`\nwrote ${JSONOUT}`);
        }
    } else {
        const audit = auditBeatLines(analysed);
        printAudit(audit);
    }
})();
