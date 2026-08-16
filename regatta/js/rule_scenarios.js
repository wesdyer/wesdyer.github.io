// RULE SCENARIOS — the battery's single source of truth.
//
// One scenario = one 1:1 rule situation, as DATA. Two consumers:
//   - eval/test_scenarios.js   (the battery runner: asserts oracle + behavior)
//   - rules.html               (the visual page: renders each scenario looping,
//                               rule text underneath)
// Design stance (owner + 2026-08-15/16 sessions):
//   (a) scenarios are data — the runner and the page read the SAME file;
//   (b) TWO assertion layers — `oracle` (what Rules.evaluate/getRightOfWay
//       says) vs `behavior` (what the umpire/engine does) — so a failure
//       names its layer. Rule 15 proved why: two bench falsifications after
//       green oracle runs;
//   (c) every scenario asserts its own PRECONDITIONS (`pre`) — the mark-room
//       lesson: two test versions passed on a broken engine because the setup
//       was not what it claimed;
//   (d) clear-cut geometries with tolerance; boundary probing stays in
//       dedicated oracle tests, not here.
//
// ── Schema ──────────────────────────────────────────────────────────────
// {
//   id:        'r43-mark-touch',            // unique, kebab
//   rule:      'Rule 43.1(b)',              // display grouping
//   title:     'Squeezed onto the mark',
//   ruleText:  '...',                       // verbatim RRS, for the page
//   venue:     'bay' | 'river' | 'seatrials',
//   anchor:    'roundMark' | 'bankSpot' | 'openWater',
//             // roundMark: first round-leg mark; frame = mark center,
//             //   world axes, unit = mark.zone (dx/dy are FRACTIONS of zone).
//             // bankSpot: searched spot with land on the WINDWARD side of a
//             //   sailable heading and >=8 cells of open leeward water;
//             //   frame = spot, axes u (toward land) and h (spot heading);
//             //   dl = units toward land, dh = units along heading;
//             //   heading 0 = the spot heading. Units are WORLD UNITS.
//             // openWater: the bankSpot frame shifted 150u to open water.
//   boats:     [ { name: 'A', dl, dh, heading } ... ]      (bankSpot/openWater)
//              [ { name: 'A', dx, dy, heading } ... ]      (roundMark; frac of zone)
//             // heading: number (rad, world) or 'spot' (bankSpot heading)
//             // or 'spot+X' (offset rad).
//   phases: [ { // executed in order; each phase may move boats then step
//     move:   { A: {dl,dh}|{dx,dy}, ... },   // optional repositioning
//     step:   'rules' | 'rules+islands' | 'contact' | 'markContact',
//             // rules:         Rules.update only (oracle-layer stepping)
//             // rules+islands: + checkIslandCollisions (ledger + grounding)
//             // contact:       + checkBoatCollisions   (the boat umpire)
//             // markContact:   + checkMarkCollisions   (the mark umpire)
//     frames: 5,                             // how many 1/60 steps
//     hold:   true,                          // re-pin positions every frame
//     clearPenalties: true,                  // zero penalty state before step
//     pre:    { ... },     // precondition asserts — fixture layer
//     oracle: { ... },     // Rules asserts — the rules-as-encoded layer
//     behavior: { ... },   // umpire/engine asserts — the enforcement layer
//   } ... ]
// }
// Assertable oracle fields:  row ('A'|'B'|null), rule, markRoom ('A'|'B'|null),
//   overlapped (bool), constraintR15 (bool), snapshotEntitled ('A'|'B'|null),
//   tackA/tackB ('starboard'|'port'), aAsternOfB/bAsternOfA (bool).
// Assertable behavior fields: penA/penB (bool), isTackingA (bool),
//   contact (bool — hulls touched during the phase), grounded ('A'|'B'|null).
// Assertable pre fields: any oracle/behavior field, plus dToMark
//   {boat:'B', lt: 60}, sep {lt: 110}.
//
// Keep geometries owner-readable: every number in a scenario should be
// explainable in one sentence of sailing English.

(function (root) {
    'use strict';

    const S = [];

    // ═══════════════ Section A of Part 2 — the right-of-way core ═════════
    // Stepped pure-oracle on seatrials open water. Headings are wind-relative
    // at materialization time: 'stbdCH'/'portCH' = close-hauled each tack
    // (wd -/+ 0.66), 'stbdRun'/'portRun' = broad each tack (wd -/+ 2.4).

    S.push({
        id: 'r10-port-gives-way',
        rule: 'Rule 10',
        title: 'Opposite tacks — port keeps clear',
        ruleText: 'When boats are on opposite tacks, a port-tack boat shall keep clear of a starboard-tack boat.',
        venue: 'seatrials', anchor: 'openWater',
        boats: [
            { name: 'A', dl: 0, dh: 0, heading: 'stbdCH' },
            { name: 'B', dl: -140, dh: 100, heading: 'portCH' },
        ],
        phases: [{
            step: 'rules', frames: 5,
            pre: { tackA: 'starboard', tackB: 'port' },
            oracle: { row: 'A', rule: 'Rule 10' },
        }],
    });

    S.push({
        id: 'r11-windward-keeps-clear',
        rule: 'Rule 11',
        title: 'Same tack, overlapped — windward keeps clear',
        ruleText: 'When boats are on the same tack and overlapped, a windward boat shall keep clear of a leeward boat.',
        venue: 'seatrials', anchor: 'openWater',
        boats: [
            // two starboard close-hauled boats abeam, 30u apart: A to leeward
            { name: 'A', dl: -30, dh: 0, heading: 'stbdCH' },
            { name: 'B', dl: 0, dh: 0, heading: 'stbdCH' },
        ],
        phases: [{
            step: 'rules', frames: 5,
            pre: { overlapped: true, tackA: 'starboard', tackB: 'starboard' },
            oracle: { row: 'A', rule: 'Rule 11' },
        }],
        note: 'bankSpot/openWater frames put +dl toward the WINDWARD side, so A at −dl is the leeward boat.',
    });

    S.push({
        id: 'r12-clear-astern-keeps-clear',
        rule: 'Rule 12',
        title: 'Same tack, not overlapped — clear astern keeps clear',
        ruleText: 'When boats are on the same tack and not overlapped, a boat clear astern shall keep clear of a boat clear ahead.',
        venue: 'seatrials', anchor: 'openWater',
        boats: [
            { name: 'A', dl: 0, dh: 0, heading: 'stbdCH' },
            { name: 'B', dl: 0, dh: -120, heading: 'stbdCH' },
        ],
        phases: [{
            step: 'rules', frames: 5,
            pre: { overlapped: false, bAsternOfA: true },
            oracle: { row: 'A', rule: 'Rule 12' },
        }],
    });

    S.push({
        id: 'r13-tacking-keeps-clear',
        rule: 'Rule 13',
        title: 'While tacking — past head to wind, not yet close-hauled',
        ruleText: 'After a boat passes head to wind, she shall keep clear of other boats until she is on a close-hauled course.',
        venue: 'seatrials', anchor: 'openWater',
        boats: [
            { name: 'A', dl: 0, dh: 0, heading: 'stbdCH' },
            // B mid-tack: pointed 0.2 rad off head-to-wind (inside the 0.40
            // close-hauled exit landed 62dfb25), flagged isTacking
            { name: 'B', dl: -120, dh: 60, heading: 'wd+0.2', isTacking: true },
        ],
        phases: [{
            step: 'rules', frames: 5,
            // no overlap precondition: the overlap definition ignores lateral
            // distance, and rule 13 applies overlapped or not
            oracle: { row: 'A', rule: 'Rule 13' },
        }],
    });

    S.push({
        id: 'r13-exit-is-close-hauled',
        rule: 'Rule 13 (exit)',
        title: 'Tacking ends on a close-hauled course — the fleet\'s, not 45°',
        ruleText: '...she shall keep clear of other boats UNTIL SHE IS ON A CLOSE-HAULED COURSE. (This game\'s close-hauled is TWA ~38°; the exit test is 0.40 rad past head to wind — 23°, below what a wind shift can reach — so a boat that completes her tack onto her real beat is no longer "tacking". Landed 62dfb25: the 45° exit kept a starboard boat at 38° flagged, giving port rights over her.)',
        venue: 'seatrials', anchor: 'openWater',
        boats: [
            { name: 'A', dl: 200, dh: 0, heading: 'stbdCH' },
            // B just past head to wind: 0.30 rad — inside the exit, still tacking
            { name: 'B', dl: 0, dh: 0, heading: 'wd+0.30', isTacking: true },
        ],
        phases: [
            {
                step: 'full', frames: 2, hold: true,
                behavior: { isTackingB: true }, // 17° past head to wind: still tacking
            },
            {
                // she bears away past the exit threshold (0.55 rad ≈ 31°)
                move: { B: { dl: 0, dh: 0, heading: 'wd+0.55' } },
                step: 'full', frames: 2, hold: true,
                behavior: { isTackingB: false }, // on a close-hauled course: flag clears
            },
        ],
    });

    // ═══════════════ Rule 15 — acquiring right of way ════════════════════
    // Ported from _r15_oracle.js (landed 6bd9707).

    S.push({
        id: 'r15-acquisition-grace',
        rule: 'Rule 15',
        title: 'Acquiring ROW by your own action — initial room to respond',
        ruleText: 'When a boat acquires right of way, she shall initially give the other boat room to keep clear, unless she acquires right of way because of the other boat’s actions.',
        venue: 'seatrials', anchor: 'openWater',
        boats: [
            { name: 'A', dl: 0, dh: 0, heading: 'stbdCH' },
            { name: 'B', dl: -200, dh: 150, heading: 'portCH' },
        ],
        phases: [
            {
                step: 'rules', frames: 2,
                pre: { rule: 'Rule 10', row: 'A' },
                oracle: { constraintR15: false }, // first meeting is not an acquisition
            },
            {
                // B tacks onto starboard clear-ahead-to-leeward: SHE acquires ROW
                move: { B: { dl: -60, dh: 45, heading: 'stbdCH' } },
                step: 'rules', frames: 1,
                pre: { overlapped: true, row: 'B' },
                oracle: { constraintR15: true }, // grace window active
            },
            {
                step: 'rules', frames: 150, // 2.5 s
                oracle: { constraintR15: false }, // expired
            },
        ],
    });

    S.push({
        id: 'r15-contact-in-grace-penalizes-acquirer',
        rule: 'Rule 15 (umpire)',
        title: 'Contact inside the grace window is the acquirer\'s foul',
        ruleText: 'When a boat acquires right of way, she shall initially give the other boat room to keep clear... Contact within the window (2 s, acquisition by her own tack) is the acquirer failing to give that room — the penalty goes to HER, not to the boat that had no room to respond. (Landed 6bd9707; the oracle-green/bench-red lesson lives here.)',
        venue: 'seatrials', anchor: 'openWater',
        boats: [
            { name: 'A', dl: 0, dh: 0, heading: 'stbdCH' },
            { name: 'B', dl: -200, dh: 150, heading: 'portCH' },
        ],
        phases: [
            {
                step: 'rules', frames: 2,
                pre: { rule: 'Rule 10', row: 'A' },
            },
            {
                // B tacks onto starboard hard under A's lee side — she acquires
                // ROW by her own maneuver, with the hulls already touching
                move: { B: { dl: -16, dh: 0, heading: 'stbdCH' } },
                step: 'rules', frames: 1,
                pre: { overlapped: true, rule: 'Rule 11', row: 'B' },
                oracle: { constraintR15: true },
            },
            {
                // now the umpire sees the contact — inside the grace window
                step: 'contact', frames: 1, clearPenalties: true,
                pre: { contact: true },
                behavior: { penB: true, penA: false }, // the ACQUIRER is penalized
            },
        ],
    });

    // ═══════════════ Rule 18.2 — mark-room ═══════════════════════════════
    // Ported from test_markroom.js (owner ruling: "first in gets rights").

    S.push({
        id: 'r18-first-to-zone',
        rule: 'Rule 18.2(a)(2)',
        title: 'Not overlapped — first into the zone is entitled',
        ruleText: 'If the boats are not overlapped, the boat that has not reached the zone at that moment shall give the other boat mark-room.',
        venue: 'bay', anchor: 'roundMark',
        boats: [
            // A clear ahead but OUTSIDE the zone; B astern of her and inside it
            { name: 'A', dx: -1.9, dy: -1.2, heading: 0 },
            { name: 'B', dx: -0.5, dy: 0.5, heading: 0 },
        ],
        phases: [{
            step: 'rules', frames: 5,
            pre: { overlapped: false, bAsternOfA: true, dToMark: { boat: 'B', ltZone: 1.0, other: 'A', gtZone: 1.0 } },
            oracle: { markRoom: 'B' },
        }],
    });

    S.push({
        id: 'r18-inside-overlapped',
        rule: 'Rule 18.2(a)(1)',
        title: 'Overlapped at the zone — inside boat is entitled',
        ruleText: 'If boats are overlapped when the first of them reaches the zone, the outside boat at that moment shall thereafter give the inside boat mark-room.',
        venue: 'bay', anchor: 'roundMark',
        boats: [
            { name: 'A', dx: -1.15, dy: -0.24, heading: 1.5707963 },
            { name: 'B', dx: -0.85, dy: 0.24, heading: 1.5707963 },
        ],
        phases: [{
            step: 'rules', frames: 5,
            pre: { overlapped: true, dToMark: { boat: 'B', ltZone: 1.0, other: 'A', gtZone: 1.0 } },
            oracle: { markRoom: 'B' },
        }],
    });

    S.push({
        id: 'r18-entitlement-survives-overlap-break',
        rule: 'Rule 18.2(a)',
        title: 'Mark-room survives the overlap breaking',
        ruleText: 'When a boat is required to give mark-room by this rule, she shall continue to do so for as long as this rule applies, even if later an overlap is broken or a new overlap begins.',
        venue: 'bay', anchor: 'roundMark',
        boats: [
            { name: 'A', dx: -1.15, dy: -0.24, heading: 1.5707963 },
            { name: 'B', dx: -0.85, dy: 0.24, heading: 1.5707963 },
        ],
        phases: [
            { step: 'rules', frames: 3, oracle: { markRoom: 'B' } },
            {
                move: { A: { dx: -3.1, dy: -0.24 }, B: { dx: -0.78, dy: 0.24 } },
                step: 'rules', frames: 2,
                pre: { overlapped: false },
                oracle: { markRoom: 'B' },
            },
        ],
    });

    S.push({
        id: 'r18-entitlement-ends-leaving-zone',
        rule: 'Rule 18.2(b)',
        title: 'Mark-room ends when the entitled boat leaves the zone',
        ruleText: 'Rule 18.2(a) no longer applies if the boat entitled to mark-room passes head to wind or leaves the zone.',
        venue: 'bay', anchor: 'roundMark',
        boats: [
            { name: 'A', dx: -1.15, dy: -0.24, heading: 1.5707963 },
            { name: 'B', dx: -0.85, dy: 0.24, heading: 1.5707963 },
        ],
        phases: [
            { step: 'rules', frames: 3, oracle: { markRoom: 'B' } },
            {
                move: { B: { dx: -2.5, dy: 0.24 } }, // B sails back out of the zone
                step: 'rules', frames: 2,
                oracle: { markRoom: null },
            },
        ],
    });

    // ═══════════════ Rule 43 — exoneration (landed this arc) ═════════════
    // Ported from test_exoneration.js. The owner's two named cases.

    S.push({
        id: 'r43-mark-touch-exonerated',
        rule: 'Rule 43.1(b)',
        title: 'Squeezed onto the mark while entitled — no rule 31 penalty',
        ruleText: 'When a boat is sailing within the room or mark-room to which she is entitled, she shall be exonerated if, in an incident with a boat required to give her that room or mark-room, she breaks rule 31.',
        venue: 'bay', anchor: 'roundMark',
        boats: [
            { name: 'A', dx: -1.05, dy: -0.20, heading: 1.5707963 },
            { name: 'B', dx: -0.80, dy: 0.16, heading: 1.5707963 },
        ],
        phases: [
            {
                step: 'rules', frames: 5,
                pre: { overlapped: true },
                oracle: { markRoom: 'B' },
            },
            {
                // B pressed onto the buoy, the ower close aboard outside
                move: { B: { du: 18, dv: 0 }, A: { du: 93, dv: 0 } }, // world units from the MARK
                step: 'markContact', frames: 1, clearPenalties: true,
                pre: { sep: { lt: 110 } },
                behavior: { penB: false }, // exonerated
            },
        ],
    });

    S.push({
        id: 'r43-mark-touch-alone-still-fouls',
        rule: 'Rule 31 (control)',
        title: 'A lone mark touch is still a foul',
        ruleText: 'While racing, a boat shall not touch a starting mark before starting, a mark that begins, bounds or ends the leg of the course on which she is sailing, or a finishing mark after finishing.',
        venue: 'bay', anchor: 'roundMark',
        boats: [
            { name: 'A', dx: -1.05, dy: -0.20, heading: 1.5707963 },
            { name: 'B', dx: -0.80, dy: 0.16, heading: 1.5707963 },
        ],
        phases: [
            { step: 'rules', frames: 5, oracle: { markRoom: 'B' } },
            {
                move: { B: { du: 18, dv: 0 }, A: { dx: 4.0, dy: -4.0 } }, // A four zones away
                step: 'markContact', frames: 1, clearPenalties: true,
                behavior: { penB: true }, // no incident, no exoneration
            },
        ],
    });

    S.push({
        id: 'r43-obstruction-squeeze-contact',
        retryScope: 'any-layer', // umpire guards are deliberately conservative — assert a clean geometry EXISTS
        rule: 'Rule 43.1(a) + 19.2(b)',
        title: 'Contact while denied room at an obstruction — the denier fouls',
        ruleText: '19.2(b): ...the outside boat shall give the inside boat room between her and the obstruction... 43.1(a): when as a consequence of breaking a rule a boat has compelled another boat to break a rule, the other boat is exonerated for her breach.',
        venue: 'river', anchor: 'bankSpot',
        boats: [
            { name: 'B', dl: 0, dh: 0, heading: 'spot' },   // pinned near the bank
            { name: 'A', dl: -60, dh: 0, heading: 'spot' }, // leeward open water, ROW
        ],
        phases: [
            {
                step: 'rules+islands', frames: 72, hold: true,
                pre: { row: 'A', overlapped: true, ledgerBA: true },
            },
            {
                move: { A: { dl: -16, dh: 0 } }, // closes the last of the room
                step: 'contact', frames: 1, clearPenalties: true,
                pre: { contact: true },
                behavior: { penA: true, penB: false }, // denier fouls; pinned boat exonerated
            },
        ],
    });

    S.push({
        id: 'r43-open-water-control',
        rule: 'Rule 11 (control)',
        title: 'The same contact in open water is windward’s own foul',
        ruleText: 'When boats are on the same tack and overlapped, a windward boat shall keep clear of a leeward boat.',
        venue: 'river', anchor: 'openWater',
        boats: [
            { name: 'B', dl: 0, dh: 0, heading: 'spot' },
            { name: 'A', dl: -60, dh: 0, heading: 'spot' },
        ],
        phases: [
            { step: 'rules+islands', frames: 72, hold: true, pre: { row: 'A', overlapped: true } },
            {
                move: { A: { dl: -16, dh: 0 } },
                step: 'contact', frames: 1, clearPenalties: true,
                pre: { contact: true },
                behavior: { penA: false, penB: true },
            },
        ],
    });

    S.push({
        id: 'r19-grounding-squeezer-fouls',
        retryScope: 'any-layer',
        rule: 'Rule 19.2(b)',
        title: 'Forced aground at an obstruction — the denier fouls',
        ruleText: 'An outside boat shall give the inside boat room between her and the obstruction, unless she has been unable to do so from the time the overlap began.',
        venue: 'river', anchor: 'bankSpot',
        boats: [
            { name: 'B', dl: 0, dh: 0, heading: 'spot' },
            { name: 'A', dl: -60, dh: 0, heading: 'spot' },
        ],
        phases: [
            { step: 'rules+islands', frames: 72, hold: true, pre: { ledgerBA: true } },
            {
                marchToLand: { boat: 'B', follower: 'A', gap: 60 },
                step: 'rules+islands', frames: 1, clearPenalties: true,
                pre: { grounded: 'B' },
                behavior: { penA: true, penB: false },
            },
        ],
    });

    const API = { scenarios: S };
    if (typeof module !== 'undefined' && module.exports) module.exports = API;
    if (root) root.RuleScenarios = API;
})(typeof window !== 'undefined' ? window : null);
