type Command = { cmd: 'create' } | { cmd: 'join'; code: string };

type Handler = {
  [K in Command['cmd']]?: (msg: Extract<Command, { cmd: K }>) => void;
};

class GameSocket {
  socket?: WebSocket;
  handlers: Handler = {};
  connect(url: string) {
    if (this.socket) return this;
    this.socket = new WebSocket(url);
    this.socket.addEventListener('open', (e) => {
      this.socket.send(JSON.stringify({ cmd: 'create' }));
    });

    // Listen for messages
    this.socket.addEventListener('message', (event) => {
      try {
        const msg = JSON.parse(event.data) as Command;
        console.log(msg, this.handlers);
        // @ts-expect-error TS can't strongly infer this type but we know it is allowed
        this.handlers[msg.cmd]?.(msg);
      } catch (e) {
        //
        console.log(e);
      }
    });

    this.socket.addEventListener('close', () => {
      console.log('socket closed');
    });
    this.on('room', (t) => console.log('handled create event', t));
    return this;
  }
  ping() {
    this.socket.send(JSON.stringify({ cmd: 'create' }));
  }
  on<T extends Command['cmd']>(
    command: T,
    func: (msg: Extract<Command, { cmd: T }>) => void
  ) {
    // @ts-expect-error TS can't strongly infer this type but we know it is allowed
    this.handlers[command] = func;
  }
}

export { GameSocket };
