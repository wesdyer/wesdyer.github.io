// RATE RUN — one shard of the character re-rating campaign, August 2026.
//
//   node regatta/eval/rate_run.js --venue redrock --trials 700 --seed 100000 \
//        --out regatta/eval/rating/redrock-100000.jsonl
//
// Writes JSONL: one header object, then ONE LINE PER RACE. Shards are additive —
// run many concurrently with non-overlapping seed bases and concatenate.
//
// WHY ROWS AND NOT SUMS. tier_eval.js stores aggregates (sumDelta, sumSqDelta, ...),
// which answer exactly one question: what is each character's mean fleet delta. This
// campaign was commissioned to answer five — the total order, whether the venues even
// agree enough for one order to be honest, the price of all ten stats, an audit of
// every character's `beat` line, and outlier flags. Four of those need to know WHO
// RACED WHOM, which a sum has thrown away. At 6,667 races x 9 boats x ~40 bytes a
// venue's rows cost about 2.5MB. The races cost four days. Keep the rows.
//
// ⚠️ NOTHING HERE CHANGES THE AI. Owner constraint: the sailing code and the venue
// documents are frozen in another repository. See rate_harness.js for the four
// observational changes and the argument that none of them can move a finisher's time.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ARGS = process.argv.slice(2);
const argOf = (flag, dflt) => {
    const i = ARGS.indexOf(flag);
    return i >= 0 ? ARGS[i + 1] : dflt;
};

const VENUE   = argOf('--venue', 'seatrials');
const TRIALS  = parseInt(argOf('--trials', '100'), 10);
const SEED    = parseInt(argOf('--seed', '1000'), 10);
const OUT     = argOf('--out', `regatta/eval/rating/${VENUE}-${SEED}.jsonl`);
const CUTMUL  = parseFloat(argOf('--cutoff-mul', '2'));
const LIMIT   = parseInt(argOf('--limit', '1500'), 10);   // hard sim ceiling, seconds
const QUIET   = ARGS.includes('--quiet');

// Trials accumulate state in the page and it degrades — tier_eval.js learned this the
// expensive way (shards that once ran 200 deep started dying around 50 once the venue
// and gust work landed). Recycle the browser on a fixed count instead of tuning against
// a moving ceiling. The RNG is re-seeded per trial, so a fresh page is numerically
// identical to a tired one.
const RECYCLE = 25;

(async () => {
    const { chromium } = require('playwright');

    // Stamp the shard with the hash of the venue file it actually ran against. The
    // frozen benchmark set is NOT updated (owner constraint — those cuts are frozen
    // elsewhere), so attribution lives in the shard rather than in eval/venues.
    const venuePath = path.resolve(`regatta/assets/venues/${VENUE}.venue.js`);
    const venueHash = crypto.createHash('sha256')
        .update(fs.readFileSync(venuePath)).digest('hex').slice(0, 16);

    // Roster hash too: if script.js gains or loses a character mid-campaign, shards from
    // either side of that are not the same experiment and the merge must refuse them.
    const scriptSrc = fs.readFileSync(path.resolve('regatta/js/script.js'), 'utf8');
    const rosterBlock = scriptSrc.match(/const AI_CONFIG = \[[\s\S]*?\n\];/);
    const roster = eval(rosterBlock[0].replace('const AI_CONFIG =', ''));
    const rosterHash = crypto.createHash('sha256')
        .update(roster.map(c => c.name + JSON.stringify(c.stats) + c.archetype).join('|'))
        .digest('hex').slice(0, 16);

    // AND THE SAILING CODE ITSELF. rosterHash covers who is racing and with what stats;
    // it says nothing about HOW they sail. A change to the AI mid-campaign — a merge
    // from the branch this work is frozen against, say — would leave every hash in
    // every shard identical while silently splitting the campaign into two experiments.
    // Half the venues rated against one AI and half against another does not average
    // into a fleet ranking, and worse, it would show up in the venue-agreement number
    // as venue specialisation, which is the one result the campaign exists to produce.
    // Hash the files that decide how a boat sails, and refuse a mismatched merge.
    const AI_FILES = ['js/script.js', 'js/rules.js', 'js/planner.js', 'js/traffic.js',
                      'js/venuedoc.js', 'js/swell.js', 'js/water.js'];
    const aiHash = crypto.createHash('sha256');
    for (const f of AI_FILES) {
        const p = path.resolve('regatta', f);
        aiHash.update(f).update(fs.existsSync(p) ? fs.readFileSync(p) : Buffer.from('absent'));
    }
    const codeHash = aiHash.digest('hex').slice(0, 16);

    // WRITE TO .part AND RENAME ON SUCCESS. A shard file that exists is therefore a
    // shard that finished, which is what makes the campaign safely resumable. Learned
    // the hard way: killing a campaign left six workers alive, and because they wrote
    // their output in place under the same names the next campaign chose, two runs with
    // two different row formats were appending to one file. Nothing errored. The merge
    // would simply have been wrong.
    fs.mkdirSync(path.dirname(path.resolve(OUT)), { recursive: true });
    const PART = path.resolve(OUT) + '.part';
    const out = fs.createWriteStream(PART, { flags: 'w' });
    out.write(JSON.stringify({
        kind: 'header', venue: VENUE, venueHash, rosterHash, codeHash, roster: roster.length,
        trials: TRIALS, seedBase: SEED, cutoffMul: CUTMUL, limit: LIMIT,
        harness: 'rate_harness.js',
        // Row layout, written down so a reader six months from now does not have to
        // reverse-engineer nine positional fields from the code that wrote them.
        cols: ['name', 'finishTime', 'place', 'points', 'status', 'penalties',
               'lateForShippedCutoff', 'leg', 'legSplits', 'maneuversPerLeg']
    }) + '\n');

    let browser = null, page = null;
    const openPage = async () => {
        if (browser) { try { await browser.close(); } catch (e) {} }
        browser = await chromium.launch();
        page = await browser.newPage();
        await page.goto('file://' + path.resolve('regatta/index.html'));
        await page.evaluate(v => localStorage.setItem('regatta_settings',
            JSON.stringify({ venue: v })), VENUE);
        await page.addScriptTag({ content: fs.readFileSync('regatta/eval/rate_harness.js', 'utf8') });
    };
    await openPage();

    // (4) in rate_harness: hold a DIFFERENT character out of each race. script.js builds
    // the fleet as "everyone except the character you are sailing as", and the eval has
    // always sailed as the default, so one name has been silently absent from every
    // measurement ever taken. Rotating spreads that hole evenly across the roster.
    const names = roster.map(c => c.name);

    const t0 = Date.now();
    let done = 0, failed = 0;

    for (let i = 0; i < TRIALS; i++) {
        const seed = SEED + i;
        if (i > 0 && i % RECYCLE === 0) await openPage();
        const heldOut = names[i % names.length];

        let r;
        try {
            r = await page.evaluate(({ seed, limit, mul, ch }) =>
                window.rateHarness.runTrial(seed, limit, { cutoffMul: mul, character: ch }),
                { seed, limit: LIMIT, mul: CUTMUL, ch: heldOut });
        } catch (e) {
            // A dead page loses this race, not the shard.
            if (!QUIET) process.stdout.write(`[${VENUE}/${SEED}] page died at ${i}, reopening\n`);
            try {
                await openPage();
                r = await page.evaluate(({ seed, limit, mul, ch }) =>
                    window.rateHarness.runTrial(seed, limit, { cutoffMul: mul, character: ch }),
                    { seed, limit: LIMIT, mul: CUTMUL, ch: heldOut });
            } catch (e2) { failed++; continue; }
        }

        // Compact the row: names are the bulk of it, times to 2dp are plenty against a
        // ~1.4s standard error, and null fields are dropped.
        // `marks` is a course constant, so it rides on the first row only rather than
        // repeating 6,667 times; `wd` (wind direction) does vary per race via dirVar.
        out.write(JSON.stringify({
            s: r.seed,
            rt: Math.round(r.raceTime * 10) / 10,
            tl: r.totalLegs,
            wd: r.windDir == null ? null : Math.round(r.windDir * 1000) / 1000,
            ...(done === 0 ? { marks: r.marks } : {}),
            w: r.windMean == null ? null : Math.round(r.windMean * 100) / 100,
            wlo: r.windMin == null ? null : Math.round(r.windMin * 100) / 100,
            whi: r.windMax == null ? null : Math.round(r.windMax * 100) / 100,
            co: Math.round(r.cutoff),
            ho: r.heldOut,
            b: r.boats.map(b => [
                b.name,
                b.t == null ? null : Math.round(b.t * 100) / 100,
                b.place, b.pts, b.status, b.pen, b.lateForShipped ? 1 : 0, b.leg,
                b.legs, b.man
            ])
        }) + '\n');
        done++;

        if (!QUIET && (i + 1) % 25 === 0) {
            const rate = (Date.now() - t0) / (i + 1) / 1000;
            const eta = Math.round(rate * (TRIALS - i - 1) / 60);
            process.stdout.write(
                `[${VENUE}/${SEED}] ${i + 1}/${TRIALS}  ${rate.toFixed(1)}s/race  ETA ${eta}m\n`);
        }
    }

    await browser.close();
    // Re-hash the venue on the way out. A shard that raced two different versions of a
    // course is not a measurement of either, and the owner edits venues live.
    const after = crypto.createHash('sha256')
        .update(fs.readFileSync(venuePath)).digest('hex').slice(0, 16);
    out.write(JSON.stringify({
        kind: 'footer', done, failed, venueHashAfter: after,
        venueStable: after === venueHash,
        secs: Math.round((Date.now() - t0) / 1000)
    }) + '\n');
    await new Promise(res => out.end(res));
    fs.renameSync(PART, path.resolve(OUT));

    const mins = ((Date.now() - t0) / 60000).toFixed(1);
    console.log(`[${VENUE}/${SEED}] wrote ${done} races (${failed} lost) in ${mins}m -> ${OUT}` +
                (after === venueHash ? '' : '  ⚠️  VENUE FILE CHANGED MID-SHARD — DISCARD'));
})();
