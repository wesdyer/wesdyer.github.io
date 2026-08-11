// TRAFFIC: vessels on rails — path maths, lifecycle, wind shadow, and the pushing hull.
//
//   node regatta/eval/test_traffic.js
//
// Two halves. The first runs js/traffic.js in bare node with no browser at all, because the
// path module is deliberately free of the DOM and the maths under it is where the subtle
// failures live. The second races Lighthouse Cove, which is the only venue authoring a
// `traffic` section today.
//
// THE CHECK THIS FILE EXISTS FOR is "a leg ending at 0 knots still arrives". Ramp speed
// linearly in ARC LENGTH — the obvious implementation — and the segment time is the
// integral of ds/v(s), which DIVERGES as the end speed goes to zero: a vessel authored to
// stop creeps at its last point forever and `end: "stay"` never fires. Constant
// acceleration gives T = 2L/(v0+v1), finite at zero. Nothing else in the file would catch
// that regression, because every path that does not end stopped behaves identically.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '../..');
let failures = 0;
const check = (name, cond, detail) => {
    if (cond) console.log(`  ok    ${name}${detail ? '   ' + detail : ''}`);
    else { console.log(`  FAIL  ${name}${detail ? ' — ' + detail : ''}`); failures++; }
};

// ── 1. The path module, headless ────────────────────────────────────────────
console.log('path maths (no browser)');
const win = {};
new Function('window', fs.readFileSync(path.join(ROOT, 'regatta/js/traffic.js'), 'utf8'))(win);
const T = win.Traffic;
const KT = T.KT_TO_U_PER_S;

check('one knot is 15 u/s, the fleet\'s own clock', KT === 15,
      'not SQUALL_DRIFT (0.18 u/frame/kt), which is how fast the BREEZE carries a thing');
{
    const p = T.compilePath({ path: [[0, 0], [1500, 0]], speed: 4 });
    check('constant speed: duration is L/v', Math.abs(p.duration - 1500 / (4 * KT)) < 1e-6,
          `${p.duration.toFixed(3)}s`);
    check('heading points along travel', Math.abs(p.at(p.duration / 2).heading - Math.PI / 2) < 1e-3);
}
{
    // ⚠️ THE ZERO-ARRIVAL CHECK. See the note at the top of this file.
    const p = T.compilePath({ path: [[0, 0, 6], [1000, 0, 0]] });
    check('a leg ending at 0kt still ARRIVES', isFinite(p.duration) && p.duration > 0,
          `${p.duration.toFixed(3)}s — linear-in-arc-length would be infinite`);
    check('and it is 2L/(v0+v1) exactly', Math.abs(p.duration - 2 * 1000 / (6 * KT)) < 1e-6);
    check('it reaches the last point stopped',
          Math.abs(p.at(p.duration).x - 1000) < 1 && p.at(p.duration).knots < 1e-6);
}
{
    const p = T.compilePath({ path: [[0, 0, 0], [800, 0, 5]] });
    check('a vessel may start from rest', isFinite(p.duration) && p.at(0).knots < 1e-9,
          `${p.duration.toFixed(2)}s to make 5kt`);
}
{
    const p = T.compilePath({ path: [[0, 0, 5], [500, 0], [1000, 0]], speed: 9 });
    check('a point with no speed inherits the last one', Math.abs(p.points[2].speed - 5) < 1e-9,
          'entry.speed 9 is only the fallback for a path naming none');
}
{
    const p = T.compilePath({ path: [[0, 0, 6], [1000, 0, 2], [2000, 0, 2]] });
    check('the ramp reaches its speed AT the point', Math.abs(p.at(p.knotT[1]).knots - 2) < 1e-4);
    check('and is linear in TIME, not distance', Math.abs(p.at(p.knotT[1] / 2).knots - 4) < 1e-4,
          'mid-time speed is the mean of the endpoints');
}
{
    // A short leg between two long ones is where uniform Catmull-Rom cusps and loops.
    const p = T.compilePath({ path: [[0, 0], [1000, 0], [1030, 20], [2000, 400]], speed: 5 });
    let back = 0, prev = null;
    for (let k = 0; k <= 400; k++) {
        const q = p.at(p.duration * k / 400);
        if (prev && q.x - prev.x < -1) back++;
        prev = q;
    }
    check('centripetal smoothing does not cusp on a tight correction', back === 0, `${back} reversals`);
}
{
    // ── A MID-PATH STOP ──────────────────────────────────────────────────────
    // `dwell` seconds at a point whose speed is 0: decelerate in, hold, accelerate out.
    const runs = T.compilePath({ path: [[0, 0, 6], [1000, 0, 0], [2000, 0, 6]] });
    const waits = T.compilePath({ path: [[0, 0, 6], { x: 1000, y: 0, speed: 0, dwell: 30 }, [2000, 0, 6]] });
    check('a dwell adds exactly its own seconds', Math.abs(waits.duration - runs.duration - 30) < 1e-6,
          `${runs.duration.toFixed(2)}s -> ${waits.duration.toFixed(2)}s`);
    const mid = waits.at(runs.duration / 2 + 15);
    check('the vessel is stopped for the whole dwell', mid.stopped && mid.knots === 0
          && Math.abs(mid.x - 1000) < 1, `at (${mid.x.toFixed(1)}, ${mid.y.toFixed(1)}), ${mid.knots}kt`);
    check('it does not drift while it waits',
          Math.abs(waits.at(runs.duration / 2 + 1).x - waits.at(runs.duration / 2 + 29).x) < 1e-9);
    check('and it gets under way again after it', waits.at(waits.duration).knots > 5.9
          && Math.abs(waits.at(waits.duration).x - 2000) < 1,
          `${waits.at(waits.duration).knots.toFixed(2)}kt at the end`);
    // A dwell on the LAST point is how a berthing sits for a stated time before despawning.
    const berth = T.compilePath({ path: [[0, 0, 6], { x: 1000, y: 0, speed: 0, dwell: 20 }] });
    check('a dwell on the last point counts toward the passage',
          Math.abs(berth.duration - (2 * 1000 / (6 * KT) + 20)) < 1e-6, `${berth.duration.toFixed(2)}s`);
    check('and the hull stays put through it, not past the end',
          Math.abs(berth.at(berth.duration - 1).x - 1000) < 1e-6);
}
{
    // ── AN AUTHORED HEADING ──────────────────────────────────────────────────
    // On rails a hull points where it is going — which says nothing when it is NOT going
    // anywhere. A point may name a heading in degrees; it wins there and blends out.
    const plain = T.compilePath({ path: [[0, 0], [1000, 0], [2000, 0]], speed: 6 });
    const turned = T.compilePath({ path: [{ x: 0, y: 0, heading: 90 }, [1000, 0], [2000, 0]], speed: 6 });
    check('the tangent alone would point due east here',
          Math.abs(plain.at(0).heading - Math.PI / 2) < 1e-3, `${(plain.at(0).heading * 57.3).toFixed(1)} deg`);
    check('an authored heading wins at its own point',
          Math.abs(turned.at(0).heading - Math.PI / 2) < 1e-3, '90 deg authored');
    const north = T.compilePath({ path: [{ x: 0, y: 0, heading: 0 }, [1000, 0], [2000, 0]], speed: 6 });
    check('...and 0 means north, the game\'s own convention',
          Math.abs(north.at(0).heading) < 1e-3, `${(north.at(0).heading * 57.3).toFixed(2)} deg`);
    // It must SWING onto the travel heading, not snap to it.
    let worst = 0, prev = null;
    for (let f = 0; f < north.duration * 60; f++) {
        const h = north.at(f / 60).heading;
        if (prev !== null) {
            let d = h - prev;
            while (d > Math.PI) d -= 2 * Math.PI;
            while (d < -Math.PI) d += 2 * Math.PI;
            worst = Math.max(worst, Math.abs(d) * 180 / Math.PI);
        }
        prev = h;
    }
    check('it swings onto the lane rather than snapping', worst < 1.5,
          `worst ${worst.toFixed(2)} deg/frame while turning 90 deg onto the track`);
    check('and is back on the tangent well before the next point',
          Math.abs(north.at(north.duration * 0.5).heading - Math.PI / 2) < 1e-2);
}
{
    // ── ASTERN ───────────────────────────────────────────────────────────────
    // A negative speed does NOT rewind the path — the hull covers the next stretch stern
    // first, so a vessel can back into a berth that lies further along its route.
    const back = T.compilePath({ path: [
        { x: 0, y: 0, speed: 6 }, { x: 1000, y: 0, speed: 0, dwell: 8 },
        { x: 400, y: 600, speed: -3 }, { x: 200, y: 900, speed: 0, dwell: 40 },
        { x: 900, y: 400, speed: 5 }, { x: 2500, y: 0, speed: 8 } ] });
    check('a negative speed compiles', !!back && back.duration > 0, `${back.duration.toFixed(1)}s`);
    // ⚠️ THE ARC LENGTH MUST STILL ADVANCE. Taking max(0, speed) instead of the magnitude
    // zeroed an astern leg's entry speed while leaving its deceleration, and the hull walked
    // BACK down the curve at a reported 0 knots.
    let mono = true, prevS = -1;
    for (let k = 0; k < back.duration * 20; k++) {
        const q = back.at(k / 20);
        if (q.s < prevS - 1e-6) mono = false;
        prevS = q.s;
    }
    check('the path still advances while going astern', mono, 'negative speed is a heading, not a rewind');
    const mid = back.at(back.knotT ? (back.knotT[2] + back.knotT[3]) / 2 : 0);
    check('the leg reports itself astern', mid.astern === true, `${mid.knots.toFixed(2)}kt astern`);
    check('...and its speed is a magnitude, not a negative', mid.knots > 0);

    // ⚠️ A REVERSAL IS A CUSP. Smoothed like an ordinary vertex, the spline rounds the stop
    // into a U-turn and the ship drives forward round a loop instead of backing up. What
    // says the cusp is there is that the HEADING stays put: a stopped hull does not swing.
    let worstHdg = 0, worstPos = 0, prev = null;
    for (let k = 0; k < back.duration * 60; k++) {
        const q = back.at(k / 60);
        if (prev) {
            worstPos = Math.max(worstPos, Math.hypot(q.x - prev.x, q.y - prev.y));
            let d = q.heading - prev.heading;
            while (d > Math.PI) d -= 2 * Math.PI;
            while (d < -Math.PI) d += 2 * Math.PI;
            worstHdg = Math.max(worstHdg, Math.abs(d) * 180 / Math.PI);
        }
        prev = q;
    }
    check('the whole manoeuvre is continuous in position', worstPos < 8 * KT / 60 * 1.2,
          `worst ${worstPos.toFixed(2)}u a frame`);
    check('...and the hull never snaps round', worstHdg < 1.0,
          `worst ${worstHdg.toFixed(2)} deg a frame across two reversals and a berthing`);

    // A reversal with NO dwell has no time to turn, and the swing lands in one frame.
    const rush = T.compilePath({ path: [
        { x: 0, y: 0, speed: 6 }, { x: 1000, y: 0, speed: 0 },
        { x: 400, y: 600, speed: -3 }, { x: 200, y: 900, speed: 0 } ] });
    let snap = 0; prev = null;
    for (let k = 0; k < rush.duration * 60; k++) {
        const q = rush.at(k / 60);
        if (prev) {
            let d = q.heading - prev.heading;
            while (d > Math.PI) d -= 2 * Math.PI;
            while (d < -Math.PI) d += 2 * Math.PI;
            snap = Math.max(snap, Math.abs(d) * 180 / Math.PI);
        }
        prev = q;
    }
    check('without a dwell the reversal turn is instant — which the validator warns about',
          snap > 1.0, `${snap.toFixed(1)} deg in one frame; the same path with a dwell was ${worstHdg.toFixed(2)}`);
}
{
    // ── A LOOP IS A CLOSED CURVE ─────────────────────────────────────────────
    // `end: wrap` used to restart at s = 0, seamless only if the last point sat exactly on
    // the first — and even then the HEADING snapped, because an open path takes its end
    // tangents from reflected phantoms that know nothing about the other end.
    const EIGHT = [{ x: 0, y: -1200, speed: 8 }, { x: 900, y: -600 }, { x: 900, y: 600 },
                   { x: -900, y: -600 }, { x: -900, y: 600 }, { x: 0, y: 1200 }];
    const loop = T.compilePath({ end: 'wrap', path: EIGHT.map(p2 => ({ ...p2 })) });
    check('a looping path compiles closed', loop && loop.closed === true,
          `${loop.length.toFixed(0)}u lap in ${loop.duration.toFixed(1)}s`);
    // The closing segment is a real segment, so the lap is longer than the open polyline.
    const open = T.compilePath({ end: 'despawn', path: EIGHT.map(p2 => ({ ...p2 })) });
    check('...with the closing leg included', loop.length > open.length,
          `${open.length.toFixed(0)}u open vs ${loop.length.toFixed(0)}u closed`);

    // ⚠️ THE SEAM TEST. Frame by frame across the join: a lap must continue, not restart.
    let jump = 0, prev = null;
    for (let k = -120; k <= 120; k++) {
        const t = loop.duration + k / 60;
        const q = loop.at(T.localTime({ end: 'wrap' }, loop, t).t);
        if (prev) jump = Math.max(jump, Math.hypot(q.x - prev.x, q.y - prev.y));
        prev = q;
    }
    const perFrame = 8 * KT / 60;
    check('the join is continuous in position', jump < perFrame * 1.5,
          `worst ${jump.toFixed(2)}u a frame against ${perFrame.toFixed(2)}u of ordinary travel`);

    // ⚠️ THE STRONGER TEST: move the join and the curve must not change shape. A kink at the
    // join would travel with it; genuine closure is rotation-invariant.
    const rolled = EIGHT.map((_, i) => ({ ...EIGHT[(i + 3) % EIGHT.length] }));
    rolled[0].speed = 8;
    const loop2 = T.compilePath({ end: 'wrap', path: rolled });
    let worstPos = 0, worstHdg = 0;
    for (let k = 0; k < 2000; k++) {
        const d = loop.length * k / 2000;
        const a = loop.atArc(loop.knotS[3] + d), b = loop2.atArc(loop2.knotS[0] + d);
        worstPos = Math.max(worstPos, Math.hypot(a.x - b.x, a.y - b.y));
        let dh = a.heading - b.heading;
        while (dh > Math.PI) dh -= 2 * Math.PI;
        while (dh < -Math.PI) dh += 2 * Math.PI;
        worstHdg = Math.max(worstHdg, Math.abs(dh) * 180 / Math.PI);
    }
    check('the same loop started at a different vertex is the same curve',
          worstPos < 1 && worstHdg < 0.5,
          `worst ${worstPos.toFixed(4)}u and ${worstHdg.toFixed(4)} deg apart — a kink would move with the join`);

    // The arc lookup wraps, so a wake trails round the loop instead of stopping at the seam.
    const back = loop.atArc(-200), fwd = loop.atArc(loop.length - 200);
    check('arc length wraps on a loop', Math.hypot(back.x - fwd.x, back.y - fwd.y) < 1e-6,
          'a wake behind the join reaches back round the lap');

    // A figure eight crosses itself, which is a path shape, not an error.
    check('a self-crossing loop is legal', loop.duration > 0 && isFinite(loop.at(loop.duration / 2).x));
}
{
    // ── THE STAIRCASE GUARD ──────────────────────────────────────────────────
    // The heading is read off the FLATTENED table, so if it is taken as "which segment am I
    // on" it is piecewise CONSTANT: the hull holds still, then snaps. Measured when this was
    // the case, on the cove's own lane: 97.2% of frames turned by exactly zero and the rest
    // jumped up to 6.9 degrees in one frame. Density alone does not fix it — only smaller
    // steps — so what this guards is CONTINUITY, not resolution.
    const curvy = T.compilePath({
        path: [[0, 0], [2000, 600], [3500, 2400], [3000, 5000], [800, 6000], [-1500, 5200]],
        speed: 10
    });
    let prev = null, frozen = 0, worst = 0, n = 0;
    for (let f = 0; f < Math.floor(curvy.duration * 60); f++) {
        const h = curvy.at(f / 60).heading;
        if (prev !== null) {
            let d = h - prev;
            while (d > Math.PI) d -= 2 * Math.PI;
            while (d < -Math.PI) d += 2 * Math.PI;
            const deg = Math.abs(d) * 180 / Math.PI;
            if (deg < 1e-9) frozen++;
            if (deg > worst) worst = deg;
            n++;
        }
        prev = h;
    }
    check('the hull turns EVERY frame, not in steps', frozen / n < 0.02,
          `${(100 * frozen / n).toFixed(1)}% of frames turned by exactly zero (was 97.2%)`);
    check('and no frame snaps', worst < 1.0, `worst ${worst.toFixed(3)} deg/frame (was 6.9)`);
}
{
    const z = T.compilePath({ path: [[0, 0, 0], [100, 0, 0]] });
    const at = z.at(5);
    check('a degenerate document yields no NaN', isFinite(at.x) && isFinite(at.knots),
          'the validator rejects two consecutive zeros; this is the belt to that brace');
    check('a one-point path compiles to nothing', T.compilePath({ path: [[0, 0]], speed: 4 }) === null);
}

// ── 2. In the running game ──────────────────────────────────────────────────
(async () => {
    console.log('\nLighthouse Cove, racing');
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
    const errs = [];
    page.on('pageerror', e => errs.push(e.message));
    await page.addInitScript(() => localStorage.setItem('regatta_settings', JSON.stringify({ venue: 'bay' })));
    await page.goto('file://' + path.resolve(ROOT, 'regatta/index.html'));
    await page.waitForTimeout(2800);

    const out = await page.evaluate(async () => {
        const r = [];
        const ok = (n, c, d = '') => r.push([n, !!c, d]);

        const bad = [];
        for (const k of ['bay', 'lake', 'lagoon', 'swamp', 'river', 'ocean', 'redrock', 'glowtide', 'arctic', 'seatrials']) {
            const doc = window.VenueDoc.get(k);
            if (!doc) continue;
            const e = window.VenueDoc.validate(doc).filter(p => p.level === 'error');
            if (e.length) bad.push(k + ': ' + e.map(p => p.msg).join('; '));
        }
        ok('every venue still validates', bad.length === 0, bad.join(' | '));

        resetGame();
        await new Promise(res => setTimeout(res, 1500));
        startRace();
        for (let i = 0; i < 30; i++) update(1 / 60);

        const v = state.traffic[0];
        ok('the cove compiles its vessel', !!v, `${state.traffic.length} vessel(s)`);
        if (!v) return r;

        const setClock = (t) => { state.race.status = t >= 0 ? 'racing' : 'prestart'; state.race.timer = Math.abs(t); updateTraffic(); };
        const dur = v.path.duration, first = v.firstSpawn, delay = v.respawnDelay;

        // lifecycle
        setClock(first - 5); ok('absent before firstSpawn', !v.active);
        // AT THE SPAWN INSTANT, not half a second after it. The lane's speed is authored and
        // may be anything — at 20 knots a vessel is 150 units down the track in that half
        // second, so a fixed tolerance turns "the designer sped the ship up" into a failure.
        // At elapsed zero the answer is exact whatever the speed.
        setClock(first);
        // ⚠️ AGAINST THE DOCUMENT, not against remembered coordinates. A venue's lane is
        // meant to be moved — the designer redraws it in the editor and saves — and a test
        // that hardcodes where it used to be reports ordinary authoring as a bug.
        const head = v.path.points[0];
        ok('spawns at the head of its path', v.active && Math.hypot(v.x - head.x, v.y - head.y) < 1,
           `(${v.x.toFixed(0)},${v.y.toFixed(0)}) vs authored (${head.x.toFixed(0)},${head.y.toFixed(0)})`);
        setClock(first + dur + 2); ok('despawns at the end', !v.active);
        setClock(first + dur + delay - 2); ok('stays away through respawnDelay', !v.active);
        setClock(first + dur + delay + 1); ok('respawns on schedule', v.active);

        // determinism: the same clock is the same answer, whatever happened in between
        setClock(first + 40);
        const a = { x: v.x, y: v.y };
        for (let i = 0; i < 200; i++) setClock(first + Math.random() * dur);
        setClock(first + 40);
        ok('position is a pure function of the race clock',
           Math.abs(v.x - a.x) < 1e-9 && Math.abs(v.y - a.y) < 1e-9,
           'no accumulator, so 30fps and 144fps agree');

        // hull, measured off the bake
        setClock(first + dur * 0.5);
        ok('the hull is the measured oblong, not the sprite frame',
           Math.abs(v.hullLen - 662) < 4 && Math.abs(v.hullBeam - 173) < 4,
           `${v.hullLen.toFixed(0)} x ${v.hullBeam.toFixed(0)}u`);

        // ── WIND SHADOW: the cove's promised mechanic ───────────────────────
        const fx = -Math.sin(v.windDir), fy = Math.cos(v.windDir);
        const at = (d) => getWindAt(v.x + fx * d, v.y + fy * d).speed;
        // A/B the same point. Sampling somewhere far off and calling it clear air measures
        // the whole wind field — islands, gusts, gradients — and resetGame re-rolls it.
        const ab = (d) => { const on = at(d); v.active = false; const off = at(d); v.active = true; return [on, off]; };
        const [lee5, bare5] = ab(500), [lee9, bare9] = ab(900), [farOn, farOff] = ab(6000);
        ok('the ship drags a hole in the breeze', lee5 < bare5 * 0.65,
           `${lee5.toFixed(2)}kt vs ${bare5.toFixed(2)}kt without it`);
        ok('the lee recovers down the plume', lee9 / bare9 > lee5 / bare5,
           `${(100 * lee5 / bare5).toFixed(0)}% at 500u, ${(100 * lee9 / bare9).toFixed(0)}% at 900u`);
        ok('and reaches no further than it should', Math.abs(farOn - farOff) < 1e-9,
           `lee is ${v.shadowLen.toFixed(0)}u`);
        // THE POINT OF THE SECOND PASS: wind, without touching routing.
        const isl = state.course.navIslands || state.course.islands || [];
        ok('no vessel ever enters the islands list', !isl.some(i => i.id === 'ship-1'),
           'a moving caster in front of the router is the thing this design avoids');

        // ── WAKE BELONGS TO THE VESSEL ──────────────────────────────────────
        // Varying the KIND, not a field on the lane: a hull throws what its shape throws.
        const savedTraffic = state.course.doc.traffic;
        const fillsFor = (kind, astern) => {
            state.course.doc.traffic = [ astern
                ? { id: 'w', kind, firstSpawn: 0, path: [
                    { x: 0, y: -4000, speed: 7 }, { x: 0, y: 0, speed: 0, dwell: 6 },
                    { x: 0, y: 4000, speed: -7 } ] }
                : { id: 'w', kind, firstSpawn: 0, path: [
                    { x: 0, y: -6000, speed: 7 }, { x: 0, y: 6000, speed: 7 } ] }];
            initTraffic();
            state.race.status = 'racing'; state.race.timer = astern ? 120 : 60;
            updateTraffic();
            const w2 = state.traffic[0];
            state.camera.x = w2.x; state.camera.y = w2.y;
            const c2 = document.getElementById('gameCanvas').getContext('2d');
            const proto2 = Object.getPrototypeOf(c2);
            const realFill = proto2.fill;
            let n2 = 0;
            proto2.fill = function (...a) { n2++; return realFill.apply(this, a); };
            drawTrafficWakes(c2);
            proto2.fill = realFill;
            return { fills: n2, v: w2 };
        };
        const K = window.VenueDoc.PROP_KINDS;
        const vessels = Object.keys(K).filter(k => Array.isArray(K[k].hull));
        ok('every vessel kind carries a wake', vessels.every(k => K[k].wake && K[k].wake.kind),
           vessels.map(k => `${k.replace('bay-cove-','')}:${K[k].wake.kind}`).join(' '));

        const ship = fillsFor('bay-cove-cargo-ship', false);
        const cat = fillsFor('bay-cove-fast-ferry', false);
        const boat = fillsFor('bay-cove-motorboat', false);
        ok('a displacement hull throws the wedge', ship.v.wake.style === 'kelvin' && ship.fills > 60,
           `${ship.fills} fills`);
        ok('a planing craft leaves a ribbon', boat.v.wake.style === 'ribbon' && boat.fills > 10,
           `${boat.fills} fills`);
        // ⚠️ A CATAMARAN IS NOT A WIDE MONOHULL. Two narrow trails with water between them,
        // which is twice the geometry of one — drawn as a single broad band it would claim a
        // displacement hull that is not there.
        ok('a catamaran leaves TWO ribbons', cat.v.wakeHulls.length === 2 && cat.fills === boat.fills * 2,
           `${cat.fills} fills against a single hull's ${boat.fills}`);
        ok('...offset either side of the centreline, and narrower than her beam',
           cat.v.wakeHulls[0] < 0 && cat.v.wakeHulls[1] > 0 && cat.v.wakeBeam < cat.v.hullBeam,
           `hulls at ${cat.v.wakeHulls.map(x => x.toFixed(0)).join(' and ')}u, each ${cat.v.wakeBeam.toFixed(0)}u wide of a ${cat.v.hullBeam.toFixed(0)}u beam`);

        // ── ASTERN: THE DOUBLE-ENDER IS THE EXCEPTION ───────────────────────
        const deAstern = fillsFor('bay-cove-ferry', true);
        const shipAstern = fillsFor('bay-cove-cargo-ship', true);
        ok('a hull with two bows still wakes when running astern',
           deAstern.v.astern === true && deAstern.fills > 60,
           `${deAstern.fills} fills while astern`);
        ok('...and an ordinary hull backing down does not',
           shipAstern.v.astern === true && shipAstern.fills === 0,
           'a ship going backwards churns; it does not throw a bow wave');

        state.course.doc.traffic = savedTraffic;
        initTraffic();
        setClock(first + dur * 0.5);

        // ── THE PUSHING HULL ────────────────────────────────────────────────
        const me = state.boats.find(b => b.isPlayer);
        const px = Math.cos(v.heading), py = Math.sin(v.heading);
        setClock(first + dur * 0.5);
        me.x = v.x; me.y = v.y; me.speed = 0; me.velocity.x = 0; me.velocity.y = 0;
        let n = 0;
        while (n++ < 400) {
            checkTrafficCollisions(1 / 60);
            if (Math.abs((me.x - v.x) * px + (me.y - v.y) * py) > v.hullBeam * 0.5) break;
        }
        ok('a boat inside the hull is pushed out', n < 400, `${n} frames`);
        // ⚠️ REGRESSION GUARD. The normal must come from the boat's CENTRE. Taken from the
        // nearest hull corner it flips every time the boat is nudged, because a hull
        // straddling the centreline has corners on both sides — measured before the fix, a
        // boat amidships oscillated +4.33u/-4.33u forever and never came out.
        ok('the push does not oscillate', n > 3 && n < 200, `${n} frames, monotone`);

        me.x = v.x; me.y = v.y;
        const p0 = { x: me.x, y: me.y };
        checkTrafficCollisions(1 / 60);
        ok('one frame is rate-capped', Math.hypot(me.x - p0.x, me.y - p0.y) <= 260 / 60 + 2.5,
           'no boat is moved faster than it can be seen to move');

        me.x = v.x + px * (v.hullBeam * 0.5 + 200); me.y = v.y + py * (v.hullBeam * 0.5 + 200);
        const q0 = { x: me.x, y: me.y };
        checkTrafficCollisions(1 / 60);
        ok('no invisible wall alongside', Math.abs(me.x - q0.x) < 1e-9,
           `200u off the beam; a circle sized to the ${v.hullLen.toFixed(0)}u length would have hit`);

        // Cannot trap: the property that makes this safe to ship before the planner sees it.
        setClock(first + dur * 0.5);
        me.x = v.x + px * 400; me.y = v.y + py * 400; me.speed = 1.2;
        let inside = 0;
        for (let i = 0; i < 240; i++) {
            const tx = v.x - me.x, ty = v.y - me.y, tl = Math.hypot(tx, ty) || 1;
            me.velocity.x = tx / tl * me.speed; me.velocity.y = ty / tl * me.speed;
            me.x += me.velocity.x; me.y += me.velocity.y;
            checkTrafficCollisions(1 / 60);
            if (Math.abs((me.x - v.x) * px + (me.y - v.y) * py) < v.hullBeam * 0.5 - 3 &&
                Math.abs((me.x - v.x) * Math.sin(v.heading) + (me.y - v.y) * -Math.cos(v.heading)) < v.hullLen * 0.5) inside++;
        }
        ok('a boat sailing straight at it is never trapped', inside === 0,
           'bots cannot see the vessel yet, so it must shove rather than hold');

        // The planner is not reached into — it is being changed elsewhere.
        const bot = state.boats.find(b => !b.isPlayer && b.ai);
        if (bot) {
            bot.ai.collisionData = null;
            bot.x = v.x; bot.y = v.y;
            checkTrafficCollisions(1 / 60);
            ok('no AI collisionData is written', bot.ai.collisionData == null);
        }

        setClock(first + dur + 10);
        me.x = v.x; me.y = v.y;
        const g0 = { x: me.x, y: me.y };
        checkTrafficCollisions(1 / 60);
        ok('a despawned vessel collides with nothing', Math.abs(me.x - g0.x) < 1e-9);

        state.traffic = [];
        ok('an empty fleet costs nothing and breaks nothing', isFinite(getWindAt(v.x, v.y).speed));
        return r;
    });

    for (const [n, c, d] of out) check(n, c, d);
    // Read straight off the document, so it survives whatever the checks above did to
    // `state.traffic` — and so the comparison below is genuinely page-vs-page on one file.
    const gameCurve = await page.evaluate(() => {
        const c = window.Traffic.compilePath(window.VenueDoc.get('bay').traffic[0]);
        return { length: c.length, duration: c.duration };
    });
    // WHERE THE RACE PUTS EVERY VESSEL at a few seconds, straight off the running game, so
    // the editor's scrubber can be checked against it rather than against itself.
    const gameAt = await page.evaluate(async () => {
        resetGame();
        await new Promise(r => setTimeout(r, 1200));
        startRace();
        for (let i = 0; i < 20; i++) update(1 / 60);
        const out = {};
        for (const t of [-10, 0, 45, 120, 240]) {
            state.race.status = t >= 0 ? 'racing' : 'prestart';
            state.race.timer = Math.abs(t);
            updateTraffic();
            out[t] = state.traffic.map(v => v.active ? { id: v.id, x: v.x, y: v.y } : null);
        }
        return out;
    });
    check('no page errors', errs.length === 0, errs.slice(0, 2).join(' | '));
    await page.close();

    // ── 3. The editor's traffic layer ───────────────────────────────────────
    console.log('\nthe editor');
    const ed = await browser.newPage({ viewport: { width: 1500, height: 950 } });
    const edErrs = [];
    ed.on('pageerror', e => edErrs.push(e.message));
    // Several fixtures below are DELIBERATELY invalid — that is what they are testing — and
    // the editor is right to complain about each. Listed explicitly rather than filtered
    // loosely, so a genuinely new error still fails the suite.
    const EXPECTED = /both 0 knots|may be unsailable|can only wait where it has stopped|must come to 0 before it reverses|nothing comes before the start/;
    ed.on('console', m => {
        const t = m.text();
        if (m.type() === 'error' && !EXPECTED.test(t)) edErrs.push('console: ' + t);
    });
    await ed.goto('file://' + path.resolve(ROOT, 'regatta/editor.html'));
    await ed.waitForTimeout(2200);
    const bayText = fs.readFileSync(path.resolve(ROOT, 'regatta/assets/venues/bay.venue.js'), 'utf8');

    const edOut = await ed.evaluate(async ({ txt, game }) => {
        const r = [];
        const ok = (n, c, d = '') => r.push([n, !!c, d]);
        const A = window.EditorApp;
        A._openDocText(txt, 'bay.venue.js');
        await new Promise(res => setTimeout(res, 600));
        // ⚠️ NOT A FIXED COUNT. The cove is authored and re-authored; a test that pins how
        // many vessels it holds reports ordinary design work as a regression. What matters is
        // that every one of them compiles to something sailable.
        const fleet = A._state().doc.traffic || [];
        ok('the cove opens with traffic, and all of it compiles',
           fleet.length >= 1 && fleet.every((_, k) => (A._trafficCurve(k) || {}).duration > 0),
           `${fleet.length} vessel(s): ${fleet.map((f, k) => `${f.id} ${(A._trafficCurve(k) || {}).duration?.toFixed(0)}s`).join(', ')}`);
        A._setMode('traffic');
        ok('Traffic is a layer', A._state().mode === 'traffic');

        A._selTraffic(0);
        const c0 = A._trafficCurve(0);
        // THE EDITOR COMPILES WITH THE GAME'S OWN MODULE, so the lane drawn on the map is
        // the lane the hull sails. Checked by comparing the two PAGES on the same document
        // rather than against a constant: a constant only says the lane has not been
        // edited, which is not a property worth defending.
        ok('the editor draws the curve the game sails',
           c0 && Math.abs(c0.duration - game.duration) < 0.01 && Math.abs(c0.length - game.length) < 0.01,
           c0 ? `editor ${c0.length.toFixed(0)}u/${c0.duration.toFixed(1)}s vs game ${game.length.toFixed(0)}u/${game.duration.toFixed(1)}s`
              : 'no curve');
        // ── ONLY REAL VESSELS ───────────────────────────────────────────────
        const kindSel = () => document.querySelector('[data-trkind]');
        const opts = () => Array.from(kindSel().options).map(o => o.value);
        ok('the vessel list holds only things with a measured hull',
           opts().every(k => Array.isArray(window.VenueDoc.PROP_KINDS[k].hull)),
           `${opts().length} options: ${opts().map(k => k.replace('bay-cove-', '')).join(', ')}`);
        // AGAINST THE REGISTRY, NOT AGAINST A COUNT. This read `opts().length === 7` and
        // broke the day a ninth vessel was registered, which is the failure mode the curve
        // check above already argues against: a constant only says nobody has added a boat.
        // The properties worth defending are that the list is EXACTLY the measured-hull set
        // — nothing missing, nothing extra — and that it stays a small slice of the registry.
        const hulled = () => Object.keys(window.VenueDoc.PROP_KINDS)
            .filter(k => Array.isArray(window.VenueDoc.PROP_KINDS[k].hull));
        ok('...which is every measured hull and nothing else, a small slice of the registry',
           opts().length === hulled().length
           && hulled().every(k => opts().includes(k))
           && hulled().length * 3 < Object.keys(window.VenueDoc.PROP_KINDS).length,
           `${opts().length} of ${Object.keys(window.VenueDoc.PROP_KINDS).length} kinds`);

        // SHOWN, NOT CHOSEN. The wake is the vessel's, so the panel states it rather than
        // offering a decision the same hull could answer two ways on two lanes.
        A._selTraffic(0);
        ok('the panel no longer offers a wake choice', !document.querySelector('[data-trwake]'));
        const insp = document.getElementById('insp-obj').textContent;
        ok('...it states what the vessel brings', /wedge|ribbon|none/i.test(insp),
           (insp.match(/(Kelvin wedge|\d+ ribbons|ribbon|none)[^A-Z]*/) || [''])[0].trim());
        // A lane still carrying the retired field is told, rather than silently ignored.
        A._state().doc.traffic[0].wake = 'ribbon';
        A._afterEdit(true, 'legacy');
        ok('a lane still setting a wake is warned about it',
           window.VenueDoc.validate(A._state().doc).some(x => x.level === 'warn' && /belongs to the vessel/.test(x.msg)));
        delete A._state().doc.traffic[0].wake;
        A._afterEdit(true, 'legacy');

        ok('the inspector offers the whole entry',
           ['trkind', 'trfirst', 'trend', 'trheight', 'trshadow']
               .every(k => document.querySelector(`[data-${k}]`))
           && document.querySelector('[data-rename="traffic"]'));
        // The vessel-level speed field is GONE: every point inherits the last named before
        // it, so one number on the first waypoint carries the lane and a second control
        // saying the same thing is a way to lose track of which one won.
        ok('and no competing vessel-level speed', !document.querySelector('[data-trspeed]'));
        // The passage reads in the units a schedule is thought about in.
        const note = document.querySelector('[data-trend]').closest('.in-sect').textContent;
        ok('the schedule states its own length and time', /km/.test(note) && /\d\d:\d\d/.test(note),
           note.replace(/\s+/g, ' ').trim().slice(-24));

        const n0 = A._state().doc.traffic.length;
        const i = A._drawLane([[-2000, -2000], [-1000, -500], [0, 800]]);
        const v = () => A._state().doc.traffic[i];
        ok('Draw lays a lane', A._state().doc.traffic.length === n0 + 1);
        // A LANE NEEDS TWO POINTS, not three — a shape must enclose water, a path only has
        // to go somewhere.
        const j = A._drawLane([[-3000, 0], [-2500, 500]]);
        ok('two points is enough', A._state().doc.traffic[j].path.length === 2);
        A._state().doc.traffic.splice(j, 1);
        // The tool must not be able to author something the game rejects.
        ok('a freshly drawn lane validates',
           window.VenueDoc.validate(A._state().doc).filter(x => x.level === 'error').length === 0);

        A._selTraffic(i, 1);
        const inp = () => document.querySelector('[data-trvspeed]');
        ok('a waypoint offers its own speed, showing what it inherits',
           inp() && +inp().placeholder > 0, inp() ? `placeholder ${inp().placeholder}` : 'no field');
        const slow = () => { const e2 = inp(); e2.value = '2'; e2.dispatchEvent(new Event('change')); };
        const cBefore = A._trafficCurve(i);
        slow();
        ok('typing one writes it through', v().path[1].speed === 2);
        ok('and the passage gets longer', A._trafficCurve(i).duration > cBefore.duration,
           `${cBefore.duration.toFixed(1)}s -> ${A._trafficCurve(i).duration.toFixed(1)}s`);

        // 0 at the last point berths; 0 in the middle is caught.
        A._selTraffic(i, 2);
        inp().value = '0'; inp().dispatchEvent(new Event('change'));
        ok('0kt at the last point is legal and still arrives',
           window.VenueDoc.validate(A._state().doc).filter(x => x.level === 'error').length === 0
           && isFinite(A._trafficCurve(i).duration));
        A._selTraffic(i, 1);
        inp().value = '0'; inp().dispatchEvent(new Event('change'));
        ok('two zeros in a row is refused',
           window.VenueDoc.validate(A._state().doc).some(x => /both 0 knots/.test(x.msg)));
        A._undo(); A._undo();

        A._selTraffic(i);
        const es = document.querySelector('[data-trend]');
        es.value = 'stay'; es.dispatchEvent(new Event('change'));
        ok('end-of-lane writes through', A._state().doc.traffic[i].end === 'stay');
        ok('respawn is hidden for a vessel that never despawns',
           !document.querySelector('[data-trrespawn]'),
           'a field that silently does nothing is worse than no field');

        // ── ADDING POINTS ───────────────────────────────────────────────────
        // Mid-lane: double-click the lane. Aim at the midpoint of a leg.
        A._selTraffic(i);
        const n1 = v().path.length;
        const ax = (v().path[0].x + v().path[1].x) / 2, ay = (v().path[0].y + v().path[1].y) / 2;
        ok('double-clicking a lane inserts a waypoint', A._insertLanePoint(ax, ay)
           && v().path.length === n1 + 1, `${n1} -> ${v().path.length}`);
        // A NEW POINT INHERITS. Writing the interpolated speed would pin the ramp at a
        // value nobody typed, and the ramp is the whole reason per-point speed exists.
        ok('...and it inherits its speed rather than pinning one',
           v().path[1].speed === undefined, JSON.stringify(v().path[1]));
        ok('...landing between the two points it was dropped between',
           Math.abs(v().path[1].x - ax) < 1 && Math.abs(v().path[1].y - ay) < 1);
        const far = A._insertLanePoint(99999, 99999);
        ok('clicking nowhere near the lane inserts nothing', !far);

        // At an end: Draw, click the end point to resume, then click on.
        const n2 = v().path.length;
        ok('Draw resumes the END of a selected lane',
           A._extendLane(i, false, [[3000, 3000], [3600, 3600]]) === n2 + 2,
           `${n2} -> ${v().path.length}`);
        ok('...appending in the order clicked',
           Math.abs(v().path[v().path.length - 1].x - 3600) < 1);
        const n3 = v().path.length;
        ok('Draw also resumes the START',
           A._extendLane(i, true, [[-4000, -4000], [-4600, -4600]]) === n3 + 2);
        // Prepending REVERSES: you drew away from the old start, so the last click is the
        // lane's new beginning.
        ok('...and the last thing clicked becomes the new beginning',
           Math.abs(v().path[0].x - -4600) < 1, `starts at ${v().path[0].x}`);
        ok('the extended lane still validates',
           window.VenueDoc.validate(A._state().doc).filter(x => x.level === 'error').length === 0);

        // ── A STOP, AND AN AUTHORED HEADING, THROUGH THE PANEL ──────────────
        A._selTraffic(i, 1);
        ok('no wait field until the vessel is stopped there', !document.querySelector('[data-trvdwell]'),
           'a wait at speed would be an instantaneous halt and restart');
        const sp = document.querySelector('[data-trvspeed]');
        sp.value = '0'; sp.dispatchEvent(new Event('change'));
        A._selTraffic(i, 1);
        const dw = document.querySelector('[data-trvdwell]');
        ok('setting the speed to 0 reveals the wait', !!dw);
        const durBefore = A._trafficCurve(i).duration;
        dw.value = '45'; dw.dispatchEvent(new Event('change'));
        ok('the wait writes through', v().path[1].dwell === 45);
        ok('...and lengthens the passage by exactly that',
           Math.abs(A._trafficCurve(i).duration - durBefore - 45) < 1e-6,
           `${durBefore.toFixed(1)}s -> ${A._trafficCurve(i).duration.toFixed(1)}s`);
        ok('a stop validates', window.VenueDoc.validate(A._state().doc)
            .filter(x => x.level === 'error').length === 0);
        // A dwell where the vessel is NOT stopped must be refused.
        v().path[1].speed = 5;
        ok('a wait at speed is refused', window.VenueDoc.validate(A._state().doc)
            .some(x => /can only wait where it has stopped/.test(x.msg)));
        v().path[1].speed = 0;

        A._selTraffic(i, 0);
        const hd = document.querySelector('[data-trvhdg]');
        ok('every waypoint offers a heading, showing the curve\'s own as placeholder',
           hd && hd.placeholder !== '', `placeholder ${hd.placeholder} deg`);
        hd.value = '270'; hd.dispatchEvent(new Event('change'));
        ok('an authored heading writes through', v().path[0].heading === 270);
        ok('...and the compiled hull uses it',
           Math.abs(A._trafficCurve(i) ? 0 : 0) === 0
           && Math.abs(((window.Traffic.compilePath(v()).at(0).heading * 180 / Math.PI) % 360 + 360) % 360 - 270) < 1,
           'degrees in the document, radians in the engine');
        hd.value = ''; hd.dispatchEvent(new Event('change'));
        ok('clearing it goes back to the curve', v().path[0].heading === undefined);

        // ── THE CLOCK ───────────────────────────────────────────────────────
        A._selTraffic(-1);
        const sc = A._scrub(0);
        ok('the layer carries a scrubber', !!sc, sc ? `${sc.min}s .. ${sc.max}s` : 'none');
        // The window is the race's own: the authored prestart through to the limit.
        const course = A._state().doc.course || {};
        const wantMin = -(course.startTime != null ? course.startTime : 30);
        ok('...spanning the prestart to the time limit', sc.min === wantMin && sc.max >= 60,
           `${sc.min}s (prestart) .. ${sc.max}s (limit)`);

        // ⚠️ THE INVARIANT THAT MATTERS: the editor's preview and the RACE must agree about
        // where every hull is at a given second. They share one lifecycle rule in
        // js/traffic.js precisely so this cannot drift; this is the check that says so.
        let worst = 0, compared = 0, mismatched = 0;
        for (const key of Object.keys(game.at)) {
            const t = +key;
            A._scrub(t);
            const mine = A._trafficAt(t);
            const theirs = game.at[key];
            for (let k = 0; k < theirs.length; k++) {
                const a = theirs[k], b = mine[k];
                if (!a !== !b) { mismatched++; continue; }
                if (!a) continue;
                worst = Math.max(worst, Math.hypot(a.x - b.x, a.y - b.y));
                compared++;
            }
        }
        ok('the scrubber agrees with the race about who is on the water',
           mismatched === 0, `${mismatched} disagreements about presence`);
        ok('...and about exactly where they are', worst < 0.01,
           `${compared} positions compared, worst ${worst.toExponential(1)}u apart`);

        // A ONE-SHOT vessel reports absent after its passage rather than parking at its
        // last point. Built here rather than assumed of the authored fleet, which may
        // respawn or `stay` and would make this pass for the wrong reason.
        const oneShot = A._drawLane([[-9000, -9000], [-8000, -8500]]);
        const os = A._state().doc.traffic[oneShot];
        os.firstSpawn = 0; delete os.respawn; delete os.end;
        const osDur = A._trafficCurve(oneShot).duration;
        ok('a one-shot vessel is on the water mid-passage',
           A._trafficAt(osDur * 0.5)[oneShot] != null);
        ok('...and absent after it, not parked at the last point',
           A._trafficAt(osDur + 1)[oneShot] === null, `duration ${osDur.toFixed(1)}s`);
        A._state().doc.traffic.splice(oneShot, 1);

        // ── DELETING, through the real key path ─────────────────────────────
        // The inspector's buttons are gone; Delete on the map is the one verb, and it means
        // the WAYPOINT when one is in hand and the VESSEL when none is.
        const del = () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }));
        A._selTraffic(i, 0);
        const before = v().path.length;
        del();
        ok('Delete removes the selected waypoint', v().path.length === before - 1,
           `${before} -> ${v().path.length}`);
        let guard = 40;
        while (v().path.length > 2 && guard-- > 0) { A._selTraffic(i, 0); del(); }
        ok('but never below two', v().path.length === 2, `${v().path.length} points`);
        A._selTraffic(i, 0); del();
        ok('...and the last two are refused outright', v().path.length === 2);
        A._undo();
        ok('undo reaches all of it', A._state().doc.traffic[i].path.length > 2);
        // ⚠️ REGRESSION GUARD. Points inherit the last speed named before them, and a new
        // lane's only speed sits on point 0 — so deleting point 0 used to leave a lane with
        // no speed anywhere, invalid, with nothing on screen saying why.
        ok('deleting a waypoint never strips the lane of its speed',
           window.VenueDoc.validate(A._state().doc).every(x => !/no speed anywhere/.test(x.msg)),
           'the next point inherits what was in force');

        // ── RENAMING ────────────────────────────────────────────────────────
        A._selTraffic(i);
        const nameEl = document.querySelector('[data-rename="traffic"]');
        const oldId = v().id;
        nameEl.value = 'Harbour run'; nameEl.dispatchEvent(new Event('change'));
        ok('a vessel can be renamed', v().name === 'Harbour run');
        // THE ID MUST NOT MOVE. A name is a label; ids are what anything else would hold on
        // to, and a rename that changes one is a rename that can break a reference.
        ok('...without its id changing', v().id === oldId, `${oldId}`);
        ok('...and the list shows the name', document.getElementById('obj-list').textContent.includes('Harbour run'));
        nameEl.value = ''; nameEl.dispatchEvent(new Event('change'));
        ok('clearing the name falls back to the id', v().name === undefined);

        // ── HEIGHT drives the lee ───────────────────────────────────────────
        const hEl = document.querySelector('[data-trheight]');
        const lenPlaceholderBefore = document.querySelector('[data-trshadow]').placeholder;
        hEl.value = '50'; hEl.dispatchEvent(new Event('change'));
        ok('height writes through in metres', v().height === 50);
        const lenPlaceholderAfter = document.querySelector('[data-trshadow]').placeholder;
        ok('...and the lee length follows it', +lenPlaceholderAfter === 50 * 5 * 10
           && lenPlaceholderAfter !== lenPlaceholderBefore,
           `${lenPlaceholderBefore}u -> ${lenPlaceholderAfter}u (10x height, the island rule)`);
        ok('the doc still validates with a height',
           window.VenueDoc.validate(A._state().doc).filter(x => x.level === 'error').length === 0);

        // ── ADD AND DELETE FROM THE LIST ────────────────────────────────────
        // SCOPED TO THE LIST'S OWN ACTION STRIP. Searching every button on the page finds
        // the selection bar's Delete too, which belongs to shapes and is not what is being
        // asserted here.
        const btn = (label) => Array.from(document.getElementById('objs-actions').querySelectorAll('button'))
            .find(b => b.textContent.trim() === label);
        const nBefore = A._state().doc.traffic.length;
        btn('+ Traffic').click();
        ok('+ Traffic adds a vessel', A._state().doc.traffic.length === nBefore + 1);
        const made = A._state().doc.traffic[A._state().doc.traffic.length - 1];
        ok('...ready to sail, with a speed on its first point',
           made.path.length === 2 && made.path[0].speed > 0 && !!made.kind,
           `${made.id} ${made.kind} ${made.path[0].speed}kt`);
        ok('...and it validates',
           window.VenueDoc.validate(A._state().doc).filter(x => x.level === 'error').length === 0);
        // No Delete button any more — the key is the one verb, and with no waypoint in hand
        // it means the vessel.
        ok('no Delete button in the list', !btn('Delete'));
        A._selTraffic(A._state().doc.traffic.length - 1);
        del();
        ok('Delete removes the selected vessel', A._state().doc.traffic.length === nBefore);

        // ── ASTERN, THROUGH THE DOCUMENT ────────────────────────────────────
        const dz = A._state().doc;
        const berth = () => ({ id: 'z', kind: 'bay-cove-cruise-ship', firstSpawn: 0, path: [
            { x: -4000, y: 200, speed: 9 }, { x: 900, y: 100, speed: 0, dwell: 8 },
            { x: -200, y: 500, speed: -3 }, { x: -700, y: 900, speed: 0, dwell: 90 },
            { x: 500, y: 400, speed: 5 }, { x: 4000, y: 250, speed: 9 } ] });
        dz.traffic = [berth()];
        A._afterEdit(true, 'berth');
        ok('a berthing manoeuvre validates',
           window.VenueDoc.validate(dz).filter(x => x.level === 'error').length === 0,
           window.VenueDoc.validate(dz).filter(x => x.level === 'error').map(x => x.msg)[0] || '');
        // ⚠️ A SHIP CANNOT SWAP ENDS AT SPEED.
        dz.traffic = [berth()];
        dz.traffic[0].path[1].speed = 4;          // ahead straight into an astern leg
        A._afterEdit(true, 'berth');
        ok('going from ahead to astern without stopping is refused',
           window.VenueDoc.validate(dz).some(x => /must come to 0 before it reverses/.test(x.msg)));
        dz.traffic = [berth()];
        dz.traffic[0].path[0].speed = -9;         // nothing precedes the start
        A._afterEdit(true, 'berth');
        ok('a vessel cannot start astern',
           window.VenueDoc.validate(dz).some(x => /nothing comes before the start/.test(x.msg)));
        // And the reversal-with-no-dwell advisory.
        dz.traffic = [berth()];
        delete dz.traffic[0].path[1].dwell;
        A._afterEdit(true, 'berth');
        ok('a reversal with no dwell is flagged as a one-frame swing',
           window.VenueDoc.validate(dz).some(x => x.level === 'warn' && /reverses ahead\/astern with no dwell/.test(x.msg)));

        // ── CLASHES ─────────────────────────────────────────────────────────
        // The authored cove first: a real document must not light up red for no reason.
        // ⚠️ REPORTED, NOT ASSERTED. A venue under active authoring may legitimately hold a
        // clash mid-edit, and failing the suite for it would make the test a nag rather than
        // a check. What must not break is the DETECTOR, which the fixtures below pin down.
        {
            const cc = A._clashes();
            const nm = A._state().doc.traffic.map(x => x.name || x.id);
            ok('the authored cove was scanned', true,
               cc.hit.length
                 ? `⚠ ${cc.points.map(x => `${nm[x.i]} × ${nm[x.j]} at ${Math.round(x.t)}s`).join('; ')}`
                 : `${nm.length} vessels, clean`);
        }

        // Then fixtures, because the interesting case is the DISCRIMINATION: crossing lanes
        // are the entire point of traffic, and only crossing HULLS are a problem.
        const d3 = A._state().doc;
        d3.traffic = [
            { id: 'a', kind: 'bay-cove-cargo-ship', firstSpawn: 0,
              path: [{ x: -3000, y: 0, speed: 8 }, { x: 3000, y: 0 }] },
            { id: 'b', kind: 'bay-cove-cargo-ship', firstSpawn: 0,
              path: [{ x: 0, y: -3000, speed: 8 }, { x: 0, y: 3000 }] }
        ];
        A._afterEdit(true, 'clash fixture');
        let cl = A._clashes();
        ok('two hulls in the same water at the same second is a clash',
           cl.hit.length === 2 && cl.points.length >= 1,
           `${cl.points.length} encounter(s), first at ${cl.points[0] ? Math.round(cl.points[0].t) : '?'}s`);
        d3.traffic[1].firstSpawn = 90;
        A._afterEdit(true, 'clash fixture');
        ok('...and the SAME lanes 90s apart are clean', A._clashes().hit.length === 0,
           'the geometry did not change — only the clock did');
        // The threshold is the hull, not the lane.
        d3.traffic = [
            { id: 'a', kind: 'bay-cove-cargo-ship', firstSpawn: 0,
              path: [{ x: -3000, y: 0, speed: 8 }, { x: 3000, y: 0 }] },
            { id: 'b', kind: 'bay-cove-cargo-ship', firstSpawn: 0,
              path: [{ x: -3000, y: 420, speed: 8 }, { x: 3000, y: 420 }] }
        ];
        A._afterEdit(true, 'clash fixture');
        ok('a clear pass is not flagged', A._clashes().hit.length === 0, '420u apart against a 173u beam');
        d3.traffic[1].path[0].y = 120; d3.traffic[1].path[1].y = 120;
        A._afterEdit(true, 'clash fixture');
        ok('...but hull on hull is', A._clashes().hit.length === 2, '120u apart, inside a beam');
        ok('the scan is not silently coarsened at this scale', !A._clashes().coarsened,
           'a scan that dropped resolution would say so rather than quietly miss things');

        return r;
    }, { txt: bayText, game: { ...gameCurve, at: gameAt } });

    for (const [n, c, d] of edOut) check(n, c, d);
    check('no editor page errors', edErrs.length === 0, edErrs.slice(0, 2).join(' | '));
    await browser.close();

    console.log(`\n${failures ? 'FAIL' : 'PASS'} — ${failures} failure(s)`);
    process.exitCode = failures ? 1 : 0;
})();
