//! `RoomServer` is an actor. It maintains list of connection client session.
//! And manages available rooms. Peers send messages to other peers in same
//! room through `RoomServer`.

use std::collections::HashMap;

use actix::prelude::*;
use rand::{self, distributions::Alphanumeric, rngs::ThreadRng, Rng};

use super::{
    responses::{self, Player, Response, RoomInfo},
    session::{self},
};

/// Session is disconnected
#[derive(Message, Clone, Debug)]
#[rtype(result = "()")]
pub struct Disconnect {
    /// the player ID
    pub id: Option<String>,
    /// the room code
    pub room: Option<String>,
}

/// Join room by provided code
#[derive(Message, Clone, Debug)]
/// returns a generated unique (within this room) ID for the player
#[rtype(result = "()")]
pub struct JoinRoom {
    /// client session address
    pub addr: Addr<session::PlayerSession>,
    /// 4-digit room code
    pub code: String,
}
/// request to create a room
#[derive(Message, Clone, Debug)]
#[rtype(result = "()")]
pub struct CreateRoom {
    /// client session address
    pub addr: Addr<session::PlayerSession>,
}

/// directly send arbitrary messages to room members
#[derive(Message, Clone)]
#[rtype(result = "()")]
pub struct ToRoom {
    pub msg: Response,
    /// the room ID to send the message to
    pub room: String,
    /// the player ID the message is from.
    /// this player is not included in the broadcast
    pub id: String,
}

/// broadcast message to all users. Provide a room to scope the broadcast to that room
#[derive(Message, Clone, Debug)]
#[rtype(result = "()")]
pub struct Broadcast {
    pub room: Option<String>,
    pub text: String,
}
impl Broadcast {
    pub fn all(msg: String) -> Broadcast {
        Broadcast {
            room: None,
            text: msg,
        }
    }
    pub fn room(room: String, msg: String) -> Broadcast {
        Broadcast {
            room: Some(room),
            text: msg,
        }
    }
}

#[derive(Clone, Debug)]
pub struct PlayerInfo {
    /// the player's unique ID
    id: String,
    /// the player's chosen character
    c: Option<u8>,
    /// the address of the player's session
    addr: Addr<session::PlayerSession>,
}

/// a room containing player data
#[derive(Debug)]
pub struct Room {
    code: String,
    /// map of player id to player info
    players: HashMap<String, PlayerInfo>,
    /// an ordered list of player IDs
    players_order: Vec<Option<String>>,
}

/// `RoomServer` manages game rooms
#[derive(Default)]
pub struct RoomServer {
    /// map of rooms, each with set of users
    rooms: HashMap<String, Room>,
    rng: ThreadRng,
}

impl RoomServer {}

/// Make actor from `RoomServer`
impl Actor for RoomServer {
    /// We are going to use simple Context, we just need ability to communicate
    /// with other actors.
    type Context = Context<Self>;
}

/// Handler for Disconnect message.
impl Handler<Disconnect> for RoomServer {
    type Result = ();

    fn handle(&mut self, msg: Disconnect, _: &mut Context<Self>) {
        if let (Some(code), Some(id)) = (msg.room, msg.id) {
            log::info!("Player {} left room {}", id, code);
            if let Some(room) = self.rooms.get_mut(&code) {
                room.players.remove(&id);
                let index = room
                    .players_order
                    .iter()
                    .position(|x| x.as_ref() == Some(&id));
                if let Some(idx) = index {
                    room.players_order.remove(idx);
                }
                // inform each player in the room about the disconnected player
                // This can be in the form of a `Player` message- with their ID but a player index of -1
                for (id, p) in room.players.clone() {
                    p.addr.do_send(responses::Response::Player(Player {
                        id,
                        c: None,
                        i: Some(usize::MAX),
                    }));
                }
            }
        }
    }
}

/// Join room, send join message to new room
impl Handler<JoinRoom> for RoomServer {
    type Result = ();

    fn handle(&mut self, msg: JoinRoom, _: &mut Context<Self>) {
        let JoinRoom { addr, code } = msg;
        if self.rooms.get_mut(&code).is_none() {
            // tell the connecting player that they did not join a room successfully
            addr.do_send(responses::Response::RoomInfo(RoomInfo {
                players: [].to_vec(),
                code: "".to_string(),
            }));
            //exit the function early
            return ();
        }

        if let Some(room) = self.rooms.get_mut(&code) {
            log::info!("found room {:#?}", room);
            // add the player to the last slot of the room by default
            let mut pos = room.players_order.len();
            // Find the position of the first empty space in the vec
            if let Some(empty_pos) = room.players_order.iter().position(|x| x.is_none()) {
                pos = empty_pos;
            }

            //player ID
            let pid: String = (&mut self.rng)
                .sample_iter(&Alphanumeric)
                .take(8)
                .map(char::from)
                .collect();
            //TODO repeat the above process if the ID is not unique in the room
            addr.do_send(responses::Response::You(Player {
                id: pid.to_owned(),
                c: None,
                i: Some(pos),
            }));

            // Insert the id into the vec at that position
            room.players_order.insert(pos, Some(pid.clone()));

            //create a new player
            let new_player = PlayerInfo {
                id: pid.clone(),
                c: None,
                addr: addr.clone(),
            };
            //inform each player in the room about the new player
            for (_id, p) in room.players.clone() {
                p.addr.do_send(responses::Response::Player(Player {
                    id: new_player.id.clone(),
                    c: new_player.c,
                    i: Some(pos),
                }));
            }

            log::info!(
                "Player {} joined room {} ({} players already in room)",
                pid,
                code,
                room.players.len()
            );

            //insert the user into the room
            room.players.insert(pid.clone(), new_player);

            //broadcast to the new user the info about the other users in the room
            addr.do_send(responses::Response::RoomInfo(RoomInfo {
                players: room
                    .players_order
                    .iter()
                    .enumerate()
                    .map(|(index, item)| {
                        item.as_ref().and_then(|key| {
                            room.players.get(key).map(|p| Player {
                                id: p.id.clone(),
                                i: Some(index),
                                c: p.c,
                            })
                        })
                    })
                    .collect(),
                code: code.clone(),
            }));
        }
    }
}

impl Handler<CreateRoom> for RoomServer {
    type Result = ();

    fn handle(&mut self, msg: CreateRoom, _ctx: &mut Context<Self>) {
        let addr = msg.addr;
        let rng = &mut self.rng;
        // generate a random 4-letter code
        let code: String = rng
            .sample_iter(&Alphanumeric)
            .map(char::from)
            .filter(|c| c.is_alphabetic() && c.is_lowercase())
            .take(4)
            .collect();

        let pid: String = rng
            .sample_iter(&Alphanumeric)
            .take(8)
            .map(char::from)
            .collect();
        let you = Player {
            id: pid.to_owned(),
            c: None,
            i: Some(0),
        };

        self.rooms.insert(
            code.clone(),
            Room {
                code: code.clone(),
                players: [(
                    pid.clone(),
                    PlayerInfo {
                        id: pid.clone(),
                        addr: addr.clone(),
                        c: None,
                    },
                )]
                .iter()
                .cloned()
                .collect(),
                players_order: [Some(pid)].to_vec(),
            },
        );
        addr.do_send(responses::Response::You(you.clone()));
        addr.do_send(responses::Response::RoomInfo(RoomInfo {
            players: [Some(you)].to_vec(),
            code,
        }));
    }
}

impl Handler<Broadcast> for RoomServer {
    type Result = ();
    fn handle(&mut self, msg: Broadcast, _ctx: &mut Self::Context) -> Self::Result {
        if let Some(room) = msg.room {
            if let Some(room) = self.rooms.get(&room) {
                for (_id, p) in room.players.clone() {
                    p.addr.do_send(responses::Response::Alert(responses::Chat {
                        msg: msg.text.clone(),
                    }));
                }
            }
        } else {
            for (_code, room) in &self.rooms {
                for (_id, p) in room.players.clone() {
                    p.addr.do_send(responses::Response::Alert(responses::Chat {
                        msg: msg.text.clone(),
                    }));
                }
            }
        }
    }
}

/// an option to directly forward messages to each player
impl Handler<ToRoom> for RoomServer {
    type Result = ();

    fn handle(&mut self, msg: ToRoom, _ctx: &mut Self::Context) {
        if let Some(room) = self.rooms.get(&msg.room) {
            for (player_id, player) in room.players.iter() {
                // check if the player ID matches the ID provided in msg
                if player_id.ne(&msg.id) {
                    log::info!(
                        "sending message {:#?} from player {} to room {}",
                        msg.msg.clone(),
                        player_id,
                        msg.room
                    );
                    // send the message to the player
                    player.addr.do_send(msg.msg.clone());
                }
            }
        }
    }
}
