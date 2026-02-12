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
        // Wrapper group handles horizontal flip + overall scale
        this.whaleGroup = new PIXI.Container();
        this.whaleGroup.scale.set(-0.5, 0.5); // Flipped (image faces left, whale swims right)

        // --- Tail fluke (behind body) ---
        this.tailSprite = PIXI.Sprite.from('assets/whale_tail.png');
        this.tailSprite.anchor.set(0, 0.37); // Pivot at left-center (peduncle connection)
        this.tailSprite.position.set(125, 5);  // Relative to body center (180,50)
        this.whaleGroup.addChild(this.tailSprite);

        // --- Pectoral flipper (behind body — body hides the attachment) ---
        this.flipperSprite = PIXI.Sprite.from('assets/whale_flipper.png');
        this.flipperSprite.anchor.set(0.636, 0.163); // Pivot at body attachment point
        this.flipperSprite.position.set(-20, 32);
        this.whaleGroup.addChild(this.flipperSprite);

        // --- Body (drawn last, on top — covers flipper attachment seam) ---
        this.bodySprite = PIXI.Sprite.from('assets/whale_body.png');
        this.bodySprite.anchor.set(0.45, 0.42); // Center of body mass
        this.bodySprite.position.set(0, 0);
        this.whaleGroup.addChild(this.bodySprite);

        // For invulnerability flash, reference the whole group
        this.sprite = this.whaleGroup;

        // Animation state
        this.swimTime = 0;
        this.facingRight = true;
        this.wasUnderwater = true;

        this.container.addChild(this.whaleGroup);
    }

    update(dt) {
        const input = this.game.input;
        const waterLevel = this.game.world.WATER_LEVEL;
        const isUnderwater = this.container.y > waterLevel;

        // Blow when surfacing
        if (this.wasUnderwater && !isUnderwater && this.game.particles) {
            // Spout from blowhole (slightly ahead and above the whale's back)
            const blowX = this.container.x + (this.facingRight ? 20 : -20);
            const blowY = this.container.y - 25;
            this.game.particles.blow(blowX, blowY);
        }
        this.wasUnderwater = isUnderwater;

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

        // Swimming animation
        this.swimTime += dt;
        const swimSpeed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);

        // Flip whale based on horizontal movement direction
        if (this.vx > 15) this.facingRight = true;
        else if (this.vx < -15) this.facingRight = false;
        this.whaleGroup.scale.x = this.facingRight ? -0.5 : 0.5;

        // --- Tail animation ---
        // Slow, graceful oscillation that picks up slightly with speed
        const tailFreq = 2 + Math.min(swimSpeed / 150, 2);
        const tailAmp = 0.12 + Math.min(swimSpeed / 300, 0.25);
        this.tailSprite.rotation = Math.sin(this.swimTime * tailFreq) * tailAmp;

        // --- Flipper animation ---
        // Gentle flapping, slower than tail
        const flipFreq = 1.2 + Math.min(swimSpeed / 250, 1.3);
        const flipAmp = 0.08 + Math.min(swimSpeed / 400, 0.17);
        this.flipperSprite.rotation = Math.sin(this.swimTime * flipFreq + 0.5) * flipAmp;

        // --- Body bob ---
        // Slight vertical bob for idle swimming feel
        this.whaleGroup.y = Math.sin(this.swimTime * 1.5) * 2;

        // Dash stretch effect
        if (this.speed > 300) {
            const stretch = 1.05;
            this.whaleGroup.scale.y = 0.5 / stretch;
            this.whaleGroup.scale.x = (this.facingRight ? -0.5 : 0.5) * stretch;
        } else {
            this.whaleGroup.scale.y = 0.5;
        }

        // Rotation (Tilt based on velocity)
        const targetRotation = Math.atan2(this.vy, this.speed * 2 + Math.abs(this.vx));
        this.container.rotation += (targetRotation - this.container.rotation) * 5 * dt;
    }
}
