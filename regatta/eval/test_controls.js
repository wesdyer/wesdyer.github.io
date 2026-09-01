// EVERY CONTROL IN THE EDITOR IS WIRED, and every venue in the picker loads.
//
//   node regatta/eval/test_controls.js
//
// This exists because the same mistake landed twice: deleting a block of handlers by
// cutting between two anchors silently took the handlers in between with it. The first
// time it removed mark and gate creation; the second time it removed the Arena fit
// buttons, the map scale AND the venue picker — so switching venues stopped working and
// nothing failed. A dead button throws no error and logs nothing. It just does nothing.
//
// So: enumerate the controls in the page and assert each one is referenced in editor.js,
// then click every venue in the picker and assert the editor actually followed.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

let failures = 0;
const check = (name, cond, detail) => {
    console.log(`  ${cond ? 'ok   ' : 'FAIL '} ${name}${cond || !detail ? '' : ' — ' + detail}`);
    if (!cond) failures++;
};

// Controls that are deliberately read rather than listened to: their value is picked up
// when a nearby button is pressed. Anything not here needs a handler.
// Fields a BUTTON reads at the moment it is pressed. They carry a value rather than
// triggering anything, so having no listener is what they are, not a gap.
// The prop spread and spin are read by the PLACE GESTURE — a click on the map — rather than
// by a button, so they belong in the same category as the fields above.
const READ_ONLY = new Set(['brect-inset', 'scalemap', 'rotmap', 'ice-scatter', 'ice-vary',
                           'prop-count', 'prop-min', 'prop-max', 'prop-spin']);

(async () => {
    const html = fs.readFileSync('regatta/editor.html', 'utf8');
    const js = fs.readFileSync('regatta/js/editor.js', 'utf8');

    console.log('every control is wired\n');
    const ids = [...html.matchAll(/<(?:button|input|select)[^>]*id="([^"]+)"/g)].map(m => m[1]);
    // ⚠️ A FLOOR, and a shrinking one. This counts controls declared in editor.html; as each
    // layer moved its fields into the INSPECTOR they stopped being in the file at all and
    // started being rendered by inspLand/inspWind/inspLeg/… at runtime. So a falling number
    // here is expected, and what it no longer proves is that those fields are wired — the
    // per-layer probes in test_editor cover that, one field at a time.
    check('the page still declares controls to check', ids.length > 20, `${ids.length} found`);

    // ⚠️ --allow-file-access-from-files, for the same reason test_editor's header spells
    // out: this suite reads the editor canvas back with toDataURL, and any venue that
    // draws a prop/mark sprite from a file:// URL TAINTS the canvas permanently without
    // the flag — the suite then dies mid-run with SecurityError instead of failing a
    // check. file:// images are genuinely same-origin here.
    const browser = await chromium.launch({ args: ['--allow-file-access-from-files'] });
    const page = await browser.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push(e.message));
    // Record listeners as they are attached, BEFORE any page script runs. Guessing from
    // the source cannot see a control wired through a table or a helper; this can, because
    // it asks the browser rather than the text.
    await page.addInitScript(() => {
        window.__listened = {};
        const real = EventTarget.prototype.addEventListener;
        EventTarget.prototype.addEventListener = function (type, fn, opts) {
            if (this && this.id) (window.__listened[this.id] = window.__listened[this.id] || []).push(type);
            return real.call(this, type, fn, opts);
        };
    });
    await page.goto('file://' + path.resolve('regatta/editor.html'));
    await page.waitForTimeout(1400);

    const listened = await page.evaluate(() => window.__listened);
    const unlistened = ids.filter(id => !READ_ONLY.has(id) && !listened[id]);
    check('every interactive control has a real listener attached', unlistened.length === 0,
          unlistened.join(', '));
    console.log(`         ${Object.keys(listened).length} elements carry listeners`);

    console.log('\nloading a venue actually switches');
    const venues = await page.evaluate(() => Object.keys(window.VENUE_DOC || {}));
    check('every bundled venue has a document to load', venues.length >= 10,
          `${venues.length}: ${venues.join(', ')}`);

    const results = [];
    for (const v of venues) {
        const r = await page.evaluate((venue) => {
            const A = window.EditorApp;
            A.loadVenue(venue);
            return {
                loaded: JSON.parse(localStorage.getItem('regatta_settings') || '{}').venue,
                doc: A._state().doc ? A._state().doc.venue : null,
                marks: (window.state.course.marks || []).length
            };
        }, v);
        results.push({ v, ...r });
    }
    const followed = results.filter(r => r.loaded === r.v);
    check('switching venue loads the venue you picked', followed.length === venues.length,
          results.filter(r => r.loaded !== r.v).map(r => `${r.v} -> ${r.loaded}`).join(', '));
    // EVERY venue, not merely one. The editor could once open a document for a venue
    // that would never race it; the test that a venue "arrives as a document" only asked
    // for one such venue, which passed the whole time nine of them were unauthorable.
    check('every venue arrives as its own document',
          results.every(r => r.doc === r.v),
          results.filter(r => r.doc !== r.v).map(r => `${r.v} -> ${r.doc}`).join(', '));
    check('every venue produced a course', results.every(r => r.marks >= 2),
          results.filter(r => r.marks < 2).map(r => r.v).join(', '));
    check('no page errors across every venue', errs.length === 0, errs.slice(0, 3).join(' | '));

    // ── The file lifecycle ──────────────────────────────────────────────────
    // The dropdown is gone: a venue is a FILE. The header shows the open venue's NAME,
    // Open/Save/Save As are the whole lifecycle, and opening arbitrary text (the picker's
    // job, driven here through the test hook) must load, register and relabel.
    console.log('\nthe file lifecycle');
    const file = await page.evaluate(() => {
        const A = window.EditorApp;
        const label = () => document.getElementById('venue-label').textContent;
        A.loadVenue('seatrials');
        const after = label();
        // What the label SHOULD read, stated as the RULE rather than by calling
        // editor.js's `venueName` (which is private to its IIFE): the document's own
        // CARD name. The fallback this used to name — a `VENUES` registry — no longer
        // exists, and the document's name does not live at the top level: editor.js's
        // venueName reads `doc.card.name || doc.card.tag`, so that is the rule to state.
        const card = ((window.VENUE_DOC.seatrials || {}).card) || {};
        const expectedAfter = card.name || card.tag || 'seatrials';
        // A COPY under its own key, opened as text — the Save As → reopen workflow.
        const copy = JSON.parse(JSON.stringify(window.VENUE_DOC.seatrials));
        // ⚠️ card.name, NOT a top-level `name`. venuedoc's own migration says it: the
        // top-level field predates the card block and now has one home, `doc.card.name`
        // — and the migration only fills it in when the card has none, so a copy that
        // already carries Clubhouse Point's card kept showing Clubhouse Point.
        copy.venue = 'testcopy';
        copy.card = Object.assign({}, copy.card, { name: 'Copied Point' });
        const wrapped = 'window.VENUE_DOC = window.VENUE_DOC || {};\n'
            + `window.VENUE_DOC["testcopy"] = ${JSON.stringify(copy)};\n`;
        const openedOk = A._openDocText(wrapped, 'testcopy.venue.js');
        const opened = {
            ok: openedOk,
            doc: A._state().doc && A._state().doc.venue,
            label: label(),
            registered: !!window.VENUE_DOC.testcopy,
            loaded: JSON.parse(localStorage.getItem('regatta_settings')).venue,
            marks: (window.state.course.marks || []).length
        };
        // Bare JSON must open too — the other on-disk form.
        const jsonOk = A._openDocText(JSON.stringify(copy), 'testcopy.json');
        delete window.VENUE_DOC.testcopy;
        A.loadVenue('seatrials');
        return { after, expectedAfter, opened, jsonOk,
                 buttons: ['btn-open', 'btn-save', 'btn-saveas'].map(id => !!document.getElementById(id)) };
    });
    check('loading a venue relabels the header with its NAME',
          file.after === file.expectedAfter && /\s/.test(file.after),
          `label ${file.after}, expected ${file.expectedAfter}`);
    check('Open, Save and Save As are all present', file.buttons.every(Boolean),
          file.buttons.join(','));
    check('opened file text becomes the document, under its own key',
          file.opened.ok === true && file.opened.doc === 'testcopy'
          && file.opened.registered === true && file.opened.loaded === 'testcopy',
          JSON.stringify(file.opened));
    check('...its NAME labels the header', file.opened.label === 'Copied Point', file.opened.label);
    check('...and it compiles to a sailable course', file.opened.marks >= 2, String(file.opened.marks));
    check('bare JSON opens too', file.jsonOk === true);

    // The field overlays belong over the map, not among the file controls.
    const overlay = await page.evaluate(() => {
        const w = document.getElementById('btn-field-wind');
        return { inCanvas: !!w.closest('.ed-canvas-wrap'), inHeader: !!w.closest('.ed-head'),
                 rightSide: w.closest('.ed-fields') &&
                     getComputedStyle(w.closest('.ed-fields')).right === '14px' };
    });
    check('the field toggles sit over the map', overlay.inCanvas === true && overlay.inHeader === false);
    check('...at its top right', overlay.rightSide === true);

    // Every button in every LAYER: clicking must not throw. A dead button is silent, but a
    // button that throws takes the editor with it. The counts are asserted non-zero because
    // this section once swept zero elements and passed — a test that finds nothing to do and
    // says "ok" is worse than no test.
    console.log('\nclicking through every layer');
    // ⚠️ FRESH PAGE FOR EVERYTHING BELOW. The venue sweep above loads every document, and any
    // venue carrying a prop whose sprite loads draws a `file://` image into the schematic —
    // which taints the canvas PERMANENTLY, for the life of that canvas. toDataURL then throws
    // SecurityError, and this whole file crashed rather than failing a check the day
    // Gatorgrass Bayou's shack got its art. Reloading gives the canvas-comparison section an
    // untainted canvas and keeps the full-fidelity export, which reads the whole backing store
    // — an element screenshot loses the 1.5px dashed arena outline and the small mark dots,
    // and reported "nothing changed" for five of the seven layers.
    await page.reload();
    await page.waitForTimeout(1400);
    await page.evaluate(() => { window.EditorApp.loadVenue('arctic'); });
    const layers = await page.evaluate(() =>
        [...document.querySelectorAll('#layer-list [data-layer]')].map(b => b.dataset.layer));
    check('the layer list has layers', layers.length >= 7, `${layers.length}: ${layers.join(', ')}`);
    let clicked = 0;
    for (const L of layers) {
        errs.length = 0;
        const n = await page.evaluate((id) => {
            document.querySelector(`#layer-list [data-layer="${id}"]`).click();
            // Panel buttons AND the object column's actions. As layers moved their creation
            // verbs out of panels and onto that row (+ Draw, + Whole course, + Mark …), a
            // sweep that only walked panels was covering less and less — which is how a
            // dead control gets past it. Both are controls; both get clicked.
            const panes = [...document.querySelectorAll('.mode-panel')].filter(p => !p.hidden);
            const btns = [...panes.flatMap(p => [...p.querySelectorAll('button')]),
                          ...document.querySelectorAll('#objs-actions button')]
                .filter(b => !b.disabled && !/delete|remove/i.test(b.textContent));
            for (const b of btns) b.click();
            return btns.length;
        }, L);
        clicked += n;
        check(`${L}: ${n} button(s) clicked without error`, errs.length === 0, errs.slice(0, 2).join(' | '));
    }
    // A floor, not a count: the point is that the sweep found REAL controls, so it cannot
    // quietly pass over an empty selector the way it once did when a rename emptied it.
    check('the sweep actually clicked something', clicked > 5, `${clicked} buttons total`);

    // The tool strip, likewise: every tool switchable, none throwing. All but the two
    // always-available ones (Select and the ruler) need a layer with outlines on it —
    // this sweep runs from the Course layer, where the strip correctly greys them out.
    errs.length = 0;
    const tools = await page.evaluate(() => {
        const out = [];
        for (const el of document.querySelectorAll('#tool-strip [data-tool]')) {
            if (el.disabled) { out.push(el.dataset.tool + ':disabled'); continue; }
            el.click();
            out.push(el.dataset.tool + (el.classList.contains('on') ? ':on' : ':off'));
        }
        return out;
    });
    check('the tool strip has nine tools', tools.length === 9, tools.join(' '));
    check('picking a tool turns it on', tools.filter(t => t.endsWith(':on')).length >= 1, tools.join(' '));
    check('no page errors from the tool strip', errs.length === 0, errs.slice(0, 2).join(' | '));

    // The checks drawer.
    errs.length = 0;
    const misc = await page.evaluate(() => {
        const d = document.getElementById('drawer');
        const before = d.hidden;
        document.getElementById('btn-drawer').click();
        const opened = !d.hidden;
        document.getElementById('btn-drawer').click();
        return { before, opened, closed: d.hidden,
                 // Compared as SETS against the layer table itself, not counted against a
                 // number written here. The count was 7 — Arena, Objects, Wind, Gusts,
                 // Current, Marks, Route — and then the Props layer shipped and this
                 // assertion started failing for a reason that was not a defect. A test
                 // that hardcodes how many layers exist has to be edited every time one is
                 // added, and it fails on the good change rather than the bad one.
                 //
                 // What is still worth asserting, and is: the eyes and the layer table
                 // agree exactly. That catches an eye that failed to render, an eye for
                 // something no longer in LAYERS, and a `noEye` layer that grew one —
                 // which are the actual ways this can break.
                 eyes: [...document.querySelectorAll('#layer-list [data-eye]')].map(e => e.dataset.eye).sort(),
                 want: window.EditorApp._layers().filter(L => !L.noEye).map(L => L.id).sort(),
                 waterEye: !!document.querySelector('#layer-list [data-eye="water"]') };
    });
    check('the checks drawer opens and closes', misc.before && misc.opened && misc.closed);
    // Every layer that DRAWS something gets an eye. Water is the exception: it is the surface
    // the rest sits on, not an overlay, so there is nothing to turn off.
    check('every drawable layer has a visibility eye, and Water has none',
          JSON.stringify(misc.eyes) === JSON.stringify(misc.want) && misc.waterEye === false,
          `eyes [${misc.eyes}] vs layers [${misc.want}] · water eye ${misc.waterEye}`);
    check('no page errors from the drawer', errs.length === 0, errs.slice(0, 2).join(' | '));

    // ── The eyes must actually hide things ──────────────────────────────────
    // They shipped once as a control that only dimmed its own row: the eye said "hidden" and
    // the map drew the layer anyway. So this compares the CANVAS before and after, per layer,
    // rather than trusting a class name.
    console.log('\nthe visibility eyes hide their layer');
    await page.evaluate(() => {
        // Give every layer something to hide: this venue authors no current. And FIT the view
        // — an earlier section leaves it panned, and a layer that is off screen "hides" with
        // no visible change, which reads as a broken eye rather than a bad test.
        // Current AND gusts: this venue authors neither, and an eye over an empty layer
        // hides nothing, which reads as a broken eye rather than an empty layer. Both
        // offer the same whole-course action, so both are seeded the same way.
        for (const layer of ['current', 'gust']) {
            document.querySelector(`#layer-list [data-layer="${layer}"]`).click();
            const btn = [...document.querySelectorAll('#objs-actions .btn')]
                .find(b => /whole course/i.test(b.textContent));
            if (btn) btn.click();
        }
        document.getElementById('btn-field-wind').click();
        document.getElementById('btn-field-cur').click();
        window.EditorApp.fitView();
    });
    await page.waitForTimeout(250);
    // Compare the rendered PNG itself. A hand-rolled pixel hash reported "no change" for the
    // arena — a 1.5px dashed outline under a translucent region fill — while the image plainly
    // differed. When the question is "did the canvas change", ask the canvas.
    //
    // Reads the whole backing store, which is what makes it sensitive enough for a dashed
    // outline. Safe here because the reload above gave this section a clean canvas; if the
    // venue this section runs on ever gains props of its own, that is the day this needs the
    // slower element-screenshot path instead.
    const shot = () => page.evaluate(() => document.getElementById('schematic').toDataURL());

    // `props` is the one eye not exercised here: the test venue has nothing placed on that
    // layer, and an eye over an empty layer hides nothing. Add it to this list once the venue
    // this section runs on carries props of its own.
    for (const L of ['current', 'gust', 'land', 'arena', 'wind', 'marks', 'route']) {
        const on = await shot();
        await page.evaluate((l) => document.querySelector(`#layer-list [data-eye="${l}"]`).click(), L);
        await page.waitForTimeout(200);
        const off = await shot();
        const dimmed = await page.evaluate((l) =>
            document.querySelector(`#layer-list [data-layer="${l}"]`).classList.contains('off'), L);
        await page.evaluate((l) => document.querySelector(`#layer-list [data-eye="${l}"]`).click(), L);
        await page.waitForTimeout(200);
        const back = await shot();
        check(`${L}: hiding it changes the map, showing it restores it`,
              on !== off && on === back && dimmed === true,
              `changed ${on !== off} · restored ${on === back} · dimmed ${dimmed}`);
    }
    await page.evaluate(() => { const A = window.EditorApp; while (A._state().histIdx > 0) A._undo(); });

    await browser.close();
    console.log(`\n${failures ? 'FAIL' : 'PASS'} — ${failures} failure(s)`);
    process.exitCode = failures ? 1 : 0;
})();
