import { Scene, Math as PhaserMath } from "phaser";

const SCROLL_ORIGINAL_VISIBLE_HEIGHT = 9;
class Menu extends Scene {
  constructor() {
    super("Menu");
  }
  preload() {}
  create() {
    this.cameras.main.setBackgroundColor("#08bb08");
    const modal = this.add
      .image(128, 54, "parchment")
      .setCrop(0, 0, 96, SCROLL_ORIGINAL_VISIBLE_HEIGHT)
      .setOrigin(0);

    var parchmentMask = modal.createBitmapMask();

    const ship = this.add
      .sprite(modal.x + 29, modal.y + 23, "menu_ship", 15)
      .setMask(parchmentMask);

    // the anchor point of the curled scroll texture (where it will meet the parchment) is 12px from the top
    const scrollEnd = this.add
      .sprite(modal.x, modal.y + SCROLL_ORIGINAL_VISIBLE_HEIGHT, "scroll", 0)
      .setOrigin(0, 12 / 32);
    const wheel = this.add
      .sprite(modal.x + 60, modal.y + 52, "menu_wheel", 0)
      .setMask(parchmentMask);

    const playButton = this.add
      .image(
        modal.x + 26,
        modal.y + SCROLL_ORIGINAL_VISIBLE_HEIGHT + 4,
        "menu_items",
        0
      )
      .setOrigin(0)
      .setMask(parchmentMask);
    const optionsButton = this.add
      .image(
        playButton.x - 1,
        playButton.y + playButton.height - 2,
        "menu_items",
        1
      )
      .setOrigin(0)
      .setMask(parchmentMask);

    const reveal = this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 300,
      persist: true,
      onStart: () => {
        //animation frame count divided by duration in seconds = frame rate
        const frameRate = 8 / (300 / 1000);
        scrollEnd.play({ key: "unfurl", frameRate });
      },
      onUpdate: (tween) => {
        const height = Math.ceil(
          tween.progress * (modal.height - SCROLL_ORIGINAL_VISIBLE_HEIGHT) +
            SCROLL_ORIGINAL_VISIBLE_HEIGHT
        );
        modal.setCrop(0, 0, modal.width, height + 1);
        /**
         * magic number: stop 21 px from the bottom of the modal so that the animation lines up well.
         * computed as 20 (height of scroll end minus scroll end origin at 12px) + 1 since pixel coords are 1-based and needs to avoid a gap
         */
        scrollEnd.y = modal.y + Math.min(height, modal.height - 21);
      },
    });

    const buttonArea = new Phaser.Geom.Rectangle(-15, -6, 68, 24);

    playButton.setInteractive({
      hitArea: buttonArea,
      hitAreaCallback: Phaser.Geom.Rectangle.Contains,
      cursor: "pointer",
    });
    playButton.on("pointerover", () => {
      ship.play({ key: "menu_ship_sail", startFrame: 16, repeat: -1 });
    });
    playButton.on("pointerout", () => {
      ship.stop();
      ship.setFrame(15);
    });

    optionsButton.setInteractive({
      hitArea: buttonArea,
      hitAreaCallback: Phaser.Geom.Rectangle.Contains,
      cursor: "pointer",
    });
    optionsButton.on("pointerover", () => {
      wheel.play({ key: "menu_wheel_spin", repeat: -1 });
    });
    optionsButton.on("pointerout", () => {
      wheel.stop();
      wheel.setFrame(0);
    });

    playButton.on("pointerdown", () => {
      this.scene.manager.switch(this.scene.key, "World");
      this.input.manager.canvas.style.cursor = null;
    });

    if (this.sys.game.config.debug) {
      this.input.enableDebug(playButton);
      this.input.enableDebug(optionsButton);
    }
  }
  update() {}
}

export default Menu;
