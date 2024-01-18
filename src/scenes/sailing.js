import { Scene } from "phaser";

class Sailing extends Scene {
  constructor() {
    super("Sailing");
  }
  preload() {}
  create() {
    this.cameras.main.setBackgroundColor("#C28E5B");
    // this.cameras.main.setBounds(0, 0, 64, 64);
    this.cameras.main.setPosition(0, 0);
    this.cameras.main.setSize(64, 64);

    let hull = this.physics.add
      .image(32, 32, "tiny_ship", 0)
      .setOrigin(3.5 / 6, 0.5);
    hull.body.setOffset(-2.5, -2.5).setSize(5, 5);
    let deck = this.add.image(32, 32, "tiny_ship", 1).setOrigin(3.5 / 6, 0.5);

    hull.body.maxAngular = 60;
    hull.body.angularDrag = 50;
    hull.body.maxSpeed = 30;

    hull.body.setDamping(true);
    hull.body.setDrag(0.6, 0.6);
    hull.body.postUpdate = function () {
      //@ts-expect-error
      this.__proto__.postUpdate.bind(this)();
      deck.setPosition(this.center.x + 1, this.center.y - 0.5);
      deck.setAngle(this.rotation);
    };

    this.cameras.main.startFollow(hull, false, 0.9, 0.9);

    this.keys = this.input.keyboard.addKeys({
      up: "W",
      left: "A",
      down: "S",
      right: "D",
      punch: "SPACE",
      pickup: "E",
      drop: "Q",
    });
    this.ship = hull;
  }
  update() {
    const { left, right, up, down, punch, pickup, drop } = this.keys;
    let angularAcc = 0;
    let acc = 0;

    if (left.isDown || right.isDown) {
      angularAcc = ((left.isDown ? -1 : 0) + (right.isDown ? 1 : 0)) * 100;
    }
    if (up.isDown) {
      acc = 10;
    }

    this.ship.body.setVelocity(
      Math.cos(this.ship.rotation - 1.57) * this.ship.body.speed,
      Math.sin(this.ship.rotation - 1.57) * this.ship.body.speed
    );
    this.ship.body.setAcceleration(
      Math.cos(this.ship.rotation - 1.57) * acc,
      Math.sin(this.ship.rotation - 1.57) * acc
    );
    this.ship.body.setAngularAcceleration(angularAcc);
  }
}

export default Sailing;
