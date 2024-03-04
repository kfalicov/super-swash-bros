import { Scene } from 'phaser';
import { LinkCable } from '../objects/socket';
import { Player, api } from '@super-swash-bros/api';
import { isDefined } from '@super-swash-bros/utils';
import World from './worldgen';

const configuration = {
  iceServers: [
    {
      urls: 'stun:stun.l.google.com:19302',
    },
  ],
};

class Lobby extends Scene {
  sessionId?: string;
  players: (Player | null)[] = [];
  hostText: Phaser.GameObjects.Text;
  playBtn?: Phaser.GameObjects.Image;
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
      .setInteractive()
      .setVisible(false);
    const join = this.add
      .text(140, 40, 'join', { color: '#000000' })
      .setOrigin(0.5)
      .setInteractive()
      .setVisible(false);
    join.on('pointerdown', () => {
      input.focus();
      go.setVisible(true);
    });

    /**
     * ping the API to see if it is up. If it's up,
     * show the server-related buttons (host, join)
     */
    api.root.up().then((res) => {
      if (res.status === 200) {
        host.setVisible(true);
        join.setVisible(true);
      }
    });

    go.on('pointerdown', () => {
      if (!this.socket) {
        this.join(input.value);
      } else {
        this.socket.ping();
      }
      join.setVisible(false).disableInteractive();
      go.setVisible(false).disableInteractive();
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
        play.disableInteractive().setVisible(false);
        this.handshake().then(() => {
          this.createWorld();
        });
      } else {
        this.createWorld();
      }
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
   * initiates the RTC handshake. When the returned promise resolves,
   * it means that the players are connected and the game can start.
   * //TODO allow other players to start the game
   * @param offer the offer or answer that occurs during the handshake
   * @returns a promise that resolves when the player's local description is set
   */
  handshake() {
    /**
     * create the host RTCPeerConnection
     */
    this.rtc = new RTCPeerConnection(configuration);
    const cable = this.rtc.createDataChannel('playerData', {
      ordered: false,
    });
    cable.onopen = () => {
      console.log('cable connected - caller');
    };
    cable.onerror = (event) => console.error('error', event);
    cable.onclose = () => console.log('cable closed');
    this.cable = cable;
    this.rtc.onicecandidate = (event) => {
      if (isDefined(event.candidate)) {
        this.socket.emit({
          cmd: 'ice',
          candidate: event.candidate,
        });
      }
    };

    return new Promise<void>((resolve) => {
      this.rtc.createOffer().then((offer) => {
        this.rtc.setLocalDescription(offer);
        this.socket?.emit({ cmd: 'offer', offer });
        resolve();
      });
    });
  }

  handleDescription(
    offer: RTCSessionDescriptionInit,
    queuedIceCandidates: RTCIceCandidate[]
  ) {
    if (!isDefined(this.rtc)) {
      this.rtc = new RTCPeerConnection(configuration);
      this.rtc.onicecandidate = (event) => {
        if (isDefined(event.candidate)) {
          console.log('generated', event.candidate.usernameFragment);
          this.socket.emit({
            cmd: 'ice',
            candidate: event.candidate,
          });
        }
      };
    }
    this.rtc.setRemoteDescription(offer).then(() => {
      if (!isDefined(this.rtc.localDescription)) {
        if (offer.type === 'offer') {
          //If we get an offer, we need to answer it
          this.rtc.createAnswer().then((answer) => {
            this.rtc.setLocalDescription(answer);
            this.socket?.emit({ cmd: 'answer', offer: answer });
          });
          this.rtc.ondatachannel = (event) => {
            const dataChannel = event.channel;

            dataChannel.onopen = () => {
              console.log('cable connected - callee');
            };
            this.cable = dataChannel;
            this.createWorld();
          };
        } else if (offer.type === 'answer') {
          //if we get an answer, we don't need to do anything past setting the remote description
        }
      }

      if (isDefined(queuedIceCandidates)) {
        while (queuedIceCandidates.length > 0) {
          const candidate = queuedIceCandidates.shift();
          console.log('adding', candidate.usernameFragment);
          this.rtc.addIceCandidate(candidate);
        }
      }
    });
  }

  createWorld() {
    this.scene.manager.switch(this.scene.key, 'World');
    const world = this.scene.manager.getScene('World') as World;
    world.rtc = this.rtc;
    world.cable = this.cable;
    world.initPlayers(this.sessionId, this.players);
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
        this.handleDescription(msg.offer, queuedIceCandidates);
      })
      .on('answer', (msg) => {
        this.handleDescription(msg.offer, queuedIceCandidates);
      })
      .on('ice', (msg) => {
        if (isDefined(msg.candidate)) {
          if (isDefined(this.rtc.remoteDescription)) {
            console.log('adding', msg.candidate.usernameFragment);
            this.rtc.addIceCandidate(new RTCIceCandidate(msg.candidate));
          } else {
            console.log('queuing', msg.candidate.usernameFragment);
            queuedIceCandidates.push(new RTCIceCandidate(msg.candidate));
          }
        }
      })
      .connect(`ws://localhost:12345`)
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
