// YOUR SETTINGS AND YOUR CHARACTER SURVIVE A RELOAD AND A NEW RACE.
//
// Driven through the REAL UI — the picker is clicked, the toggles are clicked, the venue
// card is clicked — because every one of these controls already writes to `settings`
// correctly when called from script. What can rot is the wiring between the control and
// `saveSettings()`, and that is invisible to any test that sets the field itself. (The
// character picker shipped exactly that class of bug: `pickCharacter` called a grid
// refresh that did not exist, behind a `typeof` guard that swallowed it.)
//
// ⚠️ EACH CONTROL IS CHECKED AGAINST localStorage THE INSTANT IT IS USED, before any other
// control is touched. `saveSettings()` serialises the WHOLE settings object, so ANY later
// save persists every field mutated earlier — which means a control that forgot to save is
// covered for by the next one that didn't. The first version of this suite checked storage
// once at the end and passed with `saveSettings()` deleted from `pickCharacter`.
const { chromium } = require('playwright');
const path = require('path');

let bad = 0;
const fail = (m) => { bad++; console.log(`  FAIL ${m}`); };
const pass = (m) => console.log(`  ok   ${m}`);

(async () => {
    const browser = await chromium.launch();
    const p = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto('file://' + path.resolve('regatta/index.html'));
    await p.waitForFunction(() => window.state && state.boats && state.boats.length);

    const read = () => p.evaluate(() => ({
        live: { ...settings },
        stored: JSON.parse(localStorage.getItem('regatta_settings') || '{}'),
    }));

    const expected = {};

    // One UI action, then storage is inspected immediately.
    const step = async (key, label, action) => {
        const was = (await read()).live[key];
        await action();
        await p.waitForTimeout(150);
        const { live, stored } = await read();
        if (JSON.stringify(live[key]) === JSON.stringify(was)) {
            return fail(`${key.padEnd(17)} the UI did not change it (still ${JSON.stringify(was)}) — ${label}`);
        }
        if (JSON.stringify(stored[key]) !== JSON.stringify(live[key])) {
            return fail(`${key.padEnd(17)} set to ${JSON.stringify(live[key])} but localStorage still says `
                      + `${JSON.stringify(stored[key])} — ${label} never persisted it`);
        }
        expected[key] = live[key];
        pass(`${key.padEnd(17)} ${JSON.stringify(was)} -> ${JSON.stringify(live[key])} (${label})`);
    };

    console.log('every control persists AT THE MOMENT IT IS USED\n');

    // --- character, through the picker --------------------------------------
    await p.evaluate(() => { setupPreRaceOverlay(); selectCompetitor(PLAYER_CARD_KEY); });
    await p.waitForTimeout(400);
    await step('character', 'character picker', async () => {
        // Your own badge, at the top of the fleet list, is the way in: the header chip and
        // the scouting panel's button are both gone, so this is the only route to the picker.
        await p.click('#pr-competitors-grid [data-name="__player__"] button');
        await p.waitForTimeout(700);
        const target = await p.evaluate(() => charactersAlphabetical().find(c => c.name !== settings.character).name);
        await p.click(`#character-grid [data-char="${target}"]`);
        await p.waitForTimeout(400);
    });

    // --- venue, by clicking its card ----------------------------------------
    await step('venue', 'venue card', async () => {
        const key = await p.evaluate(() => Object.keys(window.VENUE_DOC).find(k => k !== settings.venue));
        // No silent fallback to selectVenue(): that would quietly test the programmatic
        // path and report a pass for a card that no longer responds to a click.
        const clicked = await p.evaluate((k) => {
            const card = [...document.querySelectorAll('#venue-picker *')]
                .find(c => c.dataset && c.dataset.venue === k);
            if (!card) return false;
            card.click(); return true;
        }, key);
        if (!clicked) fail('no venue card carried data-venue — the card path was not exercised');
    });

    // --- the settings modal --------------------------------------------------
    await p.evaluate(() => document.getElementById('settings-screen').classList.remove('hidden'));
    await p.waitForTimeout(200);
    const TOGGLES = [
        ['musicEnabled', 'setting-music'], ['soundEnabled', 'setting-sound'],
        ['bgSoundEnabled', 'setting-bg-sound'], ['penaltiesEnabled', 'setting-penalties'],
        ['navAids', 'setting-navaids'], ['autoTrim', 'setting-trim'],
    ];
    for (const [key, id] of TOGGLES) {
        await step(key, `#${id}`, () => p.evaluate((i) => {
            // The inputs are `sr-only` peers behind styled labels, so click the label.
            const el = document.getElementById(i);
            const lab = el.closest('label') || document.querySelector(`label[for="${i}"]`);
            (lab || el).click();
        }, id));
    }
    // ── The last two controls are BUTTONS now, and that is the whole lesson here ──
    //
    // Both of these steps had rotted, and both rotted the same way: they named a specific
    // thing in the DOM and the DOM moved underneath them.
    //
    //   cameraMode    drove `selectOption('#setting-camera-mode', 'wind')`. The August 2026
    //                 camera cleanup deleted the Wind mode (loadSettings still carries the
    //                 migration off it), and then the select itself was replaced by a
    //                 segmented control and left in the page as a hidden source of truth.
    //                 So the call waited on an option that would never exist, on an element
    //                 that would never be visible, and timed out.
    //   telltaleColor set `.value` on `#setting-color-telltale`, which does not exist at
    //                 all any more — it is a row of swatch buttons.
    //
    // An unhandled throw in here is not one red line, it is the whole file; under the old
    // `&&` chain it took every suite after it too. So: find the target BY ASKING THE PAGE
    // what it offers, and click the real control. That is this suite's entire premise —
    // the wiring between a control and saveSettings() is the thing that rots, and driving
    // a hidden element tests none of it.
    // ⚠️ Compare against the LIVE value, and reach it as a bare identifier. `settings` is a
    // top-level `let` in a classic script, so it lives in the global lexical scope and is
    // NOT a property of window — `window.settings` reads undefined, every candidate then
    // "differs" from it, and the first button wins, which is the one already selected.
    // That picks a no-op, and `step` correctly reports it as "the UI did not change it",
    // which looks exactly like a broken control. It was a broken test.
    const segTo = await p.evaluate(() => {
        const cur = settings.cameraMode;
        const other = [...document.querySelectorAll('#camera-segs .ov-seg')].find(b => b.dataset.mode !== cur);
        return other ? other.dataset.mode : null;
    });
    if (!segTo) fail('cameraMode        #camera-segs offers no second mode to switch to');
    else await step('cameraMode', '#camera-segs button', () => p.click(`#camera-segs .ov-seg[data-mode="${segTo}"]`));

    const swTo = await p.evaluate(() => {
        const cur = (settings.telltaleColor || '#fbbf24').toLowerCase();
        const other = [...document.querySelectorAll('.ov-swatch[data-color]')]
            .find(b => b.dataset.color.toLowerCase() !== cur);
        return other ? other.dataset.color : null;
    });
    if (!swTo) fail('telltaleColor     no telltale swatch differs from the current colour');
    else await step('telltaleColor', '.ov-swatch button', () => p.click(`.ov-swatch[data-color="${swTo}"]`));

    // --- reload ---------------------------------------------------------------
    console.log('\nand they come back');
    await p.reload();
    await p.waitForFunction(() => window.state && state.boats && state.boats.length);
    const after = await p.evaluate(() => ({ ...settings, _boat0: state.boats[0].name }));
    let lost = Object.entries(expected).filter(([k, v]) => JSON.stringify(after[k]) !== JSON.stringify(v));
    if (lost.length) fail(`lost on reload: ${lost.map(([k, v]) => `${k} ${JSON.stringify(v)}->${JSON.stringify(after[k])}`).join(', ')}`);
    else pass(`all ${Object.keys(expected).length} settings survived the reload`);

    // --- and a fresh race on top of that --------------------------------------
    const ng = await p.evaluate(() => { restartRace(); return { ...settings, _boat0: state.boats[0].name }; });
    lost = Object.entries(expected).filter(([k, v]) => JSON.stringify(ng[k]) !== JSON.stringify(v));
    if (lost.length) fail(`lost on a new race: ${lost.map(([k]) => k).join(', ')}`);
    else pass(`all ${Object.keys(expected).length} settings survived a new race`);

    const boatOk = after._boat0 === after.character && ng._boat0 === ng.character;
    if (!boatOk) fail(`the player's boat is not the stored character (reload ${after._boat0} vs ${after.character}, new race ${ng._boat0} vs ${ng.character})`);
    else pass(`the player's boat IS the stored character (${after._boat0})`);

    if (errs.length) fail('page errors: ' + errs.slice(0, 2).join(' | '));
    else pass('no page errors');

    console.log(`\n${bad ? 'FAIL' : 'PASS'} — ${bad} failure(s)`);
    await browser.close();
    process.exitCode = bad ? 1 : 0;
})();
