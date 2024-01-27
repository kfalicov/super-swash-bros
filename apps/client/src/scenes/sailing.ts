import { Scene, Math as PhaserMath, Geom, GameObjects, Physics } from 'phaser';

type WakeCoord = Phaser.Types.Math.Vector2Like & {
  vx: number;
  vy: number;
  speedFrac: number;
  rad: number;
};
const computeWake = (coords: WakeCoord[]) => {
  const port: Phaser.Types.Math.Vector2Like[] = [];
  const starboard: Phaser.Types.Math.Vector2Like[] = [];
  let alphas: number[] = [];
  for (let i = 0; i < coords.length; i++) {
    const { x, y, vx, vy, rad, speedFrac } = coords[i];
    const v = { x: vx, y: vy };
    const { x: portVx, y: portVy } = PhaserMath.Rotate({ ...v }, -1.57);
    const { x: starVx, y: starVy } = PhaserMath.Rotate({ ...v }, 1.57);
    /**
     * controls offset of where the wake starts
     */
    const { x: portOffX, y: portOffY } = PhaserMath.Rotate(
      { x: 4, y: 0 },
      -0.3 + rad
    );
    const { x: starOffX, y: starOffY } = PhaserMath.Rotate(
      { x: 4, y: 0 },
      0.3 + rad
    );
    const spread =
      speedFrac * PhaserMath.Easing.Circular.Out(i / coords.length) * 0.33;

    port.push({
      x: x + portOffX + portVx * spread,
      y: y + portOffY + portVy * spread,
    });
    starboard.push({
      x: x + starOffX + starVx * spread,
      y: y + starOffY + starVy * spread,
    });
    alphas.push(
      speedFrac * (1 - PhaserMath.Easing.Sine.Out(i / coords.length))
    );
  }
  /**snap to alphas of 25% increments */
  alphas = alphas.map((a) => Math.round(a * 4) / 4);
  return { port, starboard, alphas };
};

class Sailing extends Scene {
  center: Phaser.GameObjects.Zone;
  ship: Physics.Arcade.Image;
  keys: Record<string, Phaser.Input.Keyboard.Key>;
  gridCells: GameObjects.Image[];
  constructor() {
    super('Sailing');
  }
  preload() {}
  create() {
    // this.cameras.main.setBackgroundColor('#C28E5B');
    this.cameras.main.setViewport(0, 0, 64, 64);
    this.add.image(32, 32, 'map').setScrollFactor(0);
    const mask = this.add.bitmapMask(null, 32, 32, 'map_mask');
    (mask.bitmapMask as GameObjects.Image).setScrollFactor(0);

    const grid = this.textures.addDynamicTexture('grid', 128, 128);
    const horizontalMarker = this.add
      .tileSprite(2, -1, 125, 2, 'wake')
      .setOrigin(0);
    const verticalMarker = this.add
      .tileSprite(2, 2, 125, 2, 'wake')
      .setOrigin(0)
      .setAngle(90);
    grid?.draw?.([horizontalMarker, verticalMarker]);
    horizontalMarker.setVisible(false);
    verticalMarker.setVisible(false);

    this.gridCells = [];
    /** make 4 grid cells- the one you are in, and 3 which position themselves where you are going */
    for (let i = -1; i < 1; i++) {
      for (let j = -1; j < 1; j++) {
        this.gridCells.push(
          this.add
            .image(128 * i, 128 * j, 'grid')
            .setOrigin(0)
            .setMask(mask)
        );
      }
    }

    this.center = this.add
      .zone(
        this.gridCells[3].x - 32,
        this.gridCells[3].y - 32,
        this.gridCells[3].width + 64,
        this.gridCells[3].height + 64
      )
      .setOrigin(0);

    this.add
      .text(this.gridCells[3].x, this.gridCells[3].y, '0.0', {
        fontFamily: 'font1',
      })
      .setResolution(16);

    this.physics.add.existing(this.center, false);
    // this.physics.world.enable(this.center);
    (this.center.body as Physics.Arcade.Body).moves = false;
    (this.center.body as Physics.Arcade.Body).debugBodyColor = 0xffffff;

    // horizontalMarker.destroy();
    // verticalMarker.destroy();

    const coords: WakeCoord[] = new Array<WakeCoord>(200).fill({
      x: 32,
      y: 32,
      vx: 0,
      vy: 0,
      speedFrac: 0,
      rad: 0,
    });

    const wakePort = this.add.rope(0, 0, 'wake', undefined, coords);
    const wakeStarboard = this.add.rope(0, 0, 'wake', undefined, coords);
    wakePort.setMask(mask);
    wakeStarboard.setMask(mask);

    const hull = this.physics.add
      .image(32, 32, 'tiny_ship', 0)
      .setOrigin(0.5, 0.5);
    hull.body.setOffset(-3, -3).setSize(6, 6);
    const deck = this.add.image(32, 32, 'tiny_ship', 1).setOrigin(0.5, 0.5);

    hull.body.maxAngular = 60;
    hull.body.angularDrag = 50;
    hull.body.maxSpeed = 30;

    hull.body.setDamping(true);
    hull.body.setDrag(0.6);
    hull.body.postUpdate = function () {
      this.__proto__.postUpdate.bind(this)();
      deck.setPosition(this.center.x, this.center.y - 2);
      deck.setAngle(this.rotation);
      coords.unshift({
        ...this.center,
        vx: this.velocity.x,
        vy: this.velocity.y,
        speedFrac: this.speed / this.maxSpeed,
        rad: this.angle,
      });
      coords.pop();
      const { port, starboard, alphas } = computeWake(coords);
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
    }) as Record<string, Phaser.Input.Keyboard.Key>;
    this.ship = hull;

    this.physics.add.overlap(
      this.ship,
      this.center,
      (
        a: Phaser.Types.Physics.Arcade.GameObjectWithBody,
        b: Phaser.Types.Physics.Arcade.GameObjectWithBody
      ) => {
        const furtherThanX = Math.abs(a.body.center.x - b.body.center.x) > 64;
        const furtherThanY = Math.abs(a.body.center.y - b.body.center.y) > 64;
        const newX = Math.sign(a.body.center.x - b.body.center.x) * 128;
        const newY = Math.sign(a.body.center.y - b.body.center.y) * 128;
        this.gridCells.forEach((cell) => {
          if (furtherThanX) {
            cell.x += newX;
          }
          if (furtherThanY) {
            cell.y += newY;
          }
          this.center
            .setPosition(this.gridCells[3].x - 32, this.gridCells[3].y - 32)
            .setSize(
              this.gridCells[3].width + 64,
              this.gridCells[3].height + 64
            );
        });
      },
      function process(
        ship: Phaser.Types.Physics.Arcade.GameObjectWithBody,
        center: Phaser.Types.Physics.Arcade.GameObjectWithBody
      ) {
        const inner = new Geom.Rectangle(
          center.body.x + 32,
          center.body.y + 32,
          center.body.width - 64,
          center.body.height - 64
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

    (this.ship.body as Physics.Arcade.Body).setVelocity(
      Math.cos(this.ship.rotation - 1.57) *
        (this.ship.body as Physics.Arcade.Body).speed,
      Math.sin(this.ship.rotation - 1.57) *
        (this.ship.body as Physics.Arcade.Body).speed
    );
    (this.ship.body as Physics.Arcade.Body).setAcceleration(
      Math.cos(this.ship.rotation - 1.57) * acc,
      Math.sin(this.ship.rotation - 1.57) * acc
    );
    (this.ship.body as Physics.Arcade.Body).setAngularAcceleration(angularAcc);
  }
}

export default Sailing;
