// What is still PROGRAMMED per venue, rather than authored in its document?
//   node regatta/eval/_venue_audit.js
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve('regatta/index.html'));
  const out = await p.evaluate(() => {
    const keys = Object.keys(VENUES);
    // Did the generated (non-document) branch run at all?
    let genCalls = 0;
    const realGen = window.generateIslands;
    if (typeof generateIslands === 'function') {
      window.generateIslands = function (...a) { genCalls++; return realGen.apply(this, a); };
    }
    const rows = [];
    for (const k of keys) {
      localStorage.setItem('regatta_settings', JSON.stringify({ venue: k }));
      let s = 90210;
      Math.random = () => { let t = s += 0x6D2B79F5; t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
      const before = genCalls;
      resetGame();
      const v = VENUES[k], doc = window.VenueDoc.get(k);
      rows.push({
        key: k,
        hasDoc: !!doc,
        usedDoc: !!(state.course && state.course.doc),
        generated: genCalls > before,
        fx: Object.keys(v.fx || {}).filter(f => v.fx[f]),
        venueOnly: ['name','label','emoji','tagline','water','obstacles','tags','blurb']
                     .filter(f => v[f] !== undefined),
        palette: !!v.palette,
        docPalette: !!(doc && doc.palette),
        docConditions: !!(doc && doc.conditions),
        islandsCfg: !!v.islands,
        courseType: state.course.type,
        roundMark: !!state.course.roundMark
      });
    }
    return { rows, keys };
  });
  const R = out.rows;
  const pad = (s, n) => String(s).padEnd(n);
  console.log(pad('venue', 11) + pad('doc', 5) + pad('gen?', 6) + pad('type', 12) + pad('pal', 5) + pad('cond', 6) + 'fx');
  for (const r of R) {
    console.log(pad(r.key, 11) + pad(r.usedDoc ? 'yes' : 'NO', 5) + pad(r.generated ? 'YES' : '-', 6)
      + pad(r.courseType, 12) + pad(r.docPalette ? 'doc' : (r.palette ? 'venue' : '-'), 5)
      + pad(r.docConditions ? 'doc' : 'venue', 6) + (r.fx.join(',') || '-'));
  }
  const flag = {};
  for (const r of R) for (const f of r.fx) (flag[f] = flag[f] || []).push(r.key);
  console.log('\nfx flags in use:');
  for (const f of Object.keys(flag).sort()) console.log(`  ${pad(f, 14)} ${flag[f].join(',')}`);
  console.log('\nvenues whose land was GENERATED (not from a document):',
    R.filter(r => r.generated).map(r => r.key).join(',') || 'none');
  console.log('venues with no document:', R.filter(r => !r.hasDoc).map(r => r.key).join(',') || 'none');
  console.log('presentation fields on every venue, in no document:', R[0].venueOnly.join(','));
  console.log('errors:', errs.length ? errs.slice(0, 3) : 'none');
  await b.close();
})();
