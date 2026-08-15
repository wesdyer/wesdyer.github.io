// RATE LIB — loading, the fixed-effects fit, and the statistics the campaign reports.
// Pure functions over the JSONL rows rate_run.js writes. No browser, no racing.

const fs = require('fs');
const path = require('path');

// ── loading ────────────────────────────────────────────────────────────────────

// Every shard of a venue must agree on the venue file AND the roster. A shard raced
// against an edited course, or against a roster that gained a character mid-campaign,
// is not the same experiment — and the owner edits venue files live, so this is a
// live hazard rather than a theoretical one. Refuse rather than average.
function loadVenue(dir, venue, { strict = true } = {}) {
    const files = fs.readdirSync(dir)
        .filter(f => f.startsWith(venue + '-') && f.endsWith('.jsonl'))
        .map(f => path.join(dir, f)).sort();
    const races = [];
    let venueHash = null, rosterHash = null, codeHash = null, marks = null, skipped = [];

    for (const f of files) {
        const lines = fs.readFileSync(f, 'utf8').trim().split('\n');
        let head;
        try { head = JSON.parse(lines[0]); } catch (e) { skipped.push([f, 'unreadable header']); continue; }
        if (head.kind !== 'header') { skipped.push([f, 'no header']); continue; }

        let foot = null;
        try { foot = JSON.parse(lines[lines.length - 1]); } catch (e) {}
        const complete = foot && foot.kind === 'footer';
        if (complete && !foot.venueStable) { skipped.push([f, 'venue file changed mid-shard']); continue; }

        if (venueHash === null) { venueHash = head.venueHash; rosterHash = head.rosterHash; codeHash = head.codeHash; }
        else if (head.venueHash !== venueHash) {
            if (strict) throw new Error(`${f}: venue hash ${head.venueHash} != ${venueHash} — different course, refusing to merge`);
            skipped.push([f, 'venue hash mismatch']); continue;
        } else if (head.rosterHash !== rosterHash) {
            if (strict) throw new Error(`${f}: roster hash mismatch — the character set or its stats changed`);
            skipped.push([f, 'roster hash mismatch']); continue;
        } else if (head.codeHash && codeHash && head.codeHash !== codeHash) {
            // The AI changed under the campaign. These shards measure two different
            // sailing engines and must not be pooled — the difference would surface as
            // venue specialisation, which is the result the campaign exists to produce.
            if (strict) throw new Error(`${f}: AI code hash ${head.codeHash} != ${codeHash} — the sailing code changed mid-campaign`);
            skipped.push([f, 'AI code changed mid-campaign']); continue;
        }

        const body = lines.slice(1, complete ? -1 : undefined);
        for (const ln of body) {
            let r; try { r = JSON.parse(ln); } catch (e) { continue; }   // torn last line of a live shard
            if (r.kind) continue;
            if (r.marks) marks = r.marks;
            races.push(r);
        }
    }
    // Seeds are a pure function of (venue, shard), so a duplicate means two shards were
    // handed the same range and the same race is about to be counted twice.
    const seen = new Set(); let dupes = 0;
    for (const r of races) { if (seen.has(r.s)) dupes++; else seen.add(r.s); }

    return { venue, races, venueHash, rosterHash, codeHash, marks, skipped, dupes };
}

// ── the fixed-effects fit ──────────────────────────────────────────────────────
//
// The model is  t(race i, character j) = raceEffect_i + charEffect_j + noise.
//
// tier_eval.js instead scores each boat against the mean of the OTHER boats in its
// race. That is unbiased and it was the right call for a one-number report, but it
// throws information away: a boat's delta is measured against whichever eight rivals
// it happened to draw, so a character that repeatedly drew strong fields looks worse
// than it is, and the noise in the comparison set is carried straight into the
// estimate. Solving for all 100 character effects and all N race effects at once uses
// every boat in every race to pin every other, which is what makes ±3 places
// affordable at 600 races each rather than needing several thousand.
//
// Solved by alternating projections (the two-way ANOVA with missing cells). Each
// sweep is O(cells); it converges geometrically and 200 sweeps is far past enough.
function fitFixedEffects(races, { value = 'time', iters = 200, tol = 1e-9 } = {}) {
    const names = [];
    const idx = new Map();
    const cells = [];          // [raceIdx, charIdx, y]
    races.forEach((r, ri) => {
        for (const b of r.b) {
            const y = value === 'time' ? b[1] : b[3];
            if (y == null) continue;                        // DNF has no finish time
            let ci = idx.get(b[0]);
            if (ci === undefined) { ci = names.length; idx.set(b[0], ci); names.push(b[0]); }
            cells.push([ri, ci, y]);
        }
    });
    const nR = races.length, nC = names.length;
    const race = new Float64Array(nR), chr = new Float64Array(nC);
    const rSum = new Float64Array(nR), rCnt = new Float64Array(nR);
    const cSum = new Float64Array(nC), cCnt = new Float64Array(nC);
    for (const [ri, ci] of cells) { rCnt[ri]++; cCnt[ci]++; }

    let prev = Infinity;
    for (let it = 0; it < iters; it++) {
        rSum.fill(0); for (const [ri, ci, y] of cells) rSum[ri] += y - chr[ci];
        for (let i = 0; i < nR; i++) if (rCnt[i]) race[i] = rSum[i] / rCnt[i];
        cSum.fill(0); for (const [ri, ci, y] of cells) cSum[ci] += y - race[ri];
        for (let j = 0; j < nC; j++) if (cCnt[j]) chr[j] = cSum[j] / cCnt[j];
        // Identified only up to a constant: centre the character effects on zero so
        // "0" means "the fleet average character", not an arbitrary offset.
        let m = 0; for (let j = 0; j < nC; j++) m += chr[j];
        m /= nC; for (let j = 0; j < nC; j++) chr[j] -= m;

        if (it % 10 === 9) {
            let ss = 0; for (const [ri, ci, y] of cells) { const e = y - race[ri] - chr[ci]; ss += e * e; }
            if (Math.abs(prev - ss) < tol * Math.max(1, ss)) break;
            prev = ss;
        }
    }
    let ss = 0; for (const [ri, ci, y] of cells) { const e = y - race[ri] - chr[ci]; ss += e * e; }
    const df = Math.max(1, cells.length - nR - nC + 1);
    return { names, effect: chr, raceEffect: race, counts: cCnt, cells, nR, nC,
             residSd: Math.sqrt(ss / df) };
}

// Cluster bootstrap over RACES (not over boats): the nine boats in one race share that
// race's conditions, so resampling boats independently would understate the error by
// pretending nine correlated observations are nine independent ones.
function bootstrapSE(races, { value = 'time', reps = 200, iters = 60, seed = 12345 } = {}) {
    const base = fitFixedEffects(races, { value, iters });
    const acc = base.names.map(() => []);
    let s = seed >>> 0;
    const rnd = () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
    const nameIdx = new Map(base.names.map((n, i) => [n, i]));

    for (let rep = 0; rep < reps; rep++) {
        const samp = new Array(races.length);
        for (let i = 0; i < races.length; i++) samp[i] = races[(rnd() * races.length) | 0];
        const f = fitFixedEffects(samp, { value, iters });
        f.names.forEach((n, j) => { const k = nameIdx.get(n); if (k !== undefined) acc[k].push(f.effect[j]); });
    }
    const se = acc.map(a => {
        if (a.length < 2) return NaN;
        const m = a.reduce((x, y) => x + y, 0) / a.length;
        return Math.sqrt(a.reduce((x, y) => x + (y - m) * (y - m), 0) / (a.length - 1));
    });
    return { ...base, se };
}

// ── agreement between venues ───────────────────────────────────────────────────

// Kendall's tau-b over the characters two rankings share. This is THE number that
// decides whether one total order is honest: if venues disagree, a single column is a
// weighted average whose weights nobody chose, and the venue x character matrix is the
// real result.
function kendallTau(aMap, bMap) {
    const keys = [...aMap.keys()].filter(k => bMap.has(k));
    let conc = 0, disc = 0, tiedA = 0, tiedB = 0;
    for (let i = 0; i < keys.length; i++) {
        for (let j = i + 1; j < keys.length; j++) {
            const da = aMap.get(keys[i]) - aMap.get(keys[j]);
            const db = bMap.get(keys[i]) - bMap.get(keys[j]);
            if (da === 0 && db === 0) { tiedA++; tiedB++; continue; }
            if (da === 0) { tiedA++; continue; }
            if (db === 0) { tiedB++; continue; }
            if (da * db > 0) conc++; else disc++;
        }
    }
    const n0 = conc + disc + tiedA + tiedB;
    return (conc - disc) / Math.sqrt((n0 - tiedA) * (n0 - tiedB));
}

// ── ordinary least squares, for pricing the stats ──────────────────────────────
// Gaussian elimination on the normal equations. The design here is 100 rows by ~18
// columns, so nothing exotic is warranted.
function ols(X, y) {
    const n = X.length, p = X[0].length;
    const A = Array.from({ length: p }, () => new Float64Array(p + 1));
    for (let a = 0; a < p; a++) {
        for (let b = 0; b < p; b++) { let s = 0; for (let i = 0; i < n; i++) s += X[i][a] * X[i][b]; A[a][b] = s; }
        let s = 0; for (let i = 0; i < n; i++) s += X[i][a] * y[i]; A[a][p] = s;
    }
    for (let c = 0; c < p; c++) {
        let piv = c; for (let r = c + 1; r < p; r++) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r;
        [A[c], A[piv]] = [A[piv], A[c]];
        if (Math.abs(A[c][c]) < 1e-12) continue;
        for (let r = 0; r < p; r++) {
            if (r === c) continue;
            const f = A[r][c] / A[c][c];
            for (let k = c; k <= p; k++) A[r][k] -= f * A[c][k];
        }
    }
    const beta = new Float64Array(p);
    for (let c = 0; c < p; c++) beta[c] = Math.abs(A[c][c]) < 1e-12 ? 0 : A[c][p] / A[c][c];

    let sse = 0, sst = 0;
    const ym = y.reduce((a, b) => a + b, 0) / n;
    const resid = new Float64Array(n);
    for (let i = 0; i < n; i++) {
        let f = 0; for (let c = 0; c < p; c++) f += X[i][c] * beta[c];
        resid[i] = y[i] - f; sse += resid[i] * resid[i]; sst += (y[i] - ym) * (y[i] - ym);
    }
    // Standard errors need (X'X)^-1; recompute it by solving against identity columns.
    const XtX = Array.from({ length: p }, () => new Float64Array(p));
    for (let a = 0; a < p; a++) for (let b = 0; b < p; b++) {
        let s = 0; for (let i = 0; i < n; i++) s += X[i][a] * X[i][b]; XtX[a][b] = s;
    }
    const inv = invert(XtX, p);
    const s2 = sse / Math.max(1, n - p);
    const se = new Float64Array(p);
    for (let c = 0; c < p; c++) se[c] = inv ? Math.sqrt(Math.max(0, s2 * inv[c][c])) : NaN;

    return { beta, se, r2: sst > 0 ? 1 - sse / sst : 0, resid, n, p };
}

function invert(M, p) {
    const A = Array.from({ length: p }, (_, i) => {
        const row = new Float64Array(2 * p);
        for (let j = 0; j < p; j++) row[j] = M[i][j];
        row[p + i] = 1; return row;
    });
    for (let c = 0; c < p; c++) {
        let piv = c; for (let r = c + 1; r < p; r++) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r;
        [A[c], A[piv]] = [A[piv], A[c]];
        if (Math.abs(A[c][c]) < 1e-10) return null;
        const d = A[c][c];
        for (let k = 0; k < 2 * p; k++) A[c][k] /= d;
        for (let r = 0; r < p; r++) {
            if (r === c) continue;
            const f = A[r][c];
            for (let k = 0; k < 2 * p; k++) A[r][k] -= f * A[c][k];
        }
    }
    return A.map(row => row.slice(p));
}

// ── leg classification ─────────────────────────────────────────────────────────
//
// Conventions read out of script.js rather than assumed:
//   a boat's heading h drives velocity (sin h, -cos h)      (script.js:159)
//   TWA = normalizeAngle(heading - wind.direction)          (script.js:2314)
//   upwind when |TWA| < PI/3.5 (51.4 deg), downwind when |TWA| > PI*0.7 (126 deg)
// so wind.direction is the direction the wind blows FROM, in the heading's frame.
// Verified against seatrials, whose windDir is 0 and whose windward marks sit at
// y = -4000: heading 0 points at -y, TWA 0, a dead beat. That is the course.
const TWA_UP = Math.PI / 3.5, TWA_DOWN = Math.PI * 0.7;

function normalizeAngle(a) { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; }

function classifyLegs(marks, windDir) {
    if (!marks || marks.length < 2) return [];
    const out = [];
    for (let i = 1; i < marks.length; i++) {
        const dx = marks[i][0] - marks[i - 1][0], dy = marks[i][1] - marks[i - 1][1];
        const heading = Math.atan2(dx, -dy);
        const twa = Math.abs(normalizeAngle(heading - windDir));
        out.push(twa < TWA_UP ? 'beat' : twa > TWA_DOWN ? 'run' : 'reach');
    }
    return out;
}

module.exports = { loadVenue, fitFixedEffects, bootstrapSE, kendallTau, ols, classifyLegs, normalizeAngle };
