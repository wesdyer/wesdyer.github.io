// Venue TARGET TIMES and the TIME LIMIT, written into every venue document.
//
//   node regatta/eval/set_venue_targets.js [trajDir] [--write]
//
// Wes, Sep 25 2026:
//   · the target (the Target-time objective, `records.provisional`) is the MEAN of his
//     recorded trajectories at that venue × 1.1, rounded UP to the next 5 seconds;
//   · the time limit (`course.cutoff`) is 10 minutes on every course.
//
// ⚠️ A TRAJECTORY ONLY COUNTS IF IT WAS SAILED ON TODAY'S COURSE. Courses are rebuilt, and a
// mean from an older course sets a target for a race that no longer exists (the Aug Bayou runs
// average 203 s against a course whose path best is now 70 s). Nothing in a trajectory names
// the course version, so two checks stand in: the leg count must match the document's route,
// and the mean must sit between 0.95× and 1.45× the course's own path-best estimate (human
// times run ~1.15–1.25× it). A venue that fails either keeps no target — its objective reads
// "target coming" rather than handing out a character for a lap of a course that is gone —
// and the report says why. Re-run after recording new trajectories.
//
// Writes in the editor's own save format (header + JSON.stringify(doc, null, 2)) so a run
// that changes nothing leaves the file byte-identical. Neither field changes the saved course
// paths; the cutoff IS part of recordsHash, so the first change to it resets that venue's
// record book once (by design: the limit is part of the physical race).
//
// ⚠️ Wes edits venues live in editor.html. After a --write, reload any open editor tab before
// saving from it, or the editor's in-memory copy overwrites these fields.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const args = process.argv.slice(2);
const WRITE = args.includes('--write');
const TRAJ = args.find(a => !a.startsWith('--')) || 'regatta/eval/rl/traj';
const DIR = 'regatta/assets/venues';
const VENUES = ['bay', 'lake', 'lagoon', 'swamp', 'river', 'ocean', 'redrock', 'glowtide', 'arctic',
                'otter', 'flats', 'volcanic', 'seatrials'];
const CUTOFF = 600;
const FACTOR = 1.1, STEP = 5;
const RATIO_MIN = 0.95, RATIO_MAX = 1.45;

// The course's path-best estimate needs the whole game (polar, planner, saved paths), so it
// is read from the real page, headless, the way the editor's "best time" is.
async function estimates() {
    const { chromium } = require('playwright');
    const b = await chromium.launch();
    const p = await b.newPage();
    await p.goto('file://' + path.resolve('regatta/index.html'));
    await p.waitForFunction(() => window.VenueDoc && typeof VENUE_ORDER !== 'undefined');
    const out = await p.evaluate((keys) => {
        const r = {};
        for (const k of keys) { try { r[k] = VenueDoc.compile(VenueDoc.get(k)).estSecs || 0; } catch (e) { r[k] = 0; } }
        return r;
    }, VENUES);
    await b.close();
    return out;
}

// Mean finish time per venue from the trajectory files.
const runs = {};
for (const f of fs.readdirSync(TRAJ).filter(x => x.endsWith('.json'))) {
    const d = JSON.parse(fs.readFileSync(path.join(TRAJ, f), 'utf8'));
    if (!d.finished || !(d.finishTime > 0)) continue;
    (runs[d.venue] = runs[d.venue] || []).push({ t: d.finishTime, legs: d.legs });
}

const HEAD = '// GENERATED ONCE by art/export_venue_doc.js — now the SOURCE OF TRUTH.\n'
    + '// Emitted as JS, not JSON: the eval harness loads over file://, where fetch is blocked.\n'
    + '// Edited in editor.html.\n'
    + 'window.VENUE_DOC = window.VENUE_DOC || {};\n';

const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
(async () => {
const EST = await estimates();
let changed = 0;
for (const key of VENUES) {
    const file = path.join(DIR, `${key}.venue.js`);
    const text = fs.readFileSync(file, 'utf8');
    const box = { window: { VENUE_DOC: {} } };
    vm.createContext(box);
    vm.runInContext(text, box);
    const doc = box.window.VENUE_DOC[key];
    const legs = (doc.course.route || []).length - 1;
    const est = EST[key] || 0;

    const all = runs[key] || [];
    const match = all.filter(r => r.legs === legs);
    const mean = match.length ? match.reduce((a, r) => a + r.t, 0) / match.length : 0;
    const ratio = est > 0 && mean > 0 ? mean / est : 0;
    let target = null, why;
    if (!all.length) why = 'no trajectories';
    else if (!match.length) why = `trajectories are ${[...new Set(all.map(r => r.legs))].join('/')}-leg, the course is ${legs}-leg`;
    else if (!(est > 0)) why = 'no course estimate to check against';
    else if (ratio < RATIO_MIN || ratio > RATIO_MAX) why = `mean ${mmss(mean)} is ${ratio.toFixed(2)}× the path best ${mmss(est)} — an older course`;
    else { target = Math.ceil(mean * FACTOR / STEP) * STEP; why = `${match.length} runs, mean ${mean.toFixed(1)}s (${ratio.toFixed(2)}× path best)`; }

    const before = JSON.stringify(doc);
    doc.course.cutoff = CUTOFF;
    doc.records = doc.records || {};
    if (target != null) doc.records.provisional = target;
    else delete doc.records.provisional;
    if (!Object.keys(doc.records).length) delete doc.records;
    const dirty = JSON.stringify(doc) !== before;
    console.log(`${key.padEnd(10)} ${target != null ? 'target ' + mmss(target) : 'no target  '}  ${why}${dirty ? '' : '  (unchanged)'}`);
    if (!dirty) continue;
    changed++;
    if (WRITE) fs.writeFileSync(file, HEAD + `window.VENUE_DOC[${JSON.stringify(key)}] = ${JSON.stringify(doc, null, 2)};\n`);
}
console.log(WRITE ? `\n${changed} document(s) written.` : `\n${changed} document(s) would change — pass --write.`);
})();
