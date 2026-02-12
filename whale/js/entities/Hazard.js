export class Hazard {
    constructor(type, x, y) {
        this.type = type;
        this.container = new PIXI.Container();
        this.container.x = x;
        this.container.y = y;
        this.active = true;
        this.vx = 0;
        this.vy = 0;

        // Bounds for collision
        this.radius = 20;
        this.width = 40;
        this.height = 40;

        this.createVisuals();
    }

    createVisuals() {
        const gfx = new PIXI.Graphics();

        if (this.type === 'BOAT') {
            // Cargo ship sprite
            const ship = PIXI.Sprite.from('assets/cargo_ship.png');
            ship.anchor.set(0.5, 0.8); // Anchor near waterline
            ship.scale.set(1.5);
            this.container.addChild(ship);

            this.radius = 180;
            this.width = 450;
            this.height = 105;
            return; // Skip adding empty gfx
        } else if (this.type === 'NET') {
            gfx.lineStyle(2, 0x552200, 0.8);
            // Draw grid
            for(let i=-30; i<=30; i+=15) {
                gfx.moveTo(i, -30);
                gfx.lineTo(i, 30);
                gfx.moveTo(-30, i);
                gfx.lineTo(30, i);
            }
            this.radius = 30;
        } else if (this.type === 'PREDATOR') {
            gfx.beginFill(0xff4444);
            gfx.drawPolygon([
                -30, 0,
                30, -10,
                30, 10
            ]); // Pointing left (usually)
            gfx.endFill();
            this.radius = 25;
        }

        this.container.addChild(gfx);
    }

    update(dt, scrollSpeed, player) {
        // Scroll relative to world
        this.container.x -= scrollSpeed * dt;

        if (this.type === 'BOAT') {
            // Boat moves faster than scroll (overtakes or comes from behind?)
            // Usually hazards come from right to left in runner.
            // If it spawns ahead, it moves left.
            this.container.x -= 50 * dt;
        } else if (this.type === 'PREDATOR') {
            // Simple tracking
            this.container.x -= 150 * dt; // Fast swimmer

            // Telegraph & Dash logic could go here
            // For now just swim straight
        } else if (this.type === 'NET') {
             // Static in water, so just scrolls
        }
    }
}
