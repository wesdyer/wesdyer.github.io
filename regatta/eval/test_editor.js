// Editor tests: the editing operations, undo, and the edit→recompile→recheck loop.
//
//   node regatta/eval/test_editor.js
//
// These drive the real app in a real page rather than unit-testing the geometry in
// isolation, because the thing most likely to break is the LOOP — an edit that
// mutates the document but never reaches the compiled course, or a check panel
// still describing the previous state. A sculpt that moves vertices correctly and
// silently fails to update the race is the bug this catches.
const { chromium } = require('playwright');
const path = require('path');

let failures = 0;
const check = (name, cond, detail) => {
    console.log(`  ${cond ? 'ok   ' : 'FAIL '} ${name}${cond || !detail ? '' : ' — ' + detail}`);
    if (!cond) failures++;
};
const near = (a, b, tol) => Math.abs(a - b) <= tol;

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
    const errs = [];
    page.on('pageerror', e => errs.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    await page.goto('file://' + path.resolve('regatta/editor.html'));
    await page.waitForTimeout(1600);

    const snap = () => page.evaluate(() => {
        const s = window.EditorApp._state();
        const d = s.doc;
        return {
            dirty: s.dirty, history: s.history, histIdx: s.histIdx,
            shapes: d ? d.land.length : 0,
            verts: d ? d.land.reduce((a, l) => a + l.outer.length, 0) : 0,
            worldSize: d ? d.world.size : 0,
            // Bounding radius either way: painted venues default to a POLYGON arena,
            // so `circle` is null and reading `.r` off it used to throw here.
            boundaryR: !d ? 0
                : d.world.boundary.circle ? d.world.boundary.circle.r
                : d.world.boundary.poly ? Math.max.apply(null, d.world.boundary.poly.map(p => Math.hypot(p[0], p[1])))
                : 0,
            zone: d ? (d.course.route.find(e => e.kind === 'round') || {}).zone : 0,
            midX: d ? (d.course.marks[0].x + d.course.marks[1].x) / 2 : 0,
            midY: d ? (d.course.marks[0].y + d.course.marks[1].y) / 2 : 0,
            lineLen: d ? Math.hypot(d.course.marks[1].x - d.course.marks[0].x,
                                    d.course.marks[1].y - d.course.marks[0].y) : 0,
            coastC: d ? d.land.find(l => l.id === 'coast').c.slice() : null,
            coastR: d ? d.land.find(l => l.id === 'coast').r : 0,
            // Compiled side — proves the edit actually reached the raced course.
            compiledRoundZone: state.course.roundMark ? state.course.roundMark.zone : 0,
            compiledBoundaryR: state.course.boundary.radius,
            compiledIslandR: (state.course.islands.find(i => i.id === 'coast') || {}).radius,
            findings: window.EditorApp._state().findings.map(f => ({ id: f.id, level: f.level, detail: f.detail })),
            valid: window.VenueDoc.validate(d).filter(p => p.level === 'error').length
        };
    });

    console.log('load');
    const a = await snap();
    check('document loaded', a.shapes === 6, `${a.shapes} shapes`);
    check('not dirty on load', a.dirty === false);
    check('history seeded with one entry', a.history === 1 && a.histIdx === 0);
    check('document validates clean', a.valid === 0, `${a.valid} errors`);
    check('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));

    // ── Sculpt ──────────────────────────────────────────────────────────────
    console.log('\nsculpt brush');
    const sc = await page.evaluate(() => {
        const A = window.EditorApp, d = A._state().doc;
        const coast = d.land.find(l => l.id === 'coast');
        const before = coast.outer.map(p => p.slice());
        // Push at a known vertex with a 400u brush; falloff means the vertex under
        // the cursor moves most and vertices outside the radius must not move at all.
        const target = before[10];
        A._sculpt(target[0], target[1], 120, 0, 400);
        A._afterEdit(true, 'test sculpt');
        const after = coast.outer.map(p => p.slice());
        const moved = after.filter((p, i) => Math.hypot(p[0] - before[i][0], p[1] - before[i][1]) > 0.01).length;
        const atCursor = Math.hypot(after[10][0] - before[10][0], after[10][1] - before[10][1]);
        // Farthest vertex from the cursor should be untouched.
        let far = 0, farD = 0;
        before.forEach((p, i) => { const dd = Math.hypot(p[0] - target[0], p[1] - target[1]); if (dd > farD) { farD = dd; far = i; } });
        const atFar = Math.hypot(after[far][0] - before[far][0], after[far][1] - before[far][1]);
        return { moved, total: before.length, atCursor, atFar };
    });
    check('some vertices moved, not all', sc.moved > 0 && sc.moved < sc.total, `${sc.moved}/${sc.total}`);
    check('vertex under the cursor moved ~the full delta', near(sc.atCursor, 120, 12), `${sc.atCursor.toFixed(1)}u of 120u`);
    check('vertex outside the brush did not move', sc.atFar < 1e-9, `${sc.atFar}`);

    const b = await snap();
    check('became dirty', b.dirty === true);
    check('history grew', b.history === 2 && b.histIdx === 1);
    check('centroid rebaked', !near(b.coastC[0], a.coastC[0], 1e-9) || !near(b.coastR, a.coastR, 1e-9));
    check('edit reached the compiled island radius', near(b.compiledIslandR, b.coastR, 1e-6),
          `doc ${b.coastR} vs compiled ${b.compiledIslandR}`);
    check('still validates clean after sculpting', b.valid === 0, `${b.valid} errors`);

    // ── Undo / redo ─────────────────────────────────────────────────────────
    console.log('\nundo / redo');
    await page.evaluate(() => window.EditorApp._undo());
    const u = await snap();
    check('undo restored vertex count', u.verts === a.verts);
    check('undo restored centroid exactly', near(u.coastC[0], a.coastC[0], 1e-12) && near(u.coastR, a.coastR, 1e-12));
    check('undo recompiled the course', near(u.compiledIslandR, a.compiledIslandR, 1e-12));
    check('undo is clean again', u.dirty === false);
    await page.evaluate(() => window.EditorApp._redo());
    const r = await snap();
    check('redo re-applied the sculpt', near(r.coastR, b.coastR, 1e-12));
    await page.evaluate(() => window.EditorApp._undo());

    // ── Authored ice holds still; only its MOTION is per race ───────────────
    // Ice is hand-placed now, so "does the seed move it?" has a different answer than it
    // used to: the layout must NOT move (it is authored), while the drift, spin and wander
    // must, because that is what keeps playthroughs unique.
    console.log('\nice stability');
    const ice = await page.evaluate(() => {
        const A = window.EditorApp;
        const layout = () => (state.course.islands || []).filter(i => i.isFloe)
                               .map(i => [Math.round(i.x), Math.round(i.y), Math.round(i.radius)]);
        const motion = () => (state.course.islands || []).filter(i => i.isFloe)
                               .map(i => [+i.driftVx.toFixed(3), +i.driftVy.toFixed(3), +i.spin.toFixed(3)]);
        const before = layout(), motion0 = motion();
        const coast = A._state().doc.land.find(l => l.id === 'coast');
        A._sculpt(coast.outer[20][0], coast.outer[20][1], 200, 90, 500);
        A._afterEdit(true, 'sculpt for ice test');
        const afterEdit = layout();
        A._recompile(true);
        const afterSameSeed = layout();
        A._previewSeed(777);
        A._recompile(true);
        const afterNewSeed = layout(), motion1 = motion();
        const same = (a, b) => a.length === b.length && a.every((p, i) => p.every((v, k) => v === b[i][k]));
        return { n: before.length, heldStill: same(before, afterEdit),
                 sameSeedStable: same(before, afterSameSeed),
                 layoutFixed: same(before, afterNewSeed),
                 motionVaries: !same(motion0, motion1) };
    });
    check('editing land does not move the ice', ice.heldStill === true, `${ice.n} floes`);
    check('recompiling does not move it either', ice.sameSeedStable === true);
    check('a different seed leaves the LAYOUT alone — it is authored', ice.layoutFixed === true);
    check('...but gives every floe a fresh drift and spin', ice.motionVaries === true);
    await page.evaluate(() => { window.EditorApp._previewSeed(90210); });

    // ── Scale whole map ─────────────────────────────────────────────────────
    console.log('\nscale whole map');
    const before = await snap();
    await page.evaluate(() => { window.EditorApp._scaleMap(0.6); window.EditorApp._afterEdit(true, 'scale'); });
    const s6 = await snap();
    check('world size scaled', near(s6.worldSize, before.worldSize * 0.6, 1e-6));
    check('boundary scaled', near(s6.boundaryR, before.boundaryR * 0.6, 1e-6));
    check('rounding zone scaled', near(s6.zone, before.zone * 0.6, 1e-6));
    // The line MIDPOINT scales with the geography; its LENGTH does not, because the
    // length is set by how many boats have to fit on it.
    check('start line midpoint scaled', near(s6.midX, before.midX * 0.6, 1e-6) && near(s6.midY, before.midY * 0.6, 1e-6),
          `(${before.midX.toFixed(1)},${before.midY.toFixed(1)}) -> (${s6.midX.toFixed(1)},${s6.midY.toFixed(1)})`);
    check('land radius scaled', near(s6.coastR, before.coastR * 0.6, 1e-6));
    check('start line LENGTH preserved (fleet-sized, not geography-sized)',
          near(s6.lineLen, before.lineLen, 1e-6), `${before.lineLen} -> ${s6.lineLen}`);
    const spreadAfter = s6.findings.find(f => f.id === 'spawn-spread');
    check('fleet still fits its lanes after scaling', spreadAfter && spreadAfter.level === 'ok',
          spreadAfter && spreadAfter.detail);
    check('compiled boundary followed', near(s6.compiledBoundaryR, before.compiledBoundaryR * 0.6, 1e-6));
    check('compiled rounding zone followed', near(s6.compiledRoundZone, before.compiledRoundZone * 0.6, 1e-6));
    check('still valid after scaling', s6.valid === 0);

    // Scaling changes how long the race is, and the checks must notice without being
    // asked. What the VERDICT should be is not asserted here: the race-length check now
    // measures the sailable path and prices it with the polar, and by that measure
    // Glacier Sound at full size is already in band — the old straight-line formula's
    // "7:07, 40% too long" was measuring a line no boat can sail. So the assertion is on
    // the RELATIONSHIP: 60% of the geometry is a materially shorter race.
    const raceBefore = before.findings.find(f => f.id === 'race-length');
    const raceAfter = s6.findings.find(f => f.id === 'race-length');
    const mins = (t) => { const m = /best ~(\d+):(\d+)/.exec(t || ''); return m ? +m[1] * 60 + +m[2] : null; };
    const tBefore = mins(raceBefore && raceBefore.detail), tAfter = mins(raceAfter && raceAfter.detail);
    check('the race-length check reports a best time both times',
          tBefore != null && tAfter != null, `${tBefore} / ${tAfter}`);
    check('scaling to 60% shortens the race by roughly 40%',
          tBefore && tAfter && tAfter / tBefore > 0.5 && tAfter / tBefore < 0.75,
          `${tBefore}s -> ${tAfter}s (${tBefore ? (tAfter / tBefore).toFixed(2) : '?'}x)`);
    console.log(`         before: ${raceBefore && raceBefore.detail}`);
    console.log(`         after:  ${raceAfter && raceAfter.detail}`);

    // Uniform scaling cannot fix land-outside-boundary, because it scales the
    // boundary too. Asserting that keeps anyone from "fixing" it this way.
    const outBefore = before.findings.filter(f => f.id === 'land-outside').length;
    const outAfter = s6.findings.filter(f => f.id === 'land-outside').length;
    check('land-outside is unchanged by uniform scaling (ratio preserved)', outBefore === outAfter,
          `${outBefore} -> ${outAfter}`);

    // ── Scaling the map scales EVERYTHING ───────────────────────────────────
    // A map is only the same map if every part of it scales together. Ice that keeps its
    // size no longer fits its channel; a wind region that keeps its size no longer covers
    // the water. So this measures each kind of object rather than trusting a list.
    console.log('\nscale everything');
    const everything = await page.evaluate(() => {
        const A = window.EditorApp;
        // Give the venue one of each thing that has a size.
        document.querySelector('#layer-list [data-layer="venue"]').click();
        document.getElementById('ice-scatter').value = '1';
        A._addIce(-3200, 2600, 300); A._afterEdit(true, 'ice');
        document.querySelector('#layer-list [data-layer="water"]').click();
        document.getElementById('btn-add-cur-all').click();
        const snap = () => {
            const d = A._state().doc;
            const spanOf = (ring) => {
                let minX = Infinity, maxX = -Infinity;
                for (const p of ring) { if (p[0] < minX) minX = p[0]; if (p[0] > maxX) maxX = p[0]; }
                return maxX - minX;
            };
            const rd = d.course.route.find(e => e.kind === 'round');
            return {
                world: d.world.size,
                arena: spanOf(d.world.boundary.poly),
                land: spanOf(d.land[0].outer),
                iceSpan: spanOf(d.ice[d.ice.length - 1].outer),
                iceX: d.ice[d.ice.length - 1].outer[0][0],
                zone: rd.zone, radius: rd.radius,
                markX: d.course.marks[2].x,
                windSpan: spanOf(d.wind.regions[0].poly),
                windFall: d.wind.regions[0].falloff,
                curSpan: spanOf(d.current.regions[0].poly),
                curFall: d.current.regions[0].falloff
            };
        };
        const before = snap();
        A._scaleMap(0.5); A._afterEdit(true, 'scale');
        return { before, after: snap() };
    });
    const halved = (k) => Math.abs(everything.after[k] - everything.before[k] * 0.5) < 1e-6;
    for (const k of ['world', 'arena', 'land', 'iceSpan', 'iceX', 'zone', 'radius', 'markX',
                     'windSpan', 'windFall', 'curSpan', 'curFall']) {
        check(`${k} scaled with the map`, halved(k),
              `${(+everything.before[k]).toFixed(1)} -> ${(+everything.after[k]).toFixed(1)}`);
    }
    await page.evaluate(() => { const A = window.EditorApp; while (A._state().histIdx > 0) A._undo(); });

    // ── Boundary radius ─────────────────────────────────────────────────────
    // Growing the circle to circumscribe the square map is what DOES clear it.
    console.log('\nboundary radius');
    const grown = await page.evaluate(() => {
        const A = window.EditorApp, d = A._state().doc;
        // Circumscribe the square map with a CIRCLE, to contrast with the rect below.
        d.world.boundary = { circle: { x: 0, y: 0, r: d.world.size * Math.SQRT1_2 }, poly: null };
        A._afterEdit(true, 'boundary');
        return A._state().findings.map(f => ({ id: f.id, level: f.level, detail: f.detail }));
    });
    check('no land outside the arena once it circumscribes the map',
          grown.filter(f => f.id === 'land-outside').length === 0,
          `${grown.filter(f => f.id === 'land-outside').length} still outside`);
    const cov = grown.find(f => f.id === 'arena-coverage');
    check('arena coverage check reacts', !!cov, 'missing');
    console.log(`         ${cov && cov.detail}`);

    // ── Polygon arena, end to end ───────────────────────────────────────────
    // The point of the whole exercise: a rect arena must (a) clear the
    // land-outside warnings, (b) reach the compiled course, and (c) actually CONTAIN
    // boats when the sim runs. (c) is the one that proves the runtime consumes it
    // rather than merely storing it.
    console.log('\npolygon arena');
    const rect = await page.evaluate(() => {
        const A = window.EditorApp;
        // Force the INSCRIBED circle, which is the state that has the problem. An
        // earlier section leaves a circumscribing one behind, and starting from that
        // would make this test pass without proving anything.
        const d0 = A._state().doc;
        d0.world.boundary = { circle: { x: 0, y: 0, r: d0.world.size * 0.5 }, poly: null };
        A._afterEdit(true, 'inscribed circle');
        // An arena flush with the map edge leaves nothing beyond it to look at.
        A._boundaryToRect(0);
        A._afterEdit(true, 'rect flush');
        const before = (A._state().findings.find(x => x.id === 'scenery-depth') || {}).level;
        // Inset it and land continues PAST the sailing limit, which is the point.
        A._boundaryToRect(400);
        A._afterEdit(true, 'rect');
        const f = A._state().findings;
        return {
            before,
            depth: (f.find(x => x.id === 'scenery-depth') || {}).level,
            depthDetail: (f.find(x => x.id === 'scenery-depth') || {}).detail,
            coverage2: (f.find(x => x.id === 'arena-coverage') || {}).level,
            coverage: (f.find(x => x.id === 'arena-coverage') || {}).detail,
            covLevel: (f.find(x => x.id === 'arena-coverage') || {}).level,
            navigable: (f.find(x => x.id === 'navigable') || {}).level,
            compiledPoly: state.course.boundary.poly ? state.course.boundary.poly.length : 0,
            compiledCircle: state.course.boundary.circle,
            docSize: A._state().doc.world.size,
            errors: window.VenueDoc.validate(A._state().doc).filter(p => p.level === 'error').length
        };
    });
    check('rect arena reaches the compiled course', rect.compiledPoly === 4, `${rect.compiledPoly} vertices`);
    check('stale sampling circle is dropped with a poly', rect.compiledCircle === null);
    check('arena flush with the map edge is flagged', rect.before === 'warn', `was ${rect.before}`);
    check('land now continues past the sailing limit', rect.depth === 'ok', rect.depthDetail);
    check('arena is fully painted after the rect fit', rect.coverage2 === 'ok', rect.coverage);
    check('course is still navigable', rect.navigable === 'ok');
    check('document still validates', rect.errors === 0);
    console.log(`         ${rect.coverage}`);

    // Containment while racing is proved in test_boundary_race.js, which runs in the
    // GAME page: startRace() touches DOM the editor does not have, and more to the
    // point, only a real race exercises the physics clamp and the AI's exit test.

    // Put the document back so later sections start from a known state.
    await page.evaluate(() => { const A = window.EditorApp; while (A._state().histIdx > 0) A._undo(); });

    // ── Resample ────────────────────────────────────────────────────────────
    console.log('\nresample');
    const rs = await page.evaluate(() => {
        const A = window.EditorApp;
        const l = A._shapeById('coast');
        const snap = () => l.outer.map(p => p.slice());
        const spacing = (ring) => ring.map((p, i) => {
            const q = ring[(i + 1) % ring.length];
            return Math.hypot(q[0] - p[0], q[1] - p[1]);
        });
        const cv = (a) => { const m = a.reduce((x, y) => x + y, 0) / a.length;
            return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / a.length) / m; };
        const per = (r) => spacing(r).reduce((x, y) => x + y, 0);

        const beforeCV = cv(spacing(l.outer)), n = l.outer.length;
        A._resample(l); A._afterEdit(true, 'resample');
        const p1 = snap(), per1 = per(p1), afterCV = cv(spacing(p1));
        A._resample(l);
        const p2 = snap(), per2 = per(p2);
        for (let i = 0; i < 5; i++) A._resample(l);
        const p7 = snap(), per7 = per(p7), cv7 = cv(spacing(p7));

        // Worst vertex movement between consecutive passes. Rotation shows up here as a
        // full spacing; lossy chord drift shows up as a small fraction of one.
        // ROTATION test, precisely: after a pass, is vertex k still nearer to old vertex
        // k than to its neighbours? Rotation slides every index round the ring, so all of
        // them fail. Lossy chord drift can move one vertex a long way at a sharp corner
        // without breaking correspondence anywhere — which is why a max-movement
        // threshold tests the wrong thing.
        let step = 0, slipped = 0;
        const N1 = p1.length;
        for (let i = 0; i < N1; i++) {
            const d0 = Math.hypot(p2[i][0] - p1[i][0], p2[i][1] - p1[i][1]);
            const dn = Math.hypot(p2[i][0] - p1[(i + 1) % N1][0], p2[i][1] - p1[(i + 1) % N1][1]);
            const dp = Math.hypot(p2[i][0] - p1[(i - 1 + N1) % N1][0], p2[i][1] - p1[(i - 1 + N1) % N1][1]);
            step = Math.max(step, d0);
            if (d0 > dn || d0 > dp) slipped++;
        }
        return { beforeCV, afterCV, cv7, n, nAfter: p7.length, step, slipped, N1,
                 spacing: per1 / p1.length, per1, per2, per7,
                 vertex0Fixed: Math.hypot(p7[0][0] - p1[0][0], p7[0][1] - p1[0][1]) };
    });
    check('vertex count preserved', rs.nAfter === rs.n, `${rs.n} -> ${rs.nAfter}`);
    check('spacing became more even', rs.afterCV < rs.beforeCV,
          `CV ${rs.beforeCV.toFixed(3)} -> ${rs.afterCV.toFixed(3)}`);
    // The bug was ROTATION: each pass shifted every vertex a full step, so indices slid
    // round the ring and the shape visibly mangled when the button was pressed twice. A
    // second pass must move vertices by much LESS than one spacing. Resampling is lossy
    // by nature — chords cut corners — so some drift is expected; a whole step is not.
    // The real property: repeated passes keep the spacing EVEN. The bug made each pass
    // start emitting one step in, so indices slid round the ring and evenness decayed —
    // pressing the button twice visibly mangled the shape. Now it converges instead.
    check('spacing stays even after seven passes', rs.cv7 <= rs.afterCV * 1.15,
          `CV ${rs.afterCV.toFixed(3)} -> ${rs.cv7.toFixed(3)}`);
    check('vertex 0 stays put across repeated resamples', rs.vertex0Fixed < 1e-6,
          `moved ${rs.vertex0Fixed.toFixed(3)}u`);
    check('the shape does not collapse over seven passes', rs.per7 > rs.per1 * 0.9,
          `perimeter ${Math.round(rs.per1)} -> ${Math.round(rs.per7)}u`);
    console.log(`         perimeter ${Math.round(rs.per1)} -> ${Math.round(rs.per2)} -> ${Math.round(rs.per7)}u, `
              + `spacing CV ${rs.beforeCV.toFixed(3)} -> ${rs.afterCV.toFixed(3)} -> ${rs.cv7.toFixed(3)}`);

    // ── Vertex multi-selection, move, align, insert/delete ──────────────────
    // One selection layer shared by every mode that owns vertices — land in Land mode, the
    // arena in Arena mode, a region's outline in Wind or Water. There is no separate
    // Vertices mode: selecting a thing shows its vertices.
    console.log('\nvertex selection');
    const vs = await page.evaluate(() => {
        const A = window.EditorApp;
        document.querySelector('#layer-list [data-layer="land"]').click();
        A._selectShape('coast');                   // its vertices are what is editable
        const l = A._shapeById('coast');
        const before = l.outer.map(q => q.slice());
        A._selectVerts([0, 1, 2, 3].map(i => ({ kind: 'land', id: 'coast', ring: -1, i })));
        const n = A._vselCount();
        A._moveSel(150, -75);
        const moved = [0, 1, 2, 3].every(i =>
            Math.abs(l.outer[i][0] - (before[i][0] + 150)) < 1e-9 &&
            Math.abs(l.outer[i][1] - (before[i][1] - 75)) < 1e-9);
        const untouched = Math.abs(l.outer[10][0] - before[10][0]) < 1e-9;
        A._alignSel('x');
        const alignedX = [1, 2, 3].every(i => Math.abs(l.outer[i][0] - l.outer[0][0]) < 1e-9);
        A._alignSel('y');
        const alignedY = [1, 2, 3].every(i => Math.abs(l.outer[i][1] - l.outer[0][1]) < 1e-9);

        // The arena is a polygon and takes the same gestures.
        document.querySelector('#layer-list [data-layer="arena"]').click();
        const bp = () => A._state().doc.world.boundary.poly;
        const arenaBefore = bp().length;
        const ins = A._insertNear((bp()[0][0] + bp()[1][0]) / 2, (bp()[0][1] + bp()[1][1]) / 2);
        const arenaAfter = bp().length;
        A._selectVerts([{ kind: 'arena', i: 1 }]);
        const del = A._deleteSel();
        const arenaFinal = bp().length;

        // A ring must never fall below 3 points, or the validator rejects the document.
        A._selectVerts([0, 1, 2, 3].map(i => ({ kind: 'arena', i })));
        A._deleteSel();
        const arenaFloor = bp().length;

        document.querySelector('#layer-list [data-layer="land"]').click();
        return { n, moved, untouched, alignedX, alignedY, arenaBefore, ins, arenaAfter, del, arenaFinal, arenaFloor };
    });
    check('four vertices selected', vs.n === 4, String(vs.n));
    check('dragging moves the whole selection', vs.moved === true);
    check('...and leaves everything else alone', vs.untouched === true);
    check('align X snaps to the anchor', vs.alignedX === true);
    check('align Y snaps to the anchor', vs.alignedY === true);
    check('an arena edge accepts an inserted vertex', vs.ins === true && vs.arenaAfter === vs.arenaBefore + 1,
          `${vs.arenaBefore} -> ${vs.arenaAfter}`);
    check('an arena vertex can be deleted', vs.del === true && vs.arenaFinal === vs.arenaBefore,
          `-> ${vs.arenaFinal}`);
    check('a ring never falls below three points', vs.arenaFloor >= 3, `${vs.arenaFloor}`);
    await page.evaluate(() => { while (window.EditorApp._state().histIdx > 0) window.EditorApp._undo(); });

    // ── Marks & gates as an inventory, and the route as an ordering ─────────
    // The separation is the whole point: deleting a LEG must leave the gate alone, and
    // deleting a MARK must take its gate and the legs that used it.
    console.log('\nmarks, gates and the route');
    const inv = await page.evaluate(() => {
        const A = window.EditorApp;
        document.querySelector('#layer-list [data-layer="marks"]').click();
        const before = A._state().doc.course;
        const marks0 = before.marks.length, lines0 = (before.lines || []).length;
        document.getElementById('btn-add-line').click();       // a gate with no leg
        const c = () => A._state().doc.course;
        const madeGate = c().lines.length === lines0 + 1 && c().marks.length === marks0 + 2;
        const unusedOk = c().route.filter(e => e.lineId === c().lines[c().lines.length - 1].id).length === 0;
        // Now use it — twice.
        const gid = c().lines[c().lines.length - 1].id;
        A._addToRoute(`line:${gid}`, 'through'); A._afterEdit(true, 'add leg');
        A._addToRoute(`line:${gid}`, 'round');   A._afterEdit(true, 'add leg');
        const uses = c().route.filter(e => e.lineId === gid).length;
        const passes = c().route.filter(e => e.lineId === gid).map(e => e.pass).join(',');
        // Removing ONE leg must not disturb the inventory.
        const legIdx = c().route.findIndex(e => e.lineId === gid);
        c().route.splice(legIdx, 1); A._afterEdit(true, 'remove leg');
        const afterLegRemoval = {
            uses: c().route.filter(e => e.lineId === gid).length,
            lines: c().lines.length, marks: c().marks.length
        };
        // Deleting the gate takes its marks AND the remaining leg.
        const gi = c().lines.findIndex(l => l.id === gid);
        A._deleteLine(gi);
        const afterGateDelete = {
            uses: c().route.filter(e => e.lineId === gid).length,
            lines: c().lines.length, marks: c().marks.length
        };
        return { madeGate, unusedOk, uses, passes, afterLegRemoval, afterGateDelete,
                 marks0, lines0 };
    });
    check('a gate can be created without touching the route',
          inv.madeGate === true && inv.unusedOk === true);
    check('the same gate can be used by two legs, sailed differently',
          inv.uses === 2 && inv.passes === 'through,round', `${inv.uses} uses: ${inv.passes}`);
    check('removing a LEG leaves the gate and its marks alone',
          inv.afterLegRemoval.uses === 1 && inv.afterLegRemoval.lines === inv.lines0 + 1
          && inv.afterLegRemoval.marks === inv.marks0 + 2,
          JSON.stringify(inv.afterLegRemoval));
    check('deleting the GATE takes its marks and its remaining leg',
          inv.afterGateDelete.uses === 0 && inv.afterGateDelete.lines === inv.lines0
          && inv.afterGateDelete.marks === inv.marks0,
          JSON.stringify(inv.afterGateDelete));

    const del = await page.evaluate(() => {
        const A = window.EditorApp;
        const c = () => A._state().doc.course;
        // A start-line mark is structural: refusing is better than a course with no start.
        const startLine = c().route[0].lineId;
        const pinId = c().lines.find(l => l.id === startLine).marks[0];
        const pinIdx = c().marks.findIndex(m => m.id === pinId);
        const refused = A._deleteMark(pinIdx) === false && c().marks.some(m => m.id === pinId);
        // A free mark deletes, and takes any leg that rounded it.
        const id = A._addMark('can'); A._afterEdit(true, 'add mark');
        A._addToRoute(`mark:${id}`); A._afterEdit(true, 'add leg');
        const legs0 = c().route.length;
        const idx = c().marks.findIndex(m => m.id === id);
        const ok = A._deleteMark(idx);
        return { refused, ok, gone: !c().marks.some(m => m.id === id),
                 legsDropped: legs0 - c().route.length };
    });
    check('a start-line mark refuses to be deleted', del.refused === true);
    check('a free mark deletes, and its rounding leg goes with it',
          del.ok === true && del.gone === true && del.legsDropped === 1,
          `dropped ${del.legsDropped} leg(s)`);

    // ── Hover tells you WHICH gate ──────────────────────────────────────────
    const hov = await page.evaluate(() => {
        const A = window.EditorApp;
        const c = A._state().doc.course;
        const ln = c.lines[0];
        const a = c.marks.find(m => m.id === ln.marks[0]), b = c.marks.find(m => m.id === ln.marks[1]);
        // The midpoint of a line is on the line, so hit-testing must find the GATE there.
        const hitMid = A._hit((a.x + b.x) / 2, (a.y + b.y) / 2);
        const hitEnd = A._hit(a.x, a.y);           // a mark wins over its own gate
        return { line: hitMid.line, mark: hitEnd.mark, label: A._lineLabel(ln.id) };
    });
    check('a gate is grabbable along its span', hov.line === 0, `line ${hov.line}`);
    check('...but a mark still wins at its own position', hov.mark >= 0, `mark ${hov.mark}`);
    check('a gate has a readable name', /line|gate/i.test(hov.label), hov.label);

    // ── Route reorder by drag, and custom names ─────────────────────────────
    // The route order IS the course: the leg engine walks it in sequence. So the two
    // things worth pinning are that a drag actually moves an entry, and that the start
    // and finish cannot leave their ends however the gesture is aimed.
    console.log('\nroute reorder and naming');
    await page.evaluate(() => {
        const A = window.EditorApp;
        // Geometry is made in Marks & gates; the Route panel only orders what exists.
        document.querySelector('#layer-list [data-layer="marks"]').click();
        const gid = A._addLine(); A._afterEdit(true, 'gate');
        const mid = A._addMark('can'); A._afterEdit(true, 'mark');
        document.querySelector('#layer-list [data-layer="course"]').click();
        A._addToRoute(`line:${gid}`, 'through'); A._afterEdit(true, 'leg');
        A._addToRoute(`mark:${mid}`); A._afterEdit(true, 'leg');
    });
    const rows = page.locator('#obj-list .ob');
    const kindsOf = () => page.evaluate(() => window.EditorApp._state().doc.course.route
        .map(e => e.role === 'start' ? 'start' : e.finish ? 'finish' : (e.pass || e.kind)));
    const order0 = await kindsOf();
    check('the route now has two movable legs', order0.length >= 4, order0.join(','));

    // Drag the first movable row down past the second. The drop point matters: the LOWER
    // half of a row means "after it", which is the whole gesture being tested.
    const rowH = (await rows.nth(2).boundingBox()).height;
    await rows.nth(1).dragTo(rows.nth(2), { targetPosition: { x: 40, y: rowH * 0.8 } });
    const order1 = await kindsOf();
    check('dragging a leg down moves it', order1[1] === order0[2] && order1[2] === order0[1],
          `${order0.join(',')} -> ${order1.join(',')}`);
    check('the start stays first and the finish last',
          order1[0] === 'start' && order1[order1.length - 1] === 'finish', order1.join(','));

    // Aim a drag at the finish row: it must land just before the finish, never after it.
    await rows.nth(1).dragTo(rows.nth(order1.length - 1), { targetPosition: { x: 40, y: rowH * 0.2 } });
    const aimed = await kindsOf();
    check('a leg dragged onto the finish lands before it, not after',
          aimed[aimed.length - 1] === 'finish' && aimed[aimed.length - 2] === order1[1],
          aimed.join(','));

    const nm = await page.evaluate(() => {
        const A = window.EditorApp;
        const set = (id, v) => { const el = document.getElementById(id); el.value = v;
            el.dispatchEvent(new Event('change')); };
        const r = () => A._state().doc.course.route;
        // A leg with no name reads as what it IS.
        const derived = A._entryLabel(1);
        document.querySelector('#obj-list .ob[data-i="1"]').click();
        const rowShown = !document.getElementById('rt-name-row').classList.contains('hidden');
        set('rt-name', 'The Long Beat');
        const named = r()[1].name;
        const shownNamed = document.querySelector('#obj-list .ob[data-i="1"] .ob-n').textContent;
        set('rt-name', '   ');                     // blank clears it, default comes back
        const cleared = r()[1].name === undefined;
        const shownAgain = document.querySelector('#obj-list .ob[data-i="1"] .ob-n').textContent;

        // Marks the same way, with the smart default still on show beside the field.
        document.querySelector('#layer-list [data-layer="marks"]').click();
        A._selectMark(0);
        const mkShown = !document.getElementById('mk-name-row').classList.contains('hidden');
        const mkDerived = document.getElementById('mk-derived').textContent;
        set('mk-name', 'Sneaky Rock');
        const mkNamed = A._state().doc.course.marks[0].name;
        const mkLabel = A._markLabel(0);
        set('mk-kind', 'can');
        const kind = A._state().doc.course.marks[0].kind;
        set('mk-name', '');

        // And gates, which are named objects in their own right now.
        A._selectLine(0);
        const lnShown = !document.getElementById('ln-name-row').classList.contains('hidden');
        set('ln-name', 'The Narrows');
        const lnNamed = A._lineLabel(A._state().doc.course.lines[0].id);
        set('ln-name', '');
        const lnCleared = A._state().doc.course.lines[0].name === undefined;
        return { derived, rowShown, named, shownNamed, cleared, shownAgain,
                 mkShown, mkDerived, mkNamed, mkLabel, kind,
                 mkCleared: A._state().doc.course.marks[0].name === undefined,
                 lnShown, lnNamed, lnCleared };
    });
    check('an unnamed leg reads as what it is', /gate|round|start|finish/i.test(nm.derived), nm.derived);
    check('clicking a row opens the name field', nm.rowShown === true);
    check('a typed leg name is stored and shown', nm.named === 'The Long Beat' && nm.shownNamed === 'The Long Beat',
          `${nm.named} / ${nm.shownNamed}`);
    check('blanking the field restores the smart default', nm.cleared === true && nm.shownAgain === nm.derived,
          `${nm.shownAgain} vs ${nm.derived}`);
    check('selecting a mark opens its name field', nm.mkShown === true);
    check('...with the smart default on show', /pin|boat|gate|mark|rounding/i.test(nm.mkDerived), nm.mkDerived);
    check('a typed mark name wins over the derived label', nm.mkNamed === 'Sneaky Rock' && nm.mkLabel === 'Sneaky Rock',
          `${nm.mkNamed} / ${nm.mkLabel}`);
    check('the mark kind can be changed', nm.kind === 'can', nm.kind);
    check('blanking a mark name restores the default', nm.mkCleared === true);
    check('a gate can be named too', nm.lnShown === true && nm.lnNamed === 'The Narrows', nm.lnNamed);
    check('blanking a gate name restores its default', nm.lnCleared === true);

    // ── Measuring a multi-leg path ──────────────────────────────────────────
    console.log('\nmeasure');
    const meas = await page.evaluate(() => {
        window.EditorApp._pickTool('measure');
        const cv = document.getElementById('schematic');
        const r = cv.getBoundingClientRect();
        const at = (x, y, shift) => {
            cv.dispatchEvent(new MouseEvent('mousedown', { clientX: r.left + x, clientY: r.top + y,
                button: 0, shiftKey: !!shift, bubbles: true }));
            window.dispatchEvent(new MouseEvent('mousemove', { clientX: r.left + x, clientY: r.top + y, bubbles: true }));
            window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
        };
        at(200, 200);                       // drag out the first leg
        window.dispatchEvent(new MouseEvent('mousemove', { clientX: r.left + 300, clientY: r.top + 200, bubbles: true }));
        const one = window.EditorApp._measure().pts.length;
        at(400, 300, true);                 // shift EXTENDS
        at(500, 400, true);
        const three = window.EditorApp._measure().pts.length;
        at(120, 120);                       // a plain drag starts over
        const restart = window.EditorApp._measure().pts.length;
        return { one, three, restart };
    });
    check('a drag measures one leg', meas.one === 2, `${meas.one} points`);
    check('shift-click extends it into a path', meas.three === 4, `${meas.three} points`);
    check('a plain drag starts a new measurement', meas.restart === 2, `${meas.restart} points`);

    // ── Current regions ─────────────────────────────────────────────────────
    console.log('\ncurrent');
    const cur = await page.evaluate(() => {
        const A = window.EditorApp;
        document.querySelector('#layer-list [data-layer="water"]').click();
        document.getElementById('btn-add-cur-all').click();
        const d = A._state().doc;
        const r = d.current.regions[0];
        const set = (id, v) => { const el = document.getElementById(id); el.value = v;
            el.dispatchEvent(new Event('change')); };
        set('cr-speed', '2.5');
        set('cr-dir', '90');
        // Does the GAME see it? getCurrentAt is what the physics and the AI read.
        const mid = getCurrentAt(0, 0);
        // Outside every region the answer is the AMBIENT current, which is null when the
        // venue has none — the same value every consumer already guards for.
        const outside = getCurrentAt(1e6, 1e6);
        // And no RNG may be consumed, or a current could move the eval anchor.
        let draws = 0;
        const real = Math.random;
        Math.random = () => { draws++; return real(); };
        for (let i = 0; i < 200; i++) getCurrentAt(i * 12, 0);
        Math.random = real;
        return { count: d.current.regions.length, speed: r.speed,
                 dirDeg: Math.round(r.direction * 180 / Math.PI),
                 midSpeed: mid.speed, midDir: mid.direction,
                 outSpeed: outside ? outside.speed : 0, outNull: outside === null, draws };
    });
    check('a whole-course current region is created', cur.count === 1, String(cur.count));
    check('speed and flow direction are stored', cur.speed === 2.5 && cur.dirDeg === 90,
          `${cur.speed}kt @ ${cur.dirDeg}°`);
    check('the game reads the flow inside the region', Math.abs(cur.midSpeed - 2.5) < 0.15,
          `${cur.midSpeed.toFixed(2)}kt`);
    check('...pointing where the region says', Math.abs(cur.midDir - Math.PI / 2) < 0.05,
          `${cur.midDir.toFixed(3)} rad`);
    check('outside every region the ambient current is returned untouched',
          cur.outSpeed < 1e-9, `${cur.outSpeed}${cur.outNull ? ' (null — this venue has no ambient current)' : ''}`);
    check('sampling the current consumes no rng draws', cur.draws === 0, `${cur.draws} draws`);

    // ── The legend describes THIS venue ─────────────────────────────────────
    const leg = await page.evaluate(() => window.EditorApp._legend());
    check('the legend mentions what the venue has', /granite|ice/i.test(leg) && /current/i.test(leg), leg.slice(0, 120));
    check('...and not a fixed list', !/tropical sand|red rock/i.test(leg), leg.slice(0, 160));

    await page.evaluate(() => { const A = window.EditorApp; while (A._state().histIdx > 0) A._undo(); });

    // ── A rounding mark is not the island it stands on ──────────────────────
    // The bug this fixes: the rounding referenced a LAND SHAPE, so the mark WAS the
    // island's centroid and dragging one dragged the other.
    console.log('\nrounding mark vs island');
    const rnd = await page.evaluate(() => {
        const A = window.EditorApp;
        const d = A._state().doc;
        const e = d.course.route.find(x => x.kind === 'round');
        const mi = d.course.marks.findIndex(m => m.id === e.markId);
        const isle = d.land.find(l => l.id === 'granite-isle');
        const before = { mx: d.course.marks[mi].x, my: d.course.marks[mi].y, ic: isle.c.slice() };
        // Move the MARK.
        d.course.marks[mi].x += 400; d.course.marks[mi].y -= 250;
        A._afterEdit(true, 'move mark');
        const isle2 = A._state().doc.land.find(l => l.id === 'granite-isle');
        const islandHeld = Math.abs(isle2.c[0] - before.ic[0]) < 1e-9
                        && Math.abs(isle2.c[1] - before.ic[1]) < 1e-9;
        const markMoved = Math.abs(A._state().doc.course.marks[mi].x - (before.mx + 400)) < 1e-9;
        // ...and the compiled rounding follows the mark, not the island.
        const cm = window.state.course.route.find(x => x.kind === 'round').mark;
        const compiledFollows = Math.abs(cm.x - (before.mx + 400)) < 1e-6;
        // Now move the ISLAND and check the mark stays.
        A._selectShape('granite-isle');
        const isle3 = A._state().doc.land.find(l => l.id === 'granite-isle');
        A._translateShape(isle3, -300, 120);
        A._afterEdit(true, 'move island');
        const markHeld = Math.abs(A._state().doc.course.marks[mi].x - (before.mx + 400)) < 1e-9;
        const noLandRef = !('landId' in e);
        return { islandHeld, markMoved, compiledFollows, markHeld, noLandRef,
                 radius: e.radius, zone: e.zone };
    });
    check('the route no longer references a land shape', rnd.noLandRef === true);
    check('moving the rounding mark leaves the island alone',
          rnd.markMoved === true && rnd.islandHeld === true);
    check('...and the compiled rounding follows the mark', rnd.compiledFollows === true);
    check('moving the island leaves the mark alone', rnd.markHeld === true);
    check('the rounding still knows how big the thing it stands at is',
          rnd.radius > 100 && rnd.zone > rnd.radius, `radius ${Math.round(rnd.radius)}, zone ${Math.round(rnd.zone)}`);
    await page.evaluate(() => { const A = window.EditorApp; while (A._state().histIdx > 0) A._undo(); });

    // ── Hand-placed ice ─────────────────────────────────────────────────────
    console.log('\nhand-placed ice');
    const ice2 = await page.evaluate(() => {
        const A = window.EditorApp;
        document.querySelector('#layer-list [data-layer="venue"]').click();
        const clean = !A._state().dirty;                 // reading must not dirty the doc
        document.getElementById('ice-scatter').value = '1';
        document.getElementById('ice-vary').value = '0';
        // The venue ships with hand-placed ice, so everything here counts DELTAS.
        const start = A._state().doc.ice.length;
        const n1 = A._addIce(-3200, 2600, 300);          // open water on this venue
        A._afterEdit(true, 'ice');
        const one = A._state().doc.ice.length - start;
        const verts = A._state().doc.ice[A._state().doc.ice.length - 1].outer.length;
        // Scatter: several floes inside the dragged circle, all of them inside it.
        document.getElementById('ice-scatter').value = '6';
        const mid = A._state().doc.ice.length;
        A._addIce(-3200, 3400, 900);
        A._afterEdit(true, 'ice');
        const after = A._state().doc.ice.length - mid;
        const inside = A._state().doc.ice.slice(mid).every(f => {
            const cx = f.outer.reduce((a, p) => a + p[0], 0) / f.outer.length;
            const cy = f.outer.reduce((a, p) => a + p[1], 0) / f.outer.length;
            return Math.hypot(cx - (-3200), cy - 3400) <= 900;
        });
        // Does the GAME build them? Authored floes carry a flag and a fresh drift.
        A._recompile(true);
        const built = (window.state.course.islands || []).filter(i => i.authored);
        const docN = A._state().doc.ice.length;
        const drifts = built.every(f => Math.hypot(f.driftVx, f.driftVy) > 0 && f.spinRate !== 0);
        // Every authored floe must reach the game with the outline it was given — matched
        // by id, since the built list also carries whatever else is in the course.
        const byId = {};
        for (const f of A._state().doc.ice) byId[f.id] = f.outer.length;
        const shapeHeld = built.length > 0 && built.every(f => byId[f.id] === f.localArt.length);
        const onLand = A._state().doc.ice.every(f => {
            const cx = f.outer.reduce((a, p) => a + p[0], 0) / f.outer.length;
            const cy = f.outer.reduce((a, p) => a + p[1], 0) / f.outer.length;
            return !A._state().doc.land.some(l => window.VenueDoc.pointInRing(cx, cy, l.outer));
        });
        // Deleting.
        const before = A._state().doc.ice.length;
        A._deleteIce(0);
        const gone = A._state().doc.ice.length === before - 1;
        return { clean, n1, one, verts, after, inside, builtN: built.length, docN,
                 drifts, shapeHeld, allInWater: onLand, gone };
    });
    check('reading the ice list does not mark the document unsaved', ice2.clean === true);
    check('a drag places one floe with a generated outline',
          ice2.one === 1 && ice2.verts >= 5, `+${ice2.one} floe, ${ice2.verts} vertices`);
    // Fewer than asked for is correct behaviour when the box is partly land: the tool
    // places fewer rather than placing them badly.
    check('scatter places several, all inside the drag',
          ice2.after >= 2 && ice2.after <= 6 && ice2.inside === true, `+${ice2.after} floes`);
    check('...and never on land', ice2.allInWater === true);
    check('the game builds every authored floe', ice2.builtN === ice2.docN,
          `${ice2.builtN} built of ${ice2.docN} authored`);
    check('...each with its authored shape', ice2.shapeHeld === true);
    check('...and a fresh drift and spin per race', ice2.drifts === true);
    check('ice can be deleted', ice2.gone === true);
    await page.evaluate(() => { const A = window.EditorApp; while (A._state().histIdx > 0) A._undo(); });

    // ── Alignment snapping ──────────────────────────────────────────────────
    console.log('\nvertex snapping');
    const snapT = await page.evaluate(() => {
        const A = window.EditorApp;
        document.querySelector('#layer-list [data-layer="land"]').click();
        A._selectShape('coast');
        const l = A._shapeById('coast');
        const ref = { kind: 'land', id: 'coast', ring: -1, i: 5 };
        const nb = l.outer[4];
        // Just off the neighbour's x: must snap onto it.
        const close = A._snapPoint({ x: nb[0] + 2, y: nb[1] + 4000 }, ref);
        // Well away from it: must not.
        const farOff = A._snapPoint({ x: nb[0] + 4000, y: nb[1] + 4000 }, ref);
        return { snappedX: Math.abs(close.x - nb[0]) < 1e-9,
                 keptY: Math.abs(close.y - (nb[1] + 4000)) < 1e-9,
                 freeX: Math.abs(farOff.x - (nb[0] + 4000)) < 1e-9 };
    });
    check('a vertex snaps to its neighbour\'s axis when close', snapT.snappedX === true);
    check('...on that axis only', snapT.keptY === true);
    check('...and not when it is deliberately elsewhere', snapT.freeX === true);

    // ── The vertex panel appears only when there is a selection ─────────────
    const panel = await page.evaluate(() => {
        const shown = () => document.getElementById('vsel-row').style.display !== 'none';
        const A = window.EditorApp;
        A._selectVerts([]);
        document.querySelector('#layer-list [data-layer="land"]').click();
        const idle = shown();
        A._selectVerts([{ kind: 'land', id: 'coast', ring: -1, i: 0 }]);
        const withSel = shown();
        document.querySelector('#layer-list [data-layer="wind"]').click();
        A._selectVerts([]);
        const inWind = shown();
        return { idle, withSel, inWind };
    });
    check('the vertex panel stays out of the way with nothing selected', panel.idle === false);
    check('...and appears as soon as something is selected', panel.withSel === true);
    check('...in whichever mode owns it', panel.inWind === false);

    // ── Ice takes the same three gestures as a land shape ───────────────────
    const iceG = await page.evaluate(() => {
        const A = window.EditorApp;
        document.querySelector('#layer-list [data-layer="venue"]').click();
        document.getElementById('ice-scatter').value = '1';
        A._addIce(-3200, 2600, 300);
        A._afterEdit(true, 'ice');
        const i = A._state().doc.ice.length - 1;
        const f = () => A._state().doc.ice[i];
        const centre = () => {
            const o = f().outer;
            return { x: o.reduce((a, p) => a + p[0], 0) / o.length,
                     y: o.reduce((a, p) => a + p[1], 0) / o.length };
        };
        const span = () => {
            const o = f().outer, c = centre();
            return Math.max.apply(null, o.map(p => Math.hypot(p[0] - c.x, p[1] - c.y)));
        };
        const cv = document.getElementById('schematic');
        const r = cv.getBoundingClientRect();
        A._setView(centre().x, centre().y, 1);
        const at = (mods) => {
            const c = { x: r.width / 2, y: r.height / 2 };
            cv.dispatchEvent(new MouseEvent('mousedown', Object.assign({
                clientX: r.left + c.x, clientY: r.top + c.y, button: 0, bubbles: true }, mods || {})));
            window.dispatchEvent(new MouseEvent('mousemove', {
                clientX: r.left + c.x + 60, clientY: r.top + c.y + 30, bubbles: true }));
            window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
        };
        A._selectIce(i);
        const before = { c: centre(), span: span(), v0: f().outer[0].slice() };
        at();                                     // plain drag: move
        const afterMove = { c: centre(), span: span() };
        A._setView(centre().x, centre().y, 1);
        at({ metaKey: true });                    // Cmd+drag: rotate
        const afterRot = { c: centre(), span: span(), v0: f().outer[0].slice() };
        A._setView(centre().x, centre().y, 1);
        at({ altKey: true });                     // Alt+drag: scale
        const afterScale = { span: span() };
        return { before, afterMove, afterRot, afterScale };
    });
    check('a plain drag moves a floe',
          Math.hypot(iceG.afterMove.c.x - iceG.before.c.x, iceG.afterMove.c.y - iceG.before.c.y) > 20,
          `moved ${Math.round(Math.hypot(iceG.afterMove.c.x - iceG.before.c.x, iceG.afterMove.c.y - iceG.before.c.y))}u`);
    check('Cmd/Ctrl+drag ROTATES it — its size does not change',
          Math.abs(iceG.afterRot.span - iceG.afterMove.span) < 1e-6
          && Math.hypot(iceG.afterRot.v0[0] - iceG.before.v0[0], iceG.afterRot.v0[1] - iceG.before.v0[1]) > 1,
          `span ${iceG.afterMove.span.toFixed(1)} -> ${iceG.afterRot.span.toFixed(1)}`);
    check('Alt+drag SCALES it', Math.abs(iceG.afterScale.span - iceG.afterRot.span) > 1,
          `span ${iceG.afterRot.span.toFixed(1)} -> ${iceG.afterScale.span.toFixed(1)}`);
    await page.evaluate(() => { const A = window.EditorApp; while (A._state().histIdx > 0) A._undo(); });

    // ── Current region vertices, boat controls, bearings ────────────────────
    console.log('\ncurrent regions and the boat');
    const cur2 = await page.evaluate(() => {
        const A = window.EditorApp;
        document.querySelector('#layer-list [data-layer="water"]').click();
        document.getElementById('btn-add-cur-all').click();
        const reg = () => A._state().doc.current.regions[0];
        const p0 = reg().poly[0].slice();
        // A region corner must be GRABBABLE in its own mode — this was gated on the WIND
        // selection, so current corners could never be dragged.
        const h = A._hit(p0[0], p0[1]);
        A._selectVerts([{ kind: 'current', r: 0, i: 0 }]);
        A._moveSel(150, -90);
        const moved = Math.abs(reg().poly[0][0] - (p0[0] + 150)) < 1e-9;
        A._selectVerts([]);
        return { wvert: h.wvert, moved };
    });
    check('a current region corner is grabbable in Water mode', cur2.wvert === 0, `wvert ${cur2.wvert}`);
    check('...and moves when dragged', cur2.moved === true);

    const bear = await page.evaluate(() => {
        const A = window.EditorApp;
        document.querySelector('#layer-list [data-layer="wind"]').click();
        const r = () => A._state().doc.wind.regions[0];
        // The wind is named by where it comes FROM, as a compass bearing: 0 north, up.
        const el = document.getElementById('wr-dir');
        // Selecting the region is what exposes its fields — from the layer's object column,
        // which is where regions are listed now.
        document.querySelector('#obj-list .ob').click();
        el.value = '215'; el.dispatchEvent(new Event('change'));
        const stored = r().direction;
        const shown = document.getElementById('wr-dir').value;
        // 215 degrees means from the south-west, so the wind blows toward the north-east:
        // forward = (sin, -cos) of the FROM bearing points back at where it came from.
        const fromVec = { x: Math.sin(stored), y: -Math.cos(stored) };
        return { stored, shown, fromVec, deg: A._degOf(stored), compass: A._compassOf(stored) };
    });
    check('a wind bearing round-trips as a compass number',
          bear.shown === '215' && bear.deg === 215, `stored ${bear.stored.toFixed(3)} shown ${bear.shown}`);
    check('...and 215° reads as south-west', bear.compass === 'SW', bear.compass);
    check('...pointing back at where the wind came from (south-west of the boat)',
          bear.fromVec.x < 0 && bear.fromVec.y > 0,
          `(${bear.fromVec.x.toFixed(2)}, ${bear.fromVec.y.toFixed(2)}) — screen y is down, so +y is south`);

    const boat = await page.evaluate(() => {
        const A = window.EditorApp;
        window.EditorApp._pickTool('measure');
        document.getElementById('show-boat').click();
        const cv = document.getElementById('schematic');
        const r = cv.getBoundingClientRect();
        A._setView(0, 0, 1);                      // 1 px per world unit: the boat is 55 px
        const at = (x, y, mods) => {
            cv.dispatchEvent(new MouseEvent('mousedown', Object.assign({
                clientX: r.left + x, clientY: r.top + y, button: 0, bubbles: true }, mods || {})));
            window.dispatchEvent(new MouseEvent('mousemove', { clientX: r.left + x + 40, clientY: r.top + y + 20, bubbles: true }));
            window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
        };
        const b0 = Object.assign({}, A._boat());
        const c = { x: r.width / 2, y: r.height / 2 };
        at(c.x, c.y);                             // plain drag: move
        const b1 = Object.assign({}, A._boat());
        at(c.x + 40, c.y + 20, { metaKey: true }); // Cmd+drag: rotate
        const b2 = Object.assign({}, A._boat());
        return { b0, b1, b2 };
    });
    check('the boat appears when switched on', boat.b0 && boat.b0.x !== undefined);
    check('a plain drag MOVES it, like a shape',
          Math.abs(boat.b1.x - boat.b0.x) > 20 && Math.abs(boat.b1.heading - boat.b0.heading) < 1e-9,
          `moved ${Math.round(boat.b1.x - boat.b0.x)}u, heading ${boat.b1.heading.toFixed(3)}`);
    check('Cmd/Ctrl+drag ROTATES it, like a shape',
          Math.abs(boat.b2.heading - boat.b1.heading) > 0.05
          && Math.abs(boat.b2.x - boat.b1.x) < 1e-9,
          `heading ${boat.b1.heading.toFixed(3)} -> ${boat.b2.heading.toFixed(3)}`);
    await page.evaluate(() => { const A = window.EditorApp; while (A._state().histIdx > 0) A._undo(); });

    // ── Save output    // ── Save output ─────────────────────────────────────────────────────────
    console.log('\nsave output');
    const out = await page.evaluate(() => {
        const d = window.EditorApp._state().doc;
        const text = 'window.VENUE_DOC = window.VENUE_DOC || {};\n'
            + `window.VENUE_DOC[${JSON.stringify(d.venue)}] = ${JSON.stringify(d, null, 2)};\n`;
        // Round-trip it: the saved text must reload into an equivalent document.
        const shim = {};
        new Function('window', text)(shim);
        const back = shim.VENUE_DOC[d.venue];
        return {
            len: text.length,
            same: JSON.stringify(back) === JSON.stringify(d),
            errors: window.VenueDoc.validate(back).filter(p => p.level === 'error').length
        };
    });
    check('saved text round-trips to an identical document', out.same === true);
    check('round-tripped document validates', out.errors === 0);
    console.log(`         ${(out.len / 1024).toFixed(1)} KB — snapshot undo at 100 levels ≈ ${(out.len * 100 / 1048576).toFixed(1)} MB`);

    // ── Nothing leaked to the console ───────────────────────────────────────
    console.log('\nintegrity');
    check('no page errors across the whole session', errs.length === 0, errs.slice(0, 3).join(' | '));

    await page.screenshot({ path: 'regatta/eval/_editor_edited.png' });
    await browser.close();
    console.log(`\n${failures ? 'FAIL' : 'PASS'} — ${failures} failure(s)`);
    process.exitCode = failures ? 1 : 0;
})();
