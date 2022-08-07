import { Scene } from "phaser";
import Pirate from "../objects/player";

class World extends Scene {
  constructor() {
    super("World");
  }
  create() {
    this.cameras.main.setBackgroundColor("#08bb08");

    this.player = new Pirate(this, 100, 100);

    this.keys = this.input.keyboard.addKeys({
      up: "W",
      left: "A",
      down: "S",
      right: "D",
      punch: "SPACE",
      pickup: "E",
      drop: "Q",
    });

    /**
     * the hitboxes that are created when certain actions are performed
     */
    this.interactionHitboxes = this.physics.add.staticGroup();
    this.pickuppables = this.physics.add.group({
      dragX: 200,
      dragY: 200,
      allowDrag: true,
    });
    this.physics.add.collider(
      this.pickuppables,
      this.pickuppables,
      ({ body: a }, { body: b }) => {
        let maxX = a.halfWidth + b.halfWidth;
        let maxY = a.halfHeight + b.halfHeight;
        let x = Math.min(20, (5 * maxX) / (a.center.x - b.center.x));
        let y = Math.min(20, (5 * maxY) / (a.center.y - b.center.y));
        b.velocity.x = -x;
        b.velocity.y = -y;
        a.velocity.x = x;
        a.velocity.y = y;
      }
    );

    for (let i = 0; i < 4; i++) {
      let box = this.add.image(20 + 20 * i, 20 + 20 * i, "box");
      this.pickuppables.add(box);
    }

    this.physics.add.overlap(
      this.interactionHitboxes,
      this.pickuppables,
      (a, b) => {
        const player = a.owner;

        //should let the animation play in its entirety
        player.interruptable = false;
        player.sprite.play("player_pickup");
        player.squash.restart();

        b.body.checkCollision.none = true;
        b.body.setGravity(0);
        player.stack.add(b);
      }
    );
  }
  update() {
    const { left, right, up, down, punch, pickup, drop } = this.keys;
    let xacc = 0;
    let yacc = 0;
    if (left.isDown || right.isDown) {
      xacc = ((left.isDown ? -1 : 0) + (right.isDown ? 1 : 0)) * 300;
    }
    if (up.isDown || down.isDown) {
      yacc = ((up.isDown ? -1 : 0) + (down.isDown ? 1 : 0)) * 300;
    }

    if (punch.isDown) {
      if (this.player.canPunch && this.player.stack.getLength() === 0) {
        xacc = yacc = 0;
        this.player.canPunch = false;
        //should let the animation play in its entirety
        this.player.interruptable = false;
        this.player.sprite.play("player_punch", true);
      }
    } else this.player.canPunch = true;

    if (pickup.isDown) {
      this.interactionHitboxes.add(this.player.pickup());
    } else if (drop.isDown) {
      if (this.player.canInteract && this.player.stack.getLength() > 0) {
        this.player.canInteract = false;
        this.player.drop();
      }
    } else this.player.canInteract = true;

    this.player.body.setAcceleration(xacc, yacc);
  }
}

export default World;
