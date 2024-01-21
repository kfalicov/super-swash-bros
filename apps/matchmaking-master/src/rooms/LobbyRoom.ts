import { Room, Client } from '@colyseus/core';
import { LobbyRoomState, Player } from './schema/MyRoomState';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

class LobbyRoom extends Room<LobbyRoomState> {
  // The channel where we register the room IDs.
  LOBBY_CHANNEL = 'lobbyIds';

  maxClients = 4;

  // Generate a single 4 capital letter room ID.
  generateRoomIdSingle(): string {
    let result = '';
    for (let i = 0; i < 4; i++) {
      result += LETTERS.charAt(Math.floor(Math.random() * LETTERS.length));
    }
    return result;
  }
  // 1. Get room IDs already registered with the Presence API.
  // 2. Generate room IDs until you generate one that is not already used.
  // 3. Register the new room ID with the Presence API.
  async generateRoomId(): Promise<string> {
    const currentIds = await this.presence.smembers(this.LOBBY_CHANNEL);
    let id;
    do {
      id = this.generateRoomIdSingle();
    } while (currentIds.includes(id));

    await this.presence.sadd(this.LOBBY_CHANNEL, id);
    return id;
  }

  async onCreate(options: { private: boolean }) {
    this.roomId = await this.generateRoomId();
    this.setState(new LobbyRoomState());
    this.setPrivate(options.private || true);

    this.onMessage('charselect', (client, message) => {
      const player = this.state.players.get(`${message.p}`);
      if (!player) return;
      // console.log(client, player);
      /**
       * prevent any client from changing someone's character
       */
      if (player.sessionId === client.sessionId) {
        player.c = message.c;
      }
    });
  }

  onJoin(client: Client, options: any) {
    const players = this.state.playersArray;
    const availableSlot = players.reduce<{ [key: number]: boolean }>(
      (acc, player) => {
        acc[player.p] = false;
        return acc;
      },
      { 0: true, 1: true, 2: true, 3: true }
    );
    const slot = [0, 1, 2, 3].find((p) => availableSlot[p]);
    if (slot === undefined) throw 'No room in the lobby!';
    this.state.players.set(`${slot}`, new Player(slot, client.sessionId));
  }

  onLeave(client: Client, consented: boolean) {
    console.log(client.id, client.sessionId, 'left');
    const playersOfClient = Array.from(this.state.players.values()).filter(
      (p) => p.sessionId === client.sessionId
    );
    for (const player of playersOfClient) {
      this.state.players.delete(`${player.p}`);
    }
  }

  onDispose() {
    this.presence.srem(this.LOBBY_CHANNEL, this.roomId);
  }
}
export { LobbyRoom };
