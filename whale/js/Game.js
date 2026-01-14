import { World } from './World.js';
import { Whale } from './entities/Whale.js';
import { Input } from './Input.js';
import { SpawnSystem } from './systems/SpawnSystem.js';
import { CollisionSystem } from './systems/CollisionSystem.js';
import { HUD } from './ui/HUD.js';
import { ParticleSystem } from './systems/ParticleSystem.js';
import { audio } from './utils/Audio.js';

export class Game {
    constructor() {
        this.container = document.getElementById('game-container');

        // Initialize Pixi Application
        this.app = new PIXI.Application({
            resizeTo: window,
            autoDensity: true,
            resolution: window.devicePixelRatio || 1,
            backgroundColor: 0x0f172a, // Deep blue
        });

        this.container.appendChild(this.app.view);

        // Game State
        this.isPlaying = false;
        this.lastTime = 0;
        this.accumulator = 0;
        this.timeStep = 1000 / 60; // 60 FPS fixed step

        // Layers
        this.backgroundLayer = new PIXI.Container();
        this.gameLayer = new PIXI.Container();
        this.uiLayer = new PIXI.Container();

        this.app.stage.addChild(this.backgroundLayer);
        this.app.stage.addChild(this.gameLayer);
        this.app.stage.addChild(this.uiLayer);

        // Input
        this.input = new Input();

        // Systems
        this.spawnSystem = new SpawnSystem(this);
        this.collisionSystem = new CollisionSystem(this);

        // Debug
        this.debug = {
            fps: document.getElementById('fps-counter'),
            entities: document.getElementById('entity-count')
        };
    }

    init() {
        if (this.isInitialized) return;

        // World
        this.world = new World(this);

        // Player
        // Start roughly in middle left
        this.player = new Whale(this, this.app.screen.width * 0.2, this.app.screen.height * 0.5);

        // HUD
        this.hud = new HUD(this);

        // Particles
        this.particles = new ParticleSystem(this);

        // Audio
        this.audio = audio;

        this.isInitialized = true;
        console.log("Game Initialized");
    }

    start() {
        if (this.isPlaying) return;

        this.init();
        this.isPlaying = true;
        this.lastTime = performance.now();

        // Start Loop
        this.app.ticker.stop();
        this.gameLoopId = requestAnimationFrame(this.loop.bind(this));
    }

    loop(currentTime) {
        if (!this.isPlaying) return;

        const deltaTime = currentTime - this.lastTime;
        this.lastTime = currentTime;
        this.accumulator += deltaTime;

        // Fixed Timestep Update
        while (this.accumulator >= this.timeStep) {
            this.update(this.timeStep / 1000);
            this.accumulator -= this.timeStep;
        }

        this.draw();

        // Update Debug
        if (this.debug.fps) {
             this.debug.fps.innerText = `FPS: ${Math.round(1000 / (deltaTime || 1))}`;
        }
        if (this.debug.entities) {
             // this.debug.entities.innerText = ...
        }

        this.gameLoopId = requestAnimationFrame(this.loop.bind(this));
    }

    update(dt) {
        // Update Player
        if (this.player) {
            this.player.update(dt);

            // Camera Logic (Player locked X, world scrolls)
            // Actually, usually in side scrollers, the player moves X, and camera follows.
            // But for infinite runner style, we can keep player X fixed-ish and scroll world.
            // Let's allow player to move in screen space slightly, but main scroll is constant + player boost.

            // Let's define a "Scroll Speed"
            const baseScrollSpeed = 100;
            const scrollSpeed = baseScrollSpeed + (this.player.vx > 0 ? this.player.vx * 0.5 : 0);

            // Update World Parallax
            this.world.update(dt, scrollSpeed);

            // Update Spawn System
            this.spawnSystem.update(dt);

            // Update Collisions
            this.collisionSystem.update(dt);

            // Update UI
            if (this.hud) this.hud.update(dt);

            // Update Particles
            if (this.particles) this.particles.update(dt);

            // Keep player from going off screen left/right
            if (this.player.container.x < 50) {
                this.player.container.x = 50;
                this.player.vx = 0;
            }
            if (this.player.container.x > this.app.screen.width * 0.6) {
                this.player.container.x = this.app.screen.width * 0.6;
            }
        }
    }

    draw() {
        this.app.render();
    }

    resize() {
        this.app.resize();
        if (this.world) this.world.resize();
        // Keep player on screen if resized
    }

    gameOver() {
        if (!this.isPlaying) return;
        this.isPlaying = false;
        alert("Game Over! Refresh to try again."); // Placeholder
        // Show restart UI
    }
}
