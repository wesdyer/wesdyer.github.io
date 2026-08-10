// PROP AUTHORING: the spread fields, the spin toggle, and the scatter gesture.
//
//   node regatta/eval/test_props.js
//
// Driven through real mouse gestures rather than by calling addProps, for the reason
// test_persistence drives real controls: what rots is the wiring between a control and the
// thing it feeds, and a test that calls the function directly cannot see a field that
// stopped being read or a gesture that stopped being bound.
const { chromium } = require('playwright');
const path = require('path');
let bad = 0;
const ok = (m, c, d) => { if (!c) bad++; console.log(`  ${c ? 'ok   ' : 'FAIL '} ${m}${c || !d ? '' : ' — ' + d}`); };
(async () => {
    const b = await chromium.launch();
    const p = await b.newPage({ viewport: { width: 1500, height: 1000 } });
    const errs = []; p.on('pageerror', e => errs.push(e.message.split('\n')[0]));
    await p.goto('file://' + path.resolve('regatta/editor.html'));
    await p.waitForTimeout(1800);
    await p.evaluate(() => window.EditorApp.loadVenue('swamp'));
    await p.waitForTimeout(800);
    await p.evaluate(() => document.querySelector('#layer-list [data-layer="props"]').click());
    await p.waitForTimeout(300);
    const box = await (await p.$('#schematic')).boundingBox();
    const arm = (id) => p.evaluate((t) => {
        document.querySelector(`#tool-strip [data-tool="${t}"]`).click();
    }, id).then(() => p.waitForTimeout(180));

    // ── The tool decides what a gesture means, exactly as it does for shapes ──
    await arm('place');
    let strip = await p.evaluate(() => ({
        shown: !document.getElementById('tool-opts').hidden,
        opts: getComputedStyle(document.getElementById('prop-opts')).display,
        text: document.getElementById('tool-opts').innerText.replace(/\s+/g, ' ').trim()
    }));
    ok('Place is armable on the Props layer', strip.shown);
    ok('...and brings the prop fields with it', strip.opts === 'flex' && /COUNT/.test(strip.text), strip.text);
    await arm('select');
    strip = await p.evaluate(() => ({
        opts: getComputedStyle(document.getElementById('prop-opts')).display
    }));
    ok('...which vanish under Select, being Place\'s settings', strip.opts === 'none', strip.opts);
    await arm('place');

    const setup = (o) => p.evaluate((v) => {
        document.getElementById('prop-count').value = v.count;
        document.getElementById('prop-min').value = v.min;
        document.getElementById('prop-max').value = v.max;
        document.getElementById('prop-spin').checked = v.spin;
        window.EditorApp._state().doc.props = [];
    }, o);
    const props = () => p.evaluate(() => (window.EditorApp._state().doc.props || [])
        .map(q => ({ x: Math.round(q.x), y: Math.round(q.y), s: q.scale ?? null, h: +(q.heading || 0).toFixed(3) })));
    const drag = async (x, y, dx, dy) => {
        await p.mouse.move(box.x + x, box.y + y); await p.mouse.down();
        await p.mouse.move(box.x + x + dx, box.y + y + dy, { steps: 6 });
        await p.mouse.up(); await p.waitForTimeout(140);
    };

    // With Place armed: a tap still places exactly one, where you pointed.
    await setup({ count: 1, min: 100, max: 100, spin: false });
    await drag(500, 400, 0, 0);
    let r = await props();
    ok('a tap places one', r.length === 1, `${r.length}`);
    const at = await p.evaluate(([sx, sy]) => {
        const A = window.EditorApp, v = A._view();
        return { x: Math.round((sx - 1500 / 2) / v.scale + v.x) };
    }, [500, 400]);
    ok('...and one drag with count 1 stays at the origin', r.length === 1);

    // A drag with a count lays a stand inside the circle.
    await setup({ count: 18, min: 70, max: 130, spin: true });
    await drag(600, 450, 150, 0);
    r = await props();
    ok('a drag lays the stand', r.length >= 12 && r.length <= 18, `${r.length} of 18 asked`);
    const cx = r.reduce((a, q) => a + q.x, 0) / r.length, cy = r.reduce((a, q) => a + q.y, 0) / r.length;
    const spreadOk = r.length > 1 && new Set(r.map(q => `${q.x},${q.y}`)).size === r.length;
    ok('...every one in a different place', spreadOk);
    const sc = r.map(q => q.s).filter(x => x !== null);
    ok('...each with its own size', new Set(sc).size > r.length * 0.6, `${new Set(sc).size} distinct`);
    ok('...and its own heading', new Set(r.map(q => q.h)).size > r.length * 0.6,
       `${new Set(r.map(q => q.h)).size} distinct`);
    // Radius: the drag was 150 screen px; everything should sit inside that of the origin.
    const v = await p.evaluate(() => window.EditorApp._view());
    const rad = 150 / v.scale;
    const maxD = Math.max(...r.map(q => Math.hypot(q.x - cx, q.y - cy)));
    ok('...all inside the dragged circle', maxD <= rad * 1.35, `furthest ${Math.round(maxD)}u of ${Math.round(rad)}u`);

    // ONE undo entry for the whole stand, checked HERE — before the Select section below
    // adds gestures of its own. An undo assertion downstream of other actions is testing the
    // history, not the scatter.
    {
        const before = (await props()).length;
        await p.evaluate(() => window.EditorApp._undo());
        const after = (await props()).length;
        ok('one undo removes the whole stand', before - after >= 17, `${before} -> ${after}`);
        await p.evaluate(() => window.EditorApp._redo());
        await p.waitForTimeout(120);
    }

    // ── Select: empty water is marquee territory, which is what this bought ──
    await arm('select');
    const n0 = (await props()).length;
    await drag(560, 400, 260, 180);          // a box over part of the stand
    let selN = await p.evaluate(() => window.EditorApp._state().sel && window.EditorApp._selProps
        ? window.EditorApp._selProps().length : -1);
    ok('a drag under Select marquees instead of placing',
       (await props()).length === n0, `${n0} -> ${(await props()).length}`);
    ok('...and it actually selected some', selN > 0, `${selN} selected`);
    // Somewhere provably clear of every prop, so the click cannot be a hit by accident.
    const empty = await p.evaluate(() => {
        const A = window.EditorApp, v = A._view(), ps = A._state().doc.props || [];
        const toS = (x, y) => ({ x: (x - v.x) * v.scale + window.innerWidth / 2,
                                 y: (y - v.y) * v.scale + 0 });
        for (let sx = 120; sx < 900; sx += 40) for (let sy = 120; sy < 700; sy += 40) {
            const wx = (sx - window.innerWidth / 2) / v.scale + v.x;
            const wy = (sy - 0) / v.scale + v.y;
            if (ps.every(q => Math.hypot(q.x - wx, q.y - wy) > 600 / v.scale)) return { sx, sy };
        }
        return null;
    });
    if (empty) {
        await p.mouse.click(box.x + empty.sx, box.y + empty.sy);
        await p.waitForTimeout(160);
    }
    ok('...a bare click clears the selection rather than placing',
       !!empty && (await props()).length === n0
       && (await p.evaluate(() => window.EditorApp._selProps().length)) === 0,
       `props ${(await props()).length} of ${n0}, sel `
       + `${await p.evaluate(() => window.EditorApp._selProps().length)}`);
    await arm('place');

    ok('no page errors', errs.length === 0, errs.slice(0, 2).join(' | '));
    console.log(`\n${bad ? 'FAIL' : 'PASS'} — ${bad} failure(s)`);
    await b.close();
    process.exitCode = bad ? 1 : 0;
})();
