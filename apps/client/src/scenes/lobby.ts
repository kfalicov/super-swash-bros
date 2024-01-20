import { Scene } from 'phaser';
import { Client } from 'colyseus.js';

const client = new Client('ws://localhost:2567');

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

class Lobby extends Scene {
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
      .text(100, 40, 'host', { color: '#000000' })
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
      join.setVisible(false).disableInteractive();
      go.setVisible(false).disableInteractive();
      client.joinById<any>(input.value.toUpperCase()).then((room) => {
        console.log(room.sessionId, 'joined', room.id);
        room.onMessage('p', (type) => {
          console.log(type);
        });
        room.state.players.onAdd((player, key) => {
          console.log(`${key} is player ${player.p + 1}`);
        });
        host.setText(room.id);
      });
    });

    host.once('pointerdown', () => {
      join.setVisible(false).disableInteractive();
      client
        .joinOrCreate<any>('lobby', { private: true })
        .then((room) => {
          console.log(room.sessionId, 'joined', room.id);
          room.onMessage('p', (type) => {
            console.log(type);
          });
          room.state.players.onAdd((player, key) => {
            console.log(`${key} is player ${player.p + 1}`);
          });
          host.setText(room.id);
        })
        .catch((e) => {
          console.log('JOIN ERROR', e);
        });
    });
    // this.scene.manager.switch(this.scene.key, "World");
  }
  update() {}
}

export { Lobby };
