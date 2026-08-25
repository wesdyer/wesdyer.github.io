// THE FIVE PAGES CARRY THE SAME GAME — checked, not remembered.
//
// There is no bundler and no directory listing over file://, so the set of game
// scripts is stated by hand in five HTML pages (index, rules, scenario, editor,
// competitor). Since the 2026-08-24 split that set is 21 files, and the failure
// mode is silent: a file added to four pages out of five leaves the fifth
// running yesterday's game (or, with load-order deps, throwing at load).
// rules.html and scenario.html are explicitly copies of index.html's block —
// their own comments say "regenerate from index.html when the game shell
// changes" — and this suite is what makes forgetting that loud.
//
// Checks (pure text, no browser):
//   1. Every js file on disk under js/{game,sim,ai,render,ui}/ plus js/script.js
//      appears in EVERY page, in the SAME order everywhere, as one contiguous
//      block ending with js/script.js.
//   2. venuedoc.js precedes the game block wherever it appears (sim/wind.js
//      reads window.VenueDoc.U_PER_M at TOP LEVEL — competitor.html:64 records
//      what happens otherwise).
//   3. No page lists any script twice.
//   4. index.html and rules.html agree on their FULL script list up to
//      rules.html's viewer extras (rule_scenarios.js, rules_viewer.js).
//
// Usage: node regatta/eval/test_pages.js   (from the repo root, like every suite)
const fs = require('fs');
const path = require('path');

const R = (p) => path.resolve('regatta', p);
const PAGES = ['index.html', 'rules.html', 'scenario.html', 'editor.html', 'competitor.html'];

// The canonical game set: what exists on disk.
const GAME_DIRS = ['js/game', 'js/sim', 'js/ai', 'js/render', 'js/ui'];
const onDisk = [];
for (const d of GAME_DIRS) {
    for (const f of fs.readdirSync(R(d)).sort()) {
        if (f.endsWith('.js')) onDisk.push(`${d}/${f}`);
    }
}
onDisk.push('js/script.js');

const srcsOf = (html) => {
    const out = [];
    const re = /<script[^>]*\bsrc="([^"]+)"/g;
    let m;
    while ((m = re.exec(html))) out.push(m[1]);
    return out;
};

let failures = 0;
const fail = (msg) => { failures++; console.log('  FAIL ' + msg); };

const pageSrcs = {};
for (const p of PAGES) pageSrcs[p] = srcsOf(fs.readFileSync(R(p), 'utf8'));

// (3) duplicates anywhere
for (const p of PAGES) {
    const seen = new Set();
    for (const s of pageSrcs[p]) {
        if (seen.has(s)) fail(`${p}: <script src="${s}"> listed twice — the second declaration of any top-level name is a SyntaxError that kills the later script`);
        seen.add(s);
    }
}

// (1) same game block, same order, contiguous, everywhere, covering the disk set
const gameSet = new Set(onDisk);
let canonical = null;
for (const p of PAGES) {
    const srcs = pageSrcs[p];
    const block = srcs.filter(s => gameSet.has(s));
    const missing = onDisk.filter(f => !block.includes(f));
    if (missing.length) fail(`${p}: missing game file(s): ${missing.join(', ')} — every game file goes into ALL FIVE pages (see guidelines/architecture.md)`);
    const extra = block.filter(f => !onDisk.includes(f));
    if (extra.length) fail(`${p}: references game file(s) not on disk: ${extra.join(', ')}`);
    // contiguous: no non-game script interleaved inside the game run
    const first = srcs.findIndex(s => gameSet.has(s));
    const last = srcs.length - 1 - [...srcs].reverse().findIndex(s => gameSet.has(s));
    if (first >= 0) {
        const interlopers = srcs.slice(first, last + 1).filter(s => !gameSet.has(s));
        if (interlopers.length) fail(`${p}: non-game script(s) inside the game block: ${interlopers.join(', ')} — the block loads as one ordered unit`);
        if (srcs[last] !== 'js/script.js') fail(`${p}: the game block must END with js/script.js (it holds the boot) — last is ${srcs[last]}`);
    }
    if (canonical === null) canonical = block;
    else if (block.join('|') !== canonical.join('|')) {
        fail(`${p}: game block order differs from index.html:\n    index: ${canonical.join(' ')}\n    ${p}: ${block.join(' ')}`);
    }
}

// (2) venuedoc before the game block
for (const p of PAGES) {
    const srcs = pageSrcs[p];
    const vd = srcs.indexOf('js/venuedoc.js');
    const first = srcs.findIndex(s => gameSet.has(s));
    if (vd === -1) fail(`${p}: js/venuedoc.js not loaded — sim/wind.js reads window.VenueDoc.U_PER_M at top level and the file dies mid-parse without it`);
    else if (first >= 0 && vd > first) fail(`${p}: js/venuedoc.js loads AFTER the game block (index ${vd} > ${first})`);
}

// (4) rules.html == index.html up to the viewer extras
{
    const idx = pageSrcs['index.html'];
    const rules = pageSrcs['rules.html'].filter(s => s !== 'js/rule_scenarios.js' && s !== 'js/rules_viewer.js');
    if (idx.join('|') !== rules.join('|')) {
        const only = (a, b) => a.filter(x => !b.includes(x));
        fail(`rules.html script list has drifted from index.html (it is documented as a copy).` +
             ` only-in-index: [${only(idx, rules).join(', ')}] only-in-rules: [${only(rules, idx).join(', ')}]`);
    }
}

console.log(`checked ${PAGES.length} pages against ${onDisk.length} game files on disk`);
console.log(`\n${failures ? 'FAIL' : 'PASS'} — ${failures} failure(s)`);
process.exit(failures ? 1 : 0);
