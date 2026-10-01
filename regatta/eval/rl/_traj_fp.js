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
// ⚠️ 2026-09-07 THE SWAMP WIND CUT: an adjudication is a claim about ONE pair of
// documents — "these laps are valid on THAT frozen doc". It must not outlive the
// doc it was made against, or the next unrelated edit inherits a ruling nobody
// made (the swamp +2 kt wind cut would have shown his nine old-wind laps as
// ✓ VALID on the new-wind doc). Every entry now carries `on`, the frozen stamp
// it was adjudicated against, and applies ONLY while the frozen doc still has
// that stamp. Swamp's `on` is the pre-wind paths doc (34a25f9f; copy in
// eval/rl/_venues_prewind/), so on the new-wind doc his laps read ⛔ RETIRED —
// which is the truth until he re-sails it.
const PATHS_WHY = 'course.paths added only — every other key byte-identical (2026-08-30 paths intake)';
// ⭐ THE V3 RE-SAVE (2026-09-14, the otter intake): the owner's courseSig v3 (hard props are
// their TRACED OUTLINES, not contactR discs) re-saved course.paths on eight docs — sig-only
// on river/redrock/lake/glowtide/volcanic, polylines re-routed on bay/lagoon/swamp — and all
// eleven were re-frozen. By-key diff old-frozen (eval/rl/_venues_prev3/) vs new: course.paths
// is the ONLY key that moved on every one of the eight; marks, lines, route, shapes, wind,
// current, world, props byte-identical. Nothing he sails against moved in the DOCUMENT, so
// the prior adjudications carry with `on` re-pointed at the new frozen stamps, and a lap
// stamped on the old frozen doc itself is valid by the same proof. ⚠️ The js side of that cut
// (prop colliders as silhouettes) is a SIM change the stamp cannot see; the bot column was
// re-benched on it (ot0* anchors), the human column is a recording and stands.
const V3_WHY = '; course.paths re-saved only (2026-09-14 courseSig v3 re-freeze, by-key proof)';
const ADJUDICATED = {
    // ⭐ BAY RE-FROZEN (2026-09-28, then 2026-09-29 — the playtest laps added). Sep 28 laps stamp
    // 64a2ab22:1039713 and Sep 29 laps 64a2b767:1039713; the two docs differ ONLY in records.provisional
    // (255 vs 250). Adding the Sep 29 laps put the target back at 255 (4:15: six solo laps, mean 230.0 s),
    // so the frozen cut IS 64a2ab22 — the Sep 28 laps match it directly, the Sep 29 laps are adjudicated.
    // The older bay laps stay adjudicated only on 7f6cf2f6 (an earlier frozen cut) and read as stale.
    bay: { stamps: ['64a2b767:1039713'], on: '64a2ab22:1039713', why: 'records.provisional only (250 → 255, the target reset from these laps + Sep 28\'s) — by-key diff 2026-09-29' },
    arctic:    { stamps: ['86fc97f4:97975'],   on: 'b0074f92:98492', why: PATHS_WHY },
    // GLOWTIDE RE-FROZEN (2026-10-01, the playtest intake): his six laps stamp 3ca30a2f:515607. The freeze took the doc one
    // edit later: records.provisional 220 → 200 (3:20, Time Trial mean 181.7 s × 1.1 up to 5 s; the old 3:40 came from race
    // laps). A by-key diff shows nothing else moved. Older glowtide laps (3fbd12b1, 10b0f94a on 34e647ff) now read as stale.
    glowtide:  { stamps: ['3ca30a2f:515607'],  on: '3ca1f1ed:515607', why: 'records.provisional only (220 → 200, the target set from these laps) — by-key diff 2026-10-01' },
    // LAGOON RE-FROZEN (2026-09-29, the playtest intake): his six laps stamp a28c2765:63241. The freeze took the doc one
    // edit later: records.provisional 190 → 195 (3:15, Time Trial mean 175.2 s × 1.1 up to 5 s; the old 3:10 came from race
    // laps). A by-key diff shows nothing else moved. Older lagoon laps (3acc77de, ebd9cc79 on 54f1a9d1) now read as stale.
    lagoon:    { stamps: ['a28c2765:63241'], on: 'a28c1b20:63241', why: 'records.provisional only (190 → 195, the target set from these laps) — by-key diff 2026-09-29' },
    // LAKE RE-FROZEN (2026-09-29, the playtest intake): his six laps stamp b4249776:1001243. The freeze took the doc
    // one edit later: records.provisional added (230 = 3:50, Time Trial mean 207.1 s x 1.1 up to 5 s, set by hand
    // because set_venue_targets refuses: 1.76x the 1:58 path estimate). A by-key diff shows nothing else moved.
    // The older lake laps (84140c1f, 4ac9dd20, adjudicated on 6d3363c) now read as stale.
    lake:      { stamps: ['b4249776:1001243'], on: 'e3df0977:1001273', why: 'records.provisional added only (the target set from these laps) — by-key diff 2026-09-29' },
    // OCEAN RE-FROZEN (2026-09-30, the playtest intake): his six laps stamp 9812f466:569834. The freeze took the doc one
    // edit later: records.provisional added (220 = 3:40, Time Trial mean 196.0 s x 1.1 up to 5 s, set by hand because
    // set_venue_targets refuses — his mean is 0.79x its 4:07 path estimate; the estimate doesn't count swell surfing).
    // A by-key diff shows nothing else moved. The older ocean laps (1b1a7101 on 46475464) now read as stale.
    ocean:     { stamps: ['9812f466:569834'],  on: 'faadda46:569864', why: 'records.provisional added only (the target set from these laps) — by-key diff 2026-09-30' },
    // REDROCK RE-FROZEN (2026-09-30, the playtest intake): his laps stamp 481d1a0b:65152. TT2 (223.0 s) is EXCLUDED at
    // Wes's word ("I don't think we should keep this trajectory for the sake of determining the right time… two pretty
    // serious mistakes") and kept only in the playtest archive. The freeze took the doc one edit later: records.provisional
    // added (225 = 3:45, mean of the three clean Time Trials 200.1 s x 1.1 up to 5 s, set by hand: set_venue_targets
    // refuses at its band edge). A by-key diff shows nothing else moved. The older redrock laps (60f2a5ec, a6530aaa on 18d5c8a8) now read as stale.
    redrock:   { stamps: ['481d1a0b:65152'],   on: 'cf1c0aee:65182', why: 'records.provisional added only (the target set from these laps) — by-key diff 2026-09-30' },
    // RIVER RE-FROZEN (2026-09-30, the playtest intake): his six finished laps stamp 572d60cb:1787947 (a seventh race
    // ended aground on leg 3 and was not ingested). The freeze took the doc one edit later: records.provisional
    // 195 → 205 (3:25, Time Trial mean 182.8 s × 1.1 up to 5 s; the old 3:15 came from race laps). A by-key diff shows
    // nothing else moved. The older river laps (76659ee5, d5e773f6 on 90856445) now read as stale.
    river:     { stamps: ['572d60cb:1787947'], on: '57154221:1787947', why: 'records.provisional only (195 → 205, the target set from these laps) — by-key diff 2026-09-30' },
    // SEATRIALS RE-FROZEN (2026-09-29, the playtest intake): his six laps stamp ba7f0d6f:1781; the freeze
    // took the doc one edit later (records.provisional 210 → 205, set from these laps), by-key diff: nothing
    // else. The Aug laps (ae1026bc, adjudicated on the old cut ad2dd96f) now read as stale — the doc they
    // were sailed on also lacked records and had course.cutoff 360, not 600.
    seatrials: { stamps: ['ba7f0d6f:1781'],    on: 'ba7f7c8b:1781', why: 'records.provisional only (the target set from these laps) — by-key diff 2026-09-29' },
    // SWAMP RE-FROZEN (2026-09-30, the playtest intake): his seven laps stamp 6691639a:335942 (4 Time Trials, 3 races).
    // The freeze took the doc one edit later: records.provisional added (195 = 3:15, Time Trial mean 175.6 s x 1.1 up to
    // 5 s, set by hand because set_venue_targets refuses it — 2.50x the 1:10 path estimate). A by-key diff shows nothing
    // else moved. The Sep 8 laps (59f2931b on f6ac8c39) now read as stale.
    swamp:     { stamps: ['6691639a:335942'],  on: '895f3a97:335972', why: 'records.provisional added only (the target set from these laps) — by-key diff 2026-09-30' },
    volcanic:  { stamps: ['4ac8c0e5:45501'],   on: '46ebdb19:45501', why: 'his five laps (2026-09-13) were stamped ON the old frozen doc' + V3_WHY },
    // ⭐ SPOONBILL FLATS (2026-09-16, the flats intake): his three laps stamp 8eb84e74:38655, a
    // doc 33 bytes short of the committed 431d683 (144108a1:38688) that matches NO commit — the
    // page he sailed on was loaded before the last ladder save (the editor's save() re-bakes
    // course.paths on write; the live stamp on the shipping page equals the file's, checked with
    // _flats_livefp.js). Adjudicated by the two-step check, in the tidal form: (1) the lap's own
    // course block — marks, lines, legLens 1480/26116, zone 165, reqSweep 3.165 — is identical
    // to the frozen doc's; (2) _flats_replay.js ran every racing sample through the FROZEN
    // field's depthAt(x, y, t) on the race clock: 0 aground samples of 5002 (min depth 0.64 m
    // vs a 0.5 m draft), every passage he took open at the level he took it. The water he sailed
    // is the water the benched doc has.
    flats:     { stamps: ['8eb84e74:38655'],   on: '144108a1:38688', why: 'course block identical; tracks replayed afloat through the frozen tide field (0 aground of 5002 samples, min depth 0.64 m vs draft 0.5) — _flats_replay.js' },
};

const TD = path.join(__dirname, 'traj');
const byVenue = {};
for (const f of fs.readdirSync(TD).filter(f => f.startsWith('traj_'))) {
    // Sep 28 2026 files carry the mode: traj_<venue>_<solo|competitive>_<ts>.json
    const v = f.slice(5, f.lastIndexOf('_')).replace(/_(solo|competitive)$/, '');
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
        const A = ADJUDICATED[v];
        const adj = A && A.stamps.includes(fp) && (!A.on || A.on === froz) ? A : null;
        const adjStale = A && A.stamps.includes(fp) && A.on && A.on !== froz;
        const tag = fp == null ? 'NO STAMP (schema-1)'
            : fp === froz ? 'matches FROZEN  ✓ comparable to benches'
                : fp === ship ? (froz && froz !== ship ? 'matches SHIPPING only  ⚠️ not the benched venue' : 'matches shipping ✓')
                    : adj ? `retired stamp — ✓ ADJUDICATED VALID (${adj.why})`
                        : adjStale ? `⛔ RETIRED — adjudicated valid on doc ${A.on} only; frozen doc has moved since (re-adjudicate or re-sail)`
                            : 'matches NEITHER  ⛔ retired document';
        if (fp !== froz && !(froz === null && fp === ship) && !adj) mismatched++;
        console.log(`   ${(j.finishTime != null ? j.finishTime.toFixed(1) : '   -').padStart(7)}s  ${String(fp).padEnd(18)} ${tag}   ${f}`);
    }
}
console.log(`\n${mismatched} lap(s) are NOT on the benchmark document for their venue.`);
