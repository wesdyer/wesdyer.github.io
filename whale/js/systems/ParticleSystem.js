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

            p.sprite.x += p.vx * dt;
            p.sprite.y += p.vy * dt;
            p.sprite.alpha = p.life / p.maxLife;

            if (p.life <= 0) {
                this.container.removeChild(p.sprite);
                this.particles.splice(i, 1);
            }
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
