# Rules Inventory — RRS 2025-2028 vs the engine (2026-08-15)

What is actually encoded, where, and in what state — the coverage map for the
scenario battery. Sources: `js/rules.js` (727 lines, the oracle), the umpire
and enforcement code in `js/script.js`, and the existing tests in `eval/`.

Status vocabulary:
- **ENCODED** — implemented and believed faithful; confidence noted.
- **PARTIAL** — implemented with stated gaps or approximations.
- **MIS-ENCODED** — implemented, provably not what the rule says.
- **DEAD OUTPUT** — computed by the oracle, consumed by nothing.
- **ABSENT** — not implemented anywhere.
- **HOUSE** — deliberate deviation from RRS (owner design call, not a bug).
- **N/A** — cannot arise in this game.

## ⚠️ The two structural findings (read these first)

**1. The oracle's `constraints` output is DEAD.** `Rules.evaluate()` computes
constraint flags for Rules 15, 16.2 and 17 — and every consumer in script.js
goes through the `getRightOfWay()` wrapper (rules.js ~690), which returns only
`{boat, rule, reason, markRoom}` and drops `constraints` on the floor. The only
reader is the debug overlay. script.js re-implements its own independent
approximations of 15/16 as guards inside the no-contact foul claim (~905-945),
but the AI's *sailing* never receives a 16.2 or 17 restriction, and the umpire
never enforces one. Decision needed before the battery: wire the constraints
through (and test them), or delete them (and test the script.js guards as the
real encoding). Testing dead code proves nothing.

**2. There is no exoneration (RRS 43).** A boat sailing within mark-room or
room she is entitled to, forced thereby to break 10/11/12/13/15/16, should be
exonerated. What exists: the contact umpire's `effectiveRow` mark-room immunity
(script.js ~14355-14385, a partial 43.1(b)) and a mark-room guard in the
no-contact claim. There is no general exoneration — a boat squeezed onto a rule
breach while taking room she was owed can be penalized. The battery will hit
this constantly in mark-room scenarios; it needs a ruling on intended behavior
first.

## Definitions (Part 2 preamble)

| Definition | Status | Where / notes |
|---|---|---|
| Tack (stbd/port) | **ENCODED, verified** | `getTack` — angle-based with boom deciding only by-the-lee/dead-downwind (the definition's own carve-out). Empirically verified: 2,329 samples, zero sign counter-examples. History: was boom-animation-derived; 5.9-8.7% of close pairs disagreed on the rule-10 precondition. |
| Clear astern / ahead | **ENCODED, verified** | `isClearAstern` — projects BOTH ends of the behind boat (bow-only failed on 22-31% of close pairs at diverged headings). |
| Overlap | **PARTIAL** | Pairwise only. The definition's second sentence — "they also overlap when a boat between them overlaps both" — is explicitly not implemented. Three-boat scenario needed to price whether it matters. |
| Leeward/Windward | **ENCODED, tested** | `getLeewardBoat` — hull-frame projection. History: wind-frame version inverted 7 of 12 points of sail ("every downwind Rule 11 decision was backwards"); `test_rule11.js` guards it. |
| Zone | **ENCODED** | `zoneOf(mark)` — per-mark zone (a hardcoded 165 once sat 240u *inside* Glacier Sound's rock). |
| Continuing obstruction | **ENCODED (marks), PARTIAL (floes)** | `isContinuingObstruction` for marks (2r ≥ 3 hull lengths); floes handled separately in the 19.2(c) implementation via the floe-stamped grid. |
| Keep clear | **implicit / PARTIAL** | No explicit predicate. Proxied by the no-contact claim: stand-on forced >20° (DEV 0.35) at HIGH+ risk for HOLD 0.8 s with a needed-gap guard. This proxy IS the de-facto keep-clear definition — battery should test it as such. |
| Room / seamanlike way | **ABSENT (implicit)** | No room model; room lives inside avoidance-bubble constants. |
| Proper course | **ABSENT** | Needed by 17 and 18.4 — neither can be encoded properly without it. |
| Mark-room (content) | **PARTIAL** | Entitlement is modeled; the content ("room to sail to the mark, room to round as needed") exists only as collision immunity. |
| Start / Finish / crossing | **ENCODED, tested, recently hardened** | Hull-based crossing (RRS 28's "any part of her hull"); the one-frame crack fixed in `32fa7ae`. `test_start_crossing.js`, `test_start_line.js`, `test_gates.js`. |
| Fetching | **ABSENT** | Needed by 18.3. |

## Section A — Right of way

| Rule | Status | Notes |
|---|---|---|
| 10 (opposite tacks) | **ENCODED** | rules.js ~609. Precondition (tack) hardened; see Definitions. |
| 11 (same tack, overlapped) | **ENCODED, tested** | ~637. History: rule was effectively inverted downwind until the leeward-definition fix; the P3 give-way underlay was originally *tuned against the inverted rule* — behavioral consequences may still echo. |
| 12 (same tack, not overlapped) | **ENCODED** | ~655. |
| 13 (while tacking) | **ENCODED** | ~533. `isTacking` is definition-shaped (wind-side flip while upwind → cleared on close-hauled ~45°). Both-tacking third sentence (port side / astern keeps clear) encoded geometrically rather than falling through to the suspended rules 10-12. |

## Section B — General limitations

| Rule | Status | Notes |
|---|---|---|
| 14 (avoid contact) | **PARTIAL / HOUSE** | Enforced behaviorally in the AI (graduated stand-on hold: full at MEDIUM, accept evasion at HIGH, pure avoidance at IMMINENT). Umpire: contact penalizes the give-way boat only — the ROW boat is never penalized for contact, which loosely matches 14(b)'s only-if-damage carve-out but isn't a decision anyone made explicitly. |
| 15 (acquiring ROW) | **PARTIAL + DEAD** | Oracle: 2 s grace flag on ROW change, no "unless caused by the other boat's actions" exception — and it's a dead output. script.js separately guards the no-contact claim (role stable, GRACE 0.3) and the Rule 19 claim with a rule-15-like requirement. The real encoding is those guards. |
| 16.1 (changing course) | **PARTIAL (behavioral only)** | Not in the oracle. AI-side: `rule16Grace` suppresses the foul claim after our own material course change; candidate scoring penalizes STAND_ON steering toward the threat (~4115). |
| 16.2 (beat; stbd shall not bear off...) | **MIS-PROXIED + DEAD** | Constraint pushed on a *leg-based* proxy (`legTargetsWindward` for both boats) — inconsistent with the engine's own point-of-sail stance taken for 18.1(a) — and nothing consumes it. |
| 17 (proper course limit) | **MIS-ENCODED + DEAD** | The flag records only "overlap began within 2 hull lengths" — it checks neither that the restricted boat *came from clear astern*, nor that she became overlapped *to leeward*; the constraint is then pushed without checking which boat it binds. Also unenforceable as stated: no proper-course model exists. And it's dead. |

## Section C — At marks and obstructions

| Rule | Status | Notes |
|---|---|---|
| 18.1 (applicability) | **PARTIAL** | "Required to leave the mark on the same side" approximated by route-role targeting (windward-gate awareness). |
| 18.1(a)(1) (opposite tacks on a beat) | **ENCODED** | Point-of-sail based (`Course.isBeating`), deliberately not leg-based. |
| 18.1(a)(2) | **ABSENT** | (proper course to tack at the mark for one but not both). |
| 18.1(a)(3) (approaching vs leaving) | **ABSENT** | Constant situation on these multi-leg courses — high battery priority. |
| 18.1(a)(4) (continuing obstruction → rule 19) | **ENCODED** | Coupled with `zoneOf` — the two land together or not at all (proven byte-identical on arctic only as a pair). |
| 18.2(a) (inside overlapped) | **ENCODED, tested** | Zone-entry snapshot; `test_markroom.js`. |
| 18.2 first-to-zone | **ENCODED (2025 reading + owner ruling)** | "The boat that has not reached the zone gives mark-room" — replaces the old clear-ahead test; owner: "first in gets rights". |
| 18.2(c)/(d)/(e) | **PARTIAL/ABSENT** | Snapshot clears when entitled boat leaves zone or tacks (a coarse (c)); reasonable-doubt (d) and late-overlap (e) absent. |
| 18.3 (tacking in the zone) | **ABSENT** | Happens at every windward mark. Needs Fetching. High priority. |
| 18.4 (gybing at a gate/mark) | **ABSENT** | Needs Proper Course. |
| 19.1 / 19.2(a) | **ABSENT** | No choose-a-side model. |
| 19.2(b) (room between boat and obstruction) | **PARTIAL** | `rule19Pairs` squeeze-detector (islands, `awash` excluded — a shoal is not an obstruction) + umpire penalty 'Denied Room at Obstruction' (~21747). |
| 19.2(c) (no room for the squeezed-in boat) | **ENCODED (approximation stated)** | Floe-stamped grid test; conservative reading (applies to whichever boat is against the obstruction, not tracking became-overlapped-from-astern). |
| 20 (room to tack at an obstruction) | **ABSENT** | No hail machinery at all. River banks + upwind traffic is exactly its habitat — worth pricing. |

## Section D and elsewhere

| Rule | Status | Notes |
|---|---|---|
| 21 (starting errors / taking penalty → keep clear) | **ENCODED** | Oracle rule 0; both-returning falls through correctly. |
| 22 (capsized etc.) | **N/A** | |
| 23 (interfering) | **ABSENT** | Note: finished boats are skipped by rules tracking and the umpire entirely — a finished boat sailing home through the racing fleet is rule-free. Worth one scenario to see if it matters. |
| 28 (sail the course) | **ENCODED, tested, hardened** | Crossing + rounding-sweep (string rule); extensions; `32fa7ae` fixed the one-frame miss. |
| 29.1 (OCS) | **PARTIAL / HOUSE** | OCS flag on pre-gun crossing, clear by re-crossing or position (anti-deadlock plane at −40u). No recall flags. |
| 30 (I/Z/U/black) | **ABSENT / HOUSE** | No starting penalties beyond OCS. |
| 31 (touching a mark) | **ENCODED** | Penalty on contact. |
| 43 (exoneration) | **ABSENT** (see structural finding 2) | Partial stand-ins only. |
| 44 (penalty turns) | **HOUSE** | One 360° net-rotation turn per breach (RRS wants two turns incl. tack+gybe for Part 2, one for rule 31); untaken turns → +15 s each at finish. Deliberate design. |

## The umpire (who actually gets penalized)

1. **Contact** (~14355): give-way boat (with mark-room immunity). If ROW is
   undetermined, **both boats are penalized** — a house call that can punish a
   legal pair; worth one scenario.
2. **No-contact foul** (~905): stand-on forced >0.35 rad at HIGH+ for 0.8 s,
   with needed-gap, role-stability, rule-16-grace and mark-room guards.
3. **Rule 19 squeeze** (~21747), **Rule 31 mark touch** (~14442).
4. Nothing for: 16.2, 17, 18.3, 20, 23, exoneration reversals.

## Existing test nucleus (the battery generalizes these)

`test_markroom.js` (18.2 basics — and the hard-won lesson: **every case must
assert its own preconditions**; two versions passed on a broken engine because
the setup wasn't what it claimed), `test_rule11.js` (leeward definition),
`test_start_crossing.js` / `test_start_line.js` / `test_gates.js` (scoring
layer), `test_rounding*.js` (course side).

## Battery priorities that fall out of this

- **P0 — decisions before scenarios**: wire-or-delete the dead constraints;
  intended exoneration behavior; both-penalized-on-undetermined.
- **P1 — mis-encodings with live effect**: rule 17 flag logic (once wired),
  16.2 proxy, the keep-clear proxy thresholds (DEV/HOLD as the de-facto
  definition).
- **P2 — absences that occur every race**: 18.1(a)(3) approach-vs-leave,
  18.3 tack-in-the-zone, 20 room-to-tack (river), 23 finished-boat traffic.
- **P3 — verification of the encoded core**: 10-13, 18.2, 21, 19.2(c), each
  with precondition-asserted 1:1 geometries; scoring scenarios (28/29/31)
  including crossing-while-turning after `32fa7ae`.
