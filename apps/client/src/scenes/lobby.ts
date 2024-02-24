import { Scene } from 'phaser';
import { LinkCable } from '../objects/socket';
import { Player, api } from '@super-swash-bros/api';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

const isDefined = <T>(value: T | undefined | null): value is T =>
  value !== undefined && value !== null;

class Lobby extends Scene {
  sessionId?: string;
  players: (Player | null)[] = [];
  hostText: Phaser.GameObjects.Text;
  slots: Phaser.GameObjects.Text[];
  socket?: LinkCable;
  rtc?: RTCPeerConnection;
  cable?: RTCDataChannel;
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
        this.join(input.value);
      } else {
        this.socket.ping();
      }
      join.setVisible(false).disableInteractive();
      go.setVisible(false).disableInteractive();
      // api.rooms.join({ params: { id: input.value.toUpperCase() } });
    });

    host.once('pointerdown', () => {
      if (!this.socket) {
        this.host();
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
      const c = Math.floor(Math.random() * 10);
      const idx = this.players.findIndex((p) => p.id === this.sessionId);
      if (idx > -1) this.players[idx].c = c;
      this.socket?.emit({
        cmd: 'choice',
        c,
      });
    });

    this.slots = [0, 1, 2, 3].map((p) =>
      this.add
        .text(40 + 40 * p, 140, ``, {
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
      if (this.socket && this.players.length > 0) {
        this.handshake();
      }
      // this.scene.manager.switch(this.scene.key, 'World');
    });
    this.playBtn = play;
  }
  host() {
    this.connectCable().then((socket) => socket.emit({ cmd: 'create' }));
  }
  join(room: string) {
    this.connectCable().then((socket) =>
      socket.emit({ cmd: 'join', code: room })
    );
  }
  /**
   * the handshake can only be initiated from the "host" device (player 0)
   * and consumed by all other players.
   * It may be triggered from socket messages
   * if other players start the game.
   * //TODO allow other players to start the game
   * @param offer the offer or answer that occurs during the handshake
   */
  handshake(
    offer?: RTCSessionDescriptionInit,
    queuedIceCandidates?: RTCIceCandidate[]
  ) {
    const cable = this.rtc.createDataChannel('playerData');
    cable.onopen = () => {
      console.log('cable connected');
    };
    cable.onmessage = (event) => {
      console.log('cable message', event.data);
    };
    this.cable = cable;
    if (!isDefined(offer)) {
      this.rtc.createOffer().then((offer) => {
        this.rtc.setLocalDescription(offer);
        this.socket?.emit({ cmd: 'offer', offer });
      });
    } else {
      //we have received an offer, or an answer
      this.rtc.setRemoteDescription(offer).then(() => {
        if (!isDefined(this.rtc.localDescription)) {
          this.rtc.createAnswer().then((answer) => {
            this.rtc.setLocalDescription(answer);
            this.socket?.emit({ cmd: 'answer', offer: answer });
          });
        }
        //regardless of how a remote description is set (via offer or answer) we need to add any queued ice candidates
        if (isDefined(queuedIceCandidates)) {
          for (const candidate of queuedIceCandidates) {
            this.rtc.addIceCandidate(candidate);
          }
        }
      });
      console.log('answered offer');
    }
  }
  async connectCable() {
    const queuedIceCandidates: RTCIceCandidate[] = [];
    return await new LinkCable()
      .on('room', (msg) => {
        if (!msg.code) {
          //TODO handle room failed to create
          return;
        }
        this.hostText.setText(msg.code);
        this.players = msg.players;
        this.rtc = new RTCPeerConnection();
        this.rtc.onicecandidate = (event) => {
          if (isDefined(event.candidate)) {
            this.socket.emit({
              cmd: 'ice',
              candidate: event.candidate,
            });
          }
        };
      })
      .on('player', (msg) => {
        if (isDefined(msg.i)) {
          this.players[msg.i] = msg;
        }
        if (isDefined(msg.c)) {
          const idx = this.players.findIndex((p) => p.id === msg.id);
          if (idx > -1) this.players[idx].c = msg.c;
        }
      })
      .on('you', (msg) => {
        this.sessionId = msg.id;
        if (isDefined(msg.i) && msg.i === 0) {
          this.playBtn.setVisible(true).setInteractive();
        } else {
          this.playBtn.setVisible(false).disableInteractive();
        }
      })
      .on('offer', (msg) => {
        this.handshake(msg.offer, queuedIceCandidates);
      })
      .on('answer', (msg) => {
        this.handshake(msg.offer, queuedIceCandidates);
      })
      .on('ice', (msg) => {
        if (isDefined(msg.candidate)) {
          if (isDefined(this.rtc.remoteDescription)) {
            this.rtc.addIceCandidate(new RTCIceCandidate(msg.candidate));
          } else {
            queuedIceCandidates.push(new RTCIceCandidate(msg.candidate));
          }
        }
      })
      .connect(`ws://127.0.0.1:12345`)
      .then((socket) => {
        this.socket = socket;
        return socket;
      });
  }
  update() {
    this.slots.forEach((slot, index) => {
      if (isDefined(this.players[index])) {
        slot.setText(`${this.players[index]?.c ?? 'NONE'}`);
      }
    });
  }
}

export { Lobby };
