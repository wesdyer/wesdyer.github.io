// WHICH HUMAN LAPS ARE ACTUALLY COMPARABLE TO THE BENCHES? (2026-08-08 night)
// Every human reference in the campaign table is a number measured on ONE version of
// a venue document. `freeze_venues --check` guards the BENCH side of that (its
// fingerprint is a sha256 of the venue FILE); the recordings stamp their own, a djb2
// hash of the venue DOC as JSON (script.js ~12901). The two schemes never met, so a
// lap recorded on a since-edited course could sit in the table as the reference for a
// bench run on the frozen one — which is exactly what the river turned out to be.
//
// This prints, per venue: the fingerprint of the FROZEN benchmark document, of the
// SHIPPING document, and of every lap in the corpus, and says which each lap matches.
//   node _traj_fp.js [venue ...]
const fs = require('fs'); const path = require('path'); const vm = require('vm');
const ROOT = path.resolve(__dirname, '../../..');
const djb = (str) => { let h = 5381; for (let i = 0; i < str.length; i++) h = ((h * 33) ^ str.charCodeAt(i)) >>> 0; return h.toString(16) + ':' + str.length; };
// The venue files are browser scripts that assign into window.VENUE_DOC; run each in
// a bare context and read the doc back out, so the hash is of exactly what the game
// would have hashed at record time.
const docFp = (p, v) => {
    if (!fs.existsSync(p)) return null;
    const sandbox = { window: { VENUE_DOC: {} } };
    vm.createContext(sandbox);
    try { vm.runInContext(fs.readFileSync(p, 'utf8'), sandbox); } catch (e) { return 'ERR ' + e.message.slice(0, 40); }
    const doc = sandbox.window.VENUE_DOC && sandbox.window.VENUE_DOC[v];
    return doc ? djb(JSON.stringify(doc)) : null;
};
const TD = path.join(__dirname, 'traj');
const byVenue = {};
for (const f of fs.readdirSync(TD).filter(f => f.startsWith('traj_'))) {
    const v = f.slice(5, f.lastIndexOf('_'));
    (byVenue[v] = byVenue[v] || []).push(f);
}
const want = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(byVenue).sort();
let mismatched = 0;
for (const v of want) {
    const froz = docFp(path.join(ROOT, 'regatta/eval/venues', v + '.venue.js'), v);
    const ship = docFp(path.join(ROOT, 'regatta/assets/venues', v + '.venue.js'), v);
    console.log(`\n${v.toUpperCase()}   frozen ${froz || '(not frozen)'}   shipping ${ship}`);
    for (const f of (byVenue[v] || []).sort()) {
        const j = JSON.parse(fs.readFileSync(path.join(TD, f), 'utf8'));
        const fp = j.venueFingerprint;
        const tag = fp == null ? 'NO STAMP (schema-1)'
            : fp === froz ? 'matches FROZEN  ✓ comparable to benches'
                : fp === ship ? (froz && froz !== ship ? 'matches SHIPPING only  ⚠️ not the benched venue' : 'matches shipping ✓')
                    : 'matches NEITHER  ⛔ retired document';
        if (fp !== froz && !(froz === null && fp === ship)) mismatched++;
        console.log(`   ${(j.finishTime != null ? j.finishTime.toFixed(1) : '   -').padStart(7)}s  ${String(fp).padEnd(18)} ${tag}   ${f}`);
    }
}
console.log(`\n${mismatched} lap(s) are NOT on the benchmark document for their venue.`);
