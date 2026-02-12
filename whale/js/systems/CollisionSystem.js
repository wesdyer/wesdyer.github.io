export class CollisionSystem {
    constructor(game) {
        this.game = game;
    }

    update(dt) {
        const player = this.game.player;
        if (!player) return;

        // Player Hitbox (AABB)
        // Whale sprite: 400x119 at scale 0.5 = 200x60 on screen
        // Body anchor (0.45, 0.42) → extends ~90 left, ~110 right, ~25 up, ~35 down
        // Use a slightly smaller hitbox for fair gameplay
        const pX = player.container.x;
        const pY = player.container.y;
        const pHalfW = 70;  // ~140px wide hitbox (body core, not tail tip)
        const pHalfH = 20;  // ~40px tall hitbox
        const pLeft = pX - pHalfW;
        const pRight = pX + pHalfW;
        const pTop = pY - pHalfH;
        const pBottom = pY + pHalfH;

        for (const ent of this.game.entities) {
            if (!ent.active) continue;

            const eX = ent.container.x;
            const eY = ent.container.y;

            // Check Collision
            let hit = false;

            if (ent.constructor.name === 'Plankton') {
                // Circle collision — check closest point on whale rect to plankton center
                const closestX = Math.max(pLeft, Math.min(eX, pRight));
                const closestY = Math.max(pTop, Math.min(eY, pBottom));
                const dx = eX - closestX;
                const dy = eY - closestY;
                if (Math.sqrt(dx*dx + dy*dy) < ent.radius) {
                    hit = true;
                    this.handlePlankton(ent);
                }
            } else if (ent.constructor.name === 'Hazard') {
                if (ent.type === 'BOAT') {
                    // AABB vs AABB — ship rect vs whale rect
                    const shipHalfW = ent.width / 2;
                    const shipTop = eY - ent.height * 0.8;
                    const shipBottom = eY + ent.height * 0.2;
                    if (pRight > eX - shipHalfW && pLeft < eX + shipHalfW &&
                        pBottom > shipTop && pTop < shipBottom) {
                        hit = true;
                        this.handleHazard(ent);
                    }
                } else {
                    // Circle vs whale rect
                    const closestX = Math.max(pLeft, Math.min(eX, pRight));
                    const closestY = Math.max(pTop, Math.min(eY, pBottom));
                    const dx = eX - closestX;
                    const dy = eY - closestY;
                    if (Math.sqrt(dx*dx + dy*dy) < ent.radius) {
                        hit = true;
                        this.handleHazard(ent);
                    }
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

        // Only destroy small hazards, not boats
        if (ent.type !== 'BOAT') {
            ent.active = false;
        }

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
