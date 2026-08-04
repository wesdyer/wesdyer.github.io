// One-shot: rewrite venue documents on disk in the current reference form.
//
//   node regatta/eval/_migrate_docs.js [--write]
//
// Runs the REAL VenueDoc.migrate against each document rather than a second copy of
// the rules, so "the file on disk" and "what the game loads" cannot drift. Without
// --write it only reports what would change.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const WRITE = process.argv.includes('--write');
const DIR = 'regatta/assets/venues';

// Minimal browser shim: venuedoc.js is an IIFE that assigns window.VenueDoc, and
// migrate() needs nothing else from the page.
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync('regatta/js/venuedoc.js', 'utf8'), sandbox);
const VenueDoc = sandbox.window.VenueDoc;

let changed = 0;
for (const f of fs.readdirSync(DIR).filter(x => x.endsWith('.venue.js'))) {
    const file = path.join(DIR, f);
    const text = fs.readFileSync(file, 'utf8');
    const box = { window: { VENUE_DOC: {} } };
    vm.createContext(box);
    vm.runInContext(text, box);
    const keys = Object.keys(box.window.VENUE_DOC);

    for (const key of keys) {
        const before = JSON.stringify(box.window.VENUE_DOC[key]);
        const doc = VenueDoc.migrate(box.window.VENUE_DOC[key]);
        const after = JSON.stringify(doc);
        if (before === after) { console.log(`${f} [${key}]: already current`); continue; }
        changed++;
        const c = doc.course;
        console.log(`${f} [${key}]: ${c.lines.length} line(s), ${c.route.length} route entries, `
                  + `legs derived as ${c.route.length - 1}`);
        if (!WRITE) continue;
        // Keep the header comment: it says where the geometry came from and that the
        // document is authored from here on.
        const head = text.slice(0, text.indexOf('window.VENUE_DOC'));
        const out = head
            + 'window.VENUE_DOC = window.VENUE_DOC || {};\n'
            + `window.VENUE_DOC[${JSON.stringify(key)}] = ${JSON.stringify(doc, null, 2)};\n`;
        fs.writeFileSync(file, out);
        console.log(`  written (${(out.length / 1024).toFixed(1)} KB)`);
    }
}
console.log(WRITE ? `\n${changed} document(s) rewritten.` : `\n${changed} document(s) would change — pass --write.`);
