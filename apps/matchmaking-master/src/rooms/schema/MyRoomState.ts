import { Schema, Context, type, MapSchema } from '@colyseus/schema';

class Player extends Schema {
  /**
   * the player index (p0, p1, p2, etc)
   */
  @type('number') p: number;
  /**
   * the player's selected character. 0 for no character
   */
  @type('number') c: number = 0;
  constructor(p) {
    super();
    this.p = p;
  }
}

class LobbyRoomState extends Schema {
  @type({ map: Player }) players: MapSchema<Player> = new MapSchema<Player>();
}
export { LobbyRoomState, Player };
