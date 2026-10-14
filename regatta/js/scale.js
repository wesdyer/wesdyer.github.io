// THE WORLD SCALE: everything is sized off the boat, and the boat is a SPINDRIFT 18 (Wes, Oct 13 2026:
// "the whole world scale is based around the current boat length being 18 feet"). 18 ft is 5.49 m; the
// world is 10 cm to the unit, so the hull is 55 units bow to stern (54.9, held to the whole unit its
// polygon is drawn on — rules.js getHullPoly runs -25..+30). Distances shown in metres, the rules' boat
// lengths, venue documents' metres, and the animals' sizes all come from these. guidelines/scale.md has
// the rules for sizing things against it. Loaded first, by every page.
const SPINDRIFT_FT = 18;
const M_PER_FT = 0.3048;
const WORLD_M_PER_U = 0.1;                                                    // 10 cm a unit
const BOAT_LEN_U = Math.round(SPINDRIFT_FT * M_PER_FT / WORLD_M_PER_U);      // 55
// THE BOWSPRIT'S TIP, in the hull's own frame (bow up, y forward is negative): the foremost point of the
// Spindrift 18's short carbon sprit. The side line art is the reference (Wes, Oct 13 2026): there it runs
// 6.3% of the hull's length past the stem, which on the sprite's 56.4 u hull (stem -25.6) puts the end at
// -29.2; the top-down line art is drawn to the same share. It is EQUIPMENT IN NORMAL POSITION, so it counts where the
// rules say "hull and equipment" (Clear Astern / Overlap, rules.js isClearAstern) and NOT where they say
// "hull" (starting, OCS and finishing: physics.js hullCrossedLine), nor in collisions, which stay on the
// hull polygon. The spinnaker tacks here (render/sprites.js drawBowsprit). Wes, Oct 13 2026.
const BOWSPRIT_TIP_Y = -29.2;
// The racing rules' ZONE round a mark: three hull lengths (RRS Definitions, "Zone") — 165
const ZONE_U = 3 * BOAT_LEN_U;
// A thing's real length in metres, in world units (an animal's true size, before scale.md's ×k)
function lifeU(metres) { return metres / WORLD_M_PER_U; }
