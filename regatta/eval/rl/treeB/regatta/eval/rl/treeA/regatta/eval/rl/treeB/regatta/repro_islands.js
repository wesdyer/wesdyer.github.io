
// Mock state and helpers
const state = {
    race: {
        conditions: {
            islandCoverage: 0.2, // Some coverage
            islandSize: 0.5,
            islandClustering: 0.9 // High clustering
        },
        seed: 123
    },
    course: {
        boundary: { x: 0, y: 0, radius: 4000 },
        marks: [
            {x: -100, y: -100}, {x: 100, y: 100}, // Start
            {x: 0, y: 3000}, {x: 100, y: 3100} // Upwind
        ]
    }
};

function mulberry32(a) {
    return function() {
      var t = a += 0x6D2B79F5;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
}

// Copy-paste relevant parts of generateIslands logic for testing
function generateIslands(boundary) {
    const islands = [];
    const coverage = state.race.conditions.islandCoverage || 0;
    if (coverage <= 0) return [];

    const rng = mulberry32(state.race.seed);

    const sizeSetting = state.race.conditions.islandSize !== undefined ? state.race.conditions.islandSize : 0.5;
    const clustering = state.race.conditions.islandClustering !== undefined ? state.race.conditions.islandClustering : 0.5;

    const courseArea = Math.PI * boundary.radius * boundary.radius;
    const targetLandArea = courseArea * coverage;

    const baseRadius = 60 + sizeSetting * 190;
    const avgIslandArea = Math.PI * baseRadius * baseRadius;
    const targetCount = Math.max(1, Math.round(targetLandArea / avgIslandArea));

    console.log(`Target Count: ${targetCount}, Base Radius: ${baseRadius}`);

    const maxR = boundary.radius - 200;
    const marks = state.course.marks;

    // Clustering Centers
    const clusterCenters = [];
    // Copy existing logic
    if (clustering > 0.3) {
        const numClusters = Math.max(1, Math.floor((1.0 - clustering) * 5) + 1);
        console.log(`Num Clusters: ${numClusters}`);
        for(let i=0; i<numClusters; i++) {
             const angle = rng() * Math.PI * 2;
             const dist = Math.sqrt(rng()) * maxR;
             clusterCenters.push({
                 x: boundary.x + Math.cos(angle)*dist,
                 y: boundary.y + Math.sin(angle)*dist
             });
        }
    }

    let currentArea = 0;
    let fails = 0;
    let generated = 0;

    for(let i=0; i<targetCount * 1.5 && currentArea < targetLandArea; i++) {
        let x, y, valid = false;
        let attempts = 0;

        const sizeVar = rng() * 0.6 + 0.7;
        const radius = baseRadius * sizeVar;

        while(!valid && attempts < 50) {
            attempts++;

            if (clustering > 0.3 && clusterCenters.length > 0 && rng() < clustering) {
                const center = clusterCenters[Math.floor(rng()*clusterCenters.length)];
                const dispersion = 1200 * (1.1 - clustering);
                const angle = rng() * Math.PI * 2;
                const dist = rng() * dispersion;
                x = center.x + Math.cos(angle)*dist;
                y = center.y + Math.sin(angle)*dist;
            } else {
                const angle = rng() * Math.PI * 2;
                const dist = Math.sqrt(rng()) * maxR;
                x = boundary.x + Math.cos(angle) * dist;
                y = boundary.y + Math.sin(angle) * dist;
            }

            if ((x-boundary.x)**2 + (y-boundary.y)**2 > maxR**2) continue;

            valid = true;

            // Simplified checks for repro
            const markClearance = 350 + radius;
            for (const m of marks) {
                if ((x-m.x)**2 + (y-m.y)**2 < markClearance**2) { valid = false; break; }
            }
            if (!valid) continue;

            for (const isl of islands) {
                 const dSq = (x-isl.x)**2 + (y-isl.y)**2;
                 const minDist = radius + isl.radius + 30;
                 if (dSq < minDist**2) { valid = false; break; }
            }
        }

        if (!valid) {
            fails++;
            if (fails > 20) {
                console.log("Too many fails, stopping generation.");
                break;
            }
            continue;
        }

        islands.push({ x, y, radius });
        currentArea += Math.PI * radius * radius;
        generated++;
    }

    console.log(`Generated: ${generated}`);
    return islands;
}

// Test with high clustering
console.log("Testing High Clustering (0.9)");
state.race.conditions.islandClustering = 0.9;
generateIslands(state.course.boundary);

console.log("\nTesting Medium Clustering (0.5)");
state.race.conditions.islandClustering = 0.5;
generateIslands(state.course.boundary);
