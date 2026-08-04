// Can you switch venues in the editor? Walk the whole picker and report anything thrown.
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve('regatta/editor.html'));
  await p.waitForTimeout(1400);
  // WHY is it dirty straight after loading? Diff the saved baseline against the live doc.
  const dirt = await p.evaluate(() => {
    const A = window.EditorApp;
    const st = A._state();
    const live = JSON.parse(JSON.stringify(st.doc));
    const saved = JSON.parse(A._savedJSON() || '{}');
    const diffs = [];
    const walk = (a, b, at) => {
      if (JSON.stringify(a) === JSON.stringify(b)) return;
      if (typeof a !== 'object' || typeof b !== 'object' || !a || !b) {
        diffs.push(`${at}: ${JSON.stringify(b)} -> ${JSON.stringify(a)}`); return;
      }
      const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
      for (const k of keys) walk(a[k], b[k], at ? `${at}.${k}` : k);
    };
    walk(live, saved, '');
    return { dirty: st.dirty, diffs: diffs.slice(0, 8) };
  });
  console.log('dirty on load:', dirt.dirty, dirt.diffs.length ? '\n  ' + dirt.diffs.join('\n  ') : '');

  const venues = await p.evaluate(() => Object.keys(window.VENUE_DOC || {}));
  console.log('documents:', venues.join(', '));
  for (const v of venues) {
    errs.length = 0;
    const r = await p.evaluate((venue) => {
      try {
        window.EditorApp.loadVenue(venue);
      } catch (e) { return { threw: (e && e.message) }; }
      const A = window.EditorApp;
      return { doc: !!A._state().doc, venue: (A._state().doc || {}).venue, dirty: A._state().dirty,
               docKeys: Object.keys(window.VENUE_DOC || {}).join('+'),
               settingsVenue: JSON.parse(localStorage.getItem('regatta_settings') || '{}').venue,
               ran, marks: (window.state.course.marks || []).length };
    }, v);
    await p.waitForTimeout(300);
    console.log(`  ${v.padEnd(12)} ${r.threw ? 'THREW: ' + r.threw
        : `${r.ran || ''} doc=${r.doc} dirty=${r.dirty} marks=${r.marks} keys=${r.docKeys} settings=${r.settingsVenue} sel=${r.venue}`}${errs.length ? '  PAGE ERROR: ' + errs[0] : ''}`);
  }
  await b.close();
})();
