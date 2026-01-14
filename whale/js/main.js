import { Game } from './Game.js';

window.onload = () => {
    const game = new Game();

    // UI Elements
    const startBtn = document.getElementById('start-btn');
    const controlsHint = document.getElementById('controls-hint');

    startBtn.addEventListener('click', () => {
        controlsHint.style.opacity = '0';
        setTimeout(() => {
            controlsHint.style.display = 'none';
            game.start();
        }, 500);
    });

    // Handle resize
    window.addEventListener('resize', () => {
        game.resize();
    });
};
