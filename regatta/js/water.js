
// Water Rendering Configuration
window.WATER_CONFIG = {
    gradientStart: '#0ea5e9', // Sky Blue 500 (Top-Left)
    gradientEnd: '#1e3a8a',   // Blue 900 (Bottom-Right)
    waveColor: '#93c5fd',     // Light Blue Waves (Blue-300)
    waveOpacity: 0.6,
    waveCount: 40, // Number of waves per tile
    tileSize: 512,
    waveRadius: 8,
    waveLineWidth: 2
};

class WaterRenderer {
    constructor() {
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.pattern = null;
        this.lastConfigHash = '';
    }

    init() {
        console.log("WaterRenderer: Initialized (Gradient + Waves)");
        this.updateTexture();
    }

    getConfigHash() {
        const c = window.WATER_CONFIG;
        return `${c.waveColor}-${c.waveCount}-${c.tileSize}-${c.waveRadius}`;
    }

    updateTexture() {
        const hash = this.getConfigHash();
        if (hash === this.lastConfigHash) return;
        this.lastConfigHash = hash;

        const c = window.WATER_CONFIG;
        const size = c.tileSize;

        if (this.canvas.width !== size) {
            this.canvas.width = size;
            this.canvas.height = size;
        }

        const ctx = this.ctx;
        ctx.clearRect(0, 0, size, size);

        // Draw Waves
        ctx.strokeStyle = c.waveColor;
        ctx.lineWidth = c.waveLineWidth;
        ctx.lineCap = 'round';
        ctx.globalAlpha = c.waveOpacity;

        // Use a consistent seed if possible, or just Math.random since it's generated once per config change
        for (let i = 0; i < c.waveCount; i++) {
            const x = Math.random() * size;
            const y = Math.random() * size;
            const r = c.waveRadius;

            // Draw Smile (Arc 0 to PI)
            const drawSmile = (cx, cy) => {
                ctx.beginPath();
                ctx.arc(cx, cy, r, 0, Math.PI);
                ctx.stroke();
            };

            drawSmile(x, y);

            // Simple Tiling (Draw copies if near edges)
            // Left/Right
            if (x < r) drawSmile(x + size, y);
            if (x > size - r) drawSmile(x - size, y);
            // Top/Bottom
            if (y < r) drawSmile(x, y + size);
            if (y > size - r) drawSmile(x, y - size);
        }

        this.pattern = null;
        console.log("WaterRenderer: Wave Texture Updated");
    }

    draw(ctx, state) {
        if (!state) return;
        const c = window.WATER_CONFIG;

        // Check for config updates
        this.updateTexture();

        const width = ctx.canvas.width;
        const height = ctx.canvas.height;

        // 1. Background Gradient (Diagonal)
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset for full fill

        const grad = ctx.createLinearGradient(0, 0, width, height);
        grad.addColorStop(0, c.gradientStart);
        grad.addColorStop(1, c.gradientEnd);

        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);

        // 2. Wave Pattern
        if (!this.pattern) {
            this.pattern = ctx.createPattern(this.canvas, 'repeat');
        }

        const cam = state.camera;

        // Pattern Transform: Align with World
        const matrix = new DOMMatrix();
        matrix.translateSelf(width/2, height/2);
        matrix.rotateSelf(0, 0, -cam.rotation * (180/Math.PI));
        matrix.translateSelf(-cam.x, -cam.y);

        ctx.fillStyle = this.pattern;
        this.pattern.setTransform(matrix);

        ctx.fillRect(0, 0, width, height);

        ctx.restore();
    }
}

window.WaterRenderer = new WaterRenderer();
