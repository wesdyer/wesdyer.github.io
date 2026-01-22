
const performance = require('perf_hooks').performance;

// --- Minimal Mock Environment ---
const state = {
    boats: [],
    race: { status: 'racing' }
};

class Boat {
    constructor(id, x, y) {
        this.id = id;
        this.x = x;
        this.y = y;
        this.heading = Math.random() * Math.PI * 2;
        this.raceState = { finished: false };
        this.fadeTimer = 0;
        this.speed = 1.0;
        this.velocity = { x: 0, y: 0 };
    }
}

// --- Geometry Helpers (Copied from script.js) ---
function getHullPolygon(boat) {
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

function projectPolygon(axis, poly) {
    let min = Infinity, max = -Infinity;
    for (const p of poly) {
        const dot = p.x * axis.x + p.y * axis.y;
        if (dot < min) min = dot;
        if (dot > max) max = dot;
    }
    return { min, max };
}

function getAxes(poly) {
    const axes = [];
    for (let i = 0; i < poly.length; i++) {
        const p1 = poly[i];
        const p2 = poly[(i + 1) % poly.length];
        const edge = { x: p2.x - p1.x, y: p2.y - p1.y };
        const len = Math.sqrt(edge.x * edge.x + edge.y * edge.y);
        axes.push({ x: -edge.y / len, y: edge.x / len });
    }
    return axes;
}

function satPolygonPolygon(polyA, polyB) {
    let overlap = Infinity;
    let smallestAxis = null;
    const axes = [...getAxes(polyA), ...getAxes(polyB)];

    for (const axis of axes) {
        const p1 = projectPolygon(axis, polyA);
        const p2 = projectPolygon(axis, polyB);
        if (p1.max < p2.min || p2.max < p1.min) return null;
        const o = Math.min(p1.max, p2.max) - Math.max(p1.min, p2.min);
        if (o < overlap) {
            overlap = o;
            smallestAxis = axis;
        }
    }

    const centerA = polyA.reduce((a, b) => ({x: a.x+b.x, y: a.y+b.y}), {x:0, y:0});
    const centerB = polyB.reduce((a, b) => ({x: a.x+b.x, y: a.y+b.y}), {x:0, y:0});
    const dirX = (centerB.x/polyB.length) - (centerA.x/polyA.length);
    const dirY = (centerB.y/polyB.length) - (centerA.y/polyA.length);

    if (dirX * smallestAxis.x + dirY * smallestAxis.y < 0) {
        smallestAxis.x = -smallestAxis.x;
        smallestAxis.y = -smallestAxis.y;
    }
    return { overlap, axis: smallestAxis };
}

// --- Original O(N^2) ---
function checkBoatCollisionsBaseline(dt) {
    let checks = 0;
    const broadRadius = 40;
    for (let i = 0; i < state.boats.length; i++) {
        const b1 = state.boats[i];
        if (b1.raceState.finished && b1.fadeTimer <= 0) continue;

        const poly1 = getHullPolygon(b1);
        for (let j = i + 1; j < state.boats.length; j++) {
            const b2 = state.boats[j];
            if (b2.raceState.finished && b2.fadeTimer <= 0) continue;

            const dx = b2.x - b1.x, dy = b2.y - b1.y;
            if (dx*dx + dy*dy > (broadRadius*2)**2) continue;

            checks++;
            const poly2 = getHullPolygon(b2);
            const res = satPolygonPolygon(poly1, poly2);
        }
    }
    return checks;
}

// --- Optimized Spatial Hash ---
function checkBoatCollisionsOptimized(dt) {
    let checks = 0;
    const broadRadius = 40;
    const cellSize = 100;
    const grid = new Map();

    // 1. Build Grid
    for (const boat of state.boats) {
        if (boat.raceState.finished && boat.fadeTimer <= 0) continue;
        const cx = Math.floor(boat.x / cellSize);
        const cy = Math.floor(boat.y / cellSize);
        const key = cx + "," + cy;
        let list = grid.get(key);
        if (!list) { list = []; grid.set(key, list); }
        list.push(boat);
    }

    // 2. Iterate
    for (const b1 of state.boats) {
        if (b1.raceState.finished && b1.fadeTimer <= 0) continue;

        const cx = Math.floor(b1.x / cellSize);
        const cy = Math.floor(b1.y / cellSize);
        const poly1 = getHullPolygon(b1);

        for (let ox = -1; ox <= 1; ox++) {
            for (let oy = -1; oy <= 1; oy++) {
                const key = (cx + ox) + "," + (cy + oy);
                const cell = grid.get(key);
                if (!cell) continue;

                for (const b2 of cell) {
                    if (b1.id >= b2.id) continue;
                    if (b2.raceState.finished && b2.fadeTimer <= 0) continue;

                    const dx = b2.x - b1.x, dy = b2.y - b1.y;
                    if (dx*dx + dy*dy > (broadRadius*2)**2) continue;

                    checks++;
                    const poly2 = getHullPolygon(b2);
                    const res = satPolygonPolygon(poly1, poly2);
                }
            }
        }
    }
    return checks;
}

// --- Benchmark Runner ---
function runBenchmark() {
    const counts = [100, 2000, 5000];
    const frames = 100;

    console.log(`Running Benchmark (${frames} frames per test)...\n`);

    for (const boatCount of counts) {
        console.log(`--- ${boatCount} Boats ---`);
        state.boats = [];
        for (let i = 0; i < boatCount; i++) {
            state.boats.push(new Boat(i, Math.random() * 4000, Math.random() * 4000));
        }

        // Baseline
        const startBase = performance.now();
        let checksBase = 0;
        for (let i = 0; i < frames; i++) {
             // Jiggle
             state.boats.forEach(b => b.x += (Math.random()-0.5));
             checksBase += checkBoatCollisionsBaseline(0.016);
        }
        const timeBase = performance.now() - startBase;

        // Optimized
        const startOpt = performance.now();
        let checksOpt = 0;
        for (let i = 0; i < frames; i++) {
             state.boats.forEach(b => b.x += (Math.random()-0.5));
             checksOpt += checkBoatCollisionsOptimized(0.016);
        }
        const timeOpt = performance.now() - startOpt;

        console.log(`Baseline:  ${timeBase.toFixed(2)}ms (${(timeBase/frames).toFixed(2)}ms/frame) - Checks: ${checksBase}`);
        console.log(`Optimized: ${timeOpt.toFixed(2)}ms (${(timeOpt/frames).toFixed(2)}ms/frame) - Checks: ${checksOpt}`);
        console.log(`Speedup:   ${(timeBase/timeOpt).toFixed(2)}x\n`);
    }
}

runBenchmark();
