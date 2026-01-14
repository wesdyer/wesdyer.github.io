export class Input {
    constructor() {
        this.keys = {};
        this.pointer = { x: 0, y: 0, isDown: false };

        window.addEventListener('keydown', (e) => this.onKeyDown(e));
        window.addEventListener('keyup', (e) => this.onKeyUp(e));

        // Touch/Pointer events (handled by Pixi usually for game coords, but we can do global)
        window.addEventListener('pointerdown', (e) => this.onPointerDown(e));
        window.addEventListener('pointerup', (e) => this.onPointerUp(e));
        window.addEventListener('pointermove', (e) => this.onPointerMove(e));
    }

    onKeyDown(e) {
        this.keys[e.code] = true;
    }

    onKeyUp(e) {
        this.keys[e.code] = false;
    }

    onPointerDown(e) {
        this.pointer.isDown = true;
        this.pointer.x = e.clientX;
        this.pointer.y = e.clientY;
    }

    onPointerUp(e) {
        this.pointer.isDown = false;
    }

    onPointerMove(e) {
        this.pointer.x = e.clientX;
        this.pointer.y = e.clientY;
    }

    getAxisY() {
        let y = 0;
        if (this.keys['ArrowUp'] || this.keys['KeyW']) y -= 1;
        if (this.keys['ArrowDown'] || this.keys['KeyS']) y += 1;
        return y;
    }

    getAxisX() {
        let x = 0;
        if (this.keys['ArrowLeft'] || this.keys['KeyA']) x -= 1;
        if (this.keys['ArrowRight'] || this.keys['KeyD']) x += 1;
        return x;
    }

    isDash() {
        return this.keys['Space']; // || Double tap?
    }
}
