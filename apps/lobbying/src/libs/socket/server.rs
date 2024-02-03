//! `RoomServer` is an actor. It maintains list of connection client session.
//! And manages available rooms. Peers send messages to other peers in same
//! room through `RoomServer`.

use std::collections::HashMap;

use actix::prelude::*;
use rand::{self, distributions::Alphanumeric, rngs::ThreadRng, Rng};

use super::{
    requests::{self},
    responses::{self, Player, RoomInfo},
    session::{self},
};

/// New chat session is created
#[derive(Message, Clone, Debug)]
#[rtype(usize)]
pub struct Connect {
    pub addr: Recipient<requests::Request>,
}

/// Session is disconnected
#[derive(Message, Clone, Debug)]
#[rtype(result = "()")]
pub struct Disconnect {
    pub id: Option<String>,
    pub room: Option<String>,
}

/// Join room by provided code
#[derive(Message, Clone, Debug)]
/// returns a generated unique (within this room) ID for the player
#[rtype(String)]
pub struct RoomJoin {
    /// client session address
    pub addr: Addr<session::PlayerSession>,
    /// 4-digit room code
    pub code: String,
}
/// request to create a room
#[derive(Message, Clone, Debug)]
#[rtype(String)]
pub struct CreateRoom {}

/// `RoomServer` manages game rooms
pub struct RoomServer {
    /// map of rooms, each with set of users
    rooms: HashMap<String, HashMap<String, Addr<session::PlayerSession>>>,
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
}

/// Make actor from `RoomServer`
impl Actor for RoomServer {
    /// We are going to use simple Context, we just need ability to communicate
    /// with other actors.
    type Context = Context<Self>;
}

/// Handler for Connect message.
/// Register new session and assign unique id to this session
impl Handler<Connect> for RoomServer {
    type Result = usize;

    fn handle(&mut self, msg: Connect, _: &mut Context<Self>) -> Self::Result {
        println!("Someone joined");

        // register session with random id
        let id = self.rng.gen::<usize>();
        println!("{id}");

        // send id back
        id
    }
}

/// Handler for Disconnect message.
impl Handler<Disconnect> for RoomServer {
    type Result = ();

    fn handle(&mut self, msg: Disconnect, _: &mut Context<Self>) {
        println!("Someone disconnected");

        if let (Some(code), Some(id)) = (msg.room, msg.id) {
            if let Some(room) = self.rooms.get_mut(&code) {
                room.remove(&id);
                // TODO send message to other users
            }
        }
    }
}

/// Handler for Message message.
// impl Handler<Message> for RoomServer {
//     type Result = ();

//     fn handle(&mut self, msg: Message, _: &mut Context<Self>) {
//         self.send_message("main", msg, 10);
//     }
// }

/// Join room, send join message to new room
impl Handler<RoomJoin> for RoomServer {
    type Result = String;

    fn handle(&mut self, msg: RoomJoin, _: &mut Context<Self>) -> Self::Result {
        let RoomJoin { addr, code } = msg;

        let hash: String = self
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
            //construct list of players
            let mut players: Vec<Player> = Vec::new();
            //represent the new player in the list
            let new_player = Player {
                id: hash.clone(),
                c: None,
            };
            players.push(new_player.clone());
            for (id, addr) in room.clone() {
                // Create a new player and add them to the players vector
                let player = Player {
                    id: id.clone(),
                    //TODO replace with the correct value for `c`
                    //this will require changes to the room struct to include more data
                    c: Some(0),
                };
                players.push(player.clone());

                addr.do_send(responses::Response::Player(new_player.clone()));
            }
            //broadcast to the new user the info about the other users in the room
            addr.do_send(responses::Response::RoomInfo(RoomInfo {
                players: players,
                code,
            }));

            //insert the user into the room
            room.insert(hash.clone(), addr);
        }

        // send id back
        hash
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
        self.rooms.insert(code.clone(), HashMap::new());
        code
    }
}
