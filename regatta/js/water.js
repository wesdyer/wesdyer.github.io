
// Water Rendering Configuration
window.WATER_CONFIG = {
    // Tropical Palette
    baseColor: '#0ea5e9', // Sky-500 (Brighter, more tropical)
    deepColor: '#0369a1', // Sky-700
    shallowColor: '#38bdf8', // Sky-400

    // Depth Gradient
    depthGradientStrength: 0.20,
    depthGradientScale: 1.0,

    // Contour Lines (Cartoon effect)
    contourOpacity: 0.12,
    contourScale: 150, // Noise scale
    contourSpacing: 25, // Pixels between lines
    contourWidth: 1.0,
    contourScrollSpeed: 0.02, // Slower flow
    contourDistortion: 0.5,

    // Caustics
    causticStrength: 0.06,
    causticScale: 400,
    causticSpeed: 0.015,

    // Grain/Texture
    grainStrength: 0.02,

    // Shoreline
    shorelineColor: '#4ade80', // Green-400 (Turquoise-ish green)
    shorelineGlowSize: 1.5,
    shorelineGlowOpacity: 0.5,

    // System
    chunkSize: 512, // Texture resolution
    debug: false
};

// Simple Simplex-like Noise implementation for procedural generation
const Permutation = new Uint8Array(512);
const Gradient3 = [[1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],[1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1],[0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1]];
for(let i=0; i<512; i++) Permutation[i] = Math.floor(Math.random()*255);

function dot(g, x, y) { return g[0]*x + g[1]*y; }

// 2D Noise function
function noise2D(xin, yin) {
    const F2 = 0.5*(Math.sqrt(3.0)-1.0);
    const G2 = (3.0-Math.sqrt(3.0))/6.0;
    let s = (xin+yin)*F2;
    let i = Math.floor(xin+s);
    let j = Math.floor(yin+s);
    let t = (i+j)*G2;
    let X0 = i-t;
    let Y0 = j-t;
    let x0 = xin-X0;
    let y0 = yin-Y0;
    let i1, j1;
    if(x0>y0) {i1=1; j1=0;} else {i1=0; j1=1;}
    let x1 = x0 - i1 + G2;
    let y1 = y0 - j1 + G2;
    let x2 = x0 - 1.0 + 2.0 * G2;
    let y2 = y0 - 1.0 + 2.0 * G2;
    let ii = i & 255;
    let jj = j & 255;
    let gi0 = Permutation[ii+Permutation[jj]] % 12;
    let gi1 = Permutation[ii+i1+Permutation[jj+j1]] % 12;
    let gi2 = Permutation[ii+1+Permutation[jj+1]] % 12;
    let t0 = 0.5 - x0*x0 - y0*y0;
    let n0, n1, n2;
    if(t0<0) n0 = 0.0; else {t0 *= t0; n0 = t0 * t0 * dot(Gradient3[gi0], x0, y0);}
    let t1 = 0.5 - x1*x1 - y1*y1;
    if(t1<0) n1 = 0.0; else {t1 *= t1; n1 = t1 * t1 * dot(Gradient3[gi1], x1, y1);}
    let t2 = 0.5 - x2*x2 - y2*y2;
    if(t2<0) n2 = 0.0; else {t2 *= t2; n2 = t2 * t2 * dot(Gradient3[gi2], x2, y2);}
    return 70.0 * (n0 + n1 + n2);
}

// Tileable Noise Helper: Mixes noise samples from 4 corners to wrap edges
function tileableNoise2D(x, y, w, h) {
    const s = x / w;
    const t = y / h;
    const nx = x;
    const ny = y;

    // Sample 4 points in domain
    const v1 = noise2D(nx, ny);
    const v2 = noise2D(nx + w, ny);
    const v3 = noise2D(nx, ny + h);
    const v4 = noise2D(nx + w, ny + h);

    // Bilinear blend
    const i1 = v1 * (1 - s) + v2 * s;
    const i2 = v3 * (1 - s) + v4 * s;
    return i1 * (1 - t) + i2 * t;
}

class WaterRenderer {
    constructor() {
        this.canvas = null;
        this.ctx = null;

        // Offscreen buffers for expensive noise
        this.contourCanvas = document.createElement('canvas');
        this.causticCanvas = document.createElement('canvas');
        this.contourPattern = null;
        this.causticPattern = null;

        this.lastConfigHash = '';
        this.time = 0;
    }

    init() {
        console.log("WaterRenderer: Initialized");
        this.updateTextures();
    }

    // Check if config changed requiring texture rebuild
    getConfigHash() {
        const c = window.WATER_CONFIG;
        return `${c.contourScale}-${c.contourSpacing}-${c.contourWidth}-${c.contourDistortion}-${c.causticScale}-${c.chunkSize}`;
    }

    updateTextures() {
        const hash = this.getConfigHash();
        if (hash === this.lastConfigHash) return;

        this.lastConfigHash = hash;
        const config = window.WATER_CONFIG;
        const size = config.chunkSize;

        // 1. Generate Contour Texture
        this.contourCanvas.width = size;
        this.contourCanvas.height = size;
        const ctxC = this.contourCanvas.getContext('2d');
        ctxC.clearRect(0,0,size,size);

        const imgDataC = ctxC.createImageData(size, size);
        const dataC = imgDataC.data;

        // Tileable scaling
        const scale = config.contourScale;
        const warpPeriod = size / scale; // Period in noise space

        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                // Domain warp (Tileable)
                // We use tileableNoise for the warp offset calculation too to ensure the warp field loops
                const nx = x / scale;
                const ny = y / scale;

                // Warp vector field
                const wx = tileableNoise2D(nx, ny, warpPeriod, warpPeriod);
                const wy = tileableNoise2D(nx + 5.2, ny + 1.3, warpPeriod, warpPeriod);

                const qx = nx + config.contourDistortion * wx;
                const qy = ny + config.contourDistortion * wy;

                // Sample main noise (Tileable) with warped coords?
                // Warping a periodic domain usually breaks periodicity unless the warp itself is periodic (which it is now).
                // However, qx/qy are distorted. Does tileableNoise handle arbitrary inputs?
                // tileableNoise2D assumes x,y are within 0..w? No, it just linearly interpolates.
                // If qx exceeds period, we need to wrap inputs to tileableNoise?
                // tileableNoise logic: v1=noise(x,y), v2=noise(x+w,y).
                // If x is way out, v1 and v2 are still just sampled.
                // Wait, tileableNoise takes (x, y, w, h) where w,h are the domain size.
                // It blends across the domain 0..w.
                // We are iterating x=0..size. nx = 0..size/scale = 0..warpPeriod.
                // So we are covering exactly one period.
                // So tileableNoise2D(nx, ny, warpPeriod, warpPeriod) works perfectly for the base field.

                // Now, for the final value:
                // We want F(qx, qy) to be periodic.
                // Since qx = nx + offset, and nx is periodic 0..P, and offset is periodic 0..P (derived from wx),
                // qx is not strictly 0..P, but (qx mod P) is the lookup we want?
                // tileableNoise blends based on (x/w) ratio.
                // If we pass qx directly, s = qx/w. If qx > w, s > 1.
                // Does logic hold?
                // i1 = v1*(1-s) + v2*s. If s=1.1?
                // v1(1.1) + v2(-0.1)? No, linear extrapolation.
                // We need to wrap qx into 0..P range for the blend factors to make sense?
                // Or does simple wrapping work?
                // Actually, tileable noise function is usually just:
                // Mix( Noise(x,y), Noise(x-w, y), x/w )
                // My function: v1(x), v2(x+w).
                // If x wraps, v1 becomes v2?
                // At x=0: s=0. returns v1(0).
                // At x=w: s=1. returns v2(w) = noise(2w).
                // Wait, v2 is noise(x+w).
                // We want at x=w to equal x=0.
                // At x=0: noise(0).
                // At x=w: noise(2w). These are unrelated.
                // My tileableNoise2D function is flawed for general inputs?
                // It is designed to be called with x in 0..w.
                // We need to ensure qx is wrapped or handled.
                // But qx is the *coordinate*.
                // The issue is: The noise function itself isn't periodic. We are *forcing* periodicity by blending edges.
                // So we must sample at (qx, qy) but blend based on where we are in the *tile*.
                // But we are in warped space.
                // Actually, for the final noise look up `val = noise(qx, qy)`, we want the *result* to tile.
                // If we use tileableNoise2D(qx, qy, ...), we are saying "blend qx based on qx/w".
                // But the tile boundaries are at physical x=0, x=size.
                // We need to blend the *result* based on physical x,y position in the tile, not warped position.
                // So: `val = tileableNoise2D_SampleWarped(x, y, period, distortion)`.
                // Or simply:
                // `val = noise(qx, qy)`? No.
                // We need `val` to match at x=0 and x=size.
                // At x=0: qx0 = 0 + dist*W(0).
                // At x=size: qx1 = P + dist*W(P).
                // Since W is periodic, W(0)=W(P) (mostly, if W is tileable).
                // So qx1 = qx0 + P.
                // We need Noise(qx0) == Noise(qx0 + P).
                // Standard noise isn't periodic.
                // So we need to use a periodic noise function, or use the tileable blend on the *final* lookup.
                // But we should blend based on the *original* grid position (s = x/size), not the warped coordinate.

                // Correct approach:
                // 1. Calculate warped coordinates qx, qy.
                // 2. Sample noise at (qx, qy), (qx+P, qy), (qx, qy+P), (qx+P, qy+P).
                // 3. Blend using s = x/size, t = y/size.

                const v1 = noise2D(qx, qy);
                const v2 = noise2D(qx + warpPeriod, qy);
                const v3 = noise2D(qx, qy + warpPeriod);
                const v4 = noise2D(qx + warpPeriod, qy + warpPeriod);

                const s = x / size;
                const t = y / size;

                const i1 = v1 * (1 - s) + v2 * s;
                const i2 = v3 * (1 - s) + v4 * s;
                const val = i1 * (1 - t) + i2 * t;

                // Create bands
                // Map val to pixel space based on spacing
                const v = (val + 1.0) * 0.5 * 1000; // arbitrary scale
                const band = v % config.contourSpacing;

                let alpha = 0;
                if (band < config.contourWidth) {
                    // Smooth edge
                    alpha = 255;
                } else if (band < config.contourWidth + 1.0) {
                    // Anti-alias roughly
                    alpha = 128;
                }

                const idx = (y * size + x) * 4;
                dataC[idx] = 255;     // R
                dataC[idx+1] = 255;   // G
                dataC[idx+2] = 255;   // B
                dataC[idx+3] = alpha; // A
            }
        }
        ctxC.putImageData(imgDataC, 0, 0);

        // 2. Generate Caustic Texture
        this.causticCanvas.width = size;
        this.causticCanvas.height = size;
        const ctxK = this.causticCanvas.getContext('2d');
        const imgDataK = ctxK.createImageData(size, size);
        const dataK = imgDataK.data;

        const causticPeriod = size / config.causticScale;

        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const nx = x / config.causticScale;
                const ny = y / config.causticScale;

                // Billowy noise (Tileable)
                // Use tileable helper directly
                let val = Math.abs(tileableNoise2D(nx, ny, causticPeriod, causticPeriod));
                val = 1.0 - val;
                val = val * val * val; // Sharpen

                const idx = (y * size + x) * 4;
                dataK[idx] = 255;
                dataK[idx+1] = 255;
                dataK[idx+2] = 255;
                dataK[idx+3] = Math.floor(val * 255);
            }
        }
        ctxK.putImageData(imgDataK, 0, 0);

        // Invalidate patterns
        this.contourPattern = null;
        this.causticPattern = null;

        console.log("WaterRenderer: Textures Updated");
    }

    draw(ctx, state) {
        if (!state) return;
        const config = window.WATER_CONFIG;

        // Check for config updates (e.g. from Debug UI)
        this.updateTextures();

        const width = ctx.canvas.width;
        const height = ctx.canvas.height;
        this.time += 1; // Increment internal time

        // 1. Base Fill & Depth Gradient (Screen Space)
        // We use a radial gradient to simulate depth/vignette
        const cx = width / 2;
        const cy = height / 2;
        const radius = Math.max(width, height) * 0.8 * config.depthGradientScale;

        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
        grad.addColorStop(0, config.baseColor);
        grad.addColorStop(1, config.deepColor);

        ctx.save();
        // Use setTransform instead of resetTransform to be kinder to context stack,
        // effectively filling the screen by resetting to identity for the fill.
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);

        // 2. Prepare for World-Mapped Patterns
        const windDir = state.wind ? state.wind.direction : 0;
        const speed = config.contourScrollSpeed;

        // Scroll offsets (flow)
        const flowDx = Math.sin(windDir) * this.time * speed * 20;
        const flowDy = Math.cos(windDir) * this.time * speed * 20;

        // Caustic scroll
        const cDx = Math.sin(windDir + 1) * this.time * config.causticSpeed * 10;
        const cDy = Math.cos(windDir + 1) * this.time * config.causticSpeed * 10;

        // We need a matrix that maps Screen Pixels -> World Pattern UVs
        // Pattern logic:
        // By default, createPattern tiles in the coordinate space it is drawn.
        // We are drawing a rect at 0,0,width,height (Screen Space).
        // So (0,0) is Top-Left of Screen.
        // We want (0,0) on Screen to map to the correct World coordinate.
        // World(0,0) projects to Screen via:
        // ScreenP = Translate(W/2, H/2) * Rotate(-camRot) * Translate(-camX, -camY) * WorldP
        // Inverse (Screen -> World):
        // WorldP = Translate(camX, camY) * Rotate(camRot) * Translate(-W/2, -H/2) * ScreenP

        // The pattern matrix transforms the pattern coordinate system.
        // If we apply M to pattern, then Pattern(p) samples texture at M^-1 * p.
        // Wait, standard Canvas setTransform applies to the pattern coordinate space.
        // So we want to align the pattern space with World Space.

        // Construct Matrix:
        // Start at Identity (Pattern is at 0,0)
        // We want Pattern Origin to align with World Origin projected to Screen.
        // So we apply the Camera Transform to the Pattern Matrix.

        const camMatrix = new DOMMatrix();
        camMatrix.translateSelf(width/2, height/2);
        camMatrix.rotateSelf(0, 0, -state.camera.rotation * (180/Math.PI)); // Degrees
        camMatrix.translateSelf(-state.camera.x, -state.camera.y);

        // 3. Draw Contours
        if (!this.contourPattern) {
             this.contourPattern = ctx.createPattern(this.contourCanvas, 'repeat');
        }

        ctx.globalAlpha = config.contourOpacity;
        ctx.fillStyle = this.contourPattern;

        const contourMat = DOMMatrix.fromMatrix(camMatrix);
        contourMat.translateSelf(flowDx, flowDy); // Apply flow in world space
        this.contourPattern.setTransform(contourMat);

        ctx.fillRect(0, 0, width, height);

        // 4. Draw Caustics
        if (!this.causticPattern) {
             this.causticPattern = ctx.createPattern(this.causticCanvas, 'repeat');
        }

        ctx.globalCompositeOperation = 'overlay'; // or screen/lighter
        ctx.globalAlpha = config.causticStrength;
        ctx.fillStyle = this.causticPattern;

        const causticMat = DOMMatrix.fromMatrix(camMatrix);
        causticMat.translateSelf(cDx, cDy);
        this.causticPattern.setTransform(causticMat);

        ctx.fillRect(0, 0, width, height);

        ctx.restore();
    }
}

// Expose to window
window.WaterRenderer = new WaterRenderer();
