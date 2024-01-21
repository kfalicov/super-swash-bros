import {
  Schema,
  Context,
  type,
  MapSchema,
  ArraySchema,
} from '@colyseus/schema';

class Player extends Schema {
  /**
   * the player's index in the lobby
   */
  @type('number') p: number = 0;
  /**
   * the player's selected character. 0 for no character
   */
  @type('number') c: number = 0;
  /** the client session ID which this player is connecting from */
  @type('string') sessionId: string = '';
  constructor(p, sessionId) {
    super();
    this.p = p;
    this.sessionId = sessionId;
  }
}

class LobbyRoomState extends Schema {
  /**
   * a mapping between a player's slot in the lobby, and the player's current state.
   * Players can be added and removed from any connected client.
   */
  @type({ map: Player })
  players: MapSchema<Player> = new MapSchema<Player>();

  get playersArray(): Player[] {
    return Array.from(this.players.values());
  }
}
export { LobbyRoomState, Player };
