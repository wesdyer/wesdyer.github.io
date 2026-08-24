
// Water Rendering Configuration
window.WATER_CONFIG = {
    // Tropical Palette
    baseColor: '#0ea5e9', // Sky-500 (Brighter, more tropical)
    deepColor: '#0369a1', // Sky-700
    shallowColor: '#38bdf8', // Sky-400

    // Depth Gradient
    depthGradientStrength: 0.20,
    depthGradientScale: 1.0,

    // Ripple lattice (venue-art style water)
    rippleSpacing: 26,
    rippleOpacity: 0.9,

    // Contour Lines (legacy knobs, kept for compat)
    contourOpacity: 0.12,
    contourScale: 150, // Noise scale
    contourSpacing: 25, // Pixels between lines
    contourWidth: 1.0,
    contourScrollSpeed: 0.005, // Slower flow
    contourDistortion: 0.5,

    // Caustics
    causticStrength: 0.06,
    causticScale: 400,
    causticSpeed: 0.005,

    // Grain/Texture
    grainStrength: 0.02,

    // Render scale: water rasterizes into an offscreen canvas at this fraction
    // of screen resolution, then upscales. The contour/caustic layers are soft
    // and low-frequency, so 0.5 (quarter the pixels) is visually free.
    resolutionScale: 0.5,

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

// Interpolation helper
function smoothstep(t) {
    return t * t * (3 - 2 * t);
}

function getVarianceCorrection(t) {
    const dem = t * t + (1 - t) * (1 - t);
    return 1.0 / Math.sqrt(dem || 1);
}

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
    const s = smoothstep(x / w);
    const t = smoothstep(y / h);
    const nx = x;
    const ny = y;

    // Sample 4 points in domain
    // We subtract the period (w, h) for the blend targets so that
    // when s=1 (x=w), v2 becomes noise(w-w)=noise(0), matching v1 at s=0.
    const v1 = noise2D(nx, ny);
    const v2 = noise2D(nx - w, ny);
    const v3 = noise2D(nx, ny - h);
    const v4 = noise2D(nx - w, ny - h);

    // Bilinear blend
    const i1 = v1 * (1 - s) + v2 * s;
    const i2 = v3 * (1 - s) + v4 * s;
    const val = i1 * (1 - t) + i2 * t;

    // Variance compensation to hide grid seams
    const corr = getVarianceCorrection(s) * getVarianceCorrection(t);
    return val * corr;
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
        return `${c.rippleSpacing || 26}-${c.rippleOpacity || 0.9}-${c.chunkSize}`;
    }

    updateTextures() {
        const hash = this.getConfigHash();
        if (hash === this.lastConfigHash) return;

        this.lastConfigHash = hash;
        const config = window.WATER_CONFIG;
        const size = config.chunkSize;

        // ── Angular ripple lattice (venue-art style) ────────────────────
        // Faceted piecewise-linear wave strokes in light + dark tones over
        // the flat base — matches the card art's diamond-lattice water.
        // Tileable: wobble sines use integer cycles per tile (seamless in x)
        // and every stroke is drawn at y, y±size (seamless in y). Own PRNG —
        // never Math.random (render must not touch the eval RNG stream).
        this.contourCanvas.width = size;
        this.contourCanvas.height = size;
        const g = this.contourCanvas.getContext('2d');
        g.clearRect(0, 0, size, size);

        let seed = 987654321;
        const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

        // Distorted diamond-brick tiling: rows of wide cells, alternate rows
        // offset half a cell, every vertex jittered (periodic arrays => the
        // tile is seamless). Each cell is flat-filled slightly lighter or
        // darker than base, or left as base — a mosaic of tonal facets.
        // Top-down cartoon water (matches the game's view): two layers.
        // A) large SOFT tonal clouds — lighter/darker drifts of the base hue.
        // B) a sparse 'caustic web' — thin wobbly light loops, fragments and
        //    tiny lenses, the classic sunlight-on-the-seabed idiom.
        // Isotropic (caustics don't align with wind). Every element is drawn
        // 3x3-wrapped so the tile stays seamless.
        const wrap = (fn) => { for (const dx of [-size, 0, size]) for (const dy of [-size, 0, size]) fn(dx, dy); };

        // A) soft swell masses: elongated diagonal tonal drifts, two families
        // (±~35°), very low contrast — the big gentle undulation of the sea.
        for (let i = 0; i < 14; i++) {
            const cx = rand() * size, cy = rand() * size;
            const rx = 110 + rand() * 130, ry = rx * (0.30 + rand() * 0.25);
            const rot = (rand() < 0.5 ? 1 : -1) * (0.5 + rand() * 0.35); // ±~29-49°
            const light = rand() < 0.5;
            const a = 0.030 + rand() * 0.030;
            wrap((dx, dy) => {
                const grd = g.createRadialGradient(0, 0, 0, 0, 0, rx);
                grd.addColorStop(0, light ? `rgba(255,255,255,${a.toFixed(3)})` : `rgba(0,20,90,${a.toFixed(3)})`);
                grd.addColorStop(1, 'rgba(0,0,0,0)');
                g.save(); g.translate(cx + dx, cy + dy); g.rotate(rot); g.scale(1, ry / rx);
                g.fillStyle = grd;
                g.beginPath(); g.arc(0, 0, rx, 0, Math.PI * 2); g.fill();
                g.restore();
            });
        }

        // Invalidate patterns
        this.contourPattern = null;
        this.causticPattern = null;

        console.log('WaterRenderer: Ripple texture updated');
    }

    draw(ctx, state) {
        if (!state) return;
        const config = window.WATER_CONFIG;

        // Check for config updates (e.g. from Debug UI)
        this.updateTextures();

        const width = ctx.canvas.width;
        const height = ctx.canvas.height;
        this.time += 1; // Increment internal time

        // Low-res offscreen target: both water passes rasterize at
        // resolutionScale (default 0.5 → quarter the pixels), then one
        // upscaled blit hits the screen. This is the single biggest paint
        // saving in the game — the two full-screen passes dominated frames.
        const rs = config.resolutionScale || 1.0;
        const lw = Math.max(1, Math.ceil(width * rs));
        const lh = Math.max(1, Math.ceil(height * rs));
        if (!this.lowCanvas || this.lowCanvas.width !== lw || this.lowCanvas.height !== lh) {
            this.lowCanvas = document.createElement('canvas');
            this.lowCanvas.width = lw;
            this.lowCanvas.height = lh;
            this.lowCtx = this.lowCanvas.getContext('2d');
            this.contourPattern = null;
            this._gradKey = null;
        }
        const lctx = this.lowCtx;

        // 1. Base Fill & Depth Gradient (Screen Space)
        // We use a radial gradient to simulate depth/vignette
        const cx = lw / 2;
        const cy = lh / 2;
        const radius = Math.max(lw, lh) * 0.8 * config.depthGradientScale;

        // The depth gradient is STATIC — it only changes on resize or palette swap — so it
        // is rasterised once into its own bitmap and blitted, rather than re-evaluated
        // per-pixel every frame. A radial-gradient fill of the low canvas measured 0.82 ms;
        // the 1:1 blit of the same pixels is 0.12 ms.
        //
        // The gradient object is kept too: `_grad` is what the probe in eval/_water_probe.js
        // times against, and keeping both makes the comparison honest.
        const gradKey = lw + 'x' + lh + config.baseColor + config.deepColor + config.depthGradientScale;
        if (this._gradKey !== gradKey) {
            const g = lctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
            g.addColorStop(0, config.baseColor);
            g.addColorStop(1, config.deepColor);
            this._grad = g;
            this._gradKey = gradKey;
            this._gradCanvas = document.createElement('canvas');
            this._gradCanvas.width = lw;
            this._gradCanvas.height = lh;
            const gc = this._gradCanvas.getContext('2d');
            gc.fillStyle = g;
            gc.fillRect(0, 0, lw, lh);
        }

        lctx.setTransform(1, 0, 0, 1, 0, 0);
        lctx.globalCompositeOperation = 'copy';   // no blend against last frame's pixels
        lctx.drawImage(this._gradCanvas, 0, 0);
        lctx.globalCompositeOperation = 'source-over';

        // 2. Prepare for World-Mapped Patterns
        const windDir = state.wind ? state.wind.direction : 0;
        const speed = config.contourScrollSpeed;

        // Scroll offsets (flow)
        const flowDx = -Math.sin(windDir) * this.time * speed * 20;
        const flowDy = Math.cos(windDir) * this.time * speed * 20;

        // Caustic scroll
        const cDx = -Math.sin(windDir + 1) * this.time * config.causticSpeed * 10;
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

        // Maps world -> LOW-RES screen: scale first, then the usual camera
        // transform (M_low = S(rs) · M_full).
        const camMatrix = new DOMMatrix();
        camMatrix.scaleSelf(rs, rs);
        camMatrix.translateSelf(width/2, height/2);
        camMatrix.rotateSelf(0, 0, -state.camera.rotation * (180/Math.PI)); // Degrees
        camMatrix.translateSelf(-state.camera.x, -state.camera.y);

        // 3. Draw Contours — the DIRECT pattern fill, on purpose. A screen-oriented
        // cache (rotated fill once, translation-only blits after) was tried twice and
        // REMOVED: this game's camera rotation NEVER settles — it exponentially tracks a
        // heading that wobbles every frame — so any rotation-quantized cache renders the
        // water at a slightly stale angle and then snaps it, forever, which the owner
        // read (correctly) as "the water jumps around". A creeping layer has to be
        // re-rendered at the live transform every frame; ~2 ms here is the honest price.
        // eval/_water_motion.js is the gate for anyone tempted again.
        if (!this.contourPattern) {
             this.contourPattern = lctx.createPattern(this.contourCanvas, 'repeat');
        }

        lctx.globalAlpha = config.rippleOpacity || 0.9;
        lctx.fillStyle = this.contourPattern;

        const contourMat = DOMMatrix.fromMatrix(camMatrix);
        contourMat.translateSelf(flowDx, flowDy); // gentle downwind drift
        this.contourPattern.setTransform(contourMat);

        lctx.fillRect(0, 0, lw, lh);
        lctx.globalAlpha = 1.0;

        // 4. Draw Caustics — skipped below a visibility threshold: a ~6%-alpha
        // 'overlay' composite is a full extra screen pass for an effect that
        // is imperceptible over the busy contour layer. Raise causticStrength
        // above 0.08 to re-enable.
        if (config.causticStrength >= 0.08) {
            if (!this.causticPattern) {
                 this.causticPattern = lctx.createPattern(this.causticCanvas, 'repeat');
            }

            lctx.globalCompositeOperation = 'overlay'; // or screen/lighter
            lctx.globalAlpha = config.causticStrength;
            lctx.fillStyle = this.causticPattern;

            const causticMat = DOMMatrix.fromMatrix(camMatrix);
            causticMat.translateSelf(cDx, cDy);
            this.causticPattern.setTransform(causticMat);

            lctx.fillRect(0, 0, lw, lh);
            lctx.globalCompositeOperation = 'source-over';
            lctx.globalAlpha = 1.0;
        }

        // Single upscaled blit to the screen, NEAREST-NEIGHBOUR.
        //
        // The 2x bilinear upscale was 4.03 ms of an 8.35 ms water pass — half the water, and
        // a third of the whole frame. Nearest costs 0.85 ms.
        //
        // It is free of visual cost here because of WHAT is being upscaled: a radial depth
        // gradient and a soft low-contrast contour pattern, with no hard edge anywhere to
        // alias. Measured against the smoothed version over a full frame: 64% of pixels
        // differ, and the largest difference on any channel is 2/255. Everything with an
        // actual edge — boats, marks, wakes, the sailing limit, all the type — is drawn at
        // full resolution AFTER this blit and is untouched.
        //
        // `imageSmoothingQuality: 'low'` was tried first and does nothing: 4.03 ms either
        // way. Chrome ignores it on this path.
        //
        // ⚠️ Inside save/restore because `imageSmoothingEnabled` is canvas state — leaving it
        // off would make every sprite in the game nearest-sampled too.
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(this.lowCanvas, 0, 0, width, height);
        ctx.restore();
    }
}

// Expose to window
window.WaterRenderer = new WaterRenderer();
