import { ParallaxSystem } from './systems/ParallaxSystem.js';

export class World {
    constructor(game) {
        this.game = game;
        this.app = game.app;

        // Constants
        this.WATER_LEVEL = this.app.screen.height * 0.35; // Water starts at 35% down
        this.SEA_FLOOR = this.app.screen.height * 1.5; // Deep

        this.parallaxSystem = new ParallaxSystem(this.app);

        this.setupLayers();
    }

    setupLayers() {
        // 1. Sky Layer (Far Back)
        const skyGfx = new PIXI.Graphics();
        skyGfx.beginFill(0x87CEEB); // Sky Blue
        skyGfx.drawRect(0, 0, 100, this.app.screen.height); // Width doesn't matter for fill, but texture needs size
        skyGfx.endFill();
        // Add a sun or clouds if possible

        // Generate texture
        const skyTexture = this.app.renderer.generateTexture(skyGfx);
        const skySprite = new PIXI.TilingSprite(skyTexture, this.app.screen.width, this.app.screen.height);
        this.game.backgroundLayer.addChild(skySprite);
        // Sky moves very slowly or is static
        this.parallaxSystem.addLayer(skySprite, 0.05);


        // 2. Background Islands/Distant (Mid)
        const bgGfx = new PIXI.Graphics();
        bgGfx.beginFill(0x2d3748); // Dark Slate
        // Draw some mountain shapes
        bgGfx.moveTo(0, this.WATER_LEVEL);
        bgGfx.lineTo(50, this.WATER_LEVEL - 50);
        bgGfx.lineTo(150, this.WATER_LEVEL);
        bgGfx.lineTo(250, this.WATER_LEVEL - 80);
        bgGfx.lineTo(400, this.WATER_LEVEL);
        bgGfx.lineTo(400, this.app.screen.height); // Fill down?
        bgGfx.lineTo(0, this.app.screen.height);
        bgGfx.endFill();

        // We need a wider texture to scroll
        const bgTexture = this.app.renderer.generateTexture(bgGfx, { region: new PIXI.Rectangle(0, 0, 400, this.app.screen.height) });
        const bgSprite = new PIXI.TilingSprite(bgTexture, this.app.screen.width, this.app.screen.height);
        bgSprite.y = -50; // Adjust vertical pos
        this.game.backgroundLayer.addChild(bgSprite);
        this.parallaxSystem.addLayer(bgSprite, 0.2);


        // 3. Water Surface & Underwater Gradient (Foreground/Main)
        // We'll use a container for the main game world, but for parallax BG logic:

        // Underwater Gradient Layer
        const waterGfx = new PIXI.Graphics();
        // Simple solid for now, or gradient if Pixi supports easily (Canvas gradient)
        // Let's create a canvas gradient texture manually
        const canvas = document.createElement('canvas');
        canvas.width = 100;
        canvas.height = this.app.screen.height;
        const ctx = canvas.getContext('2d');
        const gradient = ctx.createLinearGradient(0, this.WATER_LEVEL, 0, this.app.screen.height);
        gradient.addColorStop(0, '#22d3ee'); // Cyan (Surface)
        gradient.addColorStop(0.4, '#0ea5e9'); // Sky Blue
        gradient.addColorStop(1, '#1e1b4b'); // Deep Blue
        ctx.fillStyle = gradient;
        ctx.fillRect(0, this.WATER_LEVEL, 100, this.app.screen.height - this.WATER_LEVEL);

        const waterTexture = PIXI.Texture.from(canvas);
        const waterSprite = new PIXI.TilingSprite(waterTexture, this.app.screen.width, this.app.screen.height);

        this.game.backgroundLayer.addChild(waterSprite);
        this.parallaxSystem.addLayer(waterSprite, 0.5); // Moves with camera generally, but parallax effect might be subtle

        // Add a "Surface Line"
        const surfaceLine = new PIXI.Graphics();
        surfaceLine.lineStyle(2, 0xffffff, 0.5);
        surfaceLine.moveTo(0, this.WATER_LEVEL);
        surfaceLine.lineTo(this.app.screen.width, this.WATER_LEVEL);
        this.game.backgroundLayer.addChild(surfaceLine);
        this.surfaceLine = surfaceLine; // Keep ref to resize
    }

    update(dt, scrollSpeed) {
        this.parallaxSystem.update(dt, scrollSpeed);
    }

    resize() {
        // Re-generate textures or resize tiling sprites
        const w = this.app.screen.width;
        const h = this.app.screen.height;

        this.WATER_LEVEL = h * 0.35;
        this.parallaxSystem.resize(w, h);

        // Redraw surface line
        this.surfaceLine.clear();
        this.surfaceLine.lineStyle(2, 0xffffff, 0.5);
        this.surfaceLine.moveTo(0, this.WATER_LEVEL);
        this.surfaceLine.lineTo(w, this.WATER_LEVEL);
    }
}
