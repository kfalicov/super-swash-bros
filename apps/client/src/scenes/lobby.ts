import { Scene } from 'phaser';
import { Room } from 'colyseus.js';
import { LinkCable } from '../objects/socket';
import { api } from '@super-swash-bros/api';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

class Lobby extends Scene {
  players: Record<string, { p: number; sessionId: string; c: number }> = {};
  hostText: Phaser.GameObjects.Text;
  slots: Phaser.GameObjects.Text[];
  socket?: LinkCable;
  constructor() {
    super('Lobby');
  }
  preload() {}

  create() {
    this.cameras.main.setBackgroundColor('#ffffff');

    const text = this.add.text(100, 60, '', { color: 'blue' });
    const go = this.add
      .image(100, 100, 'go')
      .disableInteractive()
      .setVisible(false);

    const input = document.createElement('input');
    input.type = 'text';
    input.maxLength = 4;
    // input.style.opacity = '0';
    input.addEventListener('input', (evt: InputEvent) => {
      const value = (evt.currentTarget as HTMLInputElement).value;
      text.setText(value.toUpperCase());
      value.length === 4 ? go.setInteractive() : go.disableInteractive();
    });
    document.body.appendChild(input);

    const host = this.add
      .text(100, 40, 'HOST', {
        color: '#000000',
      })
      .setOrigin(0.5)
      .setInteractive();
    const join = this.add
      .text(140, 40, 'join', { color: '#000000' })
      .setOrigin(0.5)
      .setInteractive();
    join.on('pointerdown', () => {
      input.focus();
      go.setVisible(true);
    });

    go.on('pointerdown', () => {
      if (!this.socket) {
        new LinkCable()
          .on('room', (msg) => {
            host.setText(msg.code);
          })
          .connect(`ws://127.0.0.1:12345/${input.value}`)
          .then((socket) => {
            this.socket = socket;
          });
      } else {
        this.socket.ping();
      }
      join.setVisible(false).disableInteractive();
      go.setVisible(false).disableInteractive();
      // api.rooms.join({ params: { id: input.value.toUpperCase() } });
    });

    host.once('pointerdown', () => {
      if (!this.socket) {
        new LinkCable()
          .on('room', (msg) => {
            host.setText(msg.code);
          })
          .connect(`ws://127.0.0.1:12345`)
          .then((socket) => {
            this.socket = socket;
            socket.emit({ cmd: 'create' });
          });
      } else {
        this.socket.ping();
      }
      join.setVisible(false).disableInteractive();
      // api.rooms.create();
      // client
      //   .create<unknown>('lobby', { private: true })
      //   .then(this.linkRoom.bind(this))
      //   .catch((e) => {
      //     console.log('JOIN ERROR', e);
      //   });
    });
    this.hostText = host;

    /**
     * TODO have the active player select a character
     */
    this.input.on('pointerdown', () => {
      api.rooms.announce({ body: { message: 'hello' } });
      const player = Object.values(this.players).find(
        (player) => player.sessionId === this.room.sessionId
      );
      console.log('clicked', player);
      this.room?.send('charselect', {
        p: player.p,
        c: Math.floor(Math.random() * 10),
      });
    });

    this.slots = [0, 1, 2, 3].map((p) =>
      this.add
        .text(40 + 40 * p, 140, `${p}`, {
          color: 'red',
          fontFamily: 'font1',
        })
        .setResolution(16)
    );

    const play = this.add
      .image(220, 150, 'play')
      .setSize(20, 10)
      .setInteractive();
    play.on('pointerdown', () => {
      this.scene.manager.switch(this.scene.key, 'World');
    });
  }
  update() {
    this.slots.forEach((slot, index) =>
      slot.setText(`${this.players[index]?.c ?? 'NONE'}`)
    );
  }
}

export { Lobby };
