// THE EDITOR'S CLIPBOARD AND FILE CHORDS, driven as real key presses.
//
//   node regatta/eval/test_clipboard.js
//
// Driven through the KEYBOARD rather than by calling clipCopy/clipPaste, for the reason
// test_persistence drives the real controls: what rots is the wiring, and a test that calls
// the function directly cannot see a chord that stopped being bound. The one exception is
// the cross-layer case, which calls the verbs so it can stand on one layer and paste
// another's content without a chord in the middle.
//
// ⚠️ WHAT THIS CANNOT TELL YOU: Playwright injects a chord straight into the page, so a
// passing Cmd+N here does NOT mean a browser will deliver Cmd+N. Chrome and Firefox keep it
// for a new window. The handler is proven right; its reachability is not.
const { chromium } = require('playwright');
const path = require('path');

let bad = 0;
const ok = (m, c, d) => { if (!c) bad++; console.log(`  ${c ? 'ok   ' : 'FAIL '} ${m}${c || !d ? '' : ' — ' + d}`); };

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
    const errs = [];
    page.on('pageerror', e => errs.push(e.message.split('\n')[0]));
    await page.goto('file://' + path.resolve('regatta/editor.html'));
    await page.waitForTimeout(1800);
    await page.evaluate(() => window.EditorApp.loadVenue('swamp'));
    await page.waitForTimeout(600);

    const MOD = process.platform === 'darwin' ? 'Meta' : 'Control';
    const chord = async (k) => { await page.keyboard.press(`${MOD}+${k}`); await page.waitForTimeout(220); };
    const state = () => page.evaluate(() => ({
        shapes: window.EditorApp._state().doc.shapes.length,
        ids: window.EditorApp._state().doc.shapes.map(s => s.id),
        clip: window.EditorApp._clip(),
        sel: window.EditorApp._state().sel,
        hist: window.EditorApp._state().histIdx
    }));

    console.log('shapes: copy / paste / cut, as real key presses\n');
    // Select one shape on the Objects layer, the way a click would.
    await page.evaluate(() => {
        const A = window.EditorApp;
        A._setMode ? A._setMode('shape') : document.querySelector('#layer-list [data-layer="land"]').click();
        const first = A._state().doc.shapes[0];
        A._selectOsel ? A._selectOsel([{ kind: 'shape', id: first.id }]) : null;
    });
    // No public selector hook — click the object row in the list instead.
    await page.evaluate(() => {
        document.querySelector('#layer-list [data-layer="land"]').click();
        const row = document.querySelector('#obj-list .ob');
        if (row) row.click();
    });
    await page.waitForTimeout(250);
    const s0 = await state();
    ok('a shape is selected to work on', !!s0.sel.shape, JSON.stringify(s0.sel.shape));

    await chord('KeyC');
    const s1 = await state();
    ok('Cmd+C fills the clipboard', s1.clip && s1.clip.n === 1 && s1.clip.mode === 'shape', JSON.stringify(s1.clip));
    ok('...and copying changes nothing', s1.shapes === s0.shapes && s1.hist === s0.hist,
       `${s0.shapes}->${s1.shapes} shapes, hist ${s0.hist}->${s1.hist}`);

    await chord('KeyV');
    const s2 = await state();
    ok('Cmd+V adds one shape', s2.shapes === s0.shapes + 1, `${s0.shapes} -> ${s2.shapes}`);
    ok('...with a fresh id', new Set(s2.ids).size === s2.ids.length, s2.ids.slice(-3).join(', '));
    ok('...and the paste is selected', !!s2.sel.shape && s2.sel.shape !== s0.sel.shape, s2.sel.shape);

    await chord('KeyV');
    const s3 = await state();
    ok('a second paste adds another, not the same one', s3.shapes === s0.shapes + 2 && new Set(s3.ids).size === s3.ids.length,
       `${s3.shapes} shapes, ${new Set(s3.ids).size} unique ids`);
    ok('...and it steps further out', s3.clip.pastes === 2, `pastes ${s3.clip.pastes}`);

    await chord('KeyZ');
    const s4 = await state();
    ok('Cmd+Z undoes a paste', s4.shapes === s0.shapes + 1, `${s3.shapes} -> ${s4.shapes}`);

    // Re-select before cutting: undo restores the DOCUMENT but not the selection, so after
    // undoing a paste the selection dangles on a shape that is gone. That is pre-existing
    // (Delete behaves the same) and not what this is testing.
    await page.evaluate(() => document.querySelector('#obj-list .ob').click());
    await page.waitForTimeout(200);
    const sPre = await state();
    await chord('KeyX');
    const s5 = await state();
    ok('Cmd+X removes the selection', s5.shapes === sPre.shapes - 1, `${sPre.shapes} -> ${s5.shapes}`);
    ok('...and it is on the clipboard', s5.clip && s5.clip.n === 1, JSON.stringify(s5.clip));
    await chord('KeyV');
    const s6 = await state();
    ok('...so Cmd+V brings it back', s6.shapes === s5.shapes + 1, `${s5.shapes} -> ${s6.shapes}`);

    // ── Where it lands ──────────────────────────────────────────────────────
    // The whole point of the centre rule: copy here, look somewhere else, paste — and it
    // arrives where you are looking, not where you were.
    console.log('\npaste lands in the middle of the visible map');
    const centred = await page.evaluate(() => {
        const A = window.EditorApp;
        document.querySelector('#layer-list [data-layer="land"]').click();
        document.querySelector('#obj-list .ob').click();
        A._clipCopy();
        const v = A._view();
        // Scroll a long way off, so "centre of the view" and "near the original" cannot be
        // confused for one another.
        A._setView(v.x + 6000, v.y - 4000, v.scale);
        const want = A._view();
        A._clipPaste();
        const d = A._state().doc;
        const made = d.shapes[d.shapes.length - 1];
        const box = A._ringBox([made.outer].concat(made.holes || []));
        return { wantX: want.x, wantY: want.y, gotX: box.cx, gotY: box.cy,
                 offBy: Math.hypot(box.cx - want.x, box.cy - want.y), w: box.w, h: box.h };
    });
    ok('the pasted shape is centred on the view',
       centred.offBy < 1, `off by ${centred.offBy.toFixed(1)}u (shape is ${Math.round(centred.w)}x${Math.round(centred.h)}u)`);

    const again = await page.evaluate(() => {
        const A = window.EditorApp;
        const before = A._state().doc.shapes.length;
        A._clipPaste();
        const d = A._state().doc;
        const a = A._ringBox([d.shapes[before - 1].outer]);
        const b = A._ringBox([d.shapes[before].outer]);
        return { sep: Math.hypot(b.cx - a.cx, b.cy - a.cy) };
    });
    ok('a second paste into the same view cascades instead of stacking', again.sep > 1, `${again.sep.toFixed(0)}u apart`);

    const moved = await page.evaluate(() => {
        const A = window.EditorApp;
        const v = A._view();
        A._setView(v.x - 3000, v.y + 2500, v.scale);
        const want = A._view();
        A._clipPaste();
        const d = A._state().doc;
        const made = d.shapes[d.shapes.length - 1];
        const box = A._ringBox([made.outer]);
        return { offBy: Math.hypot(box.cx - want.x, box.cy - want.y) };
    });
    ok('...and moving the view resets it to dead centre again', moved.offBy < 1, `off by ${moved.offBy.toFixed(1)}u`);

    // Cross-layer: copy a wind region, then paste while standing on Objects.
    console.log('\npaste lands on the layer the content came from');
    const cross = await page.evaluate(() => {
        const A = window.EditorApp;
        document.querySelector('#layer-list [data-layer="wind"]').click();
        const row = document.querySelector('#obj-list .ob');
        if (row) row.click();
        const n = A._clipCopy();
        document.querySelector('#layer-list [data-layer="land"]').click();
        const before = A._state().doc.wind.regions.length;
        const pasted = A._clipPaste();
        return { n, pasted, before, after: A._state().doc.wind.regions.length,
                 modeNow: A._state().tool !== undefined ? document.querySelector('#layer-list .ly.on [data-layer], #layer-list .on')?.dataset?.layer : null };
    });
    ok('a wind region copies', cross.n === 1, `${cross.n}`);
    ok('pasting from another layer still lands in wind.regions',
       cross.pasted === 1 && cross.after === cross.before + 1, `${cross.before} -> ${cross.after}`);

    // ── Props ───────────────────────────────────────────────────────────────
    console.log('\nprops copy and paste too');
    const props = await page.evaluate(() => {
        const A = window.EditorApp;
        const d = A._state().doc;
        const kind = Object.keys(window.VenueDoc.PROP_KINDS)[0];
        d.props = [{ id: 'prop-1', kind, x: 0, y: 0, heading: 0 },
                   { id: 'prop-2', kind, x: 300, y: 0, heading: 0 }];
        document.querySelector('#layer-list [data-layer="props"]').click();
        const rows = [...document.querySelectorAll('#obj-list .ob')];
        rows[0].click();
        if (rows[1]) rows[1].dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey: true }));
        const copied = A._clipCopy();
        const before = d.props.length;
        const v = A._view();
        A._setView(v.x + 2200, v.y - 1800, v.scale);
        const want = A._view();
        const pasted = A._clipPaste();
        const made = d.props.slice(before);
        const xs = made.map(p => p.x), ys = made.map(p => p.y);
        const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
        return { copied, before, after: d.props.length,
                 ids: d.props.map(p => p.id),
                 offBy: Math.hypot(cx - want.x, cy - want.y),
                 spread: made.length > 1 ? Math.hypot(made[1].x - made[0].x, made[1].y - made[0].y) : 0 };
    });
    ok('a prop selection copies', props.copied >= 1, `${props.copied} copied`);
    ok('pasting adds that many props', props.after === props.before + props.copied,
       `${props.before} -> ${props.after}`);
    ok('...with unique ids', new Set(props.ids).size === props.ids.length, props.ids.join(', '));
    ok('...centred on the view, like everything else', props.offBy < 1, `off by ${props.offBy.toFixed(1)}u`);
    ok('...keeping their formation', props.spread > 1, `${props.spread.toFixed(0)}u apart`);

    // ── Cmd+N ───────────────────────────────────────────────────────────────
    // Playwright injects the chord straight into the page, so this proves the HANDLER is
    // right — it cannot prove a real browser will ever deliver it. See the note at the key.
    page.on('dialog', d => d.accept());
    const before = await page.evaluate(() => window.EditorApp._state().doc.venue);
    await chord('KeyN');
    await page.waitForTimeout(500);
    const afterNew = await page.evaluate(() => window.EditorApp._state().doc.venue);
    ok('Cmd+N starts a new document (when the browser delivers it)',
       /^untitled/.test(afterNew) && afterNew !== before, `${before} -> ${afterNew}`);

    ok('no page errors', errs.length === 0, errs.slice(0, 2).join(' | '));
    console.log(`\n${bad ? 'FAIL' : 'PASS'} — ${bad} failure(s)`);
    await browser.close();
    process.exitCode = bad ? 1 : 0;
})();
