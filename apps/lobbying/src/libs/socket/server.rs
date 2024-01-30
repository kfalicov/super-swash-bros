//! `RoomServer` is an actor. It maintains list of connection client session.
//! And manages available rooms. Peers send messages to other peers in same
//! room through `RoomServer`.

use std::collections::{HashMap, HashSet};

use actix::prelude::*;
use rand::{self, rngs::ThreadRng, Rng};

use super::session;

/// Message for chat server communications

/// New chat session is created
#[derive(Message)]
#[rtype(usize)]
pub struct Connect {
    pub addr: Recipient<session::Message>,
}

/// Session is disconnected
#[derive(Message)]
#[rtype(result = "()")]
pub struct Disconnect {
    pub id: usize,
}

/// Send message to specific room
#[derive(Message)]
#[rtype(result = "()")]
pub struct Message {
    /// Id of the client session
    pub id: usize,
    /// Peer message
    pub msg: String,
    /// Room name
    pub room: String,
}

/// List of available rooms
pub struct ListRooms;

impl actix::Message for ListRooms {
    type Result = Vec<String>;
}

/// Join room by provided code
#[derive(Message)]
#[rtype(result = "()")]
pub struct Join {
    /// client session address
    pub addr: Recipient<session::Message>,
    /// 4-digit room code
    pub code: String,
}

/// `RoomServer` manages game rooms
pub struct RoomServer {
    /// map of rooms, each with set of users
    rooms: HashMap<String, HashMap<usize, Recipient<session::Message>>>,
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
    fn send_message(&self, room: &str, message: &str, skip_id: usize) {
        if let Some(sessions) = self.rooms.get(room) {
            for id in sessions {
                if *id != skip_id {
                    if let Some(addr) = self.sessions.get(id) {
                        addr.do_send(session::Message(message.to_owned()));
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

/// Handler for Disconnect message.
impl Handler<Disconnect> for RoomServer {
    type Result = ();

    fn handle(&mut self, msg: Disconnect, _: &mut Context<Self>) {
        println!("Someone disconnected");

        let mut rooms: Vec<String> = Vec::new();

        // send message to other users
        for room in rooms {
            self.send_message(&room, "Someone disconnected", 0);
        }
    }
}

/// Handler for Message message.
impl Handler<Message> for RoomServer {
    type Result = ();

    fn handle(&mut self, msg: Message, _: &mut Context<Self>) {
        self.send_message(&msg.room, msg.msg.as_str(), msg.id);
    }
}

/// Join room, send join message to new room
impl Handler<Join> for RoomServer {
    type Result = ();

    fn handle(&mut self, msg: Join, _: &mut Context<Self>) {
        let Join { addr, code } = msg;

        // register session with random id
        let id = self.rng.gen::<usize>();

        let mut rooms = Vec::new();

        if self.rooms.get_mut(&code).is_none() {
            //TODO throw an error- joined invalid room
        }
        self.send_message(&code, "Someone connected", id);
        self.rooms.get_mut(&code).unwrap().insert(id, addr);

        // send id back
        id
    }
}
