
// Water Rendering Configuration
window.WATER_CONFIG = {
    // Tropical Palette
    baseColor: '#0ea5e9', // Sky-500
    deepColor: '#0369a1', // Sky-700
    shallowColor: '#38bdf8', // Sky-400

    // Depth Gradient
    depthGradientStrength: 0.20,
    depthGradientScale: 1.0,

    // Contour Lines (Waves)
    contourOpacity: 0.35, // Stronger visibility for testing
    contourScale: 800, // Wider waves (larger period)
    waveStretch: 20.0,  // High stretch for distinct perpendicular lines
    contourSpacing: 25,
    contourWidth: 1.2,
    contourScrollSpeed: 0.04,
    contourDistortion: 0.2,

    // Caustics
    causticStrength: 0.06,
    causticScale: 400,
    causticSpeed: 0.015,

    // Grain/Texture
    grainStrength: 0.02,

    // Shoreline
    shorelineColor: '#4ade80',
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
    const v1 = noise2D(nx, ny);
    const v2 = noise2D(nx - w, ny);
    const v3 = noise2D(nx, ny - h);
    const v4 = noise2D(nx - w, ny - h);

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
        return `${c.contourScale}-${c.waveStretch}-${c.contourSpacing}-${c.contourWidth}-${c.contourDistortion}-${c.causticScale}-${c.chunkSize}`;
    }

    updateTextures() {
        const hash = this.getConfigHash();
        if (hash === this.lastConfigHash) return;

        this.lastConfigHash = hash;
        const config = window.WATER_CONFIG;
        const size = config.chunkSize;

        // 1. Generate Contour Texture (Waves)
        this.contourCanvas.width = size;
        this.contourCanvas.height = size;
        const ctxC = this.contourCanvas.getContext('2d');
        ctxC.clearRect(0,0,size,size);

        const imgDataC = ctxC.createImageData(size, size);
        const dataC = imgDataC.data;

        // Anisotropic scaling for waves
        // scaleX is stretched (low frequency) -> Creates Horizontal Lines (along X)
        const scaleY = config.contourScale;
        const scaleX = config.contourScale * (config.waveStretch || 1.0);

        const periodX = size / scaleX;
        const periodY = size / scaleY;

        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const nx = x / scaleX;
                const ny = y / scaleY;

                const wx = tileableNoise2D(nx, ny, periodX, periodY);
                const wy = tileableNoise2D(nx + 5.2, ny + 1.3, periodX, periodY);

                const qx = nx + config.contourDistortion * wx;
                const qy = ny + config.contourDistortion * wy;

                // Sample main noise
                const v1 = noise2D(qx, qy);
                const v2 = noise2D(qx - periodX, qy);
                const v3 = noise2D(qx, qy - periodY);
                const v4 = noise2D(qx - periodX, qy - periodY);

                const s = smoothstep(x / size);
                const t = smoothstep(y / size);

                const i1 = v1 * (1 - s) + v2 * s;
                const i2 = v3 * (1 - s) + v4 * s;
                const val = i1 * (1 - t) + i2 * t;

                // Create bands
                const v = (val + 1.0) * 0.5 * 1000;
                const band = v % config.contourSpacing;

                let alpha = 0;
                if (band < config.contourWidth) {
                    alpha = 255;
                } else if (band < config.contourWidth + 1.0) {
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

        // 2. Generate Caustic Texture (Isotropic)
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

        this.contourPattern = null;
        this.causticPattern = null;

        console.log("WaterRenderer: Textures Updated");
    }

    draw(ctx, state) {
        if (!state) return;
        const config = window.WATER_CONFIG;

        this.updateTextures();

        const width = ctx.canvas.width;
        const height = ctx.canvas.height;
        this.time += 1;

        // 1. Base Fill
        const cx = width / 2;
        const cy = height / 2;
        const radius = Math.max(width, height) * 0.8 * config.depthGradientScale;

        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
        grad.addColorStop(0, config.baseColor);
        grad.addColorStop(1, config.deepColor);

        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);

        // 2. Prepare for World-Mapped Patterns
        // Wind Direction (Radians, 0=North, clockwise)
        const windDir = state.wind ? state.wind.direction : 0;

        // Base Camera Matrix: Transforms pattern from World(0,0) to Screen
        const camMatrix = new DOMMatrix();
        camMatrix.translateSelf(width/2, height/2);
        camMatrix.rotateSelf(0, 0, -state.camera.rotation * (180/Math.PI));
        camMatrix.translateSelf(-state.camera.x, -state.camera.y);

        // 3. Draw Contours (Waves)
        if (!this.contourPattern) {
             this.contourPattern = ctx.createPattern(this.contourCanvas, 'repeat');
        }

        ctx.globalAlpha = config.contourOpacity;
        ctx.fillStyle = this.contourPattern;

        const contourMat = DOMMatrix.fromMatrix(camMatrix);

        // Apply Wind Rotation to World Space
        // Base Texture: Horizontal Lines (due to waveStretch on X)
        // We want waves Perpendicular to wind.
        // If Wind is North (0 deg), we want Horizontal Waves (Perpendicular to N-S axis).
        // Rotation = windDir aligns Pattern Y (Flow axis) with Wind.

        contourMat.rotateSelf(windDir * (180/Math.PI));

        // Scroll in the direction of the wind (Texture Y axis)
        // Texture Y axis aligns with Wind Direction after rotation.
        // So moving +Y in Pattern Space moves With Wind.
        const flowDist = this.time * config.contourScrollSpeed * 20;
        contourMat.translateSelf(0, flowDist);

        this.contourPattern.setTransform(contourMat);
        ctx.fillRect(0, 0, width, height);

        // 4. Draw Caustics
        if (!this.causticPattern) {
             this.causticPattern = ctx.createPattern(this.causticCanvas, 'repeat');
        }

        ctx.globalCompositeOperation = 'overlay';
        ctx.globalAlpha = config.causticStrength;
        ctx.fillStyle = this.causticPattern;

        const causticMat = DOMMatrix.fromMatrix(camMatrix);

        // Offset caustics slightly and drift them too
        const cDx = Math.sin(windDir + 1) * this.time * config.causticSpeed * 10;
        const cDy = Math.cos(windDir + 1) * this.time * config.causticSpeed * 10;

        causticMat.translateSelf(cDx, cDy);
        this.causticPattern.setTransform(causticMat);

        ctx.fillRect(0, 0, width, height);

        ctx.restore();
    }
}

window.WaterRenderer = new WaterRenderer();
