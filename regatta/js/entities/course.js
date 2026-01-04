
import { state } from '../state/state.js';
import { mulberry32 } from '../utils/math.js';
import { Geom } from '../ai/planner.js'; // Reusing geometry helpers

export function initCourse() {
    const d = state.wind.baseDirection, ux = Math.sin(d), uy = -Math.cos(d), rx = -uy, ry = ux;
    const w = 550;
    const dist = state.race.legLength || 4000;
    state.course = {
        marks: [
            { x: -rx*w/2, y: -ry*w/2, type: 'start' }, { x: rx*w/2, y: ry*w/2, type: 'start' },
            { x: ux*dist - rx*w/2, y: uy*dist - ry*w/2, type: 'mark' }, { x: ux*dist + rx*w/2, y: uy*dist + ry*w/2, type: 'mark' }
        ],
        boundary: { x: ux*dist/2, y: uy*dist/2, radius: Math.max(3500, dist + 500) } // Adjust boundary for long courses
    };

    // Generate Islands
    let islands = [];
    let attempts = 0;
    let valid = false;

    // Only attempt if islands are requested
    if (state.race.conditions.islandCount > 0) {
        while(!valid && attempts < 5) {
            attempts++;
            islands = generateIslands(state.course.boundary);
            if (checkCourseNavigability(islands, state.course.marks)) {
                valid = true;
            }
        }
        if (!valid) {
            console.warn("Failed to generate navigable course with islands.");
            islands = [];
        }
    }
    state.course.islands = islands;
}

function generateIslands(boundary) {
    const islands = [];
    // User Settings
    const islandCount = state.race.conditions.islandCount || 0;
    if (islandCount <= 0) return [];

    const maxSizeSetting = state.race.conditions.islandMaxSize !== undefined ? state.race.conditions.islandMaxSize : 0.5;
    const clustering = state.race.conditions.islandClustering !== undefined ? state.race.conditions.islandClustering : 0.5;

    // Use seeded RNG if available, else standard random (fallback)
    const rng = state.race.seed ? mulberry32(state.race.seed) : Math.random;

    // "Max size of Islands" determines the upper bound for the first island and the random range for others.
    const absoluteMinR = 80;
    const absoluteMaxR = 200 + maxSizeSetting * 1000; // 200 to 1200

    // Boundary Constraints
    const maxWorldR = boundary.radius - 200;

    // Avoidance Geometry
    const marks = state.course.marks;
    if (!marks || marks.length < 4) return [];

    const mStart = { x: (marks[0].x+marks[1].x)/2, y: (marks[0].y+marks[1].y)/2 };
    const mUpwind = { x: (marks[2].x+marks[3].x)/2, y: (marks[2].y+marks[3].y)/2 };

    // Helper: Generate a jagged polygon for a body
    const createIslandBody = (bx, by, br) => {
        const vertices = [];
        const points = 7 + Math.floor(rng() * 6);
        for(let j=0; j<points; j++) {
            const theta = (j / points) * Math.PI * 2;
            const r = br * (0.7 + rng() * 0.6);
            vertices.push({
                x: bx + Math.cos(theta) * r,
                y: by + Math.sin(theta) * r
            });
        }
        // Veg Poly (Inner)
        const vegVertices = vertices.map(v => ({
            x: bx + (v.x - bx) * 0.75,
            y: by + (v.y - by) * 0.75
        }));
        // Trees
        const trees = [];
        const treeCount = Math.floor(2 + (br/60) * 2 + rng() * 3);
        for(let k=0; k<treeCount; k++) {
             const ang = rng() * Math.PI * 2;
             const dst = rng() * br * 0.4;
             trees.push({
                 x: bx + Math.cos(ang)*dst,
                 y: by + Math.sin(ang)*dst,
                 size: 14 + rng()*10,
                 rotation: rng() * Math.PI * 2
             });
        }
        // Rocks
        const rocks = [];
        const rockCount = Math.floor(1 + (br/50) * 3 + rng() * 2);
        for(let k=0; k<rockCount; k++) {
             const ang = rng() * Math.PI * 2;
             const dst = br * (0.65 + rng() * 0.15);
             rocks.push({
                 x: bx + Math.cos(ang)*dst,
                 y: by + Math.sin(ang)*dst,
                 size: 8 + rng() * 12,
                 rotation: rng() * Math.PI * 2
             });
        }
        return { x: bx, y: by, radius: br, vertices, vegVertices, trees, rocks };
    };

    // Helper: Validate a circle
    const isValidCircle = (cx, cy, cr) => {
         // Boundary
         if ((cx-boundary.x)**2 + (cy-boundary.y)**2 > (maxWorldR - cr)**2) return false;

         // Marks (Strict)
         const markClearance = 350 + cr;
         for (const m of marks) {
            if ((cx-m.x)**2 + (cy-m.y)**2 < markClearance**2) return false;
         }

         // Start/Finish Boxes
         const boxClearance = 500 + cr;
         if ((cx-mStart.x)**2 + (cy-mStart.y)**2 < boxClearance**2) return false;
         if ((cx-mUpwind.x)**2 + (cy-mUpwind.y)**2 < boxClearance**2) return false;

         // Overlap with existing islands
         for (const isl of islands) {
             const dSq = (cx-isl.x)**2 + (cy-isl.y)**2;
             const minDist = cr + isl.radius + 30;
             if (dSq < minDist**2) return false;
         }
         return true;
    };

    // Main Generation Loop
    let clusterCenter = null;
    let fails = 0;

    for (let i = 0; i < islandCount; i++) {
        if (fails > 50) break;

        // Size Determination
        let r = 0;
        if (i === 0) {
            r = absoluteMaxR;
        } else {
            r = absoluteMinR + rng() * (absoluteMaxR - absoluteMinR);
        }

        // Position
        let x, y, valid = false, attempts = 0;

        let center = { x: boundary.x, y: boundary.y };
        let radiusLimit = maxWorldR;

        if (i > 0 && clusterCenter) {
            center = clusterCenter;
            const tightDist = absoluteMaxR * 1.5;
            const looseDist = boundary.radius * 2;
            const searchDist = tightDist + (1.0 - clustering) * (looseDist - tightDist);
            radiusLimit = searchDist;
        }

        while (!valid && attempts < 50) {
            attempts++;

            let dist, angle;
            if (i === 0 || clustering < 0.1) {
                angle = rng() * Math.PI * 2;
                dist = Math.sqrt(rng()) * maxWorldR;
                x = boundary.x + Math.cos(angle) * dist;
                y = boundary.y + Math.sin(angle) * dist;
            } else {
                angle = rng() * Math.PI * 2;
                dist = Math.sqrt(rng()) * radiusLimit;
                x = center.x + Math.cos(angle) * dist;
                y = center.y + Math.sin(angle) * dist;
            }

            if (isValidCircle(x, y, r)) {
                valid = true;
            } else {
                if (i > 0 && attempts > 20) {
                    r *= 0.9;
                    if (r < absoluteMinR) r = absoluteMinR;
                }
            }
        }

        if (valid) {
            const body = createIslandBody(x, y, r);
            islands.push(body);
            if (i === 0) {
                clusterCenter = { x: x, y: y };
            }
        } else {
            fails++;
        }
    }

    return islands;
}

function checkCourseNavigability(islands, marks) {
    if (!islands || islands.length === 0) return true;

    // Grid Flood Fill
    // Define bounds based on course boundary radius
    const radius = state.course.boundary ? state.course.boundary.radius : 4000;
    const pad = 200;
    const minX = state.course.boundary.x - radius - pad;
    const maxX = state.course.boundary.x + radius + pad;
    const minY = state.course.boundary.y - radius - pad;
    const maxY = state.course.boundary.y + radius + pad;

    const resolution = 100; // 100 unit grid
    const cols = Math.ceil((maxX - minX) / resolution);
    const rows = Math.ceil((maxY - minY) / resolution);

    const grid = new Uint8Array(cols * rows); // 0=water, 1=island

    // Rasterize islands roughly
    // optimization: only check cells near islands
    for(const isl of islands) {
        // Bounding box in grid coords
        const c1 = Math.floor((isl.x - isl.radius - minX) / resolution);
        const c2 = Math.ceil((isl.x + isl.radius - minX) / resolution);
        const r1 = Math.floor((isl.y - isl.radius - minY) / resolution);
        const r2 = Math.ceil((isl.y + isl.radius - minY) / resolution);

        for(let c=c1; c<c2; c++) {
            for(let r=r1; r<r2; r++) {
                if(c>=0 && c<cols && r>=0 && r<rows) {
                    const wx = minX + c * resolution + resolution/2;
                    const wy = minY + r * resolution + resolution/2;
                    if ((wx-isl.x)**2 + (wy-isl.y)**2 < isl.radius**2) {
                        grid[r*cols + c] = 1;
                    }
                }
            }
        }
    }

    // Start Point (Start Line Center)
    const sx = (marks[0].x+marks[1].x)/2;
    const sy = (marks[0].y+marks[1].y)/2;
    const startC = Math.floor((sx - minX) / resolution);
    const startR = Math.floor((sy - minY) / resolution);

    // Target Point (Upwind Gate Center)
    const tx = (marks[2].x+marks[3].x)/2;
    const ty = (marks[2].y+marks[3].y)/2;
    const targetC = Math.floor((tx - minX) / resolution);
    const targetR = Math.floor((ty - minY) / resolution);

    if (grid[startR*cols + startC] === 1) return false; // Start blocked (unlikely due to generation checks)
    if (grid[targetR*cols + targetC] === 1) return false; // Target blocked

    // BFS
    const queue = [startR*cols + startC];
    const visited = new Uint8Array(cols * rows);
    visited[startR*cols + startC] = 1;

    let found = false;
    while(queue.length > 0) {
        const idx = queue.shift();
        if (idx === targetR*cols + targetC) {
            found = true;
            break;
        }

        const r = Math.floor(idx / cols);
        const c = idx % cols;

        // Neighbors (4-way)
        const neighbors = [
            {r: r+1, c: c}, {r: r-1, c: c},
            {r: r, c: c+1}, {r: r, c: c-1}
        ];

        for(const n of neighbors) {
            if (n.r >= 0 && n.r < rows && n.c >= 0 && n.c < cols) {
                const nIdx = n.r*cols + n.c;
                if (!visited[nIdx] && grid[nIdx] === 0) {
                    visited[nIdx] = 1;
                    queue.push(nIdx);
                }
            }
        }
    }

    return found;
}
