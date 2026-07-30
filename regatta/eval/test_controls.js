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
const READ_ONLY = new Set(['brect-inset', 'scalemap', 'ice-scatter', 'ice-vary', 'rt-add-what']);

(async () => {
    const html = fs.readFileSync('regatta/editor.html', 'utf8');
    const js = fs.readFileSync('regatta/js/editor.js', 'utf8');

    console.log('every control is wired\n');
    const ids = [...html.matchAll(/<(?:button|input|select)[^>]*id="([^"]+)"/g)].map(m => m[1]);
    check('the page has a plausible number of controls', ids.length > 40, `${ids.length} found`);

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
    check('a document venue arrives as a document',
          results.some(r => r.doc === r.v), 'no venue loaded its own document');
    check('a generated venue arrives with no document',
          results.some(r => r.doc === null), 'every venue claimed a document');
    check('every venue produced a course', results.every(r => r.marks >= 2),
          results.filter(r => r.marks < 2).map(r => r.v).join(', '));
    check('no page errors across every venue', errs.length === 0, errs.slice(0, 3).join(' | '));

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
            const panes = [...document.querySelectorAll('.mode-panel')].filter(p => !p.hidden);
            const btns = panes.flatMap(p => [...p.querySelectorAll('button')])
                .filter(b => !b.disabled && !/delete|remove/i.test(b.textContent));
            for (const b of btns) b.click();
            return btns.length;
        }, L);
        clicked += n;
        check(`${L}: ${n} button(s) clicked without error`, errs.length === 0, errs.slice(0, 2).join(' | '));
    }
    check('the sweep actually clicked something', clicked > 8, `${clicked} buttons total`);

    // The tool strip, likewise: five tools, all switchable, none throwing.
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
    check('the tool strip has five tools', tools.length === 5, tools.join(' '));
    check('picking a tool turns it on', tools.filter(t => t.endsWith(':on')).length >= 1, tools.join(' '));
    check('no page errors from the tool strip', errs.length === 0, errs.slice(0, 2).join(' | '));

    // The checks drawer, and the eye on every layer.
    errs.length = 0;
    const misc = await page.evaluate(() => {
        const d = document.getElementById('drawer');
        const before = d.hidden;
        document.getElementById('btn-drawer').click();
        const opened = !d.hidden;
        document.getElementById('btn-drawer').click();
        const eyes = document.querySelectorAll('#layer-list [data-eye]').length;
        document.querySelector('#layer-list [data-eye]').click();
        const hidTxt = document.querySelector('#layer-list .ly.off') ? 'hides' : 'no-op';
        document.querySelector('#layer-list [data-eye]').click();
        return { before, opened, closed: d.hidden, eyes, hidTxt };
    });
    check('the checks drawer opens and closes', misc.before && misc.opened && misc.closed);
    check('every layer has a visibility eye', misc.eyes >= 7, String(misc.eyes));
    check('the eye actually hides its layer', misc.hidTxt === 'hides', misc.hidTxt);
    check('no page errors from the drawer or the eyes', errs.length === 0, errs.slice(0, 2).join(' | '));

    await browser.close();
    console.log(`\n${failures ? 'FAIL' : 'PASS'} — ${failures} failure(s)`);
    process.exitCode = failures ? 1 : 0;
})();
