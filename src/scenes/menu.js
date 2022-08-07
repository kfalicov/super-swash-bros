import { Scene, Math as PhaserMath } from "phaser";

class Menu extends Scene {
  constructor() {
    super("Menu");
  }
  preload() {
    // this.load.spritesheet('nut', 'assets/nut.png',{frameWidth:16, frameHeight:16});
  }
  create() {
    this.cameras.main.setBackgroundColor("#08bb08");
    const nut = this.physics.add.sprite(50, 50, "nut");
    nut.body.setSize(12, 10).setOffset(2, 8);
    nut.play("nut_run");
    nut.on("animationupdate-nut_run", (animation, frame) => {
      // console.log(frame);
      const flip = nut.flipX;
      const { x = 0, y = 0 } = frame.frame.customData;
      nut.setDisplayOrigin(flip ? 8 + x : 8 - x, 13 + y);
    });
    this.standingFrame = nut.anims.currentAnim.frames[1];
    nut.body.setAllowRotation(false);
    nut.body.maxSpeed = 120;
    this.nut = nut;
    this.angle = 1;
    this.velocity = 0;
  }
  update() {
    const target = this.input.activePointer;
    if (PhaserMath.Distance.BetweenPoints(this.nut, target) > 20) {
      this.velocity = Math.min(this.velocity + 2, 120);
      this.nut.play("nut_run", true);
      this.nut.flipX = this.nut.body.velocity.x > 0;
    } else {
      this.velocity = this.velocity * 0.99 - 5;
      if (this.velocity < 10) {
        this.velocity = 0;
        this.nut.body.stop();
        this.nut.anims.stopOnFrame(this.standingFrame);
      }
    }
    if (this.nut.anims.currentAnim.key === "nut_run") {
      // console.log(this.nut.anims);
      this.nut.anims.timeScale = Math.max(this.nut.body.speed / 80, 0.8);
    }

    this.angle = PhaserMath.Angle.RotateTo(
      this.angle,
      PhaserMath.Angle.BetweenPoints(this.nut, target),
      0.05
    );

    this.physics.velocityFromRotation(
      this.angle,
      this.velocity,
      this.nut.body.velocity
    );
  }
}

export default Menu;
