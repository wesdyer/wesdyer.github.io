export class Whale {
    constructor(game, x, y) {
        this.game = game;
        this.app = game.app;

        this.container = new PIXI.Container();
        this.container.x = x;
        this.container.y = y;

        // Physics
        this.vx = 0;
        this.vy = 0;
        this.speed = 200; // base movement speed
        this.maxSpeed = 300;
        this.drag = 0.95; // Underwater drag
        this.buoyancy = -10; // Slight upward force underwater
        this.gravity = 500; // Air gravity

        // Stats
        this.maxOxygen = 100;
        this.oxygen = 100;
        this.maxEnergy = 100;
        this.energy = 50;
        this.maxHealth = 100;
        this.health = 100;
        this.invulnerable = 0;

        // Visuals
        this.createVisuals();

        this.game.gameLayer.addChild(this.container);
    }

    createVisuals() {
        this.sprite = new PIXI.Graphics();

        // Body (Ellipse)
        this.sprite.beginFill(0x4fd1c5); // Teal/Turquoise
        this.sprite.drawEllipse(0, 0, 40, 20); // Center at 0,0
        this.sprite.endFill();

        // Tail
        this.sprite.beginFill(0x38b2ac);
        this.sprite.moveTo(-30, 0);
        this.sprite.lineTo(-50, -15);
        this.sprite.lineTo(-50, 15);
        this.sprite.lineTo(-30, 0);
        this.sprite.endFill();

        // Eye
        this.sprite.beginFill(0xffffff);
        this.sprite.drawCircle(20, -5, 3);
        this.sprite.endFill();
        this.sprite.beginFill(0x000000);
        this.sprite.drawCircle(21, -5, 1);
        this.sprite.endFill();

        this.container.addChild(this.sprite);
    }

    update(dt) {
        const input = this.game.input;
        const waterLevel = this.game.world.WATER_LEVEL;
        const isUnderwater = this.container.y > waterLevel;

        if (this.invulnerable > 0) {
            this.invulnerable -= dt;
            this.sprite.alpha = 0.5 + Math.sin(Date.now() / 50) * 0.5; // Flash
        } else {
            this.sprite.alpha = 1;
        }

        // Input Forces
        let inputY = input.getAxisY();
        let inputX = input.getAxisX(); // Allow slight X movement (speeding up/slowing down scroll)

        // "Dash" / Swim kick
        if (input.isDash() && this.energy > 0) {
            this.speed = 400;
            // Drain energy? Maybe not per frame, but on activation.
            // For now just speed boost.
        } else {
            this.speed = 200;
        }

        // Apply Forces
        if (isUnderwater) {
            // Underwater movement
            this.vy += inputY * this.speed * 2 * dt; // Acceleration
            this.vx += inputX * this.speed * dt;

            // Buoyancy (passive float)
            if (inputY === 0) {
                 this.vy += this.buoyancy * dt;
            }

            // Drag
            this.vx *= this.drag;
            this.vy *= this.drag;

            // Oxygen Drain
            this.oxygen -= 5 * dt; // Drain faster for gameplay tension

            if (this.oxygen <= 0) {
                this.oxygen = 0;
                this.health -= 5 * dt; // Suffocation damage
                // Visual feedback for choking? (handled in visuals later)

                // Optional: Force float up
                this.vy -= 200 * dt;
            }
        } else {
            // Air / Jump
            this.vy += this.gravity * dt; // Gravity
            this.vx *= 0.99; // Air resistance

            // Oxygen Refill
            this.oxygen += 50 * dt;
        }

        // Clamp Stats
        this.oxygen = Math.max(0, Math.min(this.oxygen, this.maxOxygen));
        this.energy = Math.max(0, Math.min(this.energy, this.maxEnergy));
        this.health = Math.max(0, Math.min(this.health, this.maxHealth));

        // Check Death
        if (this.health <= 0) {
            // Game Over logic (trigger event)
            this.game.gameOver();
        }

        // Update Position
        this.container.x += this.vx * dt;
        this.container.y += this.vy * dt;

        // Boundaries
        // Floor
        const seaFloor = this.game.world.SEA_FLOOR || 600;
        if (this.container.y > seaFloor) {
            this.container.y = seaFloor;
            this.vy = 0;
        }

        // Ceiling (Sky limit) - prevent flying too high
        if (this.container.y < -200) {
            this.container.y = -200;
            this.vy = 0;
        }

        // Rotation (Tilt based on velocity)
        // Smooth rotation
        const targetRotation = Math.atan2(this.vy, this.speed * 2 + Math.abs(this.vx)); // Bias towards forward
        this.container.rotation += (targetRotation - this.container.rotation) * 5 * dt;
    }
}
