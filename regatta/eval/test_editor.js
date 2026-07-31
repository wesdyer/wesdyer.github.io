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
        // The brushes act on the ACTIVE LAYER's outlines, not on land specifically, so the
        // layer has to be the one that owns them — the same thing clicking Land does.
        A._setMode('shape');
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
        document.querySelector('#layer-list [data-layer="current"]').click();
        [...document.querySelectorAll('#objs-actions .btn')]
            .find(b => /whole course/i.test(b.textContent)).click();
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
    // The GESTURE, not the function. `_insertNear` had a test and kept passing while
    // double-click was dead on the Land layer for a whole tool split — because the gate it
    // failed was in the event handler, which nothing drove.
    const dbl = await page.evaluate(() => {
        const A = window.EditorApp, r = {};
        while (A._state().histIdx > 0) A._undo();
        document.querySelector('#layer-list [data-layer="land"]').click();
        const cv = document.getElementById('schematic');
        const rect = cv.getBoundingClientRect();
        const l = A._shapeById('isle-3');
        const xs = l.outer.map(q => q[0]), ys = l.outer.map(q => q[1]);
        const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
        const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
        const w = Math.max(...xs) - Math.min(...xs), h = Math.max(...ys) - Math.min(...ys);
        A._setView(cx, cy, Math.min(cv.clientWidth / (w * 1.6), cv.clientHeight / (h * 1.6)));
        const edgeMid = () => {
            const s2 = A._shapeById('isle-3'), v = A._view();
            const a = s2.outer[0], b2 = s2.outer[1];
            return { x: ((a[0] + b2[0]) / 2 - v.x) * v.scale + cv.clientWidth / 2,
                     y: ((a[1] + b2[1]) / 2 - v.y) * v.scale + cv.clientHeight / 2 };
        };
        const dblAt = (pt) => cv.dispatchEvent(new MouseEvent('dblclick',
            { clientX: rect.left + pt.x, clientY: rect.top + pt.y, bubbles: true }));
        for (const tool of ['select', 'direct']) {
            A._pickTool(tool);
            A._selectShape('isle-3');
            const before = A._shapeById('isle-3').outer.length;
            dblAt(edgeMid());
            r[tool] = A._shapeById('isle-3').outer.length - before;
        }
        // ...and on a layer that is not Land, whose outline has no land selection behind it.
        A._setMode('boundary'); A._pickTool('direct'); A.fitView();
        const bp = () => A._state().doc.world.boundary.poly;
        const v2 = A._view();
        const a2 = bp()[0], b3 = bp()[1];
        const before2 = bp().length;
        dblAt({ x: ((a2[0] + b3[0]) / 2 - v2.x) * v2.scale + cv.clientWidth / 2,
                y: ((a2[1] + b3[1]) / 2 - v2.y) * v2.scale + cv.clientHeight / 2 });
        r.arena = bp().length - before2;
        return r;
    });
    check('double-click on an edge inserts a vertex under the DIRECT arrow', dbl.direct === 1,
          `${dbl.direct} added`);
    check('...and does nothing under the object arrow', dbl.select === 0, `${dbl.select} added`);
    check('...and works the same on the arena outline', dbl.arena === 1, `${dbl.arena} added`);
    await page.evaluate(() => { const A = window.EditorApp; while (A._state().histIdx > 0) A._undo(); });

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
        document.querySelector('#layer-list [data-layer="route"]').click();
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

    // ── Renaming land ───────────────────────────────────────────────────────
    // `id` is what the file and every check refer to; `name` is what you call it. Renaming must
    // change every place the shape is NAMED and nothing about what it IS.
    console.log('\nland names');
    const ren = await page.evaluate(() => {
        const A = window.EditorApp;
        document.querySelector('#layer-list [data-layer="land"]').click();
        const id = A._state().doc.land[1].id;
        A._selectShape(id);
        const box = () => document.querySelector('#insp-obj [data-rename="shape"]');
        const set = (v) => { const el = box(); el.value = v; el.dispatchEvent(new Event('change')); };
        set('Granite Isle');
        const named = {
            id: A._state().doc.land[1].id,                      // must NOT change
            name: A._state().doc.land[1].name,
            row: [...document.querySelectorAll('#obj-list .ob .ob-n')].map(e => e.textContent),
            header: document.getElementById('in-name').textContent,
        };
        set('   ');                                             // blank reverts to the id
        const cleared = { name: A._state().doc.land[1].name,
                          header: document.getElementById('in-name').textContent };
        // Renaming is one undo, not two.
        const before = A._state().histIdx;
        set('Granite Isle'); A._undo();
        const undone = { name: A._state().doc.land[1].name, histIdx: A._state().histIdx, before };
        return { id, named, cleared, undone };
    });
    check('a land shape can be renamed', ren.named.name === 'Granite Isle');
    check('...and keeps its id, which the file and the checks use', ren.named.id === ren.id);
    check('...the object list shows the name', ren.named.row.includes('Granite Isle'), ren.named.row.join(','));
    check('...so does the inspector header', ren.named.header === 'Granite Isle', ren.named.header);
    // The channel row on a NEIGHBOUR names the renamed shape: it is one of the places a shape
    // is referred to by name rather than by identity, and it read the raw id before.
    const gapRow = await page.evaluate(() => {
        const A = window.EditorApp;
        const gapTarget = () => (document.getElementById('insp-obj').textContent
            .match(/Min channel to (.+?)\s+[\d.]/) || [])[1];
        A._selectShape(A._state().doc.land[1].id);
        const neighbour = gapTarget();                       // whatever is nearest to it
        const idx = A._state().doc.land.findIndex(l => l.id === neighbour);
        A._selectShape(A._state().doc.land[idx].id);
        const el = document.querySelector('#insp-obj [data-rename="shape"]');
        el.value = 'North headland'; el.dispatchEvent(new Event('change'));
        A._selectShape(A._state().doc.land[1].id);
        const after = gapTarget();
        A._undo();
        return { neighbour, idx, after };
    });
    check("...and a neighbour's channel row uses the name, not the id",
          gapRow.idx >= 0 && gapRow.after === 'North headland',
          `nearest was ${gapRow.neighbour}, row now says ${gapRow.after}`);
    check('clearing the box goes back to the id',
          ren.cleared.name === undefined && ren.cleared.header === ren.id,
          `${ren.cleared.name} · ${ren.cleared.header}`);
    check('a rename is ONE undo', ren.undone.name === undefined, `${ren.undone.name}`);

    // ── The water swatches ──────────────────────────────────────────────────
    // A colour picker that changes nothing on screen is worse than a missing one: you tune it,
    // nothing happens, and you conclude the water is broken. So every swatch the panel offers
    // has to move the preview — and the preview has to be the GAME's renderer, water plus the
    // wind-ripple layer, or "what you will sail on" is a claim the panel cannot keep.
    console.log('\nwater colour');
    const pal = await page.evaluate(async () => {
        document.querySelector('#layer-list [data-layer="water"]').click();
        const cv = document.getElementById('pal-preview');
        const swatches = [...document.querySelectorAll('#layer-settings .mode-panel[data-layer="water"] input[type=color]')]
            .map(el => el.id);
        const shot = () => cv.toDataURL();
        const out = [];
        for (const id of swatches) {
            const el = document.getElementById(id);
            const was = el.value;
            const before = shot();
            el.value = '#ff00ff';                       // a colour no venue would choose
            el.dispatchEvent(new Event('change'));
            const after = shot();
            el.value = was; el.dispatchEvent(new Event('change'));
            out.push({ id, changed: before !== after });
        }
        return { swatches, out,
                 // The ripple layer is the game's own: same update, same draw.
                 ripples: window.state.waveStates.size,
                 usesGameRenderer: typeof window.WaterRenderer.draw === 'function' };
    });
    check('the water panel offers exactly the colours the renderer reads',
          pal.swatches.join(',') === 'pal-base,pal-deep', pal.swatches.join(','));
    for (const o of pal.out)
        check(`${o.id} changes the preview`, o.changed === true,
              'a swatch that moves nothing on screen must not be offered');
    check('the preview carries the game\'s wind ripples', pal.ripples > 0, `${pal.ripples} wave cells`);
    check('...drawn by the game\'s own water renderer', pal.usesGameRenderer === true);

    // ── Current regions ─────────────────────────────────────────────────────
    console.log('\ncurrent');
    const cur = await page.evaluate(() => {
        const A = window.EditorApp;
        document.querySelector('#layer-list [data-layer="current"]').click();
        // "+ Whole course" is an object-column action now, and the region's numbers are in
        // the INSPECTOR — so the region must be selected before its fields exist.
        [...document.querySelectorAll('#objs-actions .btn')]
            .find(b => /whole course/i.test(b.textContent)).click();
        const d = A._state().doc;
        const r = d.current.regions[0];
        const set = (key, v) => { const el = document.querySelector(`#insp-obj [data-num="cr.${key}"]`);
            el.value = v; el.dispatchEvent(new Event('change')); };
        set('speed', '2.5');
        set('dir', '90');
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

    // ── The Course layer is the whole course, and says so ───────────────────
    // The legend is gone: what a venue contains is a count on each layer row, which is a
    // shorter answer in a place you are already looking.
    const courseLayer = await page.evaluate(() => {
        const A = window.EditorApp;
        document.querySelector('#layer-list [data-layer="course"]').click();
        return {
            rootName: document.querySelector('#layer-list .ly.root .ly-n').textContent,
            headHidden: document.querySelector('.ed-right .in-head').hidden,
            nameField: document.getElementById('course-name').value,
            venueField: document.getElementById('course-venue').textContent,
            objTitle: document.getElementById('objs-title').textContent,
            objBody: document.getElementById('obj-list').textContent.trim(),
            tools: [...document.querySelectorAll('#tool-strip [data-tool]')]
                .map(e => e.dataset.tool + (e.disabled ? ':off' : ':on')),
            rootCount: (document.querySelector('#layer-list .ly.root .ly-c') || {}).textContent || '',
            routeRow: [...document.querySelectorAll('#layer-list .ly-n')].map(e => e.textContent)
        };
    });
    // The row names the LAYER, like every other row; the course's own name is a property of
    // the course and lives in its field.
    check('the root layer row reads Course', courseLayer.rootName === 'Course', courseLayer.rootName);
    check('the name field carries the name, not a placeholder',
          courseLayer.nameField === 'Glacier Sound', courseLayer.nameField);
    check('the venue is shown as its ID', courseLayer.venueField === 'arctic', courseLayer.venueField);
    check('the right panel is empty with nothing selected — header and all',
          courseLayer.headHidden === true);
    check('...with no number beside it', courseLayer.rootCount === '', `"${courseLayer.rootCount}"`);
    check('the route layer is called Route', courseLayer.routeRow.includes('Route'),
          courseLayer.routeRow.join(','));
    check('the object column is blank, not apologetic',
          courseLayer.objTitle === '' && courseLayer.objBody === '',
          `title "${courseLayer.objTitle}" body "${courseLayer.objBody.slice(0, 40)}"`);
    check('only Measure is live on the Course layer',
          courseLayer.tools.filter(t => t.endsWith(':on')).join(',') === 'measure:on',
          courseLayer.tools.join(' '));

    // The course name is editable, and everything that displays a name reads it.
    const named = await page.evaluate(() => {
        const A = window.EditorApp;
        const el = document.getElementById('course-name');
        el.value = 'The Sound'; el.dispatchEvent(new Event('change'));
        return { stored: A._state().doc.name,
                 header: document.getElementById('venue-label').textContent,
                 field: document.getElementById('course-name').value,
                 menu: [...document.querySelectorAll('#venue-menu .ed-opt.on span')].map(e => e.textContent)[0] };
    });
    check('a typed course name is stored', named.stored === 'The Sound', named.stored);
    check('...and read by the header, the field and the venue menu',
          named.header === 'The Sound' && named.field === 'The Sound' && named.menu === 'The Sound',
          `${named.header} / ${named.field} / ${named.menu}`);
    await page.evaluate(() => {
        const el = document.getElementById('course-name');
        el.value = ''; el.dispatchEvent(new Event('change'));
    });

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
        // Land-refusal is a SCATTER guarantee (addIce retries a position and places fewer
        // rather than badly). A single placement goes exactly where you dragged, unchecked —
        // so asserting it over every floe in the document claimed more than the code
        // promises, and flaked whenever a randomly generated outline pushed a lone floe's
        // centroid over a coastline.
        const onLand = A._state().doc.ice.slice(mid).every(f => {
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
    check('...and a scattered floe is never dropped on land', ice2.allInWater === true);
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
        // Whatever the previous test left armed, these are SELECT-tool gestures. The ruler
        // now takes precedence on every layer, so it has to be put down first — the same as
        // on the Land layer, where a shape has never been draggable with the ruler up.
        A._pickTool('select');
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
        document.querySelector('#layer-list [data-layer="current"]').click();
        [...document.querySelectorAll('#objs-actions .btn')]
            .find(b => /whole course/i.test(b.textContent)).click();
        const reg = () => A._state().doc.current.regions[0];
        const p0 = reg().poly[0].slice();
        // A region corner must be GRABBABLE in its own mode — this was gated on the WIND
        // selection, so current corners could never be dragged. VERTICES belong to the
        // Direct arrow now, so that is the tool this asks about.
        A._pickTool('direct');
        const h = A._hit(p0[0], p0[1]);
        A._selectVerts([{ kind: 'current', r: 0, i: 0 }]);
        A._moveSel(150, -90);
        const moved = Math.abs(reg().poly[0][0] - (p0[0] + 150)) < 1e-9;
        A._selectVerts([]);
        return { wvert: h.wvert, moved };
    });
    check('a current region corner is grabbable on the Current layer', cur2.wvert === 0, `wvert ${cur2.wvert}`);
    check('...and moves when dragged', cur2.moved === true);

    const bear = await page.evaluate(() => {
        const A = window.EditorApp;
        document.querySelector('#layer-list [data-layer="wind"]').click();
        const r = () => A._state().doc.wind.regions[0];
        // The wind is named by where it comes FROM, as a compass bearing: 0 north, up.
        // Its fields live in the INSPECTOR now, so the region has to be selected FIRST —
        // the input does not exist until the panel renders for it.
        document.querySelector('#obj-list .ob').click();
        const el = document.querySelector('#insp-obj [data-num="wr.dir"]');
        el.value = '215'; el.dispatchEvent(new Event('change'));
        const stored = r().direction;
        const shown = document.querySelector('#insp-obj [data-num="wr.dir"]').value;
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
        // B, the real path — there is no boat checkbox: the ruler has no panel.
        const bkey = () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'b', bubbles: true }));
        const offLayer = (document.querySelector('#layer-list [data-layer="land"]').click(),
                          window.EditorApp._pickTool('select'), bkey(), window.EditorApp._boat());
        window.EditorApp._pickTool('measure');
        bkey();
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
        const shown = !!A._boat();
        bkey(); const toggledOff = A._boat() === null; bkey();   // B is a toggle
        const c = { x: r.width / 2, y: r.height / 2 };
        at(c.x, c.y);                             // plain drag: move
        const b1 = Object.assign({}, A._boat());
        at(c.x + 40, c.y + 20, { metaKey: true }); // Cmd+drag: rotate
        const b2 = Object.assign({}, A._boat());
        return { b0, b1, b2, shown, toggledOff, offLayer,
                 panel: !!document.querySelector('.mode-panel[data-layer="measure"]'),
                 boatBox: !!document.getElementById('show-boat'),
                 clearBtn: !!document.getElementById('btn-clear-measure2') };
    });
    check('B shows a boat while the ruler is up', boat.shown === true && boat.b0.x !== undefined);
    check('...and B again puts it away', boat.toggledOff === true);
    check('...but B does nothing with the ruler down', boat.offLayer === null, `${boat.offLayer}`);
    // The ruler earns no panel: Esc clears, B shows a boat, and the hint bar says both. A
    // two-control panel across the window is two controls' worth of reaching.
    check('the ruler has no panel, no boat checkbox, no Clear button',
          !boat.panel && !boat.boatBox && !boat.clearBtn,
          `panel ${boat.panel} · checkbox ${boat.boatBox} · clear ${boat.clearBtn}`);
    check('a plain drag MOVES it, like a shape',
          Math.abs(boat.b1.x - boat.b0.x) > 20 && Math.abs(boat.b1.heading - boat.b0.heading) < 1e-9,
          `moved ${Math.round(boat.b1.x - boat.b0.x)}u, heading ${boat.b1.heading.toFixed(3)}`);
    check('Cmd/Ctrl+drag ROTATES it, like a shape',
          Math.abs(boat.b2.heading - boat.b1.heading) > 0.05
          && Math.abs(boat.b2.x - boat.b1.x) < 1e-9,
          `heading ${boat.b1.heading.toFixed(3)} -> ${boat.b2.heading.toFixed(3)}`);
    await page.evaluate(() => { const A = window.EditorApp; while (A._state().histIdx > 0) A._undo(); });

    // ── The ruler is a tool, not a place ────────────────────────────────────
    const ruler = await page.evaluate(() => {
        const A = window.EditorApp;
        document.querySelector('#layer-list [data-layer="land"]').click();
        const before = { layer: document.querySelector('#layer-list .ly.on .ly-n').textContent,
                         rows: document.querySelectorAll('#obj-list .ob').length,
                         panels: [...document.querySelectorAll('.mode-panel')].filter(p => !p.hidden)
                             .map(p => p.dataset.layer) };
        A._pickTool('measure');
        const during = { layer: document.querySelector('#layer-list .ly.on .ly-n').textContent,
                         rows: document.querySelectorAll('#obj-list .ob').length,
                         panels: [...document.querySelectorAll('.mode-panel')].filter(p => !p.hidden)
                             .map(p => p.dataset.layer),
                         hint: document.getElementById('hint-mods').textContent };
        // Esc, one step at a time, most transient thing first: the measurement, then the
        // ruler itself. Two presses, because an earlier test left a measurement on screen.
        const esc = () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        esc();
        const stillRuler = [...document.querySelectorAll('#tool-strip [data-tool]')]
            .filter(e => e.classList.contains('on')).map(e => e.dataset.tool);
        const measureGone = A._measure() === null;
        esc();
        const after = [...document.querySelectorAll('#tool-strip [data-tool]')]
            .filter(e => e.classList.contains('on')).map(e => e.dataset.tool);
        return { before, during, stillRuler, measureGone, after };
    });
    check('picking the ruler keeps the layer you were editing',
          ruler.during.layer === ruler.before.layer && ruler.during.rows === ruler.before.rows,
          `${ruler.before.layer}/${ruler.before.rows} -> ${ruler.during.layer}/${ruler.during.rows}`);
    // The ruler brings NO panel of its own, and takes none away: whatever the layer was
    // showing is what it goes on showing. (Land shows nothing — its tools are all on the
    // strip — so this asserts the invariant rather than a particular panel.)
    check("...and leaves that layer's settings exactly as they were, adding none of its own",
          ruler.during.panels.join(',') === ruler.before.panels.join(','),
          `${ruler.before.panels.join(',') || '(none)'} -> ${ruler.during.panels.join(',') || '(none)'}`);
    check('the hint bar names both ruler keys, B and Esc',
          /B shows a boat/.test(ruler.during.hint) && /esc/i.test(ruler.during.hint),
          ruler.during.hint);
    check('Esc cancels the measurement first, keeping the ruler',
          ruler.measureGone === true && ruler.stillRuler.join(',') === 'measure',
          `${ruler.stillRuler.join(',')} · measure cleared ${ruler.measureGone}`);
    check('...and a second Esc puts the ruler down', ruler.after.join(',') === 'select',
          ruler.after.join(','));

    // ── Object-level commands act on the WHOLE selection ────────────────────
    // They were per-shape buttons in the inspector, which can only ever offer them for the
    // one object it shows. Now they are on the map, at the level they act on.
    console.log('\nselection commands');
    const cmd = await page.evaluate(() => {
        const A = window.EditorApp;
        while (A._state().histIdx > 0) A._undo();
        document.querySelector('#layer-list [data-layer="land"]').click();
        A._pickTool('select');
        const bar = () => document.getElementById('sel-acts');
        const label = () => document.getElementById('sel-acts-n').textContent;
        A._setOsel([]);
        const idle = bar().hidden;
        const ids = A._state().doc.land.map(l => l.id);
        A._setOsel([{ kind: 'land', id: ids[1] }]);
        const one = { hidden: bar().hidden, label: label() };
        A._setOsel([{ kind: 'land', id: ids[1] }, { kind: 'land', id: ids[2] },
                    { kind: 'land', id: ids[3] }]);
        const many = label();

        // Duplicate: N in, N out, and the COPIES are what stays selected.
        const dupBefore = A._state().doc.land.length;
        document.getElementById('btn-sel-dup').click();
        const dup = { before: dupBefore, after: A._state().doc.land.length,
                      selected: A._osel().length,
                      selectionIsTheCopies: A._osel().every(o => /-2$/.test(o.id)) };

        // Resample: point counts preserved, points moved, on every selected object.
        const snap = () => A._osel().map(o => A._shapeById(o.id).outer.map(q => q.slice()));
        const rBefore = snap();
        document.getElementById('btn-sel-resample').click();
        const rAfter = snap();
        const resample = {
            objs: rBefore.length,
            counts: rBefore.every((r, i) => r.length === rAfter[i].length),
            moved: rBefore.every((r, i) => r.some((q, k) =>
                Math.hypot(q[0] - rAfter[i][k][0], q[1] - rAfter[i][k][1]) > 1e-9))
        };

        // Delete: takes all of them, and the bar goes with the selection.
        const delBefore = A._state().doc.land.length;
        document.getElementById('btn-sel-del').click();
        const del = { removed: delBefore - A._state().doc.land.length,
                      barHidden: bar().hidden, osel: A._osel().length };

        // Cmd/Ctrl+D is the same command.
        A._setOsel([{ kind: 'land', id: A._state().doc.land[0].id }]);
        const keyBefore = A._state().doc.land.length;
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'd', metaKey: true, bubbles: true }));
        const key = A._state().doc.land.length - keyBefore;

        // The inspector must NOT still carry them — two places to press is two to keep true.
        A._setOsel([{ kind: 'land', id: A._state().doc.land[1].id }]);
        const inspector = [...document.querySelectorAll('#insp-obj button')]
            .map(b => b.textContent.trim());

        // The arena is the one polygon there is exactly one of.
        A._setMode('boundary');
        A._setOsel([{ kind: 'arena' }]);
        const arena = { dup: document.getElementById('btn-sel-dup').disabled,
                        del: document.getElementById('btn-sel-del').disabled,
                        resample: document.getElementById('btn-sel-resample').disabled };
        return { idle, one, many, dup, resample, del, key, inspector, arena };
    });
    check('the action bar stays away with nothing selected', cmd.idle === true);
    check('...and names what it will act on', cmd.one.hidden === false && cmd.one.label === '1 shape',
          cmd.one.label);
    check('...in the plural when there are several', cmd.many === '3 shapes', cmd.many);
    check('Duplicate copies every selected shape',
          cmd.dup.after - cmd.dup.before === 3, `${cmd.dup.before} -> ${cmd.dup.after}`);
    check('...and leaves the COPIES selected',
          cmd.dup.selected === 3 && cmd.dup.selectionIsTheCopies === true);
    check('Resample respaces every selected shape', cmd.resample.objs === 3 && cmd.resample.moved === true);
    check('...preserving each point count', cmd.resample.counts === true);
    check('Delete removes every selected shape', cmd.del.removed === 3, `${cmd.del.removed}`);
    check('...and the bar goes with the selection',
          cmd.del.barHidden === true && cmd.del.osel === 0);
    check('Cmd/Ctrl+D duplicates too', cmd.key === 1, `${cmd.key} added`);
    check('the inspector no longer offers the selection commands',
          !/Duplicate|Resample|Delete/.test(cmd.inspector.join(' ')), cmd.inspector.join(','));
    check('the arena can be respaced but not copied or deleted',
          cmd.arena.dup === true && cmd.arena.del === true && cmd.arena.resample === false);
    await page.evaluate(() => { const A = window.EditorApp; while (A._state().histIdx > 0) A._undo(); });

    // ── Booleans, and the hole they can produce ─────────────────────────────
    // Areas are checked against arithmetic, not against "it looked right": two 100-squares
    // overlapping by 50 union to 15000 and intersect to 5000, and nothing else does.
    console.log('\nbooleans');
    const bool = await page.evaluate(() => {
        const A = window.EditorApp, V = window.VenueDoc, r = {};
        while (A._state().histIdx > 0) A._undo();
        A._setMode('shape'); A._pickTool('select');
        const doc = A._state().doc;
        const area = (ring) => Math.abs(V.ringArea(ring));
        const mk = (id, x, y, s) => doc.land.push({ id, style: 'granite', cls: 'granite',
            soft: false, outer: [[x, y], [x + s, y], [x + s, y + s], [x, y + s]],
            holes: [], c: [0, 0], r: 0 });
        const reset = () => { doc.land = doc.land.filter(l => !/^t-/.test(l.id)); };
        const two = (a, b) => A._setOsel([{ kind: 'land', id: a }, { kind: 'land', id: b }]);

        reset(); mk('t-a', 0, 0, 100); mk('t-b', 50, 0, 100); two('t-a', 't-b');
        const u = A._boolean('union');
        r.union = { pieces: u.pieces, area: Math.round(area(A._shapeById(A._osel()[0].id).outer)),
                    left: doc.land.filter(l => /^t-/.test(l.id)).length };

        reset(); mk('t-a', 0, 0, 100); mk('t-b', 50, 0, 100); two('t-a', 't-b');
        const i = A._boolean('intersect');
        r.intersect = { pieces: i.pieces, area: Math.round(area(A._shapeById(A._osel()[0].id).outer)) };

        // Subtract a central square: one shape with one hole, and the RUNTIME must read the
        // lagoon as water off the keyholed ring compile hands it.
        reset(); mk('t-a', 0, 0, 300); mk('t-b', 100, 100, 100); two('t-a', 't-b');
        const d = A._boolean('subtract');
        const holed = A._shapeById(A._osel()[0].id);
        const isl = V.compile(A._state().doc).islands.find(x => x.id === holed.id);
        const ring = isl.vertices.map(v => [v.x, v.y]);
        r.hole = { pieces: d.pieces, holes: (holed.holes || []).length,
                   outerArea: Math.round(area(holed.outer)),
                   holeArea: Math.round(area(holed.holes[0])),
                   lagoonIsLand: V.pointInRing(150, 150, ring),
                   landIsLand: V.pointInRing(50, 150, ring),
                   naiveWouldSayLand: V.pointInRing(150, 150, holed.outer) };

        // Subtract a bar right through: the shape splits, and BOTH halves survive.
        reset(); mk('t-a', 0, 0, 300);
        doc.land.push({ id: 't-bar', style: 'granite', cls: 'granite', soft: false,
            outer: [[120, -50], [180, -50], [180, 350], [120, 350]], holes: [], c: [0, 0], r: 0 });
        two('t-a', 't-bar');
        const sp = A._boolean('subtract');
        r.split = { pieces: sp.pieces, selected: A._osel().length };

        // Disjoint intersect has an empty answer. Deleting both is NOT that answer.
        reset(); mk('t-a', 0, 0, 100); mk('t-b', 500, 500, 100); two('t-a', 't-b');
        const before = doc.land.filter(l => /^t-/.test(l.id)).length;
        const bad = A._boolean('intersect');
        r.disjoint = { refused: !!(bad && bad.error),
                       kept: doc.land.filter(l => /^t-/.test(l.id)).length === before };

        reset(); mk('t-a', 0, 0, 100);
        A._setOsel([{ kind: 'land', id: 't-a' }]);
        r.whyOne = A._booleanWhy();
        A._setMode('venue'); A._setOsel([{ kind: 'ice', i: 0 }, { kind: 'land', id: 't-a' }]);
        r.whyMixed = A._booleanWhy();
        A._setMode('shape'); reset(); A._setOsel([]);
        return r;
    });
    check('Union merges into one shape of the right area',
          bool.union.pieces === 1 && bool.union.area === 15000 && bool.union.left === 1,
          `${bool.union.pieces} piece(s), area ${bool.union.area}, ${bool.union.left} left`);
    check('Intersect keeps only the overlap',
          bool.intersect.pieces === 1 && bool.intersect.area === 5000, `area ${bool.intersect.area}`);
    check('Subtract can carve a HOLE, not a second shape',
          bool.hole.pieces === 1 && bool.hole.holes === 1
          && bool.hole.outerArea === 90000 && bool.hole.holeArea === 10000,
          `${bool.hole.pieces}/${bool.hole.holes}, ${bool.hole.outerArea}/${bool.hole.holeArea}`);
    check('...and the compiled ring reads that lagoon as WATER',
          bool.hole.lagoonIsLand === false && bool.hole.landIsLand === true);
    check('...which the outer ring alone would get wrong', bool.hole.naiveWouldSayLand === true);
    check('Subtract can split one shape into two', bool.split.pieces === 2 && bool.split.selected === 2,
          `${bool.split.pieces} pieces`);
    check('Intersecting shapes that do not overlap refuses and keeps them',
          bool.disjoint.refused === true && bool.disjoint.kept === true);
    check('a boolean needs two objects', /two or more/.test(bool.whyOne || ''), bool.whyOne);
    check('...of the same kind', /same kind/.test(bool.whyMixed || ''), bool.whyMixed);
    await page.evaluate(() => { const A = window.EditorApp; while (A._state().histIdx > 0) A._undo(); });

    // ── Land-layer feedback pass ────────────────────────────────────────────
    console.log('\ndrawing, panning, and tool-scoped commands');
    const fb = await page.evaluate(() => {
        const A = window.EditorApp, V = window.VenueDoc, r = {};
        while (A._state().histIdx > 0) A._undo();
        document.querySelector('#layer-list [data-layer="land"]').click();
        const bar = () => document.getElementById('sel-acts').hidden;

        // Object commands belong to the object arrow. Under Direct, Delete means the
        // selected VERTICES, so offering an object Delete beside it is a trap.
        A._pickTool('select');
        A._setOsel([{ kind: 'land', id: A._state().doc.land[1].id }]);
        r.barUnderSelect = bar();
        A._pickTool('direct');
        r.barUnderDirect = bar();
        A._pickTool('select');

        // Difference is the SYMMETRIC one: two 100-squares overlapping by 50 leave two
        // 50x100 slivers. (Subtract, which keeps only the base, is tested above.)
        const doc = A._state().doc;
        doc.land = doc.land.filter(l => !/^t-/.test(l.id));
        const mk = (id, x, y, s) => doc.land.push({ id, style: 'granite', cls: 'granite',
            soft: false, outer: [[x, y], [x + s, y], [x + s, y + s], [x, y + s]],
            holes: [], c: [0, 0], r: 0 });
        mk('t-a', 0, 0, 100); mk('t-b', 50, 0, 100);
        A._setOsel([{ kind: 'land', id: 't-a' }, { kind: 'land', id: 't-b' }]);
        const sd = A._boolean('symdiff');
        r.symdiff = { pieces: sd.pieces,
                      areas: A._osel().map(o => Math.round(Math.abs(V.ringArea(A._shapeById(o.id).outer)))) };
        doc.land = doc.land.filter(l => !/^t-/.test(l.id));
        A._setOsel([]);

        // The RIGHT button pans — a laptop has no middle one — and the OS menu is suppressed
        // over the canvas so the drag is usable.
        const cv = document.getElementById('schematic');
        const rect = cv.getBoundingClientRect();
        const menu = new MouseEvent('contextmenu', { clientX: rect.left + 100,
            clientY: rect.top + 100, bubbles: true, cancelable: true });
        cv.dispatchEvent(menu);
        r.contextMenuSuppressed = menu.defaultPrevented;
        const v0 = A._view();
        cv.dispatchEvent(new MouseEvent('mousedown', { clientX: rect.left + 200,
            clientY: rect.top + 200, button: 2, bubbles: true }));
        window.dispatchEvent(new MouseEvent('mousemove', { clientX: rect.left + 320,
            clientY: rect.top + 270, bubbles: true }));
        window.dispatchEvent(new MouseEvent('mouseup', { button: 2, bubbles: true }));
        const v1 = A._view();
        r.rightDragPans = (v0.x !== v1.x || v0.y !== v1.y) && v0.scale === v1.scale;
        r.rightDragIsNotAnEdit = A._state().dirty === false;

        // The shape being DRAWN has to be visible while you draw it, and clicking the first
        // point closes it — which is what the preview lights that point up to promise.
        A._pickTool('draw');
        const click = (x, y) => cv.dispatchEvent(new MouseEvent('mousedown',
            { clientX: rect.left + x, clientY: rect.top + y, button: 0, bubbles: true }));
        const move = (x, y) => window.dispatchEvent(new MouseEvent('mousemove',
            { clientX: rect.left + x, clientY: rect.top + y, bubbles: true }));
        const px = () => cv.toDataURL().length;
        const blank = px();
        click(300, 300); move(420, 320);
        r.previewShows = px() !== blank;
        const held = px();
        move(430, 240);
        r.bandFollowsCursor = px() !== held;      // no click in between
        click(420, 320); click(400, 430);
        const before = A._state().doc.land.length;
        move(302, 301); click(302, 301);          // back onto the first point
        r.firstPointCloses = A._state().doc.land.length === before + 1;
        return r;
    });
    check('the object commands hide under the vertex arrow',
          fb.barUnderSelect === false && fb.barUnderDirect === true);
    check('Difference keeps what only ONE shape covers',
          fb.symdiff.pieces === 2 && fb.symdiff.areas.every(a => a === 5000),
          `${fb.symdiff.pieces} pieces, areas ${fb.symdiff.areas.join('/')}`);
    check('right-drag pans without zooming', fb.rightDragPans === true);
    check('...and the OS context menu stays out of the way', fb.contextMenuSuppressed === true);
    check('...and panning is not an edit', fb.rightDragIsNotAnEdit === true);
    check('the shape being drawn is visible while you draw it', fb.previewShows === true);
    check('...and its rubber band follows the cursor, not the last click',
          fb.bandFollowsCursor === true);
    check('...and clicking the first point closes it', fb.firstPointCloses === true);
    await page.evaluate(() => { const A = window.EditorApp; while (A._state().histIdx > 0) A._undo(); });

    // ── The arena is a polygon like any other ───────────────────────────────
    console.log('\narena layer');
    const ar = await page.evaluate(() => {
        const A = window.EditorApp, r = {};
        while (A._state().histIdx > 0) A._undo();
        document.querySelector('#layer-list [data-layer="arena"]').click();
        A.fitView(); A._pickTool('select');
        // Re-query each time: layerRefresh rebuilds the list, so a held reference goes stale.
        const row = () => document.querySelector('#layer-list [data-layer="arena"] .ly-c').textContent;
        r.layerRow = row();
        // The object column is gone: there is one arena and there can never be a second.
        r.objHeaderHidden = document.getElementById('objs-title').closest('.ed-sect').hidden;
        r.objListEmpty = document.getElementById('obj-list').innerHTML.trim() === '';
        r.noBackToCircle = !document.getElementById('btn-bcircle');

        const bpBox = () => {
            const bp = A._state().doc.world.boundary.poly;
            const xs = bp.map(q => q[0]), ys = bp.map(q => q[1]);
            return { n: bp.length, w: Math.round(Math.max(...xs) - Math.min(...xs)),
                     cx: Math.round((Math.max(...xs) + Math.min(...xs)) / 2),
                     cy: Math.round((Math.max(...ys) + Math.min(...ys)) / 2) };
        };
        // The object arrow picks it up and transforms it, exactly like a land shape.
        A._setOsel([{ kind: 'arena' }]);
        r.inspector = document.getElementById('in-kicker').textContent;
        r.headShown = !document.querySelector('.ed-right .in-head').hidden;
        r.barLabel = document.getElementById('sel-acts-n').textContent;
        r.cannotDuplicate = document.getElementById('btn-sel-dup').disabled;
        r.cannotDelete = document.getElementById('btn-sel-del').disabled;

        const b0 = bpBox();
        A._setOsel([{ kind: 'arena' }]);
        const el = document.querySelector('#insp-obj [data-num="arena.w"]');
        r.hasTransformFields = !!el;
        el.value = '1000'; el.dispatchEvent(new Event('change'));
        const b1 = bpBox();
        r.widthDriven = b1.w === 5000 && b1.n === b0.n;      // 1000 m at 5 units/m
        r.areaRowFollows = row() !== r.layerRow;
        return r;
    });
    // Arena CORNERS behave like any other vertices: click selects, marquee selects, Delete
    // removes — and Delete stops at the floor instead of taking the polygon with it.
    const av = await page.evaluate(() => {
        const A = window.EditorApp, r = {};
        while (A._state().histIdx > 0) A._undo();
        document.querySelector('#layer-list [data-layer="arena"]').click();
        A.fitView(); A._pickTool('direct'); A._selectVerts([]);
        const cv = document.getElementById('schematic');
        const rect = cv.getBoundingClientRect();
        const npts = () => A._state().doc.world.boundary.poly.length;
        const at = (i) => {
            const bp = A._state().doc.world.boundary.poly, v = A._view();
            return { x: (bp[i][0] - v.x) * v.scale + cv.clientWidth / 2,
                     y: (bp[i][1] - v.y) * v.scale + cv.clientHeight / 2 };
        };
        const down = (pt, mods) => cv.dispatchEvent(new MouseEvent('mousedown', Object.assign(
            { clientX: rect.left + pt.x, clientY: rect.top + pt.y, button: 0, bubbles: true }, mods)));
        const move = (pt) => window.dispatchEvent(new MouseEvent('mousemove',
            { clientX: rect.left + pt.x, clientY: rect.top + pt.y, bubbles: true }));
        const up = () => window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));

        down(at(0)); up();
        r.clickSelects = A._vsel().length;
        down(at(2), { shiftKey: true }); up();
        r.shiftAdds = A._vsel().length;

        A._selectVerts([]);
        down({ x: 5, y: 5 }); move({ x: cv.clientWidth - 5, y: cv.clientHeight - 5 }); up();
        r.marqueeSelects = A._vsel().length;

        // 4 corners with all selected: the 3-point floor lets exactly one go.
        const b1 = npts();
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }));
        r.deletedToFloor = `${b1}->${npts()}`;
        // At the floor it must refuse — and must NOT fall through to deleting the arena.
        A._selectVerts([{ kind: 'arena', i: 0 }]);
        const b2 = npts();
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }));
        r.floorHolds = b2 === 3 && npts() === 3;

        // The case that really bit: a LAND triangle, where the object branch would have
        // removed the whole shape once the vertex delete declined.
        A._setMode('shape'); A._pickTool('direct');
        const doc = A._state().doc;
        doc.land = doc.land.filter(l => l.id !== 't-tri');
        doc.land.push({ id: 't-tri', style: 'granite', cls: 'granite', soft: false,
            outer: [[0, 0], [200, 0], [100, 180]], holes: [], c: [0, 0], r: 0 });
        A._selectShape('t-tri');
        A._selectVerts([{ kind: 'land', id: 't-tri', ring: -1, i: 0 }]);
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }));
        r.triangleSurvives = !!A._shapeById('t-tri') && A._shapeById('t-tri').outer.length === 3;
        doc.land = doc.land.filter(l => l.id !== 't-tri');
        A._selectVerts([]); A._setOsel([]);
        return r;
    });
    check('an arena corner selects on click', av.clickSelects === 1, `${av.clickSelects}`);
    check('...and Shift adds another', av.shiftAdds === 2, `${av.shiftAdds}`);
    check('...and a marquee takes them all', av.marqueeSelects === 4, `${av.marqueeSelects}`);
    check('Delete removes arena corners down to the 3-point floor',
          av.deletedToFloor === '4->3', av.deletedToFloor);
    check('...and at the floor it refuses rather than deleting the arena', av.floorHolds === true);
    check('...and a 3-point LAND shape is not destroyed by a vertex Delete',
          av.triangleSurvives === true);
    // The two states have to be VISIBLE, not merely held. Read the pixels: a selected corner
    // must differ from an idle one, and the arena outline must differ when the object is
    // selected — otherwise "it is selected" is a fact only the debugger knows.
    const paint = await page.evaluate(() => {
        const A = window.EditorApp;
        document.querySelector('#layer-list [data-layer="arena"]').click();
        A.fitView();
        const cv = document.getElementById('schematic'), ctx = cv.getContext('2d');
        const dpr = cv.width / cv.clientWidth;
        const px = (pt) => {
            const d = ctx.getImageData(Math.round(pt.x * dpr), Math.round(pt.y * dpr), 1, 1).data;
            return `#${[d[0], d[1], d[2]].map(v => v.toString(16).padStart(2, '0')).join('')}`;
        };
        const at = (i) => { const bp = A._state().doc.world.boundary.poly, v = A._view();
            return { x: (bp[i][0] - v.x) * v.scale + cv.clientWidth / 2,
                     y: (bp[i][1] - v.y) * v.scale + cv.clientHeight / 2 }; };
        const edge = () => { const bp = A._state().doc.world.boundary.poly, v = A._view();
            return { x: ((bp[0][0] + bp[1][0]) / 2 - v.x) * v.scale + cv.clientWidth / 2,
                     y: (bp[0][1] - v.y) * v.scale + cv.clientHeight / 2 }; };
        A._pickTool('direct'); A._selectVerts([]);
        const vIdle = px(at(0));
        A._selectVerts([{ kind: 'arena', i: 0 }]);
        const vSel = px(at(0)), vNeighbour = px(at(1));
        A._selectVerts([]);
        A._pickTool('select'); A._setOsel([]);
        const oIdle = px(edge());
        A._setOsel([{ kind: 'arena' }]);
        const oSel = px(edge());
        A._setOsel([]);
        return { vIdle, vSel, vNeighbour, oIdle, oSel };
    });
    check('a selected arena corner LOOKS selected',
          paint.vSel !== paint.vIdle, `${paint.vIdle} -> ${paint.vSel}`);
    check('...and its neighbours do not', paint.vNeighbour === paint.vIdle);
    check('a selected arena LOOKS selected as a polygon',
          paint.oSel !== paint.oIdle, `${paint.oIdle} -> ${paint.oSel}`);
    await page.evaluate(() => { const A = window.EditorApp; while (A._state().histIdx > 0) A._undo(); });

    check('the Arena layer row reports enclosed water in km², not corner count',
          /^[\d.]+ km²$/.test(ar.layerRow), ar.layerRow);
    check('...and the object column is gone entirely',
          ar.objHeaderHidden === true && ar.objListEmpty === true);
    check('"Back to circle" is gone', ar.noBackToCircle === true);
    check('the object arrow selects the arena', ar.inspector === 'Arena' && ar.headShown === true);
    check('...but it can never be duplicated or deleted',
          ar.cannotDuplicate === true && ar.cannotDelete === true, ar.barLabel);
    check('...and it takes the same numeric transform as a land shape',
          ar.hasTransformFields === true && ar.widthDriven === true);
    check('...with the area following the edit', ar.areaRowFollows === true);
    await page.evaluate(() => { const A = window.EditorApp; while (A._state().histIdx > 0) A._undo(); });

    // ── Delete on a vertex removes THAT VERTEX, on every layer that has them ─
    // `deleteSelectedVertices` knew land, arena and wind but not ice or current, so Delete
    // on a floe's corner did nothing and then blamed the 3-point floor, which was not the
    // reason. Land and Venue are compared directly because that is the pairing reported.
    console.log('\nvertex delete parity');
    const vdel = await page.evaluate(() => {
        const A = window.EditorApp;
        const probe = (row, mkRef, ringOf, objCount) => {
            while (A._state().histIdx > 0) A._undo();
            document.querySelector(`#layer-list [data-layer="${row}"]`).click();
            A.fitView(); A._pickTool('direct');
            const o = {};
            const n0 = ringOf().length, objs0 = objCount();
            A._selectVerts([mkRef(1)]);
            window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }));
            o.removedOne = n0 - ringOf().length;
            o.objectSurvived = objCount() === objs0;
            const n1 = ringOf().length;
            A._selectVerts([mkRef(1), mkRef(2)]);
            window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }));
            o.removedTwo = n1 - ringOf().length;
            A._undo();
            o.oneUndoRestores = ringOf().length === n1;
            while (A._state().histIdx > 0) A._undo();
            return o;
        };
        // isle-3, not `coast`: removing points from an 84-point concave coastline can make
        // it self-intersect, and the validator rightly errors — which the session-wide
        // page-error check then reports. A small simple blob tests the same behaviour
        // without authoring an invalid document on the way through.
        const land = probe('land', (i) => ({ kind: 'land', id: 'isle-3', ring: -1, i }),
            () => A._shapeById('isle-3').outer, () => A._state().doc.land.length);
        const venue = probe('venue', (i) => ({ kind: 'ice', id: A._state().doc.ice[0].id, r: 0, i }),
            () => A._state().doc.ice[0].outer, () => A._state().doc.ice.length);
        // The arena is a 4-gon, so it reaches the 3-point floor after ONE removal — a
        // different number for the right reason, which is why it is asserted separately.
        while (A._state().histIdx > 0) A._undo();
        document.querySelector('#layer-list [data-layer="arena"]').click();
        A.fitView(); A._pickTool('direct');
        const bp = () => A._state().doc.world.boundary.poly;
        const arena = [bp().length];
        for (const _ of [0, 1]) {
            A._selectVerts([{ kind: 'arena', i: 1 }]);
            window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }));
            arena.push(bp().length);
        }
        while (A._state().histIdx > 0) A._undo();
        return { land, venue, arena,
                 differing: Object.keys(land).filter(k => land[k] !== venue[k]) };
    });
    check('Delete on a floe corner removes that corner, exactly as on land',
          vdel.differing.length === 0, `differ: ${vdel.differing.join(', ')}`);
    check('...one selected removes one, two remove two',
          vdel.venue.removedOne === 1 && vdel.venue.removedTwo === 2,
          `${vdel.venue.removedOne} / ${vdel.venue.removedTwo}`);
    check('...the floe itself is never taken with them', vdel.venue.objectSurvived === true);
    check('...and the pair comes back in one undo', vdel.venue.oneUndoRestores === true);
    check('a 4-gon arena stops at the 3-point floor', vdel.arena.join('->') === '4->3->3',
          vdel.arena.join('->'));
    await page.evaluate(() => { const A = window.EditorApp; while (A._state().histIdx > 0) A._undo(); });

    // ── Wind regions read as arrows, and right-click never opens a menu ─────
    console.log('\nwind arrows and context menus');
    const wa = await page.evaluate(() => {
        const A = window.EditorApp, r = {};
        // No OS menu ANYWHERE — right-drag pans, so the menu would fight the gesture
        // wherever the pointer happened to be, not only over the canvas.
        r.menus = {};
        for (const [name, el] of [['canvas', document.getElementById('schematic')],
                                  ['left', document.querySelector('.ed-left')],
                                  ['header', document.querySelector('.ed-head')],
                                  ['body', document.body]]) {
            const ev = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
            el.dispatchEvent(ev);
            r.menus[name] = ev.defaultPrevented;
        }
        while (A._state().histIdx > 0) A._undo();
        document.querySelector('#layer-list [data-layer="wind"]').click();
        A.fitView();
        const cv = document.getElementById('schematic'), ctx = cv.getContext('2d');
        const dpr = cv.width / cv.clientWidth;
        // Green ink in a band, used to find which END of an arrow carries the head.
        const ink = (cx, cy, hw, hh) => {
            const d = ctx.getImageData(Math.round((cx - hw) * dpr), Math.round((cy - hh) * dpr),
                                       Math.round(hw * 2 * dpr), Math.round(hh * 2 * dpr)).data;
            let n = 0;
            for (let i = 0; i < d.length; i += 4)
                if (d[i + 1] > d[i] + 25 && d[i + 1] > d[i + 2] + 10) n++;
            return n;
        };
        // An arrow is a VECTOR: it points where the air goes. A wind "from the north" blows
        // SOUTH, so at 0 the head is at the bottom. The bearing in the panel still names the
        // source — that is how a wind is named — but the picture shows the flow.
        const heads = {};
        for (const [deg, want] of [[0, 'down'], [90, 'left'], [180, 'up'], [270, 'right']]) {
            A._state().doc.wind.regions[0].direction = deg * Math.PI / 180;
            A._afterEdit(true, 'arrow probe');
            const cx = 54 * 8 + 27, cy = 54 * 6 + 27;
            const sides = { up: ink(cx, cy - 13, 9, 7), down: ink(cx, cy + 13, 9, 7),
                            left: ink(cx - 13, cy, 7, 9), right: ink(cx + 13, cy, 7, 9) };
            const best = Object.entries(sides).sort((a, b) => b[1] - a[1]);
            heads[deg] = { got: best[0][0], want, ratio: best[0][1] / Math.max(1, best[1][1]) };
        }
        r.heads = heads;
        while (A._state().histIdx > 0) A._undo();
        return r;
    });
    check('right-click opens no menu anywhere in the editor',
          Object.values(wa.menus).every(Boolean), JSON.stringify(wa.menus));
    // A wind is NAMED by where it comes from and DRAWN by where it goes — the field overlay
    // marks the same end, or the two would contradict each other whenever both are on.
    check('a wind region draws arrows pointing the way the wind BLOWS',
          Object.values(wa.heads).every(h => h.got === h.want),
          Object.entries(wa.heads).map(([d, h]) => `${d}:${h.got}`).join(' '));
    check('...with a head you can actually tell from the tail',
          Object.values(wa.heads).every(h => h.ratio > 1.4),
          Object.values(wa.heads).map(h => h.ratio.toFixed(2)).join(' '));
    // The computed-field overlay answers the same question for the whole map, blend
    // included, so the two must never be on together — two grids of arrows crossing each
    // other, disagreeing wherever regions overlap.
    const excl = await page.evaluate(() => {
        const A = window.EditorApp;
        const cv = document.getElementById('schematic'), ctx = cv.getContext('2d');
        const green = () => {
            const d = ctx.getImageData(0, 0, cv.width, cv.height).data;
            let n = 0;
            for (let i = 0; i < d.length; i += 4)
                if (d[i + 1] > d[i] + 30 && d[i + 1] > d[i + 2] + 20) n++;
            return n;
        };
        const setField = (on) => { const btn = document.getElementById('btn-field-wind');
            if (btn.classList.contains('on') !== on) btn.click(); };
        const o = {};
        // `current` is the control: region arrows are gated on the WIND layer, so they
        // cannot draw there whatever the toggle says.
        setField(false);
        A._setMode('wind'); A.fitView();    o.offWind = green();
        A._setMode('current'); A.fitView(); o.offOther = green();
        setField(true);
        A._setMode('wind'); A.fitView();    o.onWind = green();
        A._setMode('current'); A.fitView(); o.onOther = green();
        setField(false); A._setMode('wind');
        return o;
    });
    check('with the field OFF the wind layer draws its regions\' own arrows',
          excl.offWind > excl.offOther * 1.5, `${excl.offWind} vs ${excl.offOther}`);
    check('...and with the field ON they give way to it entirely',
          excl.onWind === excl.onOther, `${excl.onWind} vs ${excl.onOther}`);
    await page.evaluate(() => { const A = window.EditorApp; while (A._state().histIdx > 0) A._undo(); });

    // ── Undo behaves the same on every layer ────────────────────────────────
    // ⚠️ Measure histIdx, NOT history.length: pushHistory truncates the redo tail, so the
    // array's length is not monotonic and a probe reading it reports phantom differences.
    console.log('\nundo parity');
    const undoP = await page.evaluate(() => {
        const A = window.EditorApp;
        const probe = (layer) => {
            while (A._state().histIdx > 0) A._undo();
            document.querySelector(`#layer-list [data-layer="${layer}"]`).click();
            A.fitView(); A._pickTool('select');
            const cv = document.getElementById('schematic'), rect = cv.getBoundingClientRect();
            const refs = A._modeObjects();
            const count = () => layer === 'land' ? A._state().doc.land.length
                                                 : A._state().doc.ice.length;
            const ringOf = (ref) => ref.kind === 'land' ? A._shapeById(ref.id).outer
                                                       : A._state().doc.ice[ref.i].outer;
            const centre = (ref) => { const ring = ringOf(ref), v = A._view();
                const cx = ring.reduce((a, q) => a + q[0], 0) / ring.length;
                const cy = ring.reduce((a, q) => a + q[1], 0) / ring.length;
                return { x: (cx - v.x) * v.scale + cv.clientWidth / 2,
                         y: (cy - v.y) * v.scale + cv.clientHeight / 2 }; };
            const down = (x, y) => cv.dispatchEvent(new MouseEvent('mousedown',
                { clientX: rect.left + x, clientY: rect.top + y, button: 0, bubbles: true }));
            const move = (x, y) => window.dispatchEvent(new MouseEvent('mousemove',
                { clientX: rect.left + x, clientY: rect.top + y, bubbles: true }));
            const up = () => window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
            const i = () => A._state().histIdx;
            const o = {};

            const i0 = i(); A._setOsel([refs[1]]); o.selectCommits = i() - i0;

            A._setOsel(refs.slice(1, 4));
            const i1 = i(), c = centre(refs[1]);
            down(c.x, c.y); move(c.x + 60, c.y + 40); up();
            o.moveCommits = i() - i1;
            A._undo();

            A._setOsel(refs.slice(1, 4));
            const n0 = count(), i2 = i();
            window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }));
            o.deleteRemoved = n0 - count();
            o.deleteCommits = i() - i2;
            A._undo();
            o.deleteOneUndoRestores = count() === n0;

            A._setOsel(refs.slice(1, 3));
            const n1 = count(), i3 = i();
            document.getElementById('btn-sel-dup').click();
            o.dupAdded = count() - n1;
            o.dupCommits = i() - i3;
            A._undo();
            o.dupOneUndoRestores = count() === n1;

            while (A._state().histIdx > 0) A._undo();
            return o;
        };
        const land = probe('land'), venue = probe('venue');
        return { differing: Object.keys(land).filter(k => land[k] !== venue[k]), land, venue };
    });
    check('undo behaves identically on Land and Venue',
          undoP.differing.length === 0, `differ: ${undoP.differing.join(', ')}`);
    check('...selecting is never an edit',
          undoP.land.selectCommits === 0 && undoP.venue.selectCommits === 0);
    check('...and a bulk delete is ONE undo, however many it removed',
          undoP.venue.deleteRemoved === 3 && undoP.venue.deleteCommits === 1
          && undoP.venue.deleteOneUndoRestores === true,
          `removed ${undoP.venue.deleteRemoved} in ${undoP.venue.deleteCommits} commit(s)`);
    await page.evaluate(() => { const A = window.EditorApp; while (A._state().histIdx > 0) A._undo(); });

    // ── Floes behave exactly like land polygons ─────────────────────────────
    // Run ONE script against both layers and diff the answers. Asserting venue behaviour on
    // its own drifts: the question is not "does venue do X" but "does venue do what land
    // does", and only a shared probe can keep answering that as either side changes.
    console.log('\nfloe / land parity');
    const parity = await page.evaluate(() => {
        const A = window.EditorApp;
        const probe = (layer) => {
            while (A._state().histIdx > 0) A._undo();
            document.querySelector(`#layer-list [data-layer="${layer}"]`).click();
            A.fitView();
            const cv = document.getElementById('schematic'), ctx = cv.getContext('2d');
            const dpr = cv.width / cv.clientWidth;
            const rect = cv.getBoundingClientRect();
            const refs = A._modeObjects();
            const ringOf = (ref) => ref.kind === 'land' ? A._shapeById(ref.id).outer
                                                       : A._state().doc.ice[ref.i].outer;
            const refA = refs[1], refB = refs[2];
            const down = (x, y, mods) => cv.dispatchEvent(new MouseEvent('mousedown', Object.assign(
                { clientX: rect.left + x, clientY: rect.top + y, button: 0, bubbles: true }, mods)));
            const move = (x, y) => window.dispatchEvent(new MouseEvent('mousemove',
                { clientX: rect.left + x, clientY: rect.top + y, bubbles: true }));
            const up = () => window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
            const px = (pt) => { const d = ctx.getImageData(Math.round(pt.x * dpr),
                                                            Math.round(pt.y * dpr), 1, 1).data;
                return `#${[d[0], d[1], d[2]].map(n => n.toString(16).padStart(2, '0')).join('')}`; };
            const at = (ref, pick) => { const ring = ringOf(ref), v = A._view();
                const q = pick(ring);
                return { x: (q[0] - v.x) * v.scale + cv.clientWidth / 2,
                         y: (q[1] - v.y) * v.scale + cv.clientHeight / 2 }; };
            const edge = (ref) => at(ref, r => [(r[0][0] + r[1][0]) / 2, (r[0][1] + r[1][1]) / 2]);
            const centre = (ref) => at(ref, r => [r.reduce((a, q) => a + q[0], 0) / r.length,
                                                  r.reduce((a, q) => a + q[1], 0) / r.length]);
            const o = {};
            A._pickTool('select');
            A._setOsel([refA]);
            o.listLitForOne = document.querySelectorAll('#obj-list .ob.on').length === 1;
            document.querySelectorAll('#obj-list .ob')[2]
                .dispatchEvent(new MouseEvent('click', { shiftKey: true, bubbles: true }));
            o.shiftClickListAdds = A._osel().length === 2;
            o.listLitForTwo = document.querySelectorAll('#obj-list .ob.on').length === 2;

            A._setOsel([]);
            down(80, 80); move(cv.clientWidth - 40, cv.clientHeight - 40); up();
            o.marqueeSelectsMany = A._osel().length > 2;

            A._setOsel([]);               const idle = px(edge(refA));
            A._setOsel([refA]);           const one = px(edge(refA));
            A._setOsel(refs.slice(1, 6)); const many = px(edge(refA));
            o.oneLooksSelected = idle !== one;
            o.manyLookSelected = idle !== many;

            A._setOsel([refA]);
            A._pickTool('select'); const s1 = cv.toDataURL().length;
            A._pickTool('direct'); const s2 = cv.toDataURL().length;
            o.verticesOnlyUnderDirect = s1 !== s2;

            A._pickTool('select'); A._setOsel([refA]);
            const c2 = centre(refB);
            down(c2.x, c2.y, { shiftKey: true }); up();
            o.shiftClickMapAdds = A._osel().length === 2;

            A._setOsel([refA, refB]);
            o.canDuplicate = !document.getElementById('btn-sel-dup').disabled;
            o.canBoolean = !document.getElementById('btn-sel-union').disabled;
            o.canDelete = !document.getElementById('btn-sel-del').disabled;
            const b0 = [refA, refB].map(x => ringOf(x)[0].slice());
            const cA = centre(refA);
            down(cA.x, cA.y); move(cA.x + 60, cA.y + 35); up();
            const a0 = [refA, refB].map(x => ringOf(x)[0].slice());
            const d = [a0[0][0] - b0[0][0], a0[0][1] - b0[0][1]];
            o.groupMoves = Math.hypot(d[0], d[1]) > 1
                        && Math.abs((a0[1][0] - b0[1][0]) - d[0]) < 1e-6;
            while (A._state().histIdx > 0) A._undo();
            return o;
        };
        const land = probe('land'), venue = probe('venue');
        const differing = Object.keys(land).filter(k => land[k] !== venue[k]);
        const falsy = Object.keys(land).filter(k => !land[k] || !venue[k]);
        return { differing, falsy, n: Object.keys(land).length };
    });
    check(`floes behave exactly like land polygons (${parity.n} behaviours)`,
          parity.differing.length === 0, `differ: ${parity.differing.join(', ')}`);
    check('...and both layers actually do all of them',
          parity.falsy.length === 0, `failing: ${parity.falsy.join(', ')}`);
    await page.evaluate(() => { const A = window.EditorApp; while (A._state().histIdx > 0) A._undo(); });

    // ── The Venue layer's left column ───────────────────────────────────────
    console.log('\nvenue panel');
    const vp = await page.evaluate(() => {
        const A = window.EditorApp;
        document.querySelector('#layer-list [data-layer="venue"]').click();
        const top = (sel) => { const el = document.querySelector(sel);
            return el ? el.getBoundingClientRect().top : null; };
        return {
            // The Place tool's parameters are on the MAP beside the tool strip, not in the
            // left column: they decide what the next drag makes, so they belong with the
            // tool and vanish with it.
            scatterOnTheMap: !!document.querySelector('#tool-opts #ice-scatter')
                             && !document.querySelector('.ed-left #ice-scatter'),
            optsHiddenUnderSelect: (() => { A._pickTool('select');
                return document.getElementById('tool-opts').hidden; })(),
            optsShownUnderPlace: (() => { A._pickTool('place');
                return !document.getElementById('tool-opts').hidden; })(),
            optsRightOfStrip: (() => {
                const o = document.getElementById('tool-opts').getBoundingClientRect();
                const t = document.getElementById('tool-strip').getBoundingClientRect();
                return o.left >= t.right && Math.abs(o.top - t.top) < 2;
            })(),
            optsGoneOffVenue: (() => { A._setMode('shape');
                const h = document.getElementById('tool-opts').hidden;
                A._setMode('venue'); A._pickTool('place'); return h; })(),
            floeRows: document.querySelectorAll('#obj-list .ob').length,
            // Everything that said the same thing twice is gone.
            noVenueFx: !document.getElementById('venue-fx'),
            noIceCount: !document.getElementById('ice-count'),
            noClearAll: !document.getElementById('btn-ice-clear'),
            noIceSel: !document.getElementById('ice-sel'),
            noBottomPanel: !document.querySelector('#layer-settings .mode-panel[data-layer="venue"]'),
            // ...and scatter still drives placement.
            scatterDrives: (() => {
                const doc = A._state().doc;
                // Ice refuses land and spaces itself out, so the probe has to FIND open
                // water — earlier sections move shapes about, and a hard-coded spot drifts
                // onto a coastline and makes this look like a wiring failure.
                const inRing = (x, y, ring) => { let inside = false;
                    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
                        const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
                        if (((yi > y) !== (yj > y)) && (x < (xj-xi)*(y-yi)/(yj-yi)+xi)) inside = !inside;
                    } return inside; };
                let spot = null;
                for (let gx = -4000; gx <= 4000 && !spot; gx += 250)
                    for (let gy = -4000; gy <= 4000 && !spot; gy += 250)
                        if (!doc.land.some(l => inRing(gx, gy, l.outer))
                            && !doc.land.some(l => inRing(gx + 800, gy + 800, l.outer)))
                            spot = { x: gx, y: gy };
                if (!spot) return null;
                const before = doc.ice.length;
                const place = (n) => {
                    document.getElementById('ice-scatter').value = String(n);
                    A._addIce(spot.x, spot.y, 900);
                    const made = doc.ice.length - before;
                    doc.ice.length = before;
                    return made;
                };
                return place(6) > place(1);
            })()
        };
    });
    check("scatter and vary live on the map, not the left column", vp.scatterOnTheMap === true);
    check('...shown only while Place is armed',
          vp.optsHiddenUnderSelect === true && vp.optsShownUnderPlace === true);
    check('...tucked against the tool strip', vp.optsRightOfStrip === true);
    check('...and gone when the layer cannot place anything', vp.optsGoneOffVenue === true);
    check('the floe list still lists the floes', vp.floeRows > 0, `${vp.floeRows} rows`);
    check('the venue blurb, ice stats, Remove-all and prose are gone',
          vp.noVenueFx && vp.noIceCount && vp.noClearAll && vp.noIceSel && vp.noBottomPanel);
    check('...and scatter still drives how many Place drops', vp.scatterDrives === true);
    await page.evaluate(() => { const A = window.EditorApp; while (A._state().histIdx > 0) A._undo(); });

    // ── Place is a TOOL; Select selects ─────────────────────────────────────
    // Venue used to create a floe when you dragged empty water with the OBJECT arrow, so
    // that one layer's Select behaved unlike every other layer's.
    console.log('\nplace tool');
    const place = await page.evaluate(() => {
        const A = window.EditorApp, r = {};
        while (A._state().histIdx > 0) A._undo();
        document.querySelector('#layer-list [data-layer="venue"]').click();
        A.fitView();
        const cv = document.getElementById('schematic');
        const rect = cv.getBoundingClientRect();
        const n = () => A._state().doc.ice.length;
        const down = (x, y) => cv.dispatchEvent(new MouseEvent('mousedown',
            { clientX: rect.left + x, clientY: rect.top + y, button: 0, bubbles: true }));
        const move = (x, y) => window.dispatchEvent(new MouseEvent('mousemove',
            { clientX: rect.left + x, clientY: rect.top + y, bubbles: true }));
        const up = () => window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));

        r.enabledOnVenue = !document.querySelector('#tool-strip [data-tool="place"]').disabled;

        // SELECT on empty water: a marquee, and nothing created.
        A._pickTool('select'); A._setOsel([]);
        const before = n();
        down(150, 120); move(cv.clientWidth - 80, cv.clientHeight - 80); up();
        r.selectCreated = n() - before;
        r.selectSelected = A._osel().length;

        // ...and the selection moves as a group.
        const p0 = A._osel().map(o => A._state().doc.ice[o.i].outer[0].slice());
        const f = A._state().doc.ice[A._osel()[0].i], v = A._view();
        const cx = f.outer.reduce((a, q) => a + q[0], 0) / f.outer.length;
        const cy = f.outer.reduce((a, q) => a + q[1], 0) / f.outer.length;
        const sx = (cx - v.x) * v.scale + cv.clientWidth / 2;
        const sy = (cy - v.y) * v.scale + cv.clientHeight / 2;
        down(sx, sy); move(sx + 70, sy + 40); up();
        const p1 = A._osel().map(o => A._state().doc.ice[o.i].outer[0].slice());
        const d = [p1[0][0] - p0[0][0], p1[0][1] - p0[0][1]];
        r.groupMoved = Math.hypot(d[0], d[1]) > 1
                    && p0.every((q, i) => Math.abs((p1[i][0] - q[0]) - d[0]) < 1e-6);
        while (A._state().histIdx > 0) A._undo();

        // PLACE on empty water: creates one.
        A._pickTool('place');
        const before2 = n();
        down(300, 700); move(380, 760); up();
        r.placeCreated = n() - before2;
        while (A._state().histIdx > 0) A._undo();

        // Leaving Venue puts Place away — it can act on nothing else.
        A._setMode('shape');
        r.disarmedOffVenue = document.getElementById('hint-tool').textContent !== 'Place';
        r.disabledOffVenue = document.querySelector('#tool-strip [data-tool="place"]').disabled;
        A._setMode('venue');
        return r;
    });
    check('Place is available on the Venue layer', place.enabledOnVenue === true);
    check('...and only there',
          place.disabledOffVenue === true && place.disarmedOffVenue === true);
    check('Select on empty water marquees instead of creating',
          place.selectCreated === 0 && place.selectSelected > 1,
          `created ${place.selectCreated}, selected ${place.selectSelected}`);
    check('...and the selected floes move as a group', place.groupMoved === true);
    check('Place is what creates a floe', place.placeCreated === 1, `${place.placeCreated}`);
    await page.evaluate(() => { const A = window.EditorApp; while (A._state().histIdx > 0) A._undo(); });

    // ── The floe inspector ──────────────────────────────────────────────────
    console.log('\nice inspector');
    const floeInsp = await page.evaluate(() => {
        const A = window.EditorApp, r = {};
        while (A._state().histIdx > 0) A._undo();
        document.querySelector('#layer-list [data-layer="venue"]').click();
        A.fitView();
        const cv = document.getElementById('schematic');
        const rect = cv.getBoundingClientRect();
        const f = A._state().doc.ice[0], v = A._view();
        const cx = f.outer.reduce((a, q) => a + q[0], 0) / f.outer.length;
        const cy = f.outer.reduce((a, q) => a + q[1], 0) / f.outer.length;
        const pt = { x: (cx - v.x) * v.scale + cv.clientWidth / 2,
                     y: (cy - v.y) * v.scale + cv.clientHeight / 2 };
        // A real click ON THE MAP — the path that used to leave the inspector on the layer.
        cv.dispatchEvent(new MouseEvent('mousedown', { clientX: rect.left + pt.x,
            clientY: rect.top + pt.y, button: 0, bubbles: true }));
        window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
        r.kicker = document.getElementById('in-kicker').textContent;
        r.sections = [...document.querySelectorAll('#insp-obj .in-sect .k')].map(k => k.textContent.trim());
        r.notes = document.querySelectorAll('#insp-obj .in-note').length;
        r.fields = [...document.querySelectorAll('#insp-obj [data-num]')].map(e => e.dataset.num);
        // and the fields still drive the floe
        const before = Math.min(...A._state().doc.ice[0].outer.map(q => q[0]));
        const el = document.querySelector('#insp-obj [data-num="ice.x"]');
        el.value = '100'; el.dispatchEvent(new Event('change'));
        r.fieldWorks = Math.min(...A._state().doc.ice[0].outer.map(q => q[0])) !== before;
        return r;
    });
    check('clicking a floe on the MAP fills the inspector', floeInsp.kicker === 'Ice floe', floeInsp.kicker);
    check('...showing Transform and nothing else',
          floeInsp.sections.join(',') === 'Transform', floeInsp.sections.join(','));
    check('...with no explanatory prose', floeInsp.notes === 0, `${floeInsp.notes} note(s)`);
    check('...and its fields still move the floe',
          floeInsp.fields.length === 6 && floeInsp.fieldWorks === true, floeInsp.fields.join(','));
    await page.evaluate(() => { const A = window.EditorApp; while (A._state().histIdx > 0) A._undo(); });

    // ── The active layer paints last ────────────────────────────────────────
    // Read the PIXEL where two layers overlap: whichever layer is active must be the one
    // you see. Asserting the call order would pass on a stacking bug nobody could see.
    console.log('\nactive layer on top');
    const stack = await page.evaluate(() => {
        const A = window.EditorApp, r = {};
        while (A._state().histIdx > 0) A._undo();
        const cv = document.getElementById('schematic'), ctx = cv.getContext('2d');
        const dpr = cv.width / cv.clientWidth;
        const px = (wx, wy) => {
            const v = A._view();
            const sx = (wx - v.x) * v.scale + cv.clientWidth / 2;
            const sy = (wy - v.y) * v.scale + cv.clientHeight / 2;
            const d = ctx.getImageData(Math.round(sx * dpr), Math.round(sy * dpr), 1, 1).data;
            return `#${[d[0], d[1], d[2]].map(n => n.toString(16).padStart(2, '0')).join('')}`;
        };
        const inRing = (x, y, ring) => { let inside = false;
            for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
                const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
                if (((yi > y) !== (yj > y)) && (x < (xj-xi)*(y-yi)/(yj-yi)+xi)) inside = !inside;
            } return inside; };
        const doc = A._state().doc;

        // A floe laid deliberately ON a coastline — ice normally refuses land, so the
        // overlap has to be built to be tested.
        const l = A._shapeById('coast');
        const cx = l.outer.reduce((a, q) => a + q[0], 0) / l.outer.length;
        const cy = l.outer.reduce((a, q) => a + q[1], 0) / l.outer.length;
        let spot = null;
        for (const q of l.outer) {
            const tx = cx + (q[0] - cx) * 0.5, ty = cy + (q[1] - cy) * 0.5;
            if (inRing(tx, ty, l.outer)) { spot = { x: tx, y: ty }; break; }
        }
        doc.ice.push({ id: 't-floe', outer: [[spot.x-260, spot.y-260], [spot.x+260, spot.y-260],
                                             [spot.x+260, spot.y+260], [spot.x-260, spot.y+260]] });
        A._setView(spot.x, spot.y, 0.5);
        A._setMode('venue'); r.iceOnVenue = px(spot.x, spot.y);
        A._setMode('shape'); r.iceOnLand = px(spot.x, spot.y);
        doc.ice = doc.ice.filter(f => f.id !== 't-floe');

        // The arena's inset edge runs through the coast, so it is buried until Arena is up.
        const bp = doc.world.boundary.poly;
        let ep = null;
        for (let t = 0.01; t < 1 && !ep; t += 0.01) {
            const x = bp[0][0] + (bp[1][0] - bp[0][0]) * t;
            const y = bp[0][1] + (bp[1][1] - bp[0][1]) * t;
            for (const sh of doc.land) if (inRing(x, y, sh.outer)) { ep = { x, y }; break; }
        }
        r.edgeFound = !!ep;
        if (ep) {
            A._setView(ep.x, ep.y, 1.2);
            A._setMode('shape');    r.edgeOnLand = px(ep.x, ep.y);
            A._setMode('boundary'); r.edgeOnArena = px(ep.x, ep.y);
        }
        A._setMode('shape'); A.fitView();
        return r;
    });
    check('ice over land shows the ICE while the Venue layer is active',
          stack.iceOnVenue !== stack.iceOnLand, `${stack.iceOnVenue} vs ${stack.iceOnLand}`);
    check('...and the LAND while the Land layer is active', stack.iceOnLand === '#e8edf5',
          stack.iceOnLand);
    check('the arena edge is buried under land until Arena is active',
          stack.edgeFound === true && stack.edgeOnLand !== stack.edgeOnArena,
          `${stack.edgeOnLand} -> ${stack.edgeOnArena}`);
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
