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
// ── ADJUDICATED RETIRED STAMPS ──────────────────────────────────────────────
// The stamp is a hash of the WHOLE document, so ANY edit retires every lap — even
// an edit to water the sailor never touches. That is the right default (it is a
// conservative proxy), but it is a proxy, and a blanket ⛔ has already come close
// to throwing away a valid human column once. Where the campaign has ADJUDICATED
// a retired stamp — diffed the docs BY KEY and re-tested the tracks against the
// new geometry — record it here so the next session inherits the ruling instead
// of the alarm. An entry is a claim that the COURSE SHE SAILED did not move.
//
// bay a331fe02:13481 (owner ruling, 2026-08-10): the shipping bay's boundary went
// from a 4-gon to a 12-gon and bay was re-frozen onto it. Only `world` differs —
// course (marks/lines/route), shapes, wind and current are byte-identical — and
// all 16 bay laps lie entirely inside the new arena with 1540-1670u of clearance
// to its edge (0 samples outside). So the RACE COURSE is unchanged and these laps
// remain valid human references. See regatta-corpus-fingerprints / regatta-venuedoc-cut.
// ⚠️ This adjudicates the HUMAN column only. Bay's BOT anchors on that cut ARE
// retired, because the boundary is an input to buildGrid and the goldens moved.
// ⭐ THE PATHS INTAKE (2026-08-30): the owner saved the editor's leg polylines into
// every document as `course.paths` and all ten were re-frozen onto that cut. By-key
// diff (scratchpad keydiff, recorded in ai-campaign.md): `course.paths` is the ONLY
// key that moved — marks, lines, route, wind, current, gusts, shapes, world, props
// byte-identical — and `_pa_paths_eq.js` shows the saved polylines ARE the router's
// (maxΔ 0 u). Nothing he sails against moved, so every lap stamped on the pre-paths
// docs (including the re-cut glowtide/redrock stamps of 2026-08-28) stays a valid
// human reference. Bot anchors on the old cut are retired (0.1 u save-rounding of
// the carrot reshuffles eight venues; re1* → pa*).
const PATHS_WHY = 'course.paths added only — every other key byte-identical (2026-08-30 paths intake)';
const ADJUDICATED = {
    bay: { stamps: ['a331fe02:13481', '915b07e4:1019761'], why: 'boundary-only change, tracks re-verified inside the new arena; ' + PATHS_WHY },
    arctic:    { stamps: ['86fc97f4:97975'],   why: PATHS_WHY },
    glowtide:  { stamps: ['3fbd12b1:514566'],  why: PATHS_WHY },
    lagoon:    { stamps: ['3acc77de:61737'],   why: PATHS_WHY },
    lake:      { stamps: ['84140c1f:1000622'], why: PATHS_WHY },
    ocean:     { stamps: ['1b1a7101:564735'],  why: PATHS_WHY },
    redrock:   { stamps: ['60f2a5ec:63791'],   why: PATHS_WHY },
    river:     { stamps: ['76659ee5:1786811'], why: PATHS_WHY },
    seatrials: { stamps: ['ae1026bc:1595'],    why: PATHS_WHY },
    swamp:     { stamps: ['c351353c:335590'],  why: PATHS_WHY },
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
        const adj = ADJUDICATED[v] && ADJUDICATED[v].stamps.includes(fp) ? ADJUDICATED[v] : null;
        const tag = fp == null ? 'NO STAMP (schema-1)'
            : fp === froz ? 'matches FROZEN  ✓ comparable to benches'
                : fp === ship ? (froz && froz !== ship ? 'matches SHIPPING only  ⚠️ not the benched venue' : 'matches shipping ✓')
                    : adj ? `retired stamp — ✓ ADJUDICATED VALID (${adj.why})`
                        : 'matches NEITHER  ⛔ retired document';
        if (fp !== froz && !(froz === null && fp === ship) && !adj) mismatched++;
        console.log(`   ${(j.finishTime != null ? j.finishTime.toFixed(1) : '   -').padStart(7)}s  ${String(fp).padEnd(18)} ${tag}   ${f}`);
    }
}
console.log(`\n${mismatched} lap(s) are NOT on the benchmark document for their venue.`);
