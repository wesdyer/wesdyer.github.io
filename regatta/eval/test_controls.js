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
const READ_ONLY = new Set(['brect-inset', 'scalemap', 'rotmap', 'ice-scatter', 'ice-vary']);

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

    const browser = await chromium.launch();
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

    console.log('\nthe venue picker actually switches');
    const venues = await page.evaluate(() =>
        [...document.getElementById('venue-select').options].map(o => o.value));
    check('the picker lists every venue', venues.length >= 10, `${venues.length}: ${venues.join(', ')}`);

    const results = [];
    for (const v of venues) {
        const r = await page.evaluate((venue) => {
            const sel = document.getElementById('venue-select');
            sel.value = venue;
            sel.dispatchEvent(new Event('change'));
            const A = window.EditorApp;
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

    // ── The venue menu ──────────────────────────────────────────────────────
    // It is our markup now, not the OS's, so the things a <select> gave for free have to be
    // tested: it opens, it lists everything, picking one loads it, and it shuts.
    console.log('\nthe venue menu');
    const menu = await page.evaluate(() => {
        const A = window.EditorApp;
        const label = () => document.getElementById('venue-label').textContent;
        const closed = A._venueMenu().open;
        document.getElementById('venue-btn').click();
        const opened = A._venueMenu().open;
        const opts = A._venueMenu().options;
        const groups = [...document.querySelectorAll('#venue-menu .ed-pop-k')].map(e => e.textContent);
        const order = [...document.querySelectorAll('#venue-menu .ed-opt')].map(e => e.dataset.v);
        const ticked = [...document.querySelectorAll('#venue-menu .ed-opt.on')].map(e => e.dataset.v);
        const before = label();
        // Clicking outside must dismiss it.
        document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        const dismissed = !A._venueMenu().open;
        document.getElementById('venue-btn').click();
        document.querySelector('#venue-menu [data-v="seatrials"]').click();
        return { closed, opened, opts, groups, order, ticked, before, dismissed,
                 after: label(), stillOpen: A._venueMenu().open,
                 // What the label SHOULD read, stated as the RULE rather than by calling
                 // editor.js's `venueName` (which is private to its IIFE): a document may
                 // override the venue's name, otherwise `VENUES` wins. Pinning the literal
                 // display name here meant a venue rename failed this test instead of the
                 // thing a rename can actually break — see redundantNames below.
                 expectedAfter: (window.VENUE_DOC.seatrials || {}).name || VENUES.seatrials.name,
                 // `doc.name` is an OVERRIDE that `venueName()` prefers over `VENUES`. One
                 // equal to the stock name overrides nothing and is a rename landmine: the
                 // freezer used to write it for every venue, so renaming Sea Trial Bay to
                 // Clubhouse Point moved the game and left the editor saying the old name.
                 redundantNames: Object.keys(window.VENUE_DOC).filter(k =>
                     window.VENUE_DOC[k].name && (typeof VENUES !== 'undefined') &&
                     VENUES[k] && window.VENUE_DOC[k].name === VENUES[k].name),
                 loaded: JSON.parse(localStorage.getItem('regatta_settings')).venue,
                 anyIds: [...document.querySelectorAll('#venue-menu .ed-opt span')]
                     .map(e => e.textContent).filter(t => /^[a-z]+$/.test(t)) };
    });
    check('the menu starts closed', menu.closed === false);
    check('the button opens it', menu.opened === true);
    check('it lists every venue', menu.opts.length >= 10, `${menu.opts.length}`);
    // One flat list in journey order. The old two groups separated editable venues from
    // generated ones, a distinction that stopped existing when every venue got a document.
    check('the venues are one flat list — no group headings', menu.groups.length === 0,
          menu.groups.join(' | '));
    check('...in journey order, the Bay first and the benchmark last',
          menu.order[0] === 'bay' && menu.order[menu.order.length - 1] === 'seatrials',
          menu.order.join(' '));
    check('no document overrides its venue name with the same name',
          menu.redundantNames.length === 0,
          `${menu.redundantNames.join(', ')} — a rename would move the game and not the editor`);
    check('the current venue is ticked', menu.ticked.length === 1, menu.ticked.join(','));
    check('clicking outside dismisses it', menu.dismissed === true);
    // NAMES, not ids: "Glacier Sound", never "arctic".
    check('the trigger shows the venue NAME', /\s/.test(menu.before) && menu.before !== 'arctic', menu.before);
    check('...and so does every row', menu.anyIds.length === 0, `id-looking rows: ${menu.anyIds.join(',')}`);
    check('picking one loads it and closes the menu',
          menu.loaded === 'seatrials' && menu.stillOpen === false &&
          menu.after === menu.expectedAfter && /\s/.test(menu.after),
          `${menu.loaded} · label ${menu.after}, expected ${menu.expectedAfter}`);
    check('no "document" suffix anywhere in the picker',
          !/·\s*document/.test(await page.evaluate(() => document.getElementById('venue-menu').textContent)));

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
    await page.evaluate(() => {
        const sel = document.getElementById('venue-select');
        sel.value = 'arctic'; sel.dispatchEvent(new Event('change'));
    });
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
                 eyes: document.querySelectorAll('#layer-list [data-eye]').length,
                 waterEye: !!document.querySelector('#layer-list [data-eye="water"]') };
    });
    check('the checks drawer opens and closes', misc.before && misc.opened && misc.closed);
    // Every layer that DRAWS something gets an eye. Water is the exception: it is the surface
    // the rest sits on, not an overlay, so there is nothing to turn off.
    // Seven: Arena, Objects, Wind, Gusts, Current, Marks, Route. (Land and Venue became one
    // Objects layer, so there is one eye for everything solid rather than one for coastlines
    // and another for ice; Gusts arrived beside Wind.)
    check('every drawable layer has a visibility eye, and Water has none',
          misc.eyes === 7 && misc.waterEye === false, `${misc.eyes} eyes · water eye ${misc.waterEye}`);
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
        document.querySelector('#layer-list [data-layer="current"]').click();
        [...document.querySelectorAll('#objs-actions .btn')]
            .find(b => /whole course/i.test(b.textContent)).click();
        document.getElementById('btn-field-wind').click();
        document.getElementById('btn-field-cur').click();
        window.EditorApp.fitView();
    });
    await page.waitForTimeout(250);
    // Compare the rendered PNG itself. A hand-rolled pixel hash reported "no change" for the
    // arena — a 1.5px dashed outline under a translucent region fill — while the image plainly
    // differed. When the question is "did the canvas change", ask the canvas.
    const shot = () => page.evaluate(() => document.getElementById('schematic').toDataURL());

    for (const L of ['current', 'land', 'arena', 'wind', 'marks', 'route']) {
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
