import { Plankton } from '../entities/Plankton.js';
import { Hazard } from '../entities/Hazard.js';

export class SpawnSystem {
    constructor(game) {
        this.game = game;
        this.timer = 0;
        this.nextSpawnTime = 0;
    }

    update(dt) {
        this.timer += dt;

        // Ensure entities array exists in game
        if (!this.game.entities) this.game.entities = [];

        // Simple Spawner
        if (this.timer > this.nextSpawnTime) {
            this.spawn();
            this.timer = 0;
            this.nextSpawnTime = 1 + Math.random() * 2; // Every 1-3 seconds
        }

        // Cleanup off-screen
        for (let i = this.game.entities.length - 1; i >= 0; i--) {
            const ent = this.game.entities[i];

            // Check active status
            if (!ent.active) {
                this.game.gameLayer.removeChild(ent.container);
                this.game.entities.splice(i, 1);
                continue;
            }

            // Check off-screen (Left side)
            if (ent.container.x < -500) {
                this.game.gameLayer.removeChild(ent.container);
                this.game.entities.splice(i, 1);
                continue;
            }

            // Update entity
            // We pass player to update for AI logic
            // Need scrollSpeed from game
            const scrollSpeed = 100 + (this.game.player ? this.game.player.vx : 0);
            ent.update(dt, scrollSpeed, this.game.player);
        }
    }

    spawn() {
        const r = Math.random();
        const spawnX = this.game.app.screen.width + 100;
        const waterLevel = this.game.world.WATER_LEVEL;
        const height = this.game.app.screen.height;

        if (r < 0.6) {
            // Plankton Cluster
            // Spawn 3-5 plankton
            const count = 3 + Math.floor(Math.random() * 3);
            const centerY = waterLevel + Math.random() * (height - waterLevel - 50);

            for(let i=0; i<count; i++) {
                const offX = (Math.random() - 0.5) * 100;
                const offY = (Math.random() - 0.5) * 50;
                const p = new Plankton(spawnX + offX, centerY + offY);
                this.game.gameLayer.addChild(p.container);
                this.game.entities.push(p);
            }
        } else {
            // Hazard
            const hr = Math.random();
            let type = 'NET';
            let y = waterLevel + 50 + Math.random() * (height - waterLevel - 100);

            if (hr < 0.4) {
                type = 'BOAT';
                y = waterLevel; // Surface
            } else if (hr < 0.7) {
                type = 'PREDATOR';
                y = waterLevel + 100 + Math.random() * (height - waterLevel - 200);
            }

            const h = new Hazard(type, spawnX, y);
            this.game.gameLayer.addChild(h.container);
            this.game.entities.push(h);
        }
    }
}
