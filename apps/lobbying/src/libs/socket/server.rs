//! `RoomServer` is an actor. It maintains list of connection client session.
//! And manages available rooms. Peers send messages to other peers in same
//! room through `RoomServer`.

use std::collections::{HashMap, HashSet};

use actix::prelude::*;
use actix_web_actors::ws;
use rand::{self, rngs::ThreadRng, Rng};

use super::session::{self, Plain, PlayerChoice};

/// Message for chat server communications
#[derive(Clone, Message, Debug)]
#[rtype(result = "()")]
pub enum ServerAction {
    Connect(Connect),
    Disconnect(Disconnect),
    RoomJoin(RoomJoin),
    CreateRoom(CreateRoom),
}

/// New chat session is created
#[derive(Message, Clone, Debug)]
#[rtype(usize)]
pub struct Connect {
    pub addr: Recipient<session::Message>,
}

/// Session is disconnected
#[derive(Message, Clone, Debug)]
#[rtype(result = "()")]
pub struct Disconnect {
    pub id: usize,
    pub room: Option<String>,
}

/// Join room by provided code
#[derive(Message, Clone, Debug)]
#[rtype(usize)]
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
    rooms: HashMap<String, HashMap<usize, Addr<session::PlayerSession>>>,
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
    /// Send message to all users in the room
    fn send_message(&self, room: &str, message: ServerAction, skip_id: usize) {
        log::info!("Sending message to room {}", room);
        if let Some(sessions) = self.rooms.get(room) {
            for id in sessions.keys() {
                if *id != skip_id {
                    if let Some(addr) = sessions.get(id) {
                        // addr.do_send("the server wants to say something to you".to_owned());
                    }
                }
            }
        }
    }
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

        if let Some(code) = msg.room {
            if let Some(room) = self.rooms.get_mut(&code) {
                room.remove(&msg.id);
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
    type Result = usize;

    fn handle(&mut self, msg: RoomJoin, _: &mut Context<Self>) -> Self::Result {
        let RoomJoin { addr, code } = msg;

        // register session with random id
        let id = self.rng.gen::<usize>();

        if self.rooms.get_mut(&code).is_none() {
            //TODO throw an error- joined invalid room
        }
        if let Some(room) = self.rooms.get_mut(&code) {
            //TODO broadcast to all users in the room that a new user has joined
            for (_key, addr) in room.clone() {
                // let message = Message::new(format!("New player joined: {}", player_name));
                let _ = addr.do_send(Plain("yabba dabba do".to_owned()));
            }
            //TODO broadcast to the new user the info about the other users in the room

            //insert the user into the room
            room.insert(id, addr);
        }

        // send id back
        id
    }
}

impl Handler<CreateRoom> for RoomServer {
    type Result = String;

    fn handle(&mut self, _msg: CreateRoom, _ctx: &mut Context<Self>) -> Self::Result {
        let code = self.rng.gen_range(1000..9999).to_string();
        self.rooms.insert(code.clone(), HashMap::new());
        println!("Created room: {code}");
        code
    }
}
