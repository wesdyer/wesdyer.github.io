export class ParallaxLayer {
    constructor(texture, speed, direction = -1) {
        this.speed = speed;
        this.direction = direction;
        this.sprites = [];

        // We need enough sprites to cover the screen width + buffer
        // For simplicity, we assume texture wraps or we tile sprites
        this.texture = texture;
    }

    // Helper to create tiling sprite logic
}

export class ParallaxSystem {
    constructor(app) {
        this.app = app;
        this.layers = [];
        this.cameraX = 0;
        this.width = app.screen.width;
        this.height = app.screen.height;
    }

    addLayer(container, speed) {
        this.layers.push({
            container: container,
            speed: speed
        });
    }

    update(dt, playerSpeedX) {
        // Move camera
        this.cameraX += playerSpeedX * dt;

        this.layers.forEach(layer => {
            // Update position based on cameraX and parallax speed
            // Since we are scrolling indefinitely, we might need TilingSprite
            // For now, let's assume the container holds a TilingSprite

            if (layer.container.tilePosition) {
                layer.container.tilePosition.x -= playerSpeedX * layer.speed * dt;
            }
        });
    }

    resize(width, height) {
        this.width = width;
        this.height = height;
        this.layers.forEach(layer => {
            if (layer.container.width) layer.container.width = width;
            if (layer.container.height) layer.container.height = height; // Careful with aspect ratio
        });
    }
}
