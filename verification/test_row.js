
// Mock State
const state = {
    wind: { direction: 0 }
};

// Mock Boat
class Boat {
    constructor(id, x, y, heading, boomSide) {
        this.id = id;
        this.x = x;
        this.y = y;
        this.heading = heading;
        this.boomSide = boomSide; // 1 = Left Boom (Starboard Tack), -1 = Right Boom (Port Tack)
        this.raceState = { isTacking: false, inZone: false };
    }
}

// Paste getRightOfWay here
function getRightOfWay(b1, b2) {
    // 0. Tacking (Rule 13) - Keep Clear while tacking
    if (b1.raceState.isTacking && !b2.raceState.isTacking) return b2;
    if (!b1.raceState.isTacking && b2.raceState.isTacking) return b1;
    // If both tacking, standard collision rules (or both keep clear of each other? Rule 13 only says keep clear of other boats)

    // 1. Mark Room (Rule 18) - First in zone has rights
    if (b1.raceState.inZone && !b2.raceState.inZone) return b1;
    if (!b1.raceState.inZone && b2.raceState.inZone) return b2;
    if (b1.raceState.inZone && b2.raceState.inZone) {
         if (b1.raceState.zoneEnterTime < b2.raceState.zoneEnterTime) return b1;
         if (b2.raceState.zoneEnterTime < b1.raceState.zoneEnterTime) return b2;
    }

    // 2. Opposite Tacks (Rule 10)
    // boomSide > 0 (Left Boom) => Starboard Tack
    const t1 = b1.boomSide > 0 ? 1 : -1;
    const t2 = b2.boomSide > 0 ? 1 : -1;

    if (t1 !== t2) {
        return (t1 === 1) ? b1 : b2; // Starboard (1) wins
    }

    // 3. Same Tack (Rule 11: Windward/Leeward & Rule 12: Clear Astern)
    // Check Clear Astern (Rule 12)
    // A boat is Clear Astern if its hull is behind a line abeam from the aftermost point of the other boat.
    // Overlap exists if neither is clear astern.
    // If NOT overlapped, Clear Astern keeps clear.

    const h1 = b1.heading, h2 = b2.heading;
    // We assume courses are roughly similar if same tack.

    // Helper: isClearAstern(behind, ahead)
    const isClearAstern = (behind, ahead) => {
        // Line abeam of ahead's stern.
        // Ahead stern pos:
        const sternOffset = 30;
        const ahX = Math.sin(ahead.heading), ahY = -Math.cos(ahead.heading);
        const sternX = ahead.x - ahX * sternOffset;
        const sternY = ahead.y - ahY * sternOffset;

        // Vector from stern to behind boat
        const dx = behind.x - sternX;
        const dy = behind.y - sternY;

        // Project onto Ahead's forward vector. If < 0, it is behind the stern line.
        // Forward vector (ahX, ahY).
        // Actually, "Behind the line abeam".
        // Abeam line is perpendicular to centerline.
        // So dot product with Forward vector < 0 means behind the abeam line.
        const dot = dx * ahX + dy * ahY;

        // Also check if "Clear" (not overlapping laterally?)
        // Rule definition: "hull is behind a line abeam from the aftermost point..."
        // If dot < 0, it IS clear astern. Even if laterally far.
        // (Assuming "abeam" line extends infinitely).
        return dot < -10; // Buffer
    };

    const b1Astern = isClearAstern(b1, b2);
    const b2Astern = isClearAstern(b2, b1);

    if (b1Astern && !b2Astern) return b2; // b1 Clear Astern -> Keeps Clear -> b2 ROW
    if (b2Astern && !b1Astern) return b1; // b2 Clear Astern -> Keeps Clear -> b1 ROW

    // If Overlapped (Rule 11): Windward gives way to Leeward.
    // Determine Windward side based on Tack.
    const dx = b2.x - b1.x;
    const dy = b2.y - b1.y;
    const wDir = state.wind.direction;

    // Wind Flow Vector (To Direction)
    // wDir 0 is From North (Flow South: 0, 1)
    const fx = -Math.sin(wDir);
    const fy = Math.cos(wDir);

    // Cross Product (Flow x RelPos) to determine Left/Right
    // cp > 0 => Right of Flow (Starboard Side)
    // cp < 0 => Left of Flow (Port Side)
    const cp = fx * dy - fy * dx;

    if (t1 === 1) { // Starboard Tack
        // Windward Side is Right (Starboard). Leeward Side is Left (Port).
        // If cp > 0 (b2 is Right of Flow -> West -> Leeward), b2 (Leeward) ROW.
        // If cp < 0 (b2 is Left of Flow -> East -> Windward), b1 (Leeward) ROW.
        return (cp > 0) ? b2 : b1;
    } else { // Port Tack
        // Windward Side is Left (Port). Leeward Side is Right (Starboard).
        // If cp > 0 (b2 is Right of Flow -> West -> Windward), b1 (Leeward) ROW.
        // If cp < 0 (b2 is Left of Flow -> East -> Leeward), b2 (Leeward) ROW.
        // If cp == 0 (Aligned), assume b2 is Downwind? (Leeward).
        return (cp > 0) ? b1 : b2;
    }
}

// Tests
console.log("Running Rule 11 Verification...");

let failed = false;

function check(caseName, winner, expected) {
    if (winner.id !== expected) {
        console.error(`FAIL [${caseName}]: Expected ${expected}, Got ${winner.id}`);
        failed = true;
    } else {
        console.log(`PASS [${caseName}]: Got ${winner.id}`);
    }
}

// Set WIND: North (0)
state.wind.direction = 0;

// CASE 1: Starboard Tack, B1 Leeward (West), B2 Windward (East)
// Heading NW (-0.78). B1 (0,0), B2 (100,0).
// Wind N(0).
// B2 is Right/East. On STB Tack, Right is Windward.
// B2 Windward. B1 Leeward.
// Expect B1.
{
    const b1 = new Boat('B1', 0, 0, -0.78, 1);
    const b2 = new Boat('B2', 100, 0, -0.78, 1);
    const winner = getRightOfWay(b1, b2);
    check('N-Wind STB: B1 Left/Lee, B2 Right/Wind', winner, 'B1');
}

// CASE 2: Starboard Tack, B1 Windward (East), B2 Leeward (West)
// B1 (100, 0). B2 (0, 0).
// B1 Right/East -> Windward. B2 Left/West -> Leeward.
// Expect B2.
{
    const b1 = new Boat('B1', 100, 0, -0.78, 1);
    const b2 = new Boat('B2', 0, 0, -0.78, 1);
    const winner = getRightOfWay(b1, b2);
    check('N-Wind STB: B1 Right/Wind, B2 Left/Lee', winner, 'B2');
}

// CASE 3: Port Tack, B1 Windward (Left/West), B2 Leeward (Right/East)
// Heading NE (0.78). Boom Right (-1). Port Tack.
// Wind N(0).
// Windward Side is Left (Port). Leeward is Right (Starboard).
// B1 (-100, 0) [West/Left]. B2 (0, 0) [East/Right].
// B1 is Windward. B2 is Leeward.
// Expect B2.
{
    const b1 = new Boat('B1', -100, 0, 0.78, -1);
    const b2 = new Boat('B2', 0, 0, 0.78, -1);
    const winner = getRightOfWay(b1, b2);
    check('N-Wind PORT: B1 Left/Wind, B2 Right/Lee', winner, 'B2');
}

// CASE 4: Port Tack, B1 Leeward (Right/East), B2 Windward (Left/West)
// B1 (0, 0) [East]. B2 (-100, 0) [West].
// B1 Leeward. B2 Windward.
// Expect B1.
{
    const b1 = new Boat('B1', 0, 0, 0.78, -1);
    const b2 = new Boat('B2', -100, 0, 0.78, -1);
    const winner = getRightOfWay(b1, b2);
    check('N-Wind PORT: B1 Right/Lee, B2 Left/Wind', winner, 'B1');
}

// WIND: East (PI/2)
state.wind.direction = Math.PI / 2;

// CASE 5: East Wind, Starboard Tack
// Wind E (Right). Starboard Tack -> Boom Left.
// Heading N (0). (Or slightly left to be STB close hauled? No, let's say Heading 0).
// Wind angle: PI/2 - 0 = PI/2 (Starboard beam). STB Tack.
// Boom Left (Side 1).
// Windward side is Starboard (Right/East). Leeward is Port (Left/West).
// B1 (0, 0). B2 (10, 0) [East].
// B2 is East -> Windward. B1 is West -> Leeward.
// Expect B1.
{
    const b1 = new Boat('B1', 0, 0, 0, 1);
    const b2 = new Boat('B2', 10, 0, 0, 1);
    const winner = getRightOfWay(b1, b2);
    check('E-Wind STB: B1 Lee(West), B2 Wind(East)', winner, 'B1');
}

// CASE 6: East Wind, Starboard Tack, Fore-Aft overlap (Overtaking/Clear Astern check fallback)
// B1 (0, 0). B2 (0, 100) [South/Behind].
// Heading N.
// B1 Ahead. B2 Behind.
// B2 is "Clear Astern" probably?
// Let's check logic:
// isClearAstern(B2, B1) -> B2 is behind B1's stern line?
// Stern line of B1 (at 0,0 heading N) is Y=30.
// B2 is at Y=100.
// B2 is "in front" of B1's stern (since Y increases downwards).
// Wait, Heading 0 is Up (-Y). Stern is Down (+Y).
// Stern pos: (0, 30).
// B2 at (0, 100). B2 is Further +Y (Behind).
// So B2 IS Clear Astern.
// Rule 12: Clear Astern keeps clear.
// So B1 has ROW.
{
    const b1 = new Boat('B1', 0, 0, 0, 1);
    const b2 = new Boat('B2', 0, 100, 0, 1); // Behind
    const winner = getRightOfWay(b1, b2);
    check('E-Wind STB: B1 Ahead, B2 Clear Astern', winner, 'B1');
}

// CASE 7: East Wind, Starboard Tack, Overlapped Fore-Aft (Lateral separation check)
// B1 (0, 0). B2 (0, 40) [South].
// Stern at (0, 30). B2 at (0, 40).
// B2 is 10 units behind stern. Buffer is 10?
// Logic: dot < -10.
// dot: dx=0, dy=10. Forward (0, -1).
// dot = -10.
// dot < -10 is False.
// So NOT Clear Astern. -> Overlapped.
// Rule 11 Applies.
// B2 is South of B1.
// Wind from East.
// Flow is West (-1, 0).
// Cross Product logic:
// B2 relative to B1: (0, 40).
// cp = fx*dy - fy*dx = -1*40 - 0 = -40.
// cp < 0 => Left of Flow.
// Flow West. Left is South. Correct.
// Code says: If Starboard Tack and cp < 0 -> b1 (Leeward) ROW.
// Returns B1.
// Matches expectation (B1 is ahead, B2 is overtaking/behind).
{
    const b1 = new Boat('B1', 0, 0, 0, 1);
    const b2 = new Boat('B2', 0, 40, 0, 1); // Close Behind (Overlapped)
    const winner = getRightOfWay(b1, b2);
    check('E-Wind STB: B1 Ahead, B2 Overlapped Behind', winner, 'B1');
}

if (failed) process.exit(1);
