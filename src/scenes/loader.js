import { Scene } from "phaser";

class Loader extends Scene {
  constructor() {
    super("Loader");
  }
  preload() {
    this.load.atlas(
      "player",
      "/assets/entity/player.png",
      "/assets/entity/player.json"
    );
    this.load.image("box", "/assets/box.png");
    this.load.image("shadow", "/assets/shadow.png");
  }
  create() {
    let runAnim = this.anims.create({
      key: "player_run",
      frames: this.anims.generateFrameNames("player", {
        prefix: "player_",
        start: 0,
        end: 1,
      }),
      frameRate: 12,
      repeat: -1,
    });
    console.log(runAnim);
    this.anims.create({
      key: "player_run_holding",
      frames: this.anims.generateFrameNames("player", {
        prefix: "player_",
        start: 4,
        end: 5,
      }),
      frameRate: 12,
      repeat: -1,
    });
    let punchFrames = this.anims.generateFrameNames("player", {
      prefix: "player_",
      start: 6,
      end: 8,
    });
    punchFrames[2].duration = 82;
    this.anims.create({
      key: "player_punch",
      frames: punchFrames,
      frameRate: 24,
    });
    this.anims.create({
      key: "player_pickup",
      frames: this.anims.generateFrameNames("player", {
        prefix: "player_",
        start: 2,
        end: 4,
      }),
      frameRate: 24,
    });
    // console.log(nut_runAnim);
    this.scene.manager.scenes[1].scene.start();
  }
}

export default Loader;
