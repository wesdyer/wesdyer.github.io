export class CollisionSystem {
    constructor(game) {
        this.game = game;
    }

    update(dt) {
        const player = this.game.player;
        if (!player) return;

        // Player Hitbox
        // Whale is roughly 80x40. Center is at container xy.
        // Let's approximate with a circle radius 30 for now, or 2 circles.
        const pX = player.container.x;
        const pY = player.container.y;
        const pRadius = 30;

        for (const ent of this.game.entities) {
            if (!ent.active) continue;

            const eX = ent.container.x;
            const eY = ent.container.y;

            // Check Collision
            let hit = false;

            // Plankton is small circle
            if (ent.constructor.name === 'Plankton') {
                 const dx = pX - eX;
                 const dy = pY - eY;
                 const dist = Math.sqrt(dx*dx + dy*dy);
                 if (dist < pRadius + ent.radius) {
                     hit = true;
                     this.handlePlankton(ent);
                 }
            } else if (ent.constructor.name === 'Hazard') {
                // Hazard logic
                // Simple distance check for now
                const dx = pX - eX;
                const dy = pY - eY;

                // For Boat/Rects, we might want AABB, but Radius is easiest for "smooth" feel
                if (dist(dx, dy) < pRadius + ent.radius) {
                    hit = true;
                    this.handleHazard(ent);
                }
            }
        }
    }

    handlePlankton(ent) {
        ent.active = false;
        this.game.player.energy += 10;
        this.game.player.energy = Math.min(this.game.player.energy, this.game.player.maxEnergy);

        // Visual feedback
        if (this.game.particles) {
            this.game.particles.emit(ent.container.x, ent.container.y, 5);
        }

        // Sound
        if (this.game.audio) {
            this.game.audio.playCollect();
        }
    }

    handleHazard(ent) {
        if (this.game.player.invulnerable > 0) return;

        ent.active = false; // Destroy hazard or just apply hit?
        // Usually hazards persist but player flashes.
        // For simplicity, let's just apply damage and small debounce.

        const player = this.game.player;

        if (ent.type === 'NET') {
            player.speed *= 0.5; // Slow down
            setTimeout(() => player.speed = 200, 2000); // Reset after 2s (logic should be in Whale update but this is a hacky easy way)
            // Wait, Whale update resets speed based on dash.
            // We should add a "debuff" system to Whale.
            player.health -= 10;
        } else {
            player.health -= 20;
            // Knockback?
            player.vx = -200;
        }

        // I-Frames
        player.invulnerable = 1.0;

        // Feedback
        // Screen shake? Flash?
        this.game.player.sprite.alpha = 0.5;

        if (this.game.audio) {
            this.game.audio.playDamage();
        }
    }
}

function dist(dx, dy) {
    return Math.sqrt(dx*dx + dy*dy);
}
