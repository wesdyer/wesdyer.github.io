// GLOBAL NAME CLASHES — every script index.html loads is a classic script, so a top-level
// `function NAME` is a global, and a second one with the same name, in a file loaded later,
// silently REPLACES the first everywhere. That is how Sep 25 2026 broke racing: course.js
// grew a 4-argument `segCross` for the Bayou's passage gates, it replaced collision.js's
// 8-argument segCross (the crossing test behind every point-in-shape check), and boats hit
// phantom walls — Sockeye Run went from 8 finishers to 0 in its golden traces.
//
// Fails on any top-level function (or var) defined in more than one place, except the names
// below that were already duplicated before this guard existed (they predate it and each is
// either scoped by its file's own wrapper or identical — look before adding to this list).
//
//   node regatta/eval/test_globals.js     (from the repo root)
const fs = require('fs');
const path = require('path');
const KNOWN = new Set(['draw', 'update', 'reset', 'jellyDepth', 'mulberry32', 'pointInPoly', 'pointInRing']);
const html = fs.readFileSync(path.resolve('regatta/index.html'), 'utf8');
const srcs = [...html.matchAll(/<script src="([^"?]+)/g)].map(m => m[1]).filter(s => s.startsWith('js/') || s.startsWith('assets/'));
const defs = new Map();
for (const f of srcs) {
    let txt; try { txt = fs.readFileSync(path.resolve('regatta', f), 'utf8'); } catch (e) { continue; }
    for (const m of txt.matchAll(/^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(|^var\s+([A-Za-z_$][\w$]*)/gm)) {
        const name = m[1] || m[2], line = txt.slice(0, m.index).split('\n').length;
        if (!defs.has(name)) defs.set(name, []);
        defs.get(name).push(`${f}:${line}`);
    }
}
let fails = 0;
for (const [name, where] of defs) {
    if (where.length < 2 || KNOWN.has(name)) continue;
    fails++; console.log(`  FAIL ${name} is defined ${where.length} times — the last one loaded replaces the rest: ${where.join(', ')}`);
}
console.log(`  checked ${srcs.length} scripts, ${defs.size} top-level names`);
console.log(fails ? `\nFAIL — ${fails} failure(s)` : '\nPASS — 0 failure(s)');
process.exit(fails ? 1 : 0);
