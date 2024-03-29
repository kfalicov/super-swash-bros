import { Player } from '@super-swash-bros/api';

type Response =
  | ({ cmd: 'you' } & Player)
  | ({ cmd: 'player' } & Player)
  | { cmd: 'room'; code?: string; players: (Player | null)[] }
  | { cmd: 'offer'; offer: RTCSessionDescriptionInit }
  | { cmd: 'answer'; offer: RTCSessionDescriptionInit }
  | { cmd: 'ice'; candidate: RTCIceCandidate };

type Request =
  | { cmd: 'create' }
  | { cmd: 'choice'; c: number }
  | { cmd: 'join'; code: string }
  | { cmd: 'offer'; offer: RTCSessionDescriptionInit }
  | { cmd: 'answer'; offer: RTCSessionDescriptionInit }
  | { cmd: 'ice'; candidate: RTCIceCandidate };

type Handler = {
  [K in Response['cmd']]?: (msg: Extract<Response, { cmd: K }>) => void;
};

class LinkCable {
  socket?: WebSocket;
  handlers: Handler = {};
  connect(url: string): Promise<LinkCable> {
    if (this.socket) return Promise.resolve(this);
    return new Promise((resolve, reject) => {
      this.socket = new WebSocket(url);
      this.socket.addEventListener('open', () => {
        resolve(this);
      });

      // Listen for messages
      this.socket.addEventListener('message', (event) => {
        try {
          const msg = JSON.parse(event.data) as Response;
          // @ts-expect-error TS can't strongly infer this type but we know it is allowed
          this.handlers[msg.cmd]?.(msg);
        } catch (e) {
          //
          console.log(e);
        }
      });

      this.socket.addEventListener('error', () => {
        this.socket = undefined;
        reject('socket error');
      });
      this.socket.addEventListener('close', () => {
        this.socket = undefined;
        reject('socket closed');
      });
    });
  }

  ping() {
    /**
     * remind the server we are still here
     */
  }

  on<T extends Response['cmd']>(
    command: T,
    func: (msg: Extract<Response, { cmd: T }>) => void
  ): LinkCable {
    // @ts-expect-error TS can't strongly infer this type but we know it is allowed
    this.handlers[command] = func;
    return this;
  }

  emit(cmd: Request) {
    if (this.socket && this.socket.OPEN) {
      this.socket.send(JSON.stringify(cmd));
    }
  }
}

export { LinkCable };
