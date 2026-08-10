// RUN EVERY SUITE, THEN REPORT — the whole point being the word EVERY.
//
//   node regatta/eval/run_all.js            all of them
//   node regatta/eval/run_all.js sail veg   only suites whose name contains one of these
//
// `npm test` used to be twenty-nine commands joined by `&&`, which stops dead at the first
// non-zero exit. That is the right shape for a build (step 2 is meaningless if step 1
// failed) and the wrong shape for a test suite, where every file is independent and the
// only useful output is the FULL list of what is broken.
//
// What it cost, measured the day this was written: `test_sailable.js` carries five known
// clearance failures on Pearl Lagoon and Sockeye Run. Because it sits tenth, the nineteen
// suites after it had not run in any full-suite invocation for as long as those failures
// had existed — and `npm test` reported "FAIL — 5 failure(s)", which reads like a total
// and was actually a first. Hiding in that gap: test_persistence.js, which had been
// crashing outright since the August 2026 camera cleanup removed the option it selected,
// and which is the suite that exists to catch settings being lost.
//
// So: run all of them, always. The exit code is still non-zero if anything failed, so this
// is no softer than the chain was — it just tells the truth about how much is broken
// instead of stopping at the first sign that something is.
const { spawn } = require('child_process');
const path = require('path');

const SUITES = [
    'test_arena.js', 'test_venuedoc.js', 'test_shoal.js', 'test_course_model.js',
    'test_route.js', 'test_gates.js', 'test_marks.js', 'test_wind.js', 'test_gusts.js',
    'test_sailable.js', 'test_start_crossing.js',
    'test_rounding_nibble.js bay', 'test_rounding_nibble.js redrock',
    'test_editor.js', 'test_controls.js', 'test_clipboard.js', 'test_props.js', 'test_fit.js', 'test_start_line.js',
    'test_character_swap.js', 'test_results.js', 'test_persistence.js', 'test_render.js',
    'test_boundary_race.js', 'test_livery.js', 'test_audio.js', 'test_contact.js',
    'test_dmc.js', 'test_rounding.js', 'test_apparent.js', 'check_venues.js'
];

const filters = process.argv.slice(2);
const chosen = filters.length
    ? SUITES.filter(s => filters.some(f => s.includes(f)))
    : SUITES;

// Every suite is spawned from the REPO ROOT, because that is the directory they resolve
// their `file://` paths against (`path.resolve('regatta/index.html')`). Running one from
// inside regatta/ gives ERR_FILE_NOT_FOUND on a path with the folder doubled, which reads
// like a broken test and is a broken working directory.
const ROOT = path.resolve(__dirname, '..', '..');

// Tee rather than inherit: the output still streams live, and it is also kept so the
// summary can quote each suite's own verdict line instead of inventing one.
function run(spec) {
    return new Promise((resolve) => {
        const [file, ...args] = spec.split(/\s+/);
        const started = Date.now();
        const child = spawn(process.execPath, [path.join('regatta', 'eval', file), ...args],
                            { cwd: ROOT, stdio: ['inherit', 'pipe', 'pipe'] });
        let out = '';
        const tee = (stream) => (chunk) => { const s = chunk.toString(); out += s; stream.write(s); };
        child.stdout.on('data', tee(process.stdout));
        child.stderr.on('data', tee(process.stderr));
        child.on('close', (code) => resolve({ spec, code, out, secs: (Date.now() - started) / 1000 }));
        child.on('error', (e) => resolve({ spec, code: -1, out: String(e), secs: 0 }));
    });
}

(async () => {
    const results = [];
    for (const spec of chosen) {
        console.log(`\n\x1b[1m━━ ${spec} ━━\x1b[0m`);
        results.push(await run(spec));
    }

    // A suite's own last PASS/FAIL line is its verdict. A non-zero exit with no such line
    // at all is a CRASH — the case that matters most here, because it is what an
    // unhandled rejection looks like and it is exactly what went unnoticed before.
    const verdictOf = (r) => {
        const lines = r.out.split('\n').filter(l => /^\s*(PASS|FAIL|All )/.test(l));
        const last = lines.length ? lines[lines.length - 1].trim() : null;
        if (last) return { state: /^FAIL/.test(last) ? 'FAIL' : 'pass', detail: last };
        return { state: r.code === 0 ? 'pass' : 'CRASH', detail: r.code === 0 ? 'no verdict line, exit 0' : `exited ${r.code}, no verdict line` };
    };

    console.log(`\n\x1b[1m━━ summary ━━\x1b[0m`);
    let broken = 0;
    const w = Math.max(...chosen.map(s => s.length));
    for (const r of results) {
        const v = verdictOf(r);
        const ok = v.state === 'pass' && r.code === 0;
        if (!ok) broken++;
        const tag = ok ? '\x1b[32mpass \x1b[0m' : v.state === 'CRASH' ? '\x1b[35mCRASH\x1b[0m' : '\x1b[31mFAIL \x1b[0m';
        console.log(`  ${tag} ${r.spec.padEnd(w)}  ${r.secs.toFixed(0).padStart(3)}s  ${v.detail}`);
    }
    const total = results.length;
    console.log(broken
        ? `\n\x1b[31m${broken} of ${total} suite(s) not passing.\x1b[0m Every suite ran; nothing was skipped.`
        : `\n\x1b[32mAll ${total} suites pass.\x1b[0m`);
    process.exitCode = broken ? 1 : 0;
})();
