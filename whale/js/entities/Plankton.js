export class Plankton {
    constructor(x, y) {
        this.container = new PIXI.Container();
        this.container.x = x;
        this.container.y = y;
        this.radius = 15;
        this.active = true;

        const gfx = new PIXI.Graphics();
        gfx.beginFill(0xffff00, 0.6); // Yellow glow
        gfx.drawCircle(0, 0, 5);
        gfx.endFill();

        // Add some "cloud" particles around it
        for(let i=0; i<3; i++) {
            gfx.beginFill(0xffffcc, 0.3);
            gfx.drawCircle((Math.random()-0.5)*15, (Math.random()-0.5)*15, 3);
            gfx.endFill();
        }

        this.container.addChild(gfx);
    }

    update(dt, scrollSpeed) {
        // Scroll with world
        this.container.x -= scrollSpeed * dt;

        // Gentle drift
        this.container.y += Math.sin(Date.now() / 500 + this.container.x) * 10 * dt;
    }
}
