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
#[rtype(String)]
pub struct JoinRoom {
    /// client session address
    pub addr: Addr<session::PlayerSession>,
    /// 4-digit room code
    pub code: String,
}
/// request to create a room
#[derive(Message, Clone, Debug)]
#[rtype(String)]
pub struct CreateRoom {}

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

#[derive(Clone)]
pub struct PlayerInfo {
    /// the player's unique ID
    id: String,
    /// the player's chosen character
    c: Option<u8>,
    /// the address of the player's session
    addr: Addr<session::PlayerSession>,
}

/// a room containing player data
pub struct Room {
    code: String,
    /// map of player id to player info
    players: HashMap<String, PlayerInfo>,
    /// an ordered list of player IDs
    players_order: Vec<Option<String>>,
}

/// `RoomServer` manages game rooms
pub struct RoomServer {
    /// map of rooms, each with set of users
    rooms: HashMap<String, Room>,
    rng: ThreadRng,
}

impl Default for RoomServer {
    fn default() -> RoomServer {
        RoomServer {
            rooms: HashMap::new(),
            rng: rand::thread_rng(),
        }
    }
}

impl RoomServer {
    //TODO put reusable functionality here
    fn add_to_room() {}
}

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
                // TODO send message to other users
            }
        }
    }
}

/// Join room, send join message to new room
impl Handler<JoinRoom> for RoomServer {
    type Result = String;

    fn handle(&mut self, msg: JoinRoom, _: &mut Context<Self>) -> Self::Result {
        let JoinRoom { addr, code } = msg;

        //player ID
        let pid: String = self
            .rng
            .clone()
            .sample_iter(&Alphanumeric)
            .take(8)
            .map(char::from)
            .collect();

        if self.rooms.get_mut(&code).is_none() {
            //TODO throw an error- joined invalid room
        }
        if let Some(room) = self.rooms.get_mut(&code) {
            // Find the position of the first empty space in the vec
            let pos = room
                .players_order
                .iter()
                .position(|x| x.is_none())
                .unwrap_or(room.players_order.len());

            // Insert the id into the vec at that position
            room.players_order.insert(pos, Some(pid.clone()));

            //create a new player
            let new_player = PlayerInfo {
                id: pid.clone(),
                c: None,
                addr: addr.clone(),
            };
            //inform each player in the room about the new player
            for (id, p) in room.players.clone() {
                p.addr.do_send(responses::Response::Player(Player {
                    id: new_player.id.clone(),
                    c: new_player.c,
                    i: Some(pos),
                }));
            }
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
                code,
            }));
        }

        // send id back
        pid
    }
}

impl Handler<CreateRoom> for RoomServer {
    type Result = String;

    fn handle(&mut self, _msg: CreateRoom, _ctx: &mut Context<Self>) -> Self::Result {
        let code: String = rand::thread_rng()
            .sample_iter(&Alphanumeric)
            .map(char::from)
            .filter(|c| c.is_alphabetic() && c.is_lowercase())
            .take(4)
            .collect();
        self.rooms.insert(
            code.clone(),
            Room {
                code: code.clone(),
                players: HashMap::new(),
                players_order: Vec::new(),
            },
        );
        code
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
                log::info!(
                    "sending message from player {} to room {}",
                    player_id,
                    msg.room
                );
                // check if the player ID matches the ID provided in msg
                if player_id.ne(&msg.id) {
                    // send the message to the player
                    player.addr.do_send(msg.msg.clone());
                }
            }
        }
    }
}
