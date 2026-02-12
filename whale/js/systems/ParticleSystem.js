export class ParticleSystem {
    constructor(game) {
        this.game = game;
        this.particles = [];
        this.container = new PIXI.Container();
        this.game.gameLayer.addChild(this.container); // Add behind player? Or foreground?
        // Let's put particles in gameLayer, maybe adjust zIndex if needed.
        // For now append to gameLayer implies on top of things added before.
    }

    update(dt) {
        // Cleanup
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.life -= dt;

            // Apply gravity and drag if present
            if (p.gravity) p.vy += p.gravity * dt;
            if (p.drag) {
                p.vx *= (1 - p.drag * dt);
                p.vy *= (1 - p.drag * dt);
            }

            p.sprite.x += p.vx * dt;
            p.sprite.y += p.vy * dt;
            p.sprite.alpha = p.life / p.maxLife;

            // Shrink over time if particle has scale
            if (p.shrink) {
                const scale = p.life / p.maxLife;
                p.sprite.scale.set(scale);
            }

            if (p.life <= 0) {
                this.container.removeChild(p.sprite);
                this.particles.splice(i, 1);
            }
        }
    }

    blow(x, y) {
        // Humpback whale blow — tall, bushy V-shaped double spout
        // Main spout columns (two diverging jets)
        for (let side = -1; side <= 1; side += 2) {
            for (let i = 0; i < 8; i++) {
                const gfx = new PIXI.Graphics();
                const size = 3 + Math.random() * 3;
                gfx.beginFill(0xffffff, 0.6 + Math.random() * 0.2);
                gfx.drawCircle(0, 0, size);
                gfx.endFill();
                gfx.x = x + side * (2 + Math.random() * 3);
                gfx.y = y;
                this.container.addChild(gfx);
                this.particles.push({
                    sprite: gfx,
                    life: 0.8 + Math.random() * 0.5,
                    maxLife: 1.3,
                    vx: side * (15 + Math.random() * 25),  // V-divergence
                    vy: -180 - Math.random() * 100,         // Tall spout
                    gravity: 150,   // Arcs back down
                    drag: 1.5,      // Slows as it rises
                    shrink: true
                });
            }
        }

        // Bushy mist cloud at the top (delayed feel via slower initial velocity)
        for (let i = 0; i < 10; i++) {
            const gfx = new PIXI.Graphics();
            const size = 4 + Math.random() * 4;
            gfx.beginFill(0xffffff, 0.3 + Math.random() * 0.2);
            gfx.drawCircle(0, 0, size);
            gfx.endFill();
            gfx.x = x + (Math.random() - 0.5) * 10;
            gfx.y = y;
            this.container.addChild(gfx);
            this.particles.push({
                sprite: gfx,
                life: 1.0 + Math.random() * 0.8,
                maxLife: 1.8,
                vx: (Math.random() - 0.5) * 40,
                vy: -100 - Math.random() * 60,
                gravity: 30,    // Hangs in the air longer
                drag: 2.5,      // Quickly decelerates into a cloud
                shrink: true
            });
        }

        // Fine water droplets that fall back down
        for (let i = 0; i < 6; i++) {
            const gfx = new PIXI.Graphics();
            gfx.beginFill(0xd0e8ff, 0.5);
            gfx.drawCircle(0, 0, 1 + Math.random() * 1.5);
            gfx.endFill();
            gfx.x = x + (Math.random() - 0.5) * 8;
            gfx.y = y;
            this.container.addChild(gfx);
            this.particles.push({
                sprite: gfx,
                life: 1.2 + Math.random() * 0.6,
                maxLife: 1.8,
                vx: (Math.random() - 0.5) * 50,
                vy: -200 - Math.random() * 80,
                gravity: 250,   // Falls back quickly
                drag: 0.5
            });
        }
    }

    emit(x, y, count = 1) {
        for(let i=0; i<count; i++) {
            const gfx = new PIXI.Graphics();
            gfx.beginFill(0xffffff, 0.6);
            gfx.drawCircle(0, 0, 2 + Math.random() * 2);
            gfx.endFill();

            gfx.x = x;
            gfx.y = y;

            this.container.addChild(gfx);

            this.particles.push({
                sprite: gfx,
                life: 1.0 + Math.random(),
                maxLife: 2.0,
                vx: (Math.random() - 0.5) * 50,
                vy: -50 - Math.random() * 50 // Bubbles float up
            });
        }
    }
}
