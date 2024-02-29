import { GameObjects } from 'phaser';

class Pirate extends GameObjects.GameObject {
  body: Phaser.Physics.Arcade.Body;
  sprite: Phaser.GameObjects.Sprite;
  squash: Phaser.Tweens.Tween;
  stack: Phaser.GameObjects.Group;
  interruptable = true;
  /**
   * disables movement and inputs from affecting the physics body.
   */
  paused = false;
  /**
   * whether this player can interact with the environment
   */
  canInteract = true;
  /**whether the player can punch. false when punch animation is occurring*/
  canPunch = true;
  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, 'pirate');
    const shadow = scene.physics.add.image(x, y, 'shadow');
    const sprite = scene.add.sprite(x, y, 'player').setOrigin(0.5, 1);
    this.sprite = sprite;
    this.body = shadow.body;

    this.stack = scene.add.group();
    const stack = this.stack;

    const getInterruptable = () => this.interruptable;

    this.body.setDamping(true);
    this.body.setDrag(0.005, 0.005);
    this.body.setSize(8, 6);
    this.body.setMaxVelocity(70);
    this.body.postUpdate = function () {
      this.__proto__.postUpdate.bind(this)();
      sprite.setPosition(this.center.x, this.bottom);
      let accHeight = 0;
      stack.getChildren().forEach((child) => {
        //@ts-expect-error we know the child will be positionable
        child.setPosition(this.center.x, this.center.y - 16 - accHeight);
        //@ts-expect-error we know the child has a displayHeight
        accHeight += child.displayHeight;
      });

      const { x: xacc, y: yacc } = this.acceleration;
      if (getInterruptable()) {
        if (xacc !== 0 || yacc !== 0) {
          if (xacc !== 0) {
            sprite.flipX = xacc < 0;
          }
          sprite.play(
            {
              key:
                stack.getLength() === 0 ? 'player_run' : 'player_run_holding',
              timeScale: 1,
            },
            true
          );
        } else {
          sprite.stop();
          sprite.setFrame(stack.getLength() === 0 ? 0 : 'player_4');
        }
      }
    };

    this.squash = scene.tweens.add({
      targets: sprite,
      persist: true,
      props: {
        scaleX: {
          getActive: () => 1.25,
          getEnd: () => 1,
          duration: 60,
          ease: 'Back.easeOut',
        },
        scaleY: {
          getActive: () => 0.875,
          getEnd: () => 1,
          duration: 83,
          ease: 'Back.easeOut',
        },
      },
    });

    sprite.on('animationcomplete-player_punch', () => {
      this.interruptable = true;
      this.sprite.setFrame(stack.getLength() === 0 ? 0 : 'player_4');
    });
    sprite.on('animationcomplete-player_pickup', () => {
      this.interruptable = true;
      this.sprite.setFrame(stack.getLength() === 0 ? 0 : 'player_4');
    });
    sprite.on(
      'animationupdate',
      (
        animation: Phaser.Animations.Animation,
        frame: Phaser.Animations.AnimationFrame
      ) => {
        // console.log("anim update", animation.key, frame);
        if (
          (animation.key === 'player_run' ||
            animation.key === 'player_run_holding') &&
          frame.index === 1
        ) {
          this.squash.restart();
        }
      }
    );
  }
  pickup() {
    const hbox = this.scene.add.zone(
      this.body.center.x + (this.sprite.flipX ? -8 : 8),
      this.body.top,
      16,
      16
    );
    //@ts-expect-error owner is a custom property we are adding to the hbox
    hbox.owner = this;
    this.scene.time.delayedCall(66, () => hbox.destroy());
    return hbox;
  }
  drop() {
    const len = this.stack.getLength();
    if (len === 0) return;
    this.interruptable = false;
    this.sprite.playReverse('player_pickup', true);
    this.squash.restart();
    const dropped = this.stack.children
      .entries[0] as Phaser.Physics.Arcade.Image;
    this.stack.remove(dropped);
    if (dropped.body) dropped.body.velocity.x = this.sprite.flipX ? -80 : 80;
    this.scene.tweens.add({
      targets: dropped,
      props: {
        y: {
          getEnd: () => {
            return this.body.center.y;
          },
          duration: 400,
          ease: 'Bounce.easeOut',
        },
      },
      onComplete: () => {
        if (dropped.body) dropped.body.checkCollision.none = false;
      },
    });
    return dropped;
  }

  setPaused(paused = true) {
    this.paused = paused;
    this.body.setEnable(!paused);
  }
}

export default Pirate;
