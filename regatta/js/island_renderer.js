
const IslandRenderer = {
    initialized: false,
    assets: {
        palms: [],
        bushes: [],
        rocks: []
    },

    init: function() {
        if (this.initialized) return;
        this.generateAssets();
        this.initialized = true;
    },

    generateAssets: function() {
        this.assets.palms = [];
        this.assets.bushes = [];
        this.assets.rocks = [];

        // Generate Palm Variants
        for (let i = 0; i < 3; i++) {
            this.assets.palms.push(this.createPalmSprite(i));
        }
        // Generate Bush Variants
        for (let i = 0; i < 3; i++) {
            this.assets.bushes.push(this.createBushSprite(i));
        }
        // Generate Rock Variants
        for (let i = 0; i < 3; i++) {
            this.assets.rocks.push(this.createRockSprite(i));
        }
    },

    createCanvas: function(w, h) {
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        return c;
    },

    createPalmSprite: function(variant) {
        const s = 64;
        const c = this.createCanvas(s, s);
        const ctx = c.getContext('2d');
        const cx = s/2, cy = s/2;

        const leaves = 5 + variant;

        ctx.translate(cx, cy);

        // Shadow/Lower leaves
        ctx.fillStyle = '#14532d'; // Dark Green
        for(let i=0; i<leaves; i++) {
            ctx.save();
            ctx.rotate((i / leaves) * Math.PI * 2);
            ctx.beginPath();
            ctx.ellipse(15, 0, 18, 6, 0, 0, Math.PI*2);
            ctx.fill();
            ctx.restore();
        }

        // Upper leaves
        ctx.fillStyle = '#22c55e'; // Bright Green
        for(let i=0; i<leaves; i++) {
            ctx.save();
            ctx.rotate((i / leaves) * Math.PI * 2 + 0.3); // Offset
            ctx.beginPath();
            ctx.ellipse(12, 0, 15, 5, 0, 0, Math.PI*2);
            ctx.fill();
            // Highlight spine
            ctx.strokeStyle = '#4ade80';
            ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(24, 0); ctx.stroke();
            ctx.restore();
        }

        // Center
        ctx.fillStyle = '#3f6212'; // Dark mossy center
        ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI*2); ctx.fill();

        return c;
    },

    createBushSprite: function(variant) {
        const s = 48;
        const c = this.createCanvas(s, s);
        const ctx = c.getContext('2d');
        const cx = s/2, cy = s/2;

        const blobs = 5 + variant * 2;

        // Dark underlayer
        ctx.fillStyle = '#166534';
        for(let i=0; i<blobs; i++) {
            const ang = Math.random() * Math.PI * 2;
            const dist = Math.random() * 10;
            const r = 8 + Math.random() * 6;
            ctx.beginPath(); ctx.arc(cx + Math.cos(ang)*dist, cy + Math.sin(ang)*dist, r, 0, Math.PI*2); ctx.fill();
        }

        // Lighter top layer
        ctx.fillStyle = '#4ade80';
        for(let i=0; i<blobs; i++) {
            const ang = Math.random() * Math.PI * 2;
            const dist = Math.random() * 8;
            const r = 6 + Math.random() * 5;
            ctx.beginPath(); ctx.arc(cx + Math.cos(ang)*dist - 2, cy + Math.sin(ang)*dist - 2, r, 0, Math.PI*2); ctx.fill();
        }

        return c;
    },

    createRockSprite: function(variant) {
        const s = 48;
        const c = this.createCanvas(s, s);
        const ctx = c.getContext('2d');
        const cx = s/2, cy = s/2;

        ctx.translate(cx, cy);
        // Irregular shape
        ctx.beginPath();
        const points = 6 + variant;
        for(let i=0; i<points; i++) {
            const ang = (i/points) * Math.PI * 2;
            const r = 10 + Math.random() * 10;
            const x = Math.cos(ang) * r;
            const y = Math.sin(ang) * r;
            if (i===0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.closePath();

        // Base Grey
        ctx.fillStyle = '#64748b';
        ctx.fill();

        // Highlight
        ctx.clip();
        ctx.fillStyle = '#94a3b8';
        ctx.beginPath();
        ctx.arc(-5, -5, 15, 0, Math.PI*2);
        ctx.fill();

        return c;
    },

    // Main Draw Function
    drawIsland: function(ctx, isl) {
        if (!isl.cache) {
            this.cacheIsland(isl);
        }
        if (isl.cache) {
            const size = isl.cache.width;
            const offset = size / 2;
            ctx.drawImage(isl.cache, isl.x - offset, isl.y - offset);
        }
    },

    cacheIsland: function(isl) {
        const padding = 60; // For halo
        // Ensure size covers the entire island plus halo
        // Island radius is approximate, so double check if vertices go outside
        // But generateIslands bounds vertices by radius.
        const size = Math.ceil((isl.radius + padding) * 2);
        const c = this.createCanvas(size, size);
        const ctx = c.getContext('2d');

        const cx = size/2;
        const cy = size/2;

        // Transform vertices to local space
        const localVertices = isl.vertices.map(v => ({ x: v.x - isl.x + cx, y: v.y - isl.y + cy }));
        const localVeg = isl.vegVertices.map(v => ({ x: v.x - isl.x + cx, y: v.y - isl.y + cy }));

        const localIsl = {
            ...isl,
            vertices: localVertices,
            vegVertices: localVeg,
            decorations: isl.decorations ? isl.decorations.map(d => ({ ...d, x: d.x - isl.x + cx, y: d.y - isl.y + cy })) : []
        };

        this.drawHalo(ctx, localIsl);
        this.drawSand(ctx, localIsl);
        this.drawGrass(ctx, localIsl);
        this.drawDecorations(ctx, localIsl);

        isl.cache = c;
    },

    drawHalo: function(ctx, isl) {
        // Draw a wide stroke behind the island for shallow water
        ctx.save();
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';

        const haloWidth = 40;

        ctx.shadowColor = 'rgba(45, 212, 191, 0.4)'; // Teal-ish
        ctx.shadowBlur = haloWidth;

        ctx.fillStyle = 'rgba(45, 212, 191, 0.3)';

        this.pathPolygon(ctx, isl.vertices);
        ctx.fill();

        // Extra stroke to define the shallow area
        ctx.lineWidth = haloWidth * 0.5;
        ctx.strokeStyle = 'rgba(45, 212, 191, 0.2)';
        ctx.stroke();

        ctx.restore();
    },

    drawSand: function(ctx, isl) {
        ctx.save();
        ctx.fillStyle = '#fde6b1'; // Base Sand
        this.pathPolygon(ctx, isl.vertices);
        ctx.fill();
        ctx.restore();
    },

    drawGrass: function(ctx, isl) {
        if (!isl.vegVertices || isl.vegVertices.length === 0) return;

        ctx.save();

        ctx.fillStyle = '#84cc16'; // Lime Green
        this.pathPolygon(ctx, isl.vegVertices);
        ctx.fill();

        // Tonal variation (blob inside)
        ctx.globalCompositeOperation = 'source-atop';
        const bounds = this.getBounds(isl.vegVertices);
        const grad = ctx.createRadialGradient(
            bounds.cx, bounds.cy, 0,
            bounds.cx, bounds.cy, bounds.r
        );
        grad.addColorStop(0, '#a3e635'); // Lighter center
        grad.addColorStop(1, '#65a30d'); // Darker edge

        ctx.fillStyle = grad;
        ctx.fill();

        ctx.restore();
    },

    drawDecorations: function(ctx, isl) {
        if (!isl.decorations) return;

        // Sort by Y for simple depth sorting
        const sorted = [...isl.decorations].sort((a, b) => a.y - b.y);

        for (const d of sorted) {
            let sprite;
            if (d.type === 'palm') sprite = this.assets.palms[d.variant % this.assets.palms.length];
            else if (d.type === 'bush') sprite = this.assets.bushes[d.variant % this.assets.bushes.length];
            else if (d.type === 'rock') sprite = this.assets.rocks[d.variant % this.assets.rocks.length];

            if (sprite) {
                const w = sprite.width * d.scale;
                const h = sprite.height * d.scale;

                ctx.save();
                ctx.translate(d.x, d.y);
                if (d.rotation) ctx.rotate(d.rotation);

                // Shadow
                ctx.save();
                ctx.globalAlpha = 0.2;
                ctx.translate(2, 2);
                ctx.drawImage(sprite, -w/2, -h/2, w, h);
                ctx.restore();

                ctx.drawImage(sprite, -w/2, -h/2, w, h);
                ctx.restore();
            }
        }
    },

    pathPolygon: function(ctx, vertices) {
        if (vertices.length < 3) return;
        ctx.beginPath();
        // Rounded Poly Logic from original script
        const last = vertices[vertices.length - 1];
        const first = vertices[0];
        let midX = (last.x + first.x) / 2;
        let midY = (last.y + first.y) / 2;
        ctx.moveTo(midX, midY);

        for (let i = 0; i < vertices.length; i++) {
            const p = vertices[i];
            const next = vertices[(i + 1) % vertices.length];
            midX = (p.x + next.x) / 2;
            midY = (p.y + next.y) / 2;
            ctx.quadraticCurveTo(p.x, p.y, midX, midY);
        }
        ctx.closePath();
    },

    getBounds: function(vertices) {
        let minX=Infinity, maxX=-Infinity, minY=Infinity, maxY=-Infinity;
        for(const v of vertices) {
            if (v.x < minX) minX = v.x;
            if (v.x > maxX) maxX = v.x;
            if (v.y < minY) minY = v.y;
            if (v.y > maxY) maxY = v.y;
        }
        return { cx: (minX+maxX)/2, cy: (minY+maxY)/2, r: Math.max(maxX-minX, maxY-minY)/2 };
    }
};

// Expose
window.IslandRenderer = IslandRenderer;
