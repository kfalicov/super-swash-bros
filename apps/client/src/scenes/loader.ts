import { Scene } from 'phaser';

class Loader extends Scene {
  constructor() {
    super('Loader');
  }
  preload() {
    this.load.atlas(
      'player',
      '/assets/entity/player.png',
      '/assets/entity/player.json'
    );
    this.load.image('box', '/assets/box.png');
    this.load.image('shadow', '/assets/shadow.png');

    this.load.spritesheet('scroll', '/assets/scroll.png', {
      frameWidth: 96,
      frameHeight: 32,
    });

    this.load.image('parchment', '/assets/modal.png');
    this.load.spritesheet('menu_ship', '/assets/menu ship.png', {
      frameWidth: 48,
      frameHeight: 48,
    });
    this.load.spritesheet('menu_wheel', '/assets/menu wheel.png', {
      frameWidth: 48,
      frameHeight: 48,
    });
    this.load.spritesheet('menu_items', '/assets/menu items.png', {
      frameWidth: 48,
      frameHeight: 32,
    });

    this.load.image('wake', '/assets/trail.png');
    this.load.spritesheet('tiny_ship', '/assets/tiny_boat.png', {
      frameWidth: 4,
      frameHeight: 12,
    });
  }
  create() {
    const runAnim = this.anims.create({
      key: 'player_run',
      frames: this.anims.generateFrameNames('player', {
        prefix: 'player_',
        start: 0,
        end: 1,
      }),
      frameRate: 12,
      repeat: -1,
    });
    this.anims.create({
      key: 'player_run_holding',
      frames: this.anims.generateFrameNames('player', {
        prefix: 'player_',
        start: 4,
        end: 5,
      }),
      frameRate: 12,
      repeat: -1,
    });
    const punchFrames = this.anims.generateFrameNames('player', {
      prefix: 'player_',
      start: 6,
      end: 8,
    });
    punchFrames[2].duration = 82;
    this.anims.create({
      key: 'player_punch',
      frames: punchFrames,
      frameRate: 24,
    });
    this.anims.create({
      key: 'player_pickup',
      frames: this.anims.generateFrameNames('player', {
        prefix: 'player_',
        start: 2,
        end: 4,
      }),
      frameRate: 24,
    });

    /**
     * menu animations
     */
    this.anims.create({ key: 'unfurl', frames: 'scroll' });
    this.anims.create({
      key: 'menu_ship_sail',
      frames: 'menu_ship',
      frameRate: 12,
    });
    this.anims.create({
      key: 'menu_wheel_spin',
      frames: 'menu_wheel',
      frameRate: 12,
    });

    this.scene.manager.scenes[1].scene.start();
    // this.scene.run("Sailing");
  }
}

export { Loader };
