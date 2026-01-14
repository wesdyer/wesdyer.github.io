# Whale Journey

A 2D side-scrolling whale conservation game.

## Architecture

- **Engine**: HTML5 Canvas with PixiJS (v7.3.2).
- **Game Loop**: Fixed timestep (60 FPS) in `Game.js`.
- **ECS-lite**:
  - **Entities**: Whale, Plankton, Hazard.
  - **Systems**: ParallaxSystem, SpawnSystem, CollisionSystem, ParticleSystem, HUD.

## Controls

**Desktop**:
- **WASD / Arrow Keys**: Swim (Up/Down/Left/Right).
- **Space**: Dash (uses Energy).

**Mobile**:
- **Touch & Drag**: Swim.
- **Tap**: Dash.

## Gameplay

- **Oxygen**: Drains underwater. Surface to refill.
- **Energy**: Drains when dashing. Refill by eating Plankton.
- **Health**: Avoid Hazards (Boats, Nets, Predators).

## Adding Content

- **New Hazards**: Add types to `js/entities/Hazard.js` and spawn logic in `js/systems/SpawnSystem.js`.
- **New Biomes**: Update `js/World.js` and `js/systems/ParallaxSystem.js` to swap textures.

## Performance

- Uses `PIXI.Container` and `PIXI.Graphics` for rendering.
- Simple bounding circle collision.
- Entities are pooled/removed when off-screen.
