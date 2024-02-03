import { Scene } from 'phaser';
import { Room } from 'colyseus.js';
import { GameSocket } from '../objects/socket';
import { LobbyRoomState } from '../../../matchmaking-master/src/rooms/schema/MyRoomState';
import { api } from '@super-swash-bros/api';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

class Lobby extends Scene {
  players: Record<string, { p: number; sessionId: string; c: number }> = {};
  room: Room<LobbyRoomState>;
  hostText: Phaser.GameObjects.Text;
  slots: Phaser.GameObjects.Text[];
  socket?: GameSocket;
  constructor() {
    super('Lobby');
  }
  preload() {}

  /**
   * wires up the room by setting up the listeners for room events
   */
  linkRoom(room: Room<LobbyRoomState>) {
    this.room = room;
    this.players = Array.from(room.state.players.values()).reduce((acc, p) => {
      acc[p.p] = p;
      return acc;
    }, {});
    room.state.players.onAdd((player, p) => {
      this.players[p] = player;
      player.listen('c', (value) => {
        this.players[p].c = value;
      });
    }, false);
    room.state.players.onRemove((player, p) => {
      delete this.players[p];
    });
  }

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
        new GameSocket()
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
        new GameSocket()
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
    if (this.room) {
      this.hostText.setText(this.room.id);
    }
    this.slots.forEach((slot, index) =>
      slot.setText(`${this.players[index]?.c ?? 'NONE'}`)
    );
  }
}

export { Lobby };
