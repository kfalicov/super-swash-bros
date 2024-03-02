import { Scene } from 'phaser';
import Pirate from '../objects/player';
import { isDefined } from '../lib/is';
import { Player } from '@super-swash-bros/api';

class World extends Scene {
  rtc?: RTCPeerConnection;
  cable?: RTCDataChannel;
  pirates: Pirate[] = [];
  sessionId?: string;
  ctrlIndex: number = 0;
  interactionHitboxes: Phaser.Physics.Arcade.StaticGroup;
  pickuppables: Phaser.Physics.Arcade.Group;
  //TODO type keys
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  keys: Record<string, any>;

  constructor() {
    super('World');
  }

  initPlayers(sessionId: string, players: (Player | null)[]) {
    for (const config of players) {
      if (isDefined(config)) {
        const pirate = new Pirate(this, 100, 100);
        this.pirates.push(pirate);
      }
    }
    this.ctrlIndex = players.findIndex((p) => p?.id === sessionId);
    this.cable.onmessage = (event) => {
      this.decode(event.data);
    };
  }
  create() {
    this.cameras.main.setBackgroundColor('#08bb08');

    this.keys = this.input.keyboard.addKeys({
      up: 'W',
      left: 'A',
      down: 'S',
      right: 'D',
      punch: 'SPACE',
      pickup: 'E',
      drop: 'Q',
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
      (pickupA, pickupB) => {
        const a = (
          pickupA as Phaser.Types.Physics.Arcade.GameObjectWithDynamicBody
        ).body;
        const b = (
          pickupB as Phaser.Types.Physics.Arcade.GameObjectWithDynamicBody
        ).body;
        const maxX = a.halfWidth + b.halfWidth;
        const maxY = a.halfHeight + b.halfHeight;
        const distX = Math.abs(Math.round(a.center.x - b.center.x)) || 1;
        const distY = Math.abs(Math.round(a.center.y - b.center.y)) || 1;
        const x =
          Math.min(50, (16 * maxX) / distX) *
          Math.sign(a.center.x - b.center.x || 1);
        const y =
          Math.min(50, (16 * maxY) / distY) *
          Math.sign(a.center.y - b.center.y || 1);
        a.velocity.x = x;
        a.velocity.y = y;
        b.velocity.x = -x;
        b.velocity.y = -y;
      }
    );

    for (let i = 0; i < 4; i++) {
      const box = this.add.image(20 + 20 * i, 20 + 20 * i, 'box');
      this.pickuppables.add(box);
    }

    this.physics.add.overlap(
      this.interactionHitboxes,
      this.pickuppables,
      (a, b) => {
        //@ts-expect-error a.owner is assigned when the hitbox is created
        const player = a.owner;

        //should let the animation play in its entirety
        player.interruptable = false;
        player.sprite.play('player_pickup');
        player.squash.restart();

        (
          b as Phaser.Types.Physics.Arcade.GameObjectWithBody
        ).body.checkCollision.none = true;
        (
          b as Phaser.Types.Physics.Arcade.GameObjectWithDynamicBody
        ).body.setGravity(0);
        player.stack.add(b);
      }
    );

    const wheel = this.physics.add.image(200, 80, 'menu_wheel');
    this.physics.add.overlap(
      this.interactionHitboxes,
      wheel,
      () => {
        console.log('wheel interacted');
        this.pirates[this.ctrlIndex].setPaused(true);
        this.scene.run('Sailing');
      },
      () => !this.scene.isActive('Sailing')
    );

    /** handle multiplayer comms */
    const syncKeyboardState = () => {
      if (isDefined(this.cable) && this.cable.readyState === 'open') {
        if (isDefined(this.keys)) {
          const {
            left: { isDown: left },
            right: { isDown: right },
            up: { isDown: up },
            down: { isDown: down },
          } = this.keys;
          const buffer = new Uint8Array(2);
          buffer[0] = this.ctrlIndex;
          //bitwise construct the state of the keys
          buffer[1] =
            (left ? 1 : 0) |
            ((right ? 1 : 0) << 1) |
            ((up ? 1 : 0) << 2) |
            ((down ? 1 : 0) << 3);
          this.cable.send(buffer.buffer);
        }
      }
    };

    //emit events to the datachannel when keys are pressed
    this.input.keyboard.on('keydown', syncKeyboardState);
    this.input.keyboard.on('keyup', syncKeyboardState);
  }

  decode(buf: ArrayBuffer) {
    const buffer = new Uint8Array(buf);
    const left = (buffer[1] & 1) > 0;
    const right = (buffer[1] & 2) > 0;
    const up = (buffer[1] & 4) > 0;
    const down = (buffer[1] & 8) > 0;
    let xacc = 0;
    let yacc = 0;
    if (left || right) {
      xacc = ((left ? -1 : 0) + (right ? 1 : 0)) * 300;
    }
    if (up || down) {
      yacc = ((up ? -1 : 0) + (down ? 1 : 0)) * 300;
    }
    this.pirates[buffer[0]].body.setAcceleration(xacc, yacc);
  }

  update() {
    const pirate = this.pirates[this.ctrlIndex];
    const { left, right, up, down, punch, pickup, drop } = this.keys;
    let xacc = 0;
    let yacc = 0;
    if (left.isDown || right.isDown) {
      xacc = ((left.isDown ? -1 : 0) + (right.isDown ? 1 : 0)) * 300;
    }
    if (up.isDown || down.isDown) {
      yacc = ((up.isDown ? -1 : 0) + (down.isDown ? 1 : 0)) * 300;
    }

    if (!pirate.paused) {
      if (punch.isDown) {
        if (pirate.canPunch && pirate.stack.getLength() === 0) {
          xacc = yacc = 0;
          pirate.canPunch = false;
          //should let the animation play in its entirety
          pirate.interruptable = false;
          pirate.sprite.play('player_punch', true);
        }
      } else pirate.canPunch = true;

      if (pickup.isDown) {
        this.interactionHitboxes.add(pirate.pickup());
      } else if (drop.isDown) {
        if (pirate.canInteract && pirate.stack.getLength() > 0) {
          pirate.canInteract = false;
          pirate.drop();
        }
      } else pirate.canInteract = true;

      pirate.body.setAcceleration(xacc, yacc);
    }
  }
}

export default World;
