/**
 * Racing Rules of Sailing (RRS) Part 2 - Oracle & Engine
 *
 * Definitions:
 * - Tack: Determined by wind angle relative to boat heading.
 *         Starboard (Wind from Stbd/Right) vs Port (Wind from Port/Left).
 * - Overlap: Exists when neither boat is clear astern of the other.
 * - Clear Astern: Hull & equipment of one is behind line abeam from aftermost point of other.
 * - Zone: 3 Hull Lengths (165 units) around a mark.
 * - Mark-Room: Room to sail to the mark and round it seamanlike.
 * - Proper Course: Course to finish/mark in absence of other boats.
 *
 * Interaction Table (Evaluation Order):
 * 0. Rule 21 (Section D): OCS/penalty boats must keep clear. Overrides all.
 * 1. Rule 13 (Tacking): Overrides 10/11/12. Both-tacking falls through to 10/11.
 * 2. Rule 18 (Mark-Room): Sets mark-room obligation (NOT on beats w/ opposite tacks per 18.1a).
 *    Section A rules still independently determine ROW.
 * 3. Rule 10 (Opposite Tacks): Port keeps clear.
 * 4. Rule 11 (Same Tack, Overlapped): Windward keeps clear.
 * 5. Rule 12 (Same Tack, Not Overlapped): Clear Astern keeps clear.
 * 6. Limitations (15, 16, 17): Constrain the ROW boat.
 * 7. Rule 14 (Avoid Contact): Universal obligation.
 */

(function(window) {

    // --- Constants ---
    const ZONE_RADIUS = 165;
    const STARBOARD = 1;
    const PORT = -1;
    const HULL_LENGTH = 55; // Approx length from Hull Polygon

    // --- Geometry Helpers ---
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

    // --- Rules Engine ---
    const Rules = {
        interactions: {}, // Key: "id1-id2", Value: { overlapStart: 0, ... }
        lastUpdate: 0,
        DEBUG: false,

        init: function() {
            this.interactions = {};
            this.lastUpdate = 0;
        },

        reset: function() {
            this.init();
        },

        // --- Definitions ---

        getTack: function(boat) {
            // boomSide 1 = Sails Left = Wind from Right = STARBOARD
            // boomSide -1 = Sails Right = Wind from Left = PORT
            return (boat.boomSide > 0) ? STARBOARD : PORT;
        },

        isClearAstern: function(behind, ahead) {
            // "behind a line abeam from the aftermost point of the other boat's hull"
            // Ahead Boat Stern is at (0, 30) relative to center.
            // Abeam line normal is Forward Vector (0, -1).
            const h = ahead.heading;
            const sin = Math.sin(h), cos = Math.cos(h);

            // Stern Position (World)
            // Local (0, 30)
            const sternX = ahead.x + (0 * cos - 30 * sin);
            const sternY = ahead.y + (0 * sin + 30 * cos);

            // Forward Vector (Normal to abeam line)
            // Heading 0 -> Forward (0, -1).
            // Vector (sin(h), -cos(h))
            const fwdX = Math.sin(h);
            const fwdY = -Math.cos(h);

            // Check Behind's Bow
            // Bow Local (0, -25)
            const bH = behind.heading;
            const bSin = Math.sin(bH), bCos = Math.cos(bH);
            const bowX = behind.x + (0 * bCos - (-25) * bSin); // +25 sin
            const bowY = behind.y + (0 * bSin + (-25) * bCos); // -25 cos

            const dx = bowX - sternX;
            const dy = bowY - sternY;

            // Dot product with Forward. If negative, it is behind the abeam line.
            return (dx * fwdX + dy * fwdY) < -0.1; // Epsilon
        },

        isOverlapped: function(b1, b2) {
            // "Neither is clear astern of the other"
            return !this.isClearAstern(b1, b2) && !this.isClearAstern(b2, b1);
        },

        distToMark: function(boat, mark) {
            return Math.sqrt((boat.x - mark.x)**2 + (boat.y - mark.y)**2);
        },

        inZone: function(boat, mark) {
            // Simple radius check
            return this.distToMark(boat, mark) < ZONE_RADIUS;
        },

        getLeewardBoat: function(b1, b2) {
            const state = window.state;
            const wd = state.wind.direction;
            const t1 = this.getTack(b1);
            const dx = b2.x - b1.x;
            const dy = b2.y - b1.y;
            const wx = Math.sin(wd);
            const wy = -Math.cos(wd);
            const rx = -wy;
            const ry = wx;
            const dot = dx * rx + dy * ry;

            if (t1 === STARBOARD) {
                return (dot > 0) ? b1 : b2; // dot>0 means b2 is windward, b1 is leeward
            } else {
                return (dot > 0) ? b2 : b1; // PORT: dot>0 means b2 is leeward
            }
        },

        // --- Core Logic ---

        update: function(dt) {
            const state = window.state;
            if (!state || !state.boats) return;
            const now = state.time;

            // Iterate all unique pairs
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
                            overlapFromClearAstern: false, // Rule 17: was overlap established from clear astern within 2 hull lengths?
                            overlapSide: 0, // 1 if b1 is Leeward, -1 if b2 is Leeward (relative)
                            zoneSnapshot: null, // { markIndex: -1, b1In: false, b2In: false, overlapped: false, inside: null }
                            rowOwner: null,
                            rowChangeTime: 0
                        };
                    }
                    const data = this.interactions[key];

                    // 1. Update Overlap Status
                    const currentlyOverlapped = this.isOverlapped(b1, b2);
                    if (currentlyOverlapped && !data.overlap) {
                        data.overlap = true;
                        data.overlapStart = now;

                        // Rule 17: Track if overlap was established from clear astern within 2 hull lengths
                        data.overlapFromClearAstern = false;
                        const dist = Math.sqrt(distSq(b1, b2));
                        if (dist < 2 * HULL_LENGTH) {
                            // Check if one boat was clear astern just before overlap began
                            // At the moment of overlap establishment, use current positions as proxy
                            data.overlapFromClearAstern = true;
                        }
                    } else if (!currentlyOverlapped && data.overlap) {
                        data.overlap = false;
                        data.overlapStart = 0;
                        data.overlapFromClearAstern = false;
                    }

                    // 2. Zone Latching (Rule 18)
                    // Identify active marks for this pair.
                    // Assume they are racing to the same mark if legs are similar or proximity logic holds.
                    // Simplified: Check all marks.
                    if (state.course && state.course.marks) {
                        let activeMarkIndex = -1;
                        // Find mark closest to being "approached"
                        // Or just use the one they are near.
                        for (let mIdx = 0; mIdx < state.course.marks.length; mIdx++) {
                            const mark = state.course.marks[mIdx];
                            const d1 = this.distToMark(b1, mark);
                            const d2 = this.distToMark(b2, mark);

                            // Check if either is in zone
                            if (d1 < ZONE_RADIUS || d2 < ZONE_RADIUS) {
                                activeMarkIndex = mIdx;
                                break;
                            }
                        }

                        if (activeMarkIndex !== -1) {
                            const mark = state.course.marks[activeMarkIndex];
                            const b1In = this.inZone(b1, mark);
                            const b2In = this.inZone(b2, mark);

                            // Snapshot Logic: "At the moment the first of them reaches the zone"
                            if (!data.zoneSnapshot || data.zoneSnapshot.markIndex !== activeMarkIndex) {
                                // New zone encounter or entering for first time
                                if (b1In || b2In) {
                                    // Create Snapshot
                                    const insideBoat = (this.distToMark(b1, mark) < this.distToMark(b2, mark)) ? b1.id : b2.id;
                                    data.zoneSnapshot = {
                                        markIndex: activeMarkIndex,
                                        time: now,
                                        overlapped: currentlyOverlapped,
                                        // If overlapped, Inside boat ID. If not, Clear Ahead boat ID is "inside" (entitled).
                                        // Wait, 18.2(a) says: "If overlapped... give inside mark-room".
                                        // "If not overlapped... not yet in zone must give mark-room". (Clear Ahead gets room).
                                        entitled: null
                                    };

                                    if (currentlyOverlapped) {
                                        // Determine inside boat
                                        // Inside is closest to mark? Generally yes.
                                        data.zoneSnapshot.entitled = insideBoat;
                                        data.zoneSnapshot.reason = "Inside Overlapped";
                                    } else {
                                        // Not overlapped. Clear Ahead is entitled.
                                        // Who is clear ahead?
                                        if (this.isClearAstern(b2, b1)) data.zoneSnapshot.entitled = b1.id; // b2 astern -> b1 ahead
                                        else if (this.isClearAstern(b1, b2)) data.zoneSnapshot.entitled = b2.id; // b1 astern -> b2 ahead
                                        else {
                                            // Neither clear astern? Then overlapped. Contradiction.
                                            // Fallback: Closer to mark
                                            data.zoneSnapshot.entitled = insideBoat;
                                        }
                                        data.zoneSnapshot.reason = "Clear Ahead";
                                    }
                                }
                            } else {
                                // Existing snapshot. Check exit conditions.
                                // 18.2(b): If entitled boat leaves zone.
                                if (data.zoneSnapshot.entitled) {
                                    const entitledId = data.zoneSnapshot.entitled;
                                    const entitledBoat = (b1.id === entitledId) ? b1 : b2;
                                    if (!this.inZone(entitledBoat, mark)) {
                                        data.zoneSnapshot = null; // Reset
                                    }
                                    // Also if entitled boat tacks? "If the boat entitled... passes head to wind"
                                    if (entitledBoat.raceState.isTacking) {
                                         data.zoneSnapshot = null;
                                    }
                                }
                                // If both leave zone?
                                if (!b1In && !b2In) {
                                    data.zoneSnapshot = null;
                                }
                            }
                        } else {
                            // No one in zone
                            data.zoneSnapshot = null;
                        }
                    }
                }
            }
        },

        evaluate: function(b1, b2) {
            const state = window.state;
            const key = [b1.id, b2.id].sort((a,b) => a-b).join('-');
            const data = this.interactions[key];
            const now = state.time;

            // Default Result
            let result = {
                rowBoat: null,
                rule: "",
                reason: "",
                markRoom: null, // ID of boat entitled
                constraints: []
            };

            const t1 = this.getTack(b1);
            const t2 = this.getTack(b2);
            const oppositeTacks = (t1 !== t2);

            // --- 0. Rule 21 (Section D) ---
            // Boats taking penalties, returning to start (OCS), or sailing backwards must keep clear
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
            // If both returning/penalized, fall through to normal rules

            // --- 1. Rule 13 (Tacking) ---
            if (b1.raceState.isTacking || b2.raceState.isTacking) {
                if (b1.raceState.isTacking && b2.raceState.isTacking) {
                    // Both tacking: fall through to underlying rules (10/11/12)
                    if (this.isClearAstern(b1, b2)) { result.rowBoat = b2; result.reason = "Tacking (Astern)"; }
                    else if (this.isClearAstern(b2, b1)) { result.rowBoat = b1; result.reason = "Tacking (Astern)"; }
                    else if (t1 !== t2) {
                        // Opposite tacks: Rule 10 (port keeps clear)
                        result.rowBoat = (t1 === STARBOARD) ? b1 : b2;
                        result.reason = "Both Tacking (Starboard)";
                    } else {
                        // Same tack: Rule 11 (windward keeps clear)
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

            // --- 2. Rule 18 (Mark-Room) ---
            // Exception 18.1(a)(1): Rule 18 does NOT apply between boats on opposite tacks
            // on a beat to windward (upwind legs)
            if (data && data.zoneSnapshot && data.zoneSnapshot.entitled !== null) {
                let rule18Applies = true;

                if (oppositeTacks) {
                    // Beat to windward: odd legs (1, 3) are upwind, leg 0 is pre-start/start
                    const b1OnBeat = (b1.raceState.leg % 2 !== 0) || b1.raceState.leg === 0;
                    const b2OnBeat = (b2.raceState.leg % 2 !== 0) || b2.raceState.leg === 0;
                    if (b1OnBeat || b2OnBeat) {
                        rule18Applies = false;
                    }
                }

                if (rule18Applies) {
                    const entitledId = data.zoneSnapshot.entitled;
                    result.markRoom = entitledId;
                    // Mark-room is tracked separately; Section A rules below still determine ROW.
                    // In collision logic, markRoom entitled boat gets immunity (outside must give room).
                }
            }

            // --- 3. Rule 10 (Opposite Tacks) ---
            if (oppositeTacks) {
                if (t1 === STARBOARD) { result.rowBoat = b1; result.reason = "Starboard"; }
                else { result.rowBoat = b2; result.reason = "Starboard"; }
                result.rule = "Rule 10";

                // Rule 16.2 Check: On beat to windward?
                // Assuming Leg 1/3 is beat.
                if (b1.raceState.leg % 2 !== 0 && b2.raceState.leg % 2 !== 0) {
                    // If ROW boat (Starboard) bears away...
                    // We just flag constraint.
                    result.constraints.push("Rule 16.2");
                }

                return result;
            }

            // --- 4. Same Tack (Rule 11 & 12) ---
            // If overlapped: Rule 11 (Windward Keep Clear)
            // If not: Rule 12 (Clear Astern Keep Clear)

            const overlapped = this.isOverlapped(b1, b2);

            if (overlapped) {
                // Rule 11: Windward boat keeps clear
                result.rowBoat = this.getLeewardBoat(b1, b2);
                result.reason = "Leeward";
                result.rule = "Rule 11";

                // Rule 17 Check: Only applies if overlap was established from clear astern
                // within 2 hull lengths
                if (data && data.overlap && data.overlapFromClearAstern) {
                    result.constraints.push("Rule 17");
                }

            } else {
                // Rule 12
                if (this.isClearAstern(b2, b1)) { // b2 is behind b1
                    result.rowBoat = b1; // Ahead
                    result.reason = "Clear Ahead";
                } else {
                    result.rowBoat = b2; // Ahead
                    result.reason = "Clear Ahead";
                }
                result.rule = "Rule 12";
            }

            // --- Rule 15 (Acquiring ROW) ---
            // If ROW holder changed since last frame/check, apply Rule 15 constraint (initially give room).
            if (data) {
                if (result.rowBoat && data.rowOwner !== result.rowBoat.id) {
                    data.rowOwner = result.rowBoat.id;
                    data.rowChangeTime = now;
                }
                if (now - data.rowChangeTime < 2.0) { // 2 seconds "initially"
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
                markRoom: res.markRoom // ID of boat entitled to mark-room (or null)
            };
        },

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

            return info;
        }
    };

    window.Rules = Rules;

})(window);