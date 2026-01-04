# Regatta - Structure Refactor

This directory contains the refactored Regatta game. The codebase has been modularized to improve maintainability and extensibility.

## Project Structure

*   `index.html`: Main entry point. Loads `js/main.js` as an ES module.
*   `js/`: Source code.
    *   `main.js`: Main entry point. Initializes game state, inputs, and the game loop.
    *   `core/`: Core configuration and constants (`config.js`).
    *   `state/`: Central state management (`state.js`).
    *   `entities/`: Game entities (`boat.js`, `course.js`).
    *   `physics/`: Physics engines and logic.
        *   `boat_physics.js`: Boat movement, sail trim, and aerodynamics.
        *   `collision.js`: Low-level collision detection (SAT, polygons).
        *   `collision_manager.js`: High-level collision handling and response.
        *   `wind.js`: Wind simulation (gusts, lulls, shifts).
        *   `rules.js`: Racing rules of sailing implementation (Right of Way).
    *   `ai/`: Artificial Intelligence.
        *   `controller.js`: Bot behavior and decision making.
        *   `planner.js`: Pathfinding (A*).
        *   `sayings.js`: Chat/Bark system.
    *   `graphics/`: Rendering logic.
        *   `renderer.js`: Main canvas rendering functions.
        *   `water.js`: Procedural water shader/renderer.
    *   `ui/`: User Interface management (`ui.js`).
    *   `audio/`: Sound system (`sound.js`).
    *   `input/`: Input handling (`input.js`).
    *   `utils/`: Helper functions (`math.js`, `helpers.js`).
*   `assets/`: Images and audio files.

## Running the Game

Because the game now uses ES Modules (`import`/`export`), it **must be served via an HTTP server** to avoid CORS errors. You cannot simply open `index.html` directly from the file system.

### Using Python (e.g., for local dev)
Run this command from the project root:
```bash
python3 -m http.server 8080
```
Then open `http://localhost:8080/regatta/index.html` in your browser.

## Running Tests

Tests are written using Playwright.

1.  Ensure you have Node.js installed.
2.  Install dependencies (if not already):
    ```bash
    npm install
    npx playwright install
    ```
3.  Run the tests:
    ```bash
    npx playwright test regatta/tests/smoke.spec.js
    ```
    *Note: The tests require the game to be served via HTTP (localhost) to bypass CORS restrictions on modules.*

## Refactoring Conventions

*   **Modules**: All new code should be ES modules.
*   **State**: Global state is managed in `js/state/state.js` and exported as `state`. Avoid attaching new properties to `window` unless necessary for debugging or external hooks.
*   **Imports**: Use explicit relative imports with extensions (e.g., `import { ... } from './utils/math.js'`).
*   **Decoupling**: Physics logic should be separate from Rendering logic where possible.
