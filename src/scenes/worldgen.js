import { Scene } from "phaser";

class World extends Scene {
  constructor() {
    super("World");
  }
  create() {
    this.cameras.main.setBackgroundColor("#08bb08");

    this.player = this.add.sprite(0, 0, "player").setOrigin(0.5, 1);
    console.log(this.player.displayHeight);
    this.playerCollection = this.add.container(50, 50, [this.player]);
    this.physics.add.existing(this.playerCollection);
    // console.log(this.anims);
    this.playerCollection.body.setDamping(true);
    this.playerCollection.body.setDrag(0.005);
    this.playerCollection.body.setSize(8, 6);
    this.playerCollection.body.setOffset(-4, -6);
    this.playerCollection.body.setMaxVelocity(70);
    this.player.canPunch = true;
    this.player.canInteract = true;

    this.carried = this.add.group();
    let carried = this.carried;

    this.playerCollection.body.update = function (delta) {
      this.__proto__.update.bind(this)(delta);
      let accHeight = 0;
      carried.getChildren().forEach((child) => {
        child.setPosition(this.center.x, this.center.y - 16 - accHeight);
        accHeight += child.displayHeight;
      });
    };

    this.player.on("animationcomplete-player_punch", () => {
      this.player.uninterruptable = false;
    });
    this.player.on("animationcomplete-player_pickup", () => {
      this.player.uninterruptable = false;
    });
    this.player.on("animationupdate", (animation, frame) => {
      // console.log("anim update", animation.key, frame);
      if (
        (animation.key === "player_run" ||
          animation.key === "player_run_holding") &&
        frame.index === 1
      ) {
        console.log("step");
        this.squash.restart();
      }
    });

    this.squash = this.tweens.add({
      targets: this.player,
      props: {
        scaleX: {
          getActive: () => 1.25,
          getEnd: () => 1,
          duration: 60,
          ease: "Back.easeOut",
        },
        scaleY: {
          getActive: () => 0.875,
          getEnd: () => 1,
          duration: 83,
          ease: "Back.easeOut",
        },
      },
    });

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
    this.pickuppables = this.physics.add.group();

    for (let i = 0; i < 4; i++) {
      let box = this.add.image(20 + 20 * i, 20 + 20 * i, "box");
      this.pickuppables.add(box);
    }

    this.physics.add.overlap(
      this.interactionHitboxes,
      this.pickuppables,
      (a, b) => {
        const player = a.owner;
        console.log("overlapping", player);

        //should let the animation play in its entirety
        player.uninterruptable = true;
        player.play("player_pickup", true);
        this.squash.restart();

        b.body.checkCollision.none = true;
        b.body.setGravity(0);
        this.carried.add(b);
      }
    );
  }
  /**
   * queues the 'pickup' action. creates a hitbox and then listens for collisions on that hitbox for 1 frame.
   * A successful collision will play an animation, and then add the hit item to the player's 'held items'.
   *
   */
  pickup() {
    let hbox = this.interactionHitboxes.create(
      this.playerCollection.x + (this.player.flipX ? -8 : 8),
      this.playerCollection.y,
      undefined,
      undefined,
      false
    );
    hbox.owner = this.player;
    this.time.delayedCall(66, () => hbox.destroy());
  }
  drop() {
    const dropped = this.carried.children.entries[0];
    this.carried.remove(dropped);
    dropped.body.setVelocity(this.player.flipX ? -80 : 80, 0);
    dropped.body.setDragX(160);
    dropped.body.checkCollision.none = false;
    dropped.body.bounce.y = 0.5;
    let floor = this.add.zone(
      this.playerCollection.body.center.x,
      this.playerCollection.body.center.y,
      100,
      10
    );

    this.physics.world
      .enableBody(floor, 1)
      .body.setOffset(0, 5 + dropped.body.height / 2);
    dropped.body.setGravityY(600);
    const collider = this.physics.add.collider(dropped, floor, (a, b) => {
      if (a.body.deltaYFinal() === 0) {
        dropped.body.setGravity(0);
        dropped.body.stop();
        collider.destroy();
      }
    });
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
      if (this.player.canPunch && this.carried.getLength() === 0) {
        xacc = yacc = 0;
        this.player.canPunch = false;
        //should let the animation play in its entirety
        this.player.uninterruptable = true;
        this.player.play("player_punch", true);
      }
    } else this.player.canPunch = true;

    if (pickup.isDown) {
      if (this.player.canInteract) {
        this.player.canInteract = false;
        this.pickup();
      }
    } else if (drop.isDown) {
      if (this.player.canInteract && this.carried.getLength() > 0) {
        this.player.canInteract = false;
        this.drop();
        //should let the animation play in its entirety
        this.player.uninterruptable = true;
        this.player.playReverse("player_pickup", true);

        this.squash.restart();
      }
    } else this.player.canInteract = true;

    if (!this.player.uninterruptable) {
      if (xacc !== 0 || yacc !== 0) {
        this.player.play(
          {
            key:
              this.carried.getLength() === 0
                ? "player_run"
                : "player_run_holding",
            timeScale: 1,
          },
          true
        );
      } else {
        this.player.stop();
        this.player.setFrame(this.carried.getLength() === 0 ? 0 : "player_4");
      }
    }

    if (xacc < 0) {
      this.player.setFlipX(true);
    } else if (xacc > 0) {
      this.player.setFlipX(false);
    }
    this.playerCollection.body.setAcceleration(xacc, yacc);
  }
}

export default World;
