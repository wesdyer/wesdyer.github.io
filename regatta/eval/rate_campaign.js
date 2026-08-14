// RATE CAMPAIGN — the driver. Splits each venue into shards, runs W at a time,
// resumes anything already finished.
//
//   node regatta/eval/rate_campaign.js --venues seatrials,ocean --per-char 600 --workers 6
//   node regatta/eval/rate_campaign.js --status
//
// RESUMABLE BY DESIGN. This run is measured in days, the machine belongs to someone
// who uses it, and the owner edits venue files live. Any of those can end a shard.
// A shard is complete iff its file ends with a footer line saying so, and complete
// shards are skipped on the next invocation — so the recovery procedure for anything
// that goes wrong is "run the same command again".
//
// SEEDS NEVER OVERLAP. Every shard's seed range is a pure function of (venue index,
// shard index), so the same race is never counted twice no matter how many times the
// campaign is resumed, interrupted, or re-sharded. This is the failure mode
// eval/venues/README.md describes as the worst one a harness can have: the run still
// completes, still prints a number, and the number is wrong.

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const ARGS = process.argv.slice(2);
const argOf = (f, d) => { const i = ARGS.indexOf(f); return i >= 0 ? ARGS[i + 1] : d; };

const ALL_VENUES = ['seatrials', 'ocean', 'lake', 'lagoon', 'redrock', 'river',
                    'arctic', 'bay', 'swamp', 'glowtide'];

// PER-VENUE CUTOFF MULTIPLIER — owner's call, 2026-08-13, made on measurement.
//
// The rule is "double the cutoff so the laggards come in; if they still don't finish,
// score them last with DNF = 0". Measured on 3-6 races per venue, doubling splits the
// ten cleanly into three groups:
//
//   FIVE VENUES where nothing changes: seatrials, ocean, lake, lagoon, bay are 0% DNF
//     either way.
//   THREE VENUES where it is a large win at ZERO cost: redrock 33% -> 0%, glowtide
//     39% -> 0%, arctic 11% -> 0%. Free because the loop exits when the last AI is
//     home, and none of them reach the raised ceiling — redrock stops at 450s of a
//     possible 720s. Not doubling here would discard a third of the fleet at three
//     venues and save nothing at all.
//   TWO VENUES that stay pinned at the ceiling, which is where the entire cost of
//     doubling lives:
//       swamp  74% -> 15%. The biggest data-quality gain in the campaign: at the
//              shipped cutoff three quarters of the fleet share ONE identical fake
//              finish time and the fit has nearly nothing to separate them. Doubled.
//       river  17% -> 17%, so DOUBLING RECOVERS NOTHING while costing 2x. Measured
//              over 54 boat-slots the distribution is bimodal with an empty middle:
//              45 boats finish (fastest 214s, slowest 344s) and 9 never finish at all,
//              ALL NINE STUCK ON LEG 3 OF 3 after 720s — longer than the winning race
//              took. They are not slow, and no cutoff reaches them. Doubling would buy
//              360 extra seconds of simulation into a gap with nothing in it.
//              Set to 1.25x (450s) rather than 1x: the 344s slowest finisher comes from
//              only 45 boats, so across 6,667 races the real tail will push past the
//              shipped 360s somewhat. 450s covers 106s beyond anything observed and
//              costs +25% instead of +100%. Owner's call, 2026-08-13.
const CUTOFF_MUL = { river: 1.25 };
const DEFAULT_MUL = 2;
const mulFor = (v) => CUTOFF_MUL[v] != null ? CUTOFF_MUL[v] : DEFAULT_MUL;

// ALL_VENUES is the CANONICAL index list and must never be reordered — the seed base is
// `1000000 + ALL_VENUES.indexOf(venue) * 100000 + shard * 1000`, so shuffling it would
// silently re-point every seed range and make a resumed campaign race different water
// under the same filenames. Run order is a separate thing.
//
// Swamp runs LAST (owner, 2026-08-13). It is the most expensive venue in the campaign
// at ~387s/race and the least certain — a one-leg course in 4kn where 15% of the fleet
// does not finish even at the doubled cutoff. Everything else being complete before it
// starts means the other nine rankings exist no matter what happens to swamp, and the
// decision to cut it short stays available for as long as possible.
const RUN_ORDER = ['seatrials', 'ocean', 'lake', 'lagoon', 'redrock', 'river',
                   'arctic', 'bay', 'glowtide', 'swamp'];

const VENUES  = argOf('--venues', RUN_ORDER.join(',')).split(',').filter(Boolean);
const PERCHAR = parseInt(argOf('--per-char', '600'), 10);
const WORKERS = parseInt(argOf('--workers', '6'), 10);
const DIR     = argOf('--dir', 'regatta/eval/rating');
const STATUS  = ARGS.includes('--status');

// The shard size is part of the filename, so --status has to agree with the run that
// produced the files or it looks in the wrong place. It defaulted to 250 while the
// campaign runs at 100, and the mismatch did not error — it printed a confident
// "0/270 shards, 0 races total" over a directory that was filling up nicely. So when
// no --shard is given, infer it from what is actually on disk.
let SHARD = ARGS.includes('--shard') ? parseInt(argOf('--shard', '250'), 10) : null;
if (SHARD == null) {
    const sizes = {};
    try {
        for (const f of fs.readdirSync(DIR)) {
            const m = f.match(/-n(\d+)\.jsonl$/);
            if (m) sizes[m[1]] = (sizes[m[1]] || 0) + 1;
        }
    } catch (e) {}
    const best = Object.entries(sizes).sort((a, b) => b[1] - a[1])[0];
    SHARD = best ? +best[0] : 100;
    if (best && STATUS) console.log(`(shard size ${SHARD}, inferred from ${best[1]} file(s) on disk)\n`);
}

// 100 characters, 9 race at a time, so a character appears in 9/100 of races.
const ROSTER = 100, FLEET = 9;
const trialsFor = (perChar) => Math.ceil(perChar * ROSTER / FLEET);

const shardsFor = (venue) => {
    const total = trialsFor(PERCHAR);
    const v = ALL_VENUES.indexOf(venue);
    if (v < 0) throw new Error(`unknown venue ${venue}`);
    const out = [];
    for (let k = 0, done = 0; done < total; k++) {
        const n = Math.min(SHARD, total - done);
        out.push({
            venue, k, trials: n, mul: mulFor(venue),
            seed: 1000000 + v * 100000 + k * 1000,
            // The shard size is IN THE NAME. Two campaigns run at different --shard
            // sizes produce different seed ranges under the same index, so sharing a
            // filename between them silently merges two different experiments.
            file: path.join(DIR, `${venue}-${String(k).padStart(3, '0')}-n${SHARD}.jsonl`)
        });
        done += n;
    }
    return out;
};

// Complete = the footer line is present AND says the venue file did not change under
// it. A shard that raced two versions of a course is a measurement of neither.
const inspect = (file) => {
    if (!fs.existsSync(file)) return { state: 'missing' };
    let txt;
    try { txt = fs.readFileSync(file, 'utf8'); } catch (e) { return { state: 'unreadable' }; }
    const lines = txt.trim().split('\n');
    let footer = null;
    try { footer = JSON.parse(lines[lines.length - 1]); } catch (e) {}
    if (!footer || footer.kind !== 'footer') return { state: 'partial', races: Math.max(0, lines.length - 1) };
    if (!footer.venueStable) return { state: 'tainted', races: footer.done };
    return { state: 'done', races: footer.done, secs: footer.secs };
};

const jobs = VENUES.flatMap(shardsFor);

if (STATUS) {
    let totDone = 0, totRaces = 0;
    for (const v of VENUES) {
        const js = jobs.filter(j => j.venue === v);
        const st = js.map(j => inspect(j.file));
        const done = st.filter(s => s.state === 'done');
        const races = st.reduce((a, s) => a + (s.races || 0), 0);
        const secs = done.reduce((a, s) => a + (s.secs || 0), 0);
        totDone += done.length; totRaces += races;
        const bad = st.filter(s => s.state === 'tainted').length;
        console.log(`${v.padEnd(10)} ${String(done.length).padStart(3)}/${js.length} shards  ` +
            `${String(races).padStart(6)} races  ${(races / ROSTER * FLEET).toFixed(0).padStart(4)}/char  ` +
            (done.length ? `${(secs / races).toFixed(1)}s/race` : '—') +
            (bad ? `   ⚠️ ${bad} TAINTED` : ''));
    }
    console.log(`\n${totDone}/${jobs.length} shards, ${totRaces} races total`);
    process.exit(0);
}

const pending = jobs.filter(j => {
    const s = inspect(j.file);
    if (s.state === 'done') return false;
    if (s.state === 'tainted') console.log(`re-racing tainted shard ${j.file}`);
    return true;
});

console.log(`${VENUES.length} venue(s), ${PERCHAR}/char = ${trialsFor(PERCHAR)} races each`);
console.log(`order: ${VENUES.join(' -> ')}`);
console.log(`cutoff: x${DEFAULT_MUL} everywhere except ${Object.entries(CUTOFF_MUL).map(([k,v])=>`${k} x${v}`).join(', ')}`);
console.log(`${jobs.length} shards, ${jobs.length - pending.length} already complete, ` +
            `${pending.length} to run on ${WORKERS} workers\n`);

const ROOT = path.resolve(__dirname, '..', '..');
let next = 0, running = 0, finished = 0;
const t0 = Date.now();

function pump() {
    while (running < WORKERS && next < pending.length) {
        const j = pending[next++];
        running++;
        const child = spawn(process.execPath, [
            path.join('regatta', 'eval', 'rate_run.js'),
            '--venue', j.venue, '--trials', String(j.trials),
            '--seed', String(j.seed), '--out', j.file, '--quiet',
            '--cutoff-mul', String(j.mul)
        ], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
        let buf = '';
        child.stdout.on('data', d => { buf += d; });
        child.stderr.on('data', d => { buf += d; });
        child.on('close', () => {
            running--; finished++;
            const el = (Date.now() - t0) / 1000;
            const eta = finished ? Math.round(el / finished * (pending.length - finished) / 60) : 0;
            const s = inspect(j.file);
            const tag = s.state === 'done' ? 'ok  ' : s.state === 'tainted' ? 'TAINT' : 'PART';
            console.log(`[${tag}] ${finished}/${pending.length}  ${j.venue}-${j.k}  ` +
                        `${s.races || 0} races  ${Math.round(el / 60)}m elapsed, ETA ${eta}m`);
            if (buf.includes('CHANGED')) console.log('   ' + buf.trim().split('\n').pop());
            pump();
        });
    }
    if (running === 0 && next >= pending.length) {
        console.log(`\ncampaign segment done in ${((Date.now() - t0) / 3600000).toFixed(2)}h`);
    }
}
pump();
