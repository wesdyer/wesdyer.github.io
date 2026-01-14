export class HUD {
    constructor(game) {
        this.game = game;
        this.container = new PIXI.Container();
        this.game.uiLayer.addChild(this.container);

        // Bars
        this.oxygenBar = new PIXI.Graphics();
        this.energyBar = new PIXI.Graphics();
        this.healthBar = new PIXI.Graphics();

        this.container.addChild(this.oxygenBar);
        this.container.addChild(this.energyBar);
        this.container.addChild(this.healthBar);

        // Labels (if text works easily, otherwise just bars/icons)
        // Pixi Text requires font loading or default
        const style = new PIXI.TextStyle({
            fontFamily: 'Arial',
            fontSize: 14,
            fill: 'white',
        });

        this.o2Label = new PIXI.Text('O2', style);
        this.o2Label.x = 20; this.o2Label.y = 20;
        this.container.addChild(this.o2Label);

        this.enLabel = new PIXI.Text('NRG', style);
        this.enLabel.x = 20; this.enLabel.y = 50;
        this.container.addChild(this.enLabel);

        this.hpLabel = new PIXI.Text('HP', style);
        this.hpLabel.x = this.game.app.screen.width - 150;
        this.hpLabel.y = 20;
        this.container.addChild(this.hpLabel);
    }

    update(dt) {
        const player = this.game.player;
        if (!player) return;

        // Draw Oxygen
        this.drawBar(this.oxygenBar, 50, 20, player.oxygen / player.maxOxygen, 0x22d3ee);

        // Draw Energy
        this.drawBar(this.energyBar, 50, 50, player.energy / player.maxEnergy, 0xfacc15);

        // Draw Health
        this.drawBar(this.healthBar, this.game.app.screen.width - 120, 20, player.health / player.maxHealth, 0xf87171);
    }

    drawBar(gfx, x, y, pct, color) {
        gfx.clear();

        // Background
        gfx.beginFill(0x000000, 0.5);
        gfx.drawRoundedRect(x, y, 100, 15, 8);
        gfx.endFill();

        // Foreground
        if (pct > 0) {
            gfx.beginFill(color);
            gfx.drawRoundedRect(x, y, 100 * pct, 15, 8);
            gfx.endFill();
        }
    }
}
