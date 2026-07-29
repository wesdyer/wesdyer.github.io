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

    // The point of scaling: it moves the race INTO the target band, and the checks
    // must notice without being asked.
    const raceBefore = before.findings.find(f => f.id === 'race-length');
    const raceAfter = s6.findings.find(f => f.id === 'race-length');
    check('race length was out of band before', raceBefore && raceBefore.level === 'warn', raceBefore && raceBefore.detail);
    check('race length is in band after scaling to 60%', raceAfter && raceAfter.level === 'ok', raceAfter && raceAfter.detail);
    console.log(`         before: ${raceBefore && raceBefore.detail}`);
    console.log(`         after:  ${raceAfter && raceAfter.detail}`);

    // Uniform scaling cannot fix land-outside-boundary, because it scales the
    // boundary too. Asserting that keeps anyone from "fixing" it this way.
    const outBefore = before.findings.filter(f => f.id === 'land-outside').length;
    const outAfter = s6.findings.filter(f => f.id === 'land-outside').length;
    check('land-outside is unchanged by uniform scaling (ratio preserved)', outBefore === outAfter,
          `${outBefore} -> ${outAfter}`);

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
        const before = A._state().findings.filter(f => f.id === 'land-outside').length;
        A._boundaryToRect(0);
        A._afterEdit(true, 'rect');
        const f = A._state().findings;
        return {
            before,
            after: f.filter(x => x.id === 'land-outside').length,
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
    check('land-outside warnings cleared', rect.before > 0 && rect.after === 0, `${rect.before} -> ${rect.after}`);
    check('arena coverage now passes', rect.covLevel === 'ok', rect.coverage);
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
        const spacing = (ring) => ring.map((p, i) => {
            const q = ring[(i + 1) % ring.length];
            return Math.hypot(q[0] - p[0], q[1] - p[1]);
        });
        const sd = (a) => { const m = a.reduce((x, y) => x + y, 0) / a.length;
            return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / a.length) / m; };
        const beforeCV = sd(spacing(l.outer)), n = l.outer.length;
        A._resample(l); A._afterEdit(true, 'resample');
        return { beforeCV, afterCV: sd(spacing(l.outer)), n, after: l.outer.length };
    });
    check('vertex count preserved', rs.after === rs.n, `${rs.n} -> ${rs.after}`);
    check('spacing became more even', rs.afterCV < rs.beforeCV,
          `CV ${rs.beforeCV.toFixed(3)} -> ${rs.afterCV.toFixed(3)}`);

    // ── Save output ─────────────────────────────────────────────────────────
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
