/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Racing Rules of Sailing (RRS 2025-2028) Part 2 — Oracle & Engine
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * This module implements the right-of-way (ROW), mark-room, and limitation
 * rules from Part 2 of the Racing Rules of Sailing as published by
 * US Sailing / World Sailing.
 *
 * EVALUATION ORDER (mirrors RRS priority):
 *
 *  0. Rule 21  (Section D) — OCS/penalty boats must keep clear.
 *     Overrides all Section A/B rules.
 *
 *  1. Rule 13  (While Tacking) — Boat past head-to-wind and not yet
 *     close-hauled keeps clear. Overrides Rules 10/11/12.
 *     Both-tacking: fall through to Rules 10/11/12 for underlying ROW.
 *
 *  2. Rule 18  (Mark-Room) — Sets mark-room entitlement at zone entry.
 *     Exception 18.1(a): Does NOT apply between opposite-tack boats
 *     on a beat to windward.
 *     Note: Mark-room does NOT override Section A ROW; it is a separate
 *     obligation tracked via result.markRoom.
 *
 *  3. Rule 10  (Opposite Tacks) — Port-tack boat keeps clear of
 *     starboard-tack boat.
 *
 *  4. Rule 11  (Same Tack, Overlapped) — Windward boat keeps clear.
 *
 *  5. Rule 12  (Same Tack, Not Overlapped) — Boat clear astern keeps
 *     clear of boat clear ahead.
 *
 *  6. Limitations on ROW boat:
 *     - Rule 15: Acquiring ROW — must initially give other boat room.
 *     - Rule 16: Changing Course — must give keep-clear boat room to respond.
 *       16.2: On a beat, ROW boat shall not bear off if it means the
 *             keep-clear boat must act to keep clear immediately.
 *     - Rule 17: Same Tack, Proper Course — when overlap established from
 *       clear astern within 2 hull lengths, leeward boat shall not sail
 *       above proper course.
 *
 *  7. Rule 14  (Avoid Contact) — Universal obligation for ALL boats.
 *     ROW boat "need not act until it becomes clear the other boat is
 *     not keeping clear." Enforced in AI avoidance (script.js), not here.
 */

(function(window) {

    // ═══════════════════════════════════════════════════════════════
    // Constants
    // ═══════════════════════════════════════════════════════════════

    // RRS Definition — Zone: "The area around a mark within a distance
    // of three hull lengths of the boat nearer to it."
    // Hull length ≈ 55 units → 3 × 55 = 165
    const ZONE_RADIUS = 165;

    // RRS Definition — Tack, Starboard or Port:
    // "A boat is on the tack, starboard or port, corresponding to her
    // windward side."
    const STARBOARD = 1;
    const PORT = -1;

    const HULL_LENGTH = 55; // Approx length from hull polygon

    // ═══════════════════════════════════════════════════════════════
    // Geometry Helpers
    // ═══════════════════════════════════════════════════════════════

    function getHullPoly(boat) {
        // Must match script.js collision hull
        const locals = [
            {x: 0, y: -25}, {x: 15, y: -5}, {x: 15, y: 20},
            {x: 12, y: 30}, {x: -12, y: 30}, {x: -15, y: 20}, {x: -15, y: -5}
        ];
        const cos = Math.cos(boat.heading), sin = Math.sin(boat.heading);
        return locals.map(p => ({
            x: boat.x + (p.x * cos - p.y * sin),
            y: boat.y + (p.x * sin + p.y * cos)
        }));
    }

    function distSq(a, b) {
        return (a.x - b.x)**2 + (a.y - b.y)**2;
    }

    // ═══════════════════════════════════════════════════════════════
    // Rules Engine
    // ═══════════════════════════════════════════════════════════════

    const Rules = {
        interactions: {}, // Key: "id1-id2", Value: { overlapStart, ... }
        lastUpdate: 0,
        DEBUG: false,

        init: function() {
            this.interactions = {};
            this.lastUpdate = 0;
        },

        reset: function() {
            this.init();
        },

        // ═══════════════════════════════════════════════════════════
        // RRS Definitions (Preamble to Part 2)
        // ═══════════════════════════════════════════════════════════

        /**
         * RRS Definition — Tack, Starboard or Port
         *
         * "A boat is on the tack, starboard or port, corresponding to
         * her windward side." In practice, this means the side the boom
         * is NOT on: boom to port → starboard tack (wind from starboard).
         *
         * Implementation: boomSide > 0 means sails are drawn to port
         * (left), so wind comes from starboard → STARBOARD tack.
         */
        getTack: function(boat) {
            return (boat.boomSide > 0) ? STARBOARD : PORT;
        },

        /**
         * RRS Definition — Clear Astern / Clear Ahead
         *
         * "A boat is clear astern of another when her hull and equipment
         * in normal position are behind a line abeam from the aftermost
         * point of the other boat's hull and equipment in normal position.
         * The other boat is clear ahead."
         *
         * Implementation: Projects the "behind" boat's bow onto the
         * "ahead" boat's abeam line at its stern. If the dot product
         * with the ahead boat's forward vector is negative, the bow is
         * behind the abeam line → clear astern.
         */
        isClearAstern: function(behind, ahead) {
            const h = ahead.heading;
            const sin = Math.sin(h), cos = Math.cos(h);

            // Stern position (local 0, 30) in world coords
            const sternX = ahead.x + (0 * cos - 30 * sin);
            const sternY = ahead.y + (0 * sin + 30 * cos);

            // Forward vector (heading 0 → forward is (0, -1) → rotated: (sin h, -cos h))
            const fwdX = Math.sin(h);
            const fwdY = -Math.cos(h);

            // Behind boat's bow (local 0, -25) in world coords
            const bH = behind.heading;
            const bSin = Math.sin(bH), bCos = Math.cos(bH);
            const bowX = behind.x + (0 * bCos - (-25) * bSin);
            const bowY = behind.y + (0 * bSin + (-25) * bCos);

            const dx = bowX - sternX;
            const dy = bowY - sternY;

            // Negative dot → bow is behind the abeam line
            return (dx * fwdX + dy * fwdY) < -0.1;
        },

        /**
         * RRS Definition — Overlap
         *
         * "Two boats overlap when neither is clear astern of the other.
         * However, they also overlap when a boat between them overlaps
         * both." (Multi-boat overlap not implemented.)
         */
        isOverlapped: function(b1, b2) {
            return !this.isClearAstern(b1, b2) && !this.isClearAstern(b2, b1);
        },

        distToMark: function(boat, mark) {
            return Math.sqrt((boat.x - mark.x)**2 + (boat.y - mark.y)**2);
        },

        /**
         * RRS Definition — Zone
         *
         * "The area around a mark within a distance of three hull lengths
         * of the boat nearer to it."
         */
        inZone: function(boat, mark) {
            return this.distToMark(boat, mark) < ZONE_RADIUS;
        },

        /**
         * RRS Definition — Leeward / Windward
         *
         * "A boat's leeward side is the side that is or, when she is
         * head to wind, was away from the wind. The other boat is the
         * windward boat."
         *
         * Implementation: Projects the vector between boats onto the
         * wind-perpendicular axis to determine which is further downwind
         * (leeward) vs upwind (windward). Tack-aware for correct sign.
         */
        getLeewardBoat: function(b1, b2) {
            const state = window.state;
            const wd = state.wind.direction;
            const t1 = this.getTack(b1);
            const dx = b2.x - b1.x;
            const dy = b2.y - b1.y;
            const wx = Math.sin(wd);
            const wy = -Math.cos(wd);
            // Wind-perpendicular (right of wind direction)
            const rx = -wy;
            const ry = wx;
            const dot = dx * rx + dy * ry;

            if (t1 === STARBOARD) {
                return (dot > 0) ? b1 : b2; // dot>0 → b2 windward, b1 leeward
            } else {
                return (dot > 0) ? b2 : b1; // PORT: dot>0 → b2 leeward
            }
        },

        // ═══════════════════════════════════════════════════════════
        // Core Logic — Continuous State Tracking
        // ═══════════════════════════════════════════════════════════

        /**
         * update() — Called each frame to maintain interaction state:
         *
         * 1. Overlap tracking (for Rule 11/12 determination and Rule 17
         *    "overlap from clear astern" context).
         *
         * 2. Zone latching (Rule 18) — captures a snapshot of overlap/
         *    inside status at the moment the first boat reaches the zone,
         *    per RRS 18.2(a) and 18.2(b).
         */
        update: function(dt) {
            const state = window.state;
            if (!state || !state.boats) return;
            const now = state.time;

            for (let i = 0; i < state.boats.length; i++) {
                const b1 = state.boats[i];
                if (b1.raceState.finished) continue;

                for (let j = i + 1; j < state.boats.length; j++) {
                    const b2 = state.boats[j];
                    if (b2.raceState.finished) continue;

                    const key = [b1.id, b2.id].sort((a,b) => a-b).join('-');
                    if (!this.interactions[key]) {
                        this.interactions[key] = {
                            overlap: false,
                            overlapStart: 0,
                            // Rule 17: Was overlap established from clear astern
                            // within 2 hull lengths? (RRS 17: "If a boat clear
                            // astern becomes overlapped within two of her hull
                            // lengths to leeward of a boat on the same tack, she
                            // shall not sail above her proper course...")
                            overlapFromClearAstern: false,
                            overlapSide: 0, // 1 if b1 leeward, -1 if b2 leeward
                            // Rule 18 zone snapshot (RRS 18.2(a)/(b))
                            zoneSnapshot: null,
                            rowOwner: null,
                            rowChangeTime: 0
                        };
                    }
                    const data = this.interactions[key];

                    // ─── 1. Overlap Status ────────────────────────────
                    // RRS Definition — Overlap: "Two boats overlap when
                    // neither is clear astern of the other."
                    const currentlyOverlapped = this.isOverlapped(b1, b2);
                    if (currentlyOverlapped && !data.overlap) {
                        data.overlap = true;
                        data.overlapStart = now;

                        // Rule 17 context: track if overlap was established
                        // from clear astern within 2 hull lengths
                        data.overlapFromClearAstern = false;
                        const dist = Math.sqrt(distSq(b1, b2));
                        if (dist < 2 * HULL_LENGTH) {
                            data.overlapFromClearAstern = true;
                        }
                    } else if (!currentlyOverlapped && data.overlap) {
                        data.overlap = false;
                        data.overlapStart = 0;
                        data.overlapFromClearAstern = false;
                    }

                    // ─── 2. Zone Latching (Rule 18) ──────────────────
                    // RRS 18.2(a): "If boats are overlapped when the first
                    // of them reaches the zone, the outside boat at that
                    // moment shall thereafter give the inside boat mark-room."
                    //
                    // RRS 18.2(b): "If boats are not overlapped when the
                    // first of them reaches the zone, the boat that at that
                    // moment is clear astern shall thereafter give mark-room
                    // to the boat that is clear ahead."
                    if (state.course && state.course.marks) {
                        let activeMarkIndex = -1;
                        for (let mIdx = 0; mIdx < state.course.marks.length; mIdx++) {
                            const mark = state.course.marks[mIdx];
                            const d1 = this.distToMark(b1, mark);
                            const d2 = this.distToMark(b2, mark);

                            if (d1 < ZONE_RADIUS || d2 < ZONE_RADIUS) {
                                // RRS 18.1: Rule 18 applies "between boats
                                // when they are required to leave a mark on
                                // the same side."
                                // Leg awareness: only snapshot marks relevant
                                // to at least one boat's current leg.
                                // Marks 0,1 = leeward gate (target on even legs: 2, 4)
                                // Marks 2,3 = windward gate (target on odd legs: 1, 3)
                                const markIsWindward = (mIdx >= 2);
                                const b1NeedsWindward = (b1.raceState.leg % 2 !== 0);
                                const b2NeedsWindward = (b2.raceState.leg % 2 !== 0);

                                // Skip if neither boat is heading to this type of mark
                                if (markIsWindward && !b1NeedsWindward && !b2NeedsWindward) continue;
                                if (!markIsWindward && b1NeedsWindward && b2NeedsWindward) continue;

                                activeMarkIndex = mIdx;
                                break;
                            }
                        }

                        if (activeMarkIndex !== -1) {
                            const mark = state.course.marks[activeMarkIndex];
                            const b1In = this.inZone(b1, mark);
                            const b2In = this.inZone(b2, mark);

                            // Snapshot: "At the moment the first of them reaches the zone"
                            if (!data.zoneSnapshot || data.zoneSnapshot.markIndex !== activeMarkIndex) {
                                if (b1In || b2In) {
                                    const insideBoat = (this.distToMark(b1, mark) < this.distToMark(b2, mark)) ? b1.id : b2.id;
                                    data.zoneSnapshot = {
                                        markIndex: activeMarkIndex,
                                        time: now,
                                        overlapped: currentlyOverlapped,
                                        entitled: null
                                    };

                                    if (currentlyOverlapped) {
                                        // RRS 18.2(a): inside boat gets mark-room
                                        data.zoneSnapshot.entitled = insideBoat;
                                        data.zoneSnapshot.reason = "Inside Overlapped";
                                    } else {
                                        // RRS 18.2(b): clear-ahead boat gets mark-room
                                        if (this.isClearAstern(b2, b1)) data.zoneSnapshot.entitled = b1.id;
                                        else if (this.isClearAstern(b1, b2)) data.zoneSnapshot.entitled = b2.id;
                                        else {
                                            // Fallback: closer to mark
                                            data.zoneSnapshot.entitled = insideBoat;
                                        }
                                        data.zoneSnapshot.reason = "Clear Ahead";
                                    }
                                }
                            } else {
                                // Existing snapshot — check exit conditions
                                // RRS 18.2(b): obligation ends when entitled boat
                                // leaves the zone or passes head to wind
                                if (data.zoneSnapshot.entitled) {
                                    const entitledId = data.zoneSnapshot.entitled;
                                    const entitledBoat = (b1.id === entitledId) ? b1 : b2;
                                    if (!this.inZone(entitledBoat, mark)) {
                                        data.zoneSnapshot = null;
                                    }
                                    if (data.zoneSnapshot && entitledBoat.raceState.isTacking) {
                                         data.zoneSnapshot = null;
                                    }
                                }
                                if (data.zoneSnapshot && !b1In && !b2In) {
                                    data.zoneSnapshot = null;
                                }
                            }
                        } else {
                            data.zoneSnapshot = null;
                        }
                    }
                }
            }
        },

        // ═══════════════════════════════════════════════════════════
        // evaluate() — Determine ROW for a pair of boats
        // ═══════════════════════════════════════════════════════════

        evaluate: function(b1, b2) {
            const state = window.state;
            const key = [b1.id, b2.id].sort((a,b) => a-b).join('-');
            const data = this.interactions[key];
            const now = state.time;

            let result = {
                rowBoat: null,
                rule: "",
                reason: "",
                markRoom: null,  // ID of boat entitled to mark-room
                constraints: []  // Limitation rules flagged for ROW boat
            };

            const t1 = this.getTack(b1);
            const t2 = this.getTack(b2);
            const oppositeTacks = (t1 !== t2);

            // ─── 0. Rule 21 (Section D) ──────────────────────────
            // RRS 21: "A boat that is sailing towards the pre-start
            // side of the starting line or one of its extensions after
            // her starting signal to comply with rule 30.1 [OCS], or
            // a boat that is taking a penalty, shall keep clear of a
            // boat that is not."
            //
            // Obligation: OCS/penalty boat must keep clear of all
            // non-OCS/non-penalty boats.
            // Overrides: All of Section A (Rules 10-13).
            // Exception: If both boats are returning/penalized, Section D
            // does not apply between them; fall through to normal rules.
            const b1Returning = b1.raceState.ocs || b1.raceState.penalty;
            const b2Returning = b2.raceState.ocs || b2.raceState.penalty;

            if (b1Returning && !b2Returning) {
                result.rowBoat = b2;
                result.rule = "Rule 21";
                result.reason = b1.raceState.ocs ? "Returning to Start" : "Taking Penalty";
                return result;
            }
            if (b2Returning && !b1Returning) {
                result.rowBoat = b1;
                result.rule = "Rule 21";
                result.reason = b2.raceState.ocs ? "Returning to Start" : "Taking Penalty";
                return result;
            }

            // ─── 1. Rule 13 (While Tacking) ─────────────────────
            // RRS 13: "After a boat passes head to wind, she shall keep
            // clear of other boats until she is on a close-hauled course.
            // During that time rules 10, 11 and 12 do not apply."
            //
            // Obligation: Tacking boat keeps clear.
            // Overrides: Rules 10, 11, 12.
            // Both tacking: Rule 13 does not determine ROW between them;
            // fall through to Rules 10/11/12 as underlying basis.
            if (b1.raceState.isTacking || b2.raceState.isTacking) {
                if (b1.raceState.isTacking && b2.raceState.isTacking) {
                    // Both tacking — Rule 13 applies to both but doesn't
                    // resolve who keeps clear. Use underlying Rules 10/11/12.
                    result.rule = "Rule 13";
                    if (this.isClearAstern(b1, b2)) { result.rowBoat = b2; result.reason = "Tacking (Astern)"; }
                    else if (this.isClearAstern(b2, b1)) { result.rowBoat = b1; result.reason = "Tacking (Astern)"; }
                    else if (t1 !== t2) {
                        // Opposite tacks → Rule 10 basis
                        result.rowBoat = (t1 === STARBOARD) ? b1 : b2;
                        result.reason = "Both Tacking (Starboard)";
                    } else {
                        // Same tack → Rule 11 basis
                        result.rowBoat = this.getLeewardBoat(b1, b2);
                        result.reason = "Both Tacking (Leeward)";
                    }
                } else if (b1.raceState.isTacking) {
                    result.rowBoat = b2;
                    result.rule = "Rule 13";
                    result.reason = "Tacking";
                } else {
                    result.rowBoat = b1;
                    result.rule = "Rule 13";
                    result.reason = "Tacking";
                }
                return result;
            }

            // ─── 2. Rule 18 (Mark-Room) ─────────────────────────
            // RRS 18.1: "Rule 18 applies between boats when they are
            // required to leave a mark on the same side..."
            //
            // RRS 18.1(a) Exception: "...rule 18 does not apply between
            // boats on opposite tacks on a beat to windward."
            //
            // Implementation: Mark-room is a SEPARATE obligation from
            // Section A ROW. We set result.markRoom to the entitled
            // boat's ID. The collision handler uses effectiveRow =
            // (markRoom > rowBoat) to give mark-room priority.
            if (data && data.zoneSnapshot && data.zoneSnapshot.entitled !== null) {
                let rule18Applies = true;

                if (oppositeTacks) {
                    // Beats to windward: odd legs (1, 3) and leg 0 (start)
                    const b1OnBeat = (b1.raceState.leg % 2 !== 0) || b1.raceState.leg === 0;
                    const b2OnBeat = (b2.raceState.leg % 2 !== 0) || b2.raceState.leg === 0;
                    if (b1OnBeat || b2OnBeat) {
                        rule18Applies = false; // 18.1(a) exception
                    }
                }

                if (rule18Applies) {
                    const entitledId = data.zoneSnapshot.entitled;
                    result.markRoom = entitledId;
                }
            }

            // ─── 3. Rule 10 (Opposite Tacks) ────────────────────
            // RRS 10: "When boats are on opposite tacks, a port-tack
            // boat shall keep clear of a starboard-tack boat."
            if (oppositeTacks) {
                if (t1 === STARBOARD) { result.rowBoat = b1; result.reason = "Starboard"; }
                else { result.rowBoat = b2; result.reason = "Starboard"; }
                result.rule = "Rule 10";

                // Rule 16.2 constraint flag
                // RRS 16.2: "In addition, on a beat to windward, if a
                // port-tack boat is keeping clear by pointing at or above
                // close-hauled, a starboard-tack boat shall not bear off
                // if it results in the port-tack boat having to act
                // immediately to keep clear."
                if (b1.raceState.leg % 2 !== 0 && b2.raceState.leg % 2 !== 0) {
                    result.constraints.push("Rule 16.2");
                }

                return result;
            }

            // ─── 4. Rules 11 & 12 (Same Tack) ───────────────────
            // RRS 11: "When boats are on the same tack and overlapped,
            // a windward boat shall keep clear of a leeward boat."
            //
            // RRS 12: "When boats are on the same tack and not overlapped,
            // a boat clear astern shall keep clear of a boat clear ahead."
            const overlapped = this.isOverlapped(b1, b2);

            if (overlapped) {
                result.rowBoat = this.getLeewardBoat(b1, b2);
                result.reason = "Leeward";
                result.rule = "Rule 11";

                // Rule 17 constraint
                // RRS 17: "If a boat clear astern becomes overlapped within
                // two of her hull lengths to leeward of a boat on the same
                // tack, she shall not sail above her proper course while
                // they remain on the same tack and overlapped within that
                // distance, unless while doing so she promptly sails astern
                // of the other boat."
                if (data && data.overlap && data.overlapFromClearAstern) {
                    result.constraints.push("Rule 17");
                }

            } else {
                // Rule 12
                if (this.isClearAstern(b2, b1)) { // b2 behind b1
                    result.rowBoat = b1;
                    result.reason = "Clear Ahead";
                } else {
                    result.rowBoat = b2;
                    result.reason = "Clear Ahead";
                }
                result.rule = "Rule 12";
            }

            // ─── Rule 15 (Acquiring ROW) ─────────────────────────
            // RRS 15: "When a boat acquires right of way, she shall
            // initially give the other boat room to keep clear, unless
            // she acquires right of way because of the other boat's
            // actions."
            //
            // Implementation: 2-second grace period after ROW changes
            // hands. During this window, "Rule 15" is flagged as a
            // constraint on the new ROW boat.
            if (data) {
                if (result.rowBoat && data.rowOwner !== result.rowBoat.id) {
                    data.rowOwner = result.rowBoat.id;
                    data.rowChangeTime = now;
                }
                if (now - data.rowChangeTime < 2.0) {
                    result.constraints.push("Rule 15");
                }
            }

            return result;
        },

        // Wrapper for compatibility with existing script.js
        getRightOfWay: function(b1, b2) {
            const res = this.evaluate(b1, b2);
            return {
                boat: res.rowBoat,
                rule: res.rule,
                reason: res.reason,
                markRoom: res.markRoom
            };
        },

        /**
         * getDebugInfo() — Returns human-readable rule status for a pair.
         * Used by the debug overlay and HUD.
         */
        getDebugInfo: function(b1, b2) {
            const res = this.evaluate(b1, b2);
            const key = [b1.id, b2.id].sort((a,b) => a-b).join('-');
            const data = this.interactions[key];

            let info = [
                `Rule: ${res.rule} (${res.reason})`,
                `ROW: ${res.rowBoat ? res.rowBoat.name : 'None'}`,
            ];
            if (res.markRoom) info.push(`Mark-Room: ${res.markRoom === b1.id ? b1.name : b2.name}`);
            if (data && data.zoneSnapshot) info.push(`Zone Lock: ${data.zoneSnapshot.reason}`);
            if (res.constraints.length) info.push(`Limits: ${res.constraints.join(',')}`);

            // Rule 21 status indicators
            if (b1.raceState.ocs || b2.raceState.ocs) info.push('OCS Active');
            if (b1.raceState.penalty || b2.raceState.penalty) info.push('Penalty Active');

            return info;
        }
    };

    window.Rules = Rules;

})(window);
