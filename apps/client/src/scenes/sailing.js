import { Scene } from 'phaser';

const BASE_SPREAD = 2; //base radius of the wake trail
const LIFE_SPREAD = 10; //px radius that the wake spreads over its lifetime
const computeWake = (coords, speeds) => {
  let port = [];
  let starboard = [];
  let alphas = [];
  for (let i = 10; i < coords.length; i += 5) {
    let angle = Phaser.Math.Angle.BetweenPointsY(coords[i - 1], coords[i]);
    const { x, y } = coords[i - 1];
    let xComponent = Math.cos(angle);
    let yComponent = Math.sin(angle);
    let spread =
      Phaser.Math.Easing.Cubic.Out((i - 10) / coords.length) * LIFE_SPREAD +
      BASE_SPREAD;
    port.push({ x: x - xComponent * spread, y: y + yComponent * spread });
    starboard.push({ x: x + xComponent * spread, y: y - yComponent * spread });
    alphas.push(
      Phaser.Math.Easing.Circular.Out(
        Math.max(speeds[i] - 0.25, 0) *
          (1 - spread / (BASE_SPREAD + LIFE_SPREAD))
      )
    );
  }
  /**snap to alphas of 25% increments */
  alphas = alphas.map((a) => Math.round(a * 4) / 4);
  return { port, starboard, alphas };
};

class Sailing extends Scene {
  constructor() {
    super('Sailing');
  }
  preload() {}
  create() {
    this.cameras.main.setBackgroundColor('#C28E5B');
    // this.cameras.main.setBounds(0, 0, 64, 64);
    this.cameras.main.setViewport(0, 0, 64, 64);

    const grid = this.textures.addDynamicTexture('grid', 128, 128);
    const horizontalMarker = this.add
      .tileSprite(2, -1, 125, 2, 'wake')
      .setOrigin(0);
    const verticalMarker = this.add
      .tileSprite(2, 2, 125, 2, 'wake')
      .setOrigin(0)
      .setAngle(90);
    grid?.draw?.([horizontalMarker, verticalMarker]);

    this.gridCells = [];
    for (let i = -1; i < 2; i++) {
      for (let j = -1; j < 2; j++) {
        this.gridCells.push(
          this.add.image(128 * i, 128 * j, 'grid').setOrigin(0)
        );
      }
    }

    this.center = this.add
      .zone(
        this.gridCells[4].x - 32,
        this.gridCells[4].y - 32,
        this.gridCells[4].width + 64,
        this.gridCells[4].height + 64
      )
      .setOrigin(0);

    this.physics.add.existing(this.center, false);
    // this.physics.world.enable(this.center);
    this.center.body.moves = false;
    this.center.body.debugBodyColor = 0xffffff;

    // horizontalMarker.destroy();
    // verticalMarker.destroy();

    let coords = new Array(200).fill({ x: 32, y: 32 });
    /**
     * must have same length as coords
     */
    let speeds = new Array(200).fill(0);

    let wakePort = this.add.rope(0, 0, 'wake', undefined, coords);
    let wakeStarboard = this.add.rope(0, 0, 'wake', undefined, coords);

    let hull = this.physics.add
      .image(32, 32, 'tiny_ship', 0)
      .setOrigin(0.5, 0.5);
    hull.body.setOffset(-3, -3).setSize(6, 6);
    let deck = this.add.image(32, 32, 'tiny_ship', 1).setOrigin(0.5, 0.5);

    hull.body.maxAngular = 60;
    hull.body.angularDrag = 50;
    hull.body.maxSpeed = 30;

    hull.body.setDamping(true);
    hull.body.setDrag(0.6);
    hull.body.postUpdate = function () {
      //@ts-expect-error
      this.__proto__.postUpdate.bind(this)();
      deck.setPosition(this.center.x, this.center.y - 2);
      deck.setAngle(this.rotation);
      speeds.unshift(this.speed / this.maxSpeed);
      speeds.pop();
      coords.unshift({ ...this.center });
      coords.pop();
      const { port, starboard, alphas } = computeWake(coords, speeds);
      wakePort.setPoints(port);
      wakeStarboard.setPoints(starboard);
      wakePort.setAlphas(alphas);
      wakeStarboard.setAlphas(alphas);
    };

    this.cameras.main.startFollow(hull, false, 0.9, 0.9);

    this.keys = this.input.keyboard.addKeys({
      up: 'W',
      left: 'A',
      down: 'S',
      right: 'D',
      punch: 'SPACE',
      pickup: 'E',
      drop: 'Q',
    });
    this.ship = hull;

    this.physics.add.overlap(
      this.ship,
      this.center,
      (a, b) => {
        let furtherThanX = Math.abs(a.body.center.x - b.body.center.x) > 64;
        let furtherThanY = Math.abs(a.body.center.y - b.body.center.y) > 64;
        let newX = Math.sign(a.body.center.x - b.body.center.x) * 128;
        let newY = Math.sign(a.body.center.y - b.body.center.y) * 128;
        this.gridCells.forEach((cell) => {
          if (furtherThanX) {
            cell.x += newX;
          }
          if (furtherThanY) {
            cell.y += newY;
          }
          this.center
            .setPosition(this.gridCells[4].x - 32, this.gridCells[4].y - 32)
            .setSize(
              this.gridCells[4].width + 64,
              this.gridCells[4].height + 64
            );
        });
      },
      function process(ship, center) {
        const inner = new Phaser.Geom.Rectangle(
          center.x + 32,
          center.y + 32,
          center.width - 64,
          center.height - 64
        );
        return !inner.contains(ship.body.center.x, ship.body.center.y);
      }
    );
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
