// ── TRAFFIC PATHS ────────────────────────────────────────────────────────────────────
// The maths under a vessel on rails: an authored polyline becomes a smooth curve, and a
// race time becomes a position, a heading and a speed on it. Pure functions over plain
// numbers — no game state, no canvas, no clock. script.js owns the lifecycle and the
// drawing; this file owns "where is it at t seconds".
//
// See guidelines/cove-traffic-plan.md for why any of this is shaped the way it is.
(function () {
'use strict';

// THE GAME'S ONE SPEED CONVERSION, derived from the fleet rather than declared: a boat
// advances `velocity * timeScale` where velocity is `dir * boat.speed` and timeScale is
// `dt * 60`, and the whole codebase reads knots off a boat as `boat.speed * 4`. So one
// knot is 60/4 = 15 units per second, and a 4-knot ship covers ground at exactly the rate
// of a 4-knot boat — which is the only thing that makes "can I make the gate before the
// ship?" a fair question.
//
// ⚠️ NOT SQUALL_DRIFT (0.18 u/frame/kt). That is how fast the BREEZE CARRIES a thing,
// a different and slower claim, and reaching for it here would put the ship at 43% of the
// speed its own document asked for.
const KT_TO_U_PER_S = 15;

// Sub-steps per authored segment when flattening the spline. The table is built once at
// compile and then only read, so density costs memory and nothing else — a few hundred
// samples is a few kilobytes.
//
// ⚠️ THIS ALSO SETS HOW SMOOTHLY THE HULL TURNS, which is why it is 64 and not 24. The
// heading comes off this table, so at 24 the cove's 19858-unit lane got 145 samples — 138
// units apart, or nearly a second of sailing each at 10 knots. Measured before the fix:
// 97.2% of frames showed NO turn at all and the rest jumped, worst case 6.9 degrees in one
// frame. A ship does not pivot; it was a staircase, and a visible one.
const FLATTEN = 64;

// Centripetal Catmull-Rom (alpha = 0.5). The uniform variant (alpha = 0) forms cusps and
// self-intersecting loops when one authored leg is much shorter than its neighbour, which
// on a hand-drawn path is not an edge case but the normal result of a quick correction.
// Centripetal is the variant that provably cannot do either.
const ALPHA = 0.5;

function crSegment(p0, p1, p2, p3, t) {
    // Knot spacing from chord lengths — this is what makes it centripetal.
    const d01 = Math.pow(Math.hypot(p1[0] - p0[0], p1[1] - p0[1]), ALPHA) || 1e-6;
    const d12 = Math.pow(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]), ALPHA) || 1e-6;
    const d23 = Math.pow(Math.hypot(p3[0] - p2[0], p3[1] - p2[1]), ALPHA) || 1e-6;
    const t0 = 0, t1 = t0 + d01, t2 = t1 + d12, t3 = t2 + d23;
    const tt = t1 + (t2 - t1) * t;
    const lerp = (a, b, ta, tb, u) => {
        const f = (u - ta) / ((tb - ta) || 1e-6);
        return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
    };
    const a1 = lerp(p0, p1, t0, t1, tt), a2 = lerp(p1, p2, t1, t2, tt), a3 = lerp(p2, p3, t2, t3, tt);
    const b1 = lerp(a1, a2, t0, t2, tt), b2 = lerp(a2, a3, t1, t3, tt);
    return lerp(b1, b2, t1, t2, tt);
}

// Normalise whatever the document holds into [{x, y, speed, dwell, heading}] with every
// speed filled in. A point without a speed INHERITS the last one named before it; a path
// naming none runs at the entry's own `speed`. Accepts [x, y] pairs as well as objects,
// because a path with one speed throughout should not have to be written as objects.
//
// HEADING IS IN DEGREES here, unlike a prop, which stores radians. Every other field in a
// traffic entry is in the units a person thinks in — knots, seconds, metres — because this
// section is meant to be readable in the document and not only through the editor, and a
// lone field in radians would be the one number a designer could not check by eye.
function normalisePoints(entry) {
    const raw = entry.path || [];
    const out = [];
    let carried = isFinite(entry.speed) ? entry.speed : 4;
    for (const p of raw) {
        const x = Array.isArray(p) ? p[0] : p.x;
        const y = Array.isArray(p) ? p[1] : p.y;
        let sp = Array.isArray(p) ? p[2] : p.speed;
        if (isFinite(sp)) carried = sp; else sp = carried;
        const o = { x, y, speed: sp, dwell: 0, hdg: null };
        if (!Array.isArray(p)) {
            if (isFinite(p.dwell)) o.dwell = Math.max(0, p.dwell);
            if (isFinite(p.heading)) o.hdg = p.heading * Math.PI / 180;
        }
        out.push(o);
    }
    return out;
}

// ── THE TWO TABLES ───────────────────────────────────────────────────────────────────
// s -> (x, y) from flattening the spline, and t -> s from integrating the speed ramp.
// Together they turn a race time into a position with no accumulator anywhere, so the
// vessel is in the same place at t = 90 whether the frame rate was 30 or 144.
function compilePath(entry) {
    const pts = normalisePoints(entry);
    if (pts.length < 2) return null;

    // ── A LOOP IS A CLOSED CURVE, NOT A PATH THAT JUMPS BACK ─────────────────────────
    // `end: wrap` used to restart at s = 0, which is only seamless if the last point sits
    // exactly on the first — and even then the HEADING snapped, because an open path takes
    // its end tangents from reflected phantom points that know nothing about the other end.
    // Compiled closed instead, the seam is not a special case at all: the segment from the
    // last point back to the first is an ordinary segment, its control points wrap around,
    // and position, heading and speed are all continuous through it. A figure eight is then
    // just a path that crosses itself.
    const closed = entry.end === 'wrap' && pts.length >= 3;
    // A closed loop's vertices are the loop; repeating the first point at the end would add
    // a zero-length segment, so an accidental duplicate is dropped rather than honoured.
    if (closed && Math.hypot(pts[0].x - pts[pts.length - 1].x, pts[0].y - pts[pts.length - 1].y) < 1) {
        pts.pop();
    }
    if (pts.length < 2) return null;

    const P = pts.map(p => [p.x, p.y]);
    const N = P.length;
    const wrapIdx = (k) => ((k % N) + N) % N;
    // Phantom endpoints by reflection for an OPEN path, so it starts and ends heading the
    // way the authored polyline does rather than swinging off toward a duplicated point. A
    // closed path needs none: its neighbours are real points.
    const ctrl = closed ? null : [
        [2 * P[0][0] - P[1][0], 2 * P[0][1] - P[1][1]],
        ...P,
        [2 * P[N - 1][0] - P[N - 2][0], 2 * P[N - 1][1] - P[N - 2][1]]
    ];
    const nSeg = closed ? N : N - 1;

    // ── WHICH WAY ROUND, PER LEG — decided before any geometry ───────────────────────
    // A leg takes its direction from whichever end names a non-zero speed. Both non-zero and
    // disagreeing is a sign change with no stop between; the validator refuses it and this
    // reads it as ahead, so a bad document still produces a hull that goes somewhere.
    const segDir = [];
    for (let i = 0; i < nSeg; i++) {
        const a = pts[i].speed, b = pts[wrapIdx(i + 1)].speed;
        segDir.push((a < 0 || b < 0) && !(a > 0 || b > 0) ? -1 : 1);
    }

    // ── A REVERSAL IS A CUSP, NOT A CORNER ───────────────────────────────────────────
    // Where a vessel changes between ahead and astern it stops and goes back the way it
    // came, and the track has a POINT there. Smoothed like any other vertex, the spline
    // rounds that point into a small U-turn — and a ship that is supposed to be backing into
    // a berth instead drives forward around a loop, which is the opposite of the manoeuvre.
    //
    // So the curve is broken at those knots: each side takes a reflected phantom instead of
    // seeing across, exactly as the two ends of an open path do. The incoming and outgoing
    // tangents then come out roughly opposite, which is what makes the HEADING continuous
    // once the astern flip is applied — a stopped hull does not swing round.
    const brk = new Array(N).fill(false);
    for (let k = 0; k < N; k++) {
        if (!closed && (k === 0 || k === N - 1)) continue;
        const inSeg = closed ? wrapIdx(k - 1) : k - 1;
        if (segDir[inSeg] !== segDir[wrapIdx(k)]) brk[k] = true;
    }
    const reflect = (a, b) => [2 * b[0] - a[0], 2 * b[1] - a[1]];   // a mirrored through b
    const cp = (i, o) => {
        const raw = closed ? P[wrapIdx(i + o)] : ctrl[i + o + 1];
        if (o === -1 && brk[closed ? wrapIdx(i) : i]) {
            // The segment STARTS at a cusp: its far neighbour is a mirror of its own next
            // point, so the tangent here is decided by this leg alone.
            const here = closed ? P[wrapIdx(i)] : P[i];
            const next = closed ? P[wrapIdx(i + 1)] : P[i + 1];
            return reflect(next, here);
        }
        if (o === 2 && brk[closed ? wrapIdx(i + 1) : i + 1]) {
            const here = closed ? P[wrapIdx(i + 1)] : P[i + 1];
            const prev = closed ? P[wrapIdx(i)] : P[i];
            return reflect(prev, here);
        }
        return raw;
    };

    // Flatten to a polyline, remembering the arc length each AUTHORED point landed at —
    // the speed ramp is defined between authored points, not between flattened samples.
    const xs = [P[0][0]], ys = [P[0][1]], ss = [0];
    const knotS = [0];
    let acc = 0;
    for (let i = 0; i < nSeg; i++) {
        for (let k = 1; k <= FLATTEN; k++) {
            const q = crSegment(cp(i, -1), cp(i, 0), cp(i, 1), cp(i, 2), k / FLATTEN);
            acc += Math.hypot(q[0] - xs[xs.length - 1], q[1] - ys[ys.length - 1]);
            xs.push(q[0]); ys.push(q[1]); ss.push(acc);
        }
        knotS.push(acc);
    }

    // ── TIME, BY CONSTANT ACCELERATION PER SEGMENT ───────────────────────────────────
    // Speed is linear in TIME, not in arc length, and that is load-bearing rather than
    // decorative. Ramping linearly in arc length makes the segment time the integral of
    // ds/v(s), which DIVERGES as the end speed goes to zero: a leg ending at 0 knots would
    // never be completed and a vessel authored to stop would creep at its last point
    // forever. Constant acceleration gives T = 2L/(v0+v1) — length over mean speed —
    // which is finite at zero, invertible in closed form, and what a real hull does.
    // knotT[i] is the ARRIVAL time at point i. A point carrying a `dwell` holds there for
    // that many seconds before leaving, so a stop is a flat stretch in the time table and
    // nothing else in the model has to know about it: position, heading, wake and collision
    // all read the same tables they always did.
    // ── ASTERN ───────────────────────────────────────────────────────────────────────
    // A NEGATIVE SPEED DOES NOT REWIND THE PATH. It means the hull covers the next stretch
    // STERN FIRST — the arc length still advances, so the time table stays monotonic and a
    // vessel can be authored to back into a berth further along its route than the point it
    // stopped at. Rewinding would put the ship somewhere it had already been, which is not
    // what backing into a dock is.
    const knotT = [0];
    const segA = [], segT = [];
    const dwell = pts.map(p => p.dwell || 0);
    let tAcc = 0;
    for (let i = 0; i < nSeg; i++) {
        const L = knotS[i + 1] - knotS[i];
        const s0 = pts[i].speed, s1 = pts[wrapIdx(i + 1)].speed;
        // MAGNITUDES drive the clock. How fast a hull is going and which way it is pointing
        // are separate questions, and only the first belongs in a time table.
        const v0 = Math.abs(s0) * KT_TO_U_PER_S;
        // The closing segment ramps back to the FIRST point's speed, so a lap ends at the
        // speed the next one begins at and the seam is invisible in the clock too.
        const v1 = Math.abs(s1) * KT_TO_U_PER_S;
        const mean = (v0 + v1) * 0.5;
        // Two consecutive zeros is a vessel that never moves; the validator rejects it, and
        // here we refuse to divide by it so a bad document cannot produce NaN positions.
        const T = mean > 1e-6 ? L / mean : 0;
        segA.push(T > 0 ? (v1 - v0) / T : 0);
        segT.push(T);
        tAcc += dwell[i] + T;
        knotT.push(tAcc);
    }
    // A dwell on the LAST point counts too — it is how a vessel authored to berth sits there
    // for a stated time before a one-shot despawn takes it away.
    // An open path may dwell at its final point; a closed one has no final point — the
    // dwell at every vertex is already counted once per lap by the loop above.
    const totalT = tAcc + (closed ? 0 : dwell[pts.length - 1]);

    // ── THE TANGENT AT EVERY SAMPLE ──────────────────────────────────────────────────
    // Density alone does not fix the staircase, it only makes the steps smaller: a heading
    // read as "which flattened segment am I on" is piecewise CONSTANT however many segments
    // there are. So the angle is stored per sample and INTERPOLATED between them, which
    // makes the heading continuous — the hull turns every frame instead of three times a
    // second. A central difference here, so each sample's tangent already accounts for the
    // curve either side of it rather than only the leg ahead.
    const hs = new Array(xs.length);
    const lastI = xs.length - 1;
    for (let i = 0; i < xs.length; i++) {
        // On a closed curve the last sample IS the first point, so the difference either
        // side of the seam reaches across it rather than falling back to one-sided — which
        // is what would put a kink in the heading exactly where a lap joins.
        let a = closed ? (i === 0 ? lastI - 1 : i - 1) : Math.max(0, i - 1);
        let b = closed ? (i === lastI ? 1 : i + 1) : Math.min(lastI, i + 1);
        // AT A CUSP the two sides point opposite ways, and averaging them gives a tangent
        // square to both — a hull sitting broadside to its own track. One-sided instead,
        // taking the direction the vessel is about to travel.
        if (i % FLATTEN === 0 && brk[closed ? wrapIdx(i / FLATTEN) : i / FLATTEN]) a = i;
        hs[i] = Math.atan2(xs[b] - xs[a], -(ys[b] - ys[a]));
    }
    // ⚠️ A CUSP NEEDS TWO TANGENTS, one per side, and a single array indexed by sample can
    // only hold one. `hs` holds the OUTGOING one; `hsIn` holds the arriving one at those
    // samples and mirrors `hs` everywhere else. Without the pair, the approach interpolates
    // toward the departing tangent and the hull spins 180 degrees through its last sample
    // interval — while decelerating, so it does it slowly and in full view.
    const cuspAt = new Array(xs.length).fill(false);
    for (let k = 0; k < N; k++) if (brk[k]) cuspAt[k * FLATTEN] = true;
    const hsIn = hs.slice();
    for (let i = 1; i < xs.length; i++) {
        if (cuspAt[i]) hsIn[i] = Math.atan2(xs[i] - xs[i - 1], -(ys[i] - ys[i - 1]));
    }
    // ── AN AUTHORED HEADING OVERRIDES THE TANGENT ────────────────────────────────────
    // On rails a hull points where it is going, and that is right while it is going
    // somewhere. It says nothing at all when the vessel is STOPPED — at a berth, at a mid-
    // path dwell, or sitting where `end: stay` left it — and "along the curve I am not
    // currently travelling" is an arbitrary answer to a question the designer should get to
    // settle. So a point may name a heading, in degrees.
    //
    // Blended out to the HALFWAY MARK of each neighbouring leg rather than applied at the
    // one sample, so a vessel swings onto its authored angle and off it again instead of
    // snapping. Windows meet at the midpoints and never overlap, so two authored headings in
    // a row cannot fight.
    for (let k = 0; k < pts.length; k++) {
        if (pts[k].hdg == null) continue;
        const idx = k * FLATTEN;
        const back = k > 0 ? FLATTEN >> 1 : 0;
        const fwd = k < pts.length - 1 ? FLATTEN >> 1 : 0;
        for (let j = Math.max(0, idx - back); j <= Math.min(hs.length - 1, idx + fwd); j++) {
            const span = j < idx ? back : (j > idx ? fwd : 1);
            const u = span > 0 ? 1 - Math.abs(j - idx) / span : 1;
            const w = u * u * (3 - 2 * u);         // 1 at the point, 0 at the window edge
            let d = pts[k].hdg - hs[j];
            while (d > Math.PI) d -= 2 * Math.PI;
            while (d < -Math.PI) d += 2 * Math.PI;
            hs[j] += d * w;
        }
    }

    // Shortest way round, so a lane crossing due north does not spin the hull the long way
    // when the angle wraps from +pi to -pi.
    const angLerp = (a, b, t) => {
        let d = b - a;
        while (d > Math.PI) d -= 2 * Math.PI;
        while (d < -Math.PI) d += 2 * Math.PI;
        return a + d * t;
    };

    const lookupS = (s) => {
        // Binary search the flattened table, then lerp within the sample.
        if (s <= 0) return { x: xs[0], y: ys[0], i: 0, f: 0 };
        const n = ss.length;
        if (s >= ss[n - 1]) return { x: xs[n - 1], y: ys[n - 1], i: n - 2, f: 1 };
        let lo = 0, hi = n - 1;
        while (hi - lo > 1) { const m = (lo + hi) >> 1; if (ss[m] <= s) lo = m; else hi = m; }
        const f = (s - ss[lo]) / ((ss[hi] - ss[lo]) || 1e-6);
        return { x: xs[lo] + (xs[hi] - xs[lo]) * f, y: ys[lo] + (ys[hi] - ys[lo]) * f, i: lo, f };
    };

    // One place the heading is read, so `at` and `atArc` cannot drift apart.
    const headingS = (p) => {
        const j = Math.min(hs.length - 1, p.i + 1);
        return angLerp(hs[p.i], cuspAt[j] ? hsIn[j] : hs[j], p.f);
    };
    // The heading a hull HOLDS while stopped at knot k, having arrived on a leg going `dir`.
    // At a cusp that is the ARRIVING tangent — which, once the astern flip is applied, is the
    // same angle the departing leg will use, so nothing turns when the wait ends.
    // If the two legs are not exactly opposed — and hand-drawn ones never are — there is a
    // few degrees between the attitude it arrives in and the one it leaves in. Given a wait,
    // that turn is spread across it: a hull easing round on its lines. Given none, there is
    // no time and it happens at once, which is what the validator warns about.
    const heldAt = (k, inDir, u) => {
        const idx = k * FLATTEN;
        const outDir = segDir[closed ? wrapIdx(k) : Math.min(k, segDir.length - 1)] || inDir;
        const arrive = (cuspAt[idx] ? hsIn[idx] : hs[idx]) + (inDir < 0 ? Math.PI : 0);
        const depart = hs[idx] + (outDir < 0 ? Math.PI : 0);
        return angLerp(arrive, depart, u * u * (3 - 2 * u));
    };

    return {
        length: acc,
        duration: totalT,
        closed,
        // Where the vessel is `t` seconds after it got underway. Heading is the tangent, so
        // a hull points where it is going without anyone authoring an angle.
        at(t) {
            const T = Math.max(0, Math.min(totalT, t));
            let i = 0;
            while (i < knotT.length - 2 && knotT[i + 1] <= T) i++;
            // Time since ARRIVING at point i. The first `dwell[i]` seconds of it are spent
            // stopped there; only what is left is spent sailing to the next point.
            const since = T - knotT[i];
            if (since < dwell[i]) {
                const p0 = lookupS(knotS[i]);
                // It arrived on the previous leg and leaves on this one. If those disagree
                // about which way round the hull sits, the turn happens HERE, spread across
                // the wait — a ship swinging at its berth rather than flipping in a frame.
                // On a path that doubles back into the berth the two cancel and nothing
                // turns at all, which is the usual case and the reason this is rarely seen.
                // The heading it is HOLDING is the one it arrived with. No swing across the
                // wait: the cusp above already puts the two legs' tangents nose to nose, so
                // applying the astern flip leaves the bow exactly where it was — which is
                // what a stopped hull does. A blend here would rotate a berthed ship for no
                // reason.
                const inDir = segDir[i > 0 ? i - 1 : (closed ? segDir.length - 1 : 0)] || 1;
                const h = heldAt(i, inDir, dwell[i] > 0 ? Math.max(0, Math.min(1, since / dwell[i])) : 1);
                return {
                    x: p0.x, y: p0.y, s: knotS[i], heading: h,
                    speed: 0, knots: 0, stopped: true, astern: inDir < 0, done: t >= totalT
                };
            }
            // Clamped to the leg, so the tail of a dwell on the LAST point cannot run the
            // position past the end of the path or the speed past its final value.
            const tau = Math.max(0, Math.min(segT[i], since - dwell[i]));
            // ⚠️ MAGNITUDE, exactly as the table that produced segA was built from. Clamping
            // with max(0, speed) instead silently zeroed the entry speed of every ASTERN leg
            // while leaving its deceleration intact, so the arc length ran BACKWARDS down
            // the curve and the hull walked back the way it came at a reported 0 knots.
            const v0 = Math.abs(pts[i].speed) * KT_TO_U_PER_S;
            const a = segA[i] || 0;
            const s = knotS[i] + v0 * tau + 0.5 * a * tau * tau;
            const p = lookupS(s);
            const dir = segDir[i] || 1;
            return {
                x: p.x, y: p.y, s,
                // Screen convention: heading 0 is -y (north), matching props and boats.
                // Astern, the hull points the other way down the same track.
                heading: headingS(p) + (dir < 0 ? Math.PI : 0),
                astern: dir < 0,
                speed: Math.max(0, v0 + a * tau),          // u/s
                knots: Math.max(0, v0 + a * tau) / KT_TO_U_PER_S,
                stopped: false,
                done: t >= totalT
            };
        },
        // Where the vessel WAS, indexed by distance along the path rather than by time.
        // The wake wants this: a hull on rails has already been everywhere its wake needs
        // to be, so the track behind it is exactly `atArc(s - d)` for d units astern. No
        // history buffer, no sampling clock, and it stays correct through a turn — which a
        // ribbon of remembered points only manages if it was sampled finely enough.
        atArc(s) {
            // Wrapped for a loop: a vessel a lap in has water behind it all the way round,
            // and a wake that stopped dead at s = 0 would announce where the seam is.
            const p = lookupS(closed ? ((s % acc) + acc) % acc : Math.max(0, Math.min(acc, s)));
            return { x: p.x, y: p.y, heading: headingS(p) };
        },
        sampleAt: lookupS,
        knotS, knotT, points: pts
    };
}

// ── THE LIFECYCLE ────────────────────────────────────────────────────────────────────
// Given the race clock, is this vessel on the water — and if so, how far into its passage?
// ONE COPY, because the game and the editor both have to answer it and a scrubber that
// disagreed with the race about when a ship is there would be worse than no scrubber.
//
// Returns null when the vessel is absent, else { t, reverse }: the time INTO its own path,
// and whether it is running that path backwards (pingpong's return leg).
function localTime(entry, path, now) {
    const dur = path && path.duration;
    if (!(dur > 0)) return null;
    const first = isFinite(entry.firstSpawn) ? entry.firstSpawn : 0;
    const elapsed = now - first;
    if (elapsed < 0) return null;
    switch (entry.end || 'despawn') {
        case 'stay':
            // Runs the path once and then IS where it stopped, for good.
            return { t: Math.min(elapsed, dur), reverse: false };
        case 'wrap':
            return { t: elapsed % dur, reverse: false };
        case 'pingpong': {
            const m = elapsed % (2 * dur);
            return m <= dur ? { t: m, reverse: false } : { t: 2 * dur - m, reverse: true };
        }
        default: {
            if (!entry.respawn) return elapsed <= dur ? { t: elapsed, reverse: false } : null;
            const gap = Math.max(0, isFinite(entry.respawnDelay) ? entry.respawnDelay : 60);
            const m = elapsed % (dur + gap);
            return m <= dur ? { t: m, reverse: false } : null;
        }
    }
}

window.Traffic = { compilePath, localTime, KT_TO_U_PER_S, FLATTEN };
})();
