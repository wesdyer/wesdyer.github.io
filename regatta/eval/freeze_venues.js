// FREEZE THE VENUES THE AI IS BENCHMARKED ON, AND CHECK THEM.
//
//   node regatta/eval/freeze_venues.js            re-freeze the benchmark set
//   node regatta/eval/freeze_venues.js --check    do the shipping venues still match?
//   node regatta/eval/freeze_venues.js --add lagoon
//
// Every bench baseline is a set of numbers produced on ONE version of a venue document.
// Edit the shipping venue and the baseline silently becomes incomparable — the bench still
// runs and still prints a number, it just means something else now. This makes that loud.
//
// See regatta/eval/venues/README.md for the policy: promote, keep both, or don't track.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SRC = path.resolve('regatta/assets/venues');
const DST = path.resolve('regatta/eval/venues');
const FP = path.join(DST, 'fingerprint.json');

// The benchmark set, deliberately small — see the README.
const DEFAULT = ['bay', 'arctic', 'seatrials', 'ocean'];

const hash = (buf) => crypto.createHash('sha256').update(buf).digest('hex').slice(0, 16);

const args = process.argv.slice(2);
const CHECK = args.includes('--check');
const addIdx = args.indexOf('--add');
const ADD = addIdx >= 0 ? args[addIdx + 1] : null;

fs.mkdirSync(DST, { recursive: true });
let fp = {};
try { fp = JSON.parse(fs.readFileSync(FP, 'utf8')); } catch (e) {}

const set = ADD ? [ADD] : (Object.keys(fp).length && CHECK ? Object.keys(fp) : DEFAULT);

if (CHECK) {
    if (!Object.keys(fp).length) {
        console.log('No fingerprint file — nothing has been frozen yet. Run without --check.');
        process.exit(1);
    }
    let bad = 0;
    console.log('venue        frozen           shipping         ');
    for (const v of Object.keys(fp)) {
        const shipPath = path.join(SRC, `${v}.venue.js`);
        if (!fs.existsSync(shipPath)) { console.log(`${v.padEnd(12)} ${fp[v].hash}  MISSING`); bad++; continue; }
        const h = hash(fs.readFileSync(shipPath));
        const same = h === fp[v].hash;
        if (!same) bad++;
        console.log(`${v.padEnd(12)} ${fp[v].hash}  ${h}  ${same ? 'match' : '<<< CHANGED'}`);
    }
    console.log('');
    if (bad) {
        console.log(`⚠️  ${bad} venue(s) differ from the frozen benchmark copy.`);
        console.log('   Every stored baseline for those venues was measured on the FROZEN cut.');
        console.log('   Decide explicitly — promote, keep both, or stop tracking. See venues/README.md.');
    } else {
        console.log('All benchmark venues match their frozen copies. Baselines are comparable.');
    }
    process.exitCode = bad ? 1 : 0;
} else {
    for (const v of set) {
        const shipPath = path.join(SRC, `${v}.venue.js`);
        if (!fs.existsSync(shipPath)) { console.log(`skip ${v} — no such venue`); continue; }
        const buf = fs.readFileSync(shipPath);
        fs.writeFileSync(path.join(DST, `${v}.venue.js`), buf);
        const h = hash(buf);
        const was = fp[v] && fp[v].hash;
        fp[v] = { hash: h, frozen: new Date().toISOString().slice(0, 10) };
        console.log(`froze ${v.padEnd(11)} ${h}${was && was !== h ? `   (was ${was} — baselines on that cut are now retired)` : ''}`);
    }
    fs.writeFileSync(FP, JSON.stringify(fp, null, 2) + '\n');
    console.log(`\nwrote ${path.relative(process.cwd(), FP)}`);
}
