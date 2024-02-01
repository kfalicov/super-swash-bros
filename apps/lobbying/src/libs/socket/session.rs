//! `PlayerSession` is an actor, it manages peer tcp connection and
//! proxies commands from peer to `RoomServer`.

use std::{
    io, str,
    time::{Duration, Instant},
};

use actix::{prelude::*, spawn};
use actix_web_actors::ws;
use serde::{Deserialize, Serialize};
use serde_json;

use super::server::{self, RoomServer, ServerAction};

/// How often heartbeat pings are sent
const HEARTBEAT_INTERVAL: Duration = Duration::from_secs(5);

/// How long before lack of client response causes a timeout
const CLIENT_TIMEOUT: Duration = Duration::from_secs(10);

/// The message type for player decisions
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct PlayerChoice {
    /// selected character
    pub c: u8,
}

/// The message type for player joining a room
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Join {
    pub code: String,
}

/// The message type used for requesting a new room
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Create {}

/// client-session messaging- main message structure received from the client
#[derive(Message, Serialize, Deserialize, Clone, Debug)]
#[rtype(result = "()")]
#[serde(tag = "cmd")]
pub enum Message {
    #[serde(rename = "choice")]
    PlayerChoice(PlayerChoice),

    #[serde(rename = "join")]
    Join(Join),

    #[serde(rename = "create")]
    Create(Create),
}

/// client-session messaging- main message structure received from the client
#[derive(Message, Serialize, Deserialize, Clone, Debug)]
#[rtype(result = "()")]
pub struct Plain(pub String);

/// `PlayerSession` actor is responsible for tcp peer communications.
pub struct PlayerSession {
    /// unique session id
    id: usize,
    /// this is address of chat server
    addr: Addr<RoomServer>,
    /// Client must send ping at least once per 10 seconds, otherwise we drop
    /// connection.
    hb: Instant,
    /// joined room
    room: Option<String>,
}

impl Actor for PlayerSession {
    type Context = ws::WebsocketContext<Self>;

    fn started(&mut self, ctx: &mut Self::Context) {
        // we'll start heartbeat process on session start.
        self.hb(ctx);
    }

    fn stopping(&mut self, _: &mut Self::Context) -> Running {
        println!("stopping session");
        // notify chat server
        self.addr.do_send(server::Disconnect {
            id: self.id,
            room: self.room.clone(),
        });
        Running::Stop
    }
}

impl actix::io::WriteHandler<io::Error> for PlayerSession {}

/// handle messages from the client. We need to figure out what the client is trying to do and then
/// send the appropriate message to the server
impl StreamHandler<Result<ws::Message, ws::ProtocolError>> for PlayerSession {
    /// This is main event loop for client requests
    fn handle(&mut self, msg: Result<ws::Message, ws::ProtocolError>, ctx: &mut Self::Context) {
        log::debug!("Received Message {:?}", msg);
        /// early exit on errors, otherwise pipe through
        let msg = match msg {
            Err(_) => {
                ctx.stop();
                return;
            }
            Ok(msg) => msg,
        };
        match msg {
            ws::Message::Ping(msg) => {
                self.hb = Instant::now();
                ctx.pong(&msg);
            }
            ws::Message::Pong(_) => {
                self.hb = Instant::now();
            }
            ws::Message::Text(msg) => {
                // Deserialize the binary data into a JSON object
                let json: Message = serde_json::from_str(&msg).unwrap();
                match json {
                    Message::PlayerChoice(p) => {}
                    Message::Join(j) => {
                        let Join { code } = j;
                        // get address of client session
                        let addr = ctx.address();
                        println!("Join to room: {code}");
                        self.room = Some(code.clone());
                        self.addr.do_send(server::RoomJoin {
                            addr: addr,
                            code: code.clone(),
                        });
                        //TODO if new room is joined from same session, leave the old room
                    }
                    Message::Create(_) => {
                        if let Some(room) = &self.room {
                            //session is already part of a room
                            ctx.text("here's who is in the room")
                        } else {
                            let future = self.addr.send(server::CreateRoom {});
                            ctx.spawn(future.into_actor(self).then(|res, act, ctx| {
                                match res {
                                    Ok(room_code) => {
                                        let room_code = room_code.clone();
                                        act.room = Some(room_code.clone());
                                        ctx.text(format!("{{\"room\": \"{}\"}}", room_code));
                                    }
                                    _ => ctx.text("Failed to create room"),
                                }
                                actix::fut::ready(())
                            }));
                        }
                    }
                    _ => {
                        log::debug!("unknown command: {:?}", json);
                    }
                }
            }
            _ => {
                log::debug!("unhandled message: {:?}", msg);
            }
        }
    }
}

/// Handle messages from chat server, we simply send it to peer websocket
impl Handler<Plain> for PlayerSession {
    type Result = ();

    fn handle(&mut self, msg: Plain, ctx: &mut Self::Context) {
        ctx.text(msg.0);
    }
}
/// Helper methods
impl PlayerSession {
    pub fn new(addr: Addr<RoomServer>) -> PlayerSession {
        PlayerSession {
            id: 0,
            addr,
            hb: Instant::now(),
            room: None,
        }
    }

    /// helper method that sends ping to client every second.
    ///
    /// also this method check heartbeats from client
    fn hb(&self, ctx: &mut ws::WebsocketContext<Self>) {
        ctx.run_interval(HEARTBEAT_INTERVAL, |act, ctx| {
            // check client heartbeats
            if Instant::now().duration_since(act.hb) > CLIENT_TIMEOUT {
                // heartbeat timed out
                println!("Websocket Client heartbeat failed, disconnecting!");

                // notify chat server
                act.addr.do_send(server::Disconnect {
                    id: act.id,
                    room: act.room.clone(),
                });

                // stop actor
                ctx.stop();

                // don't try to send a ping
                return;
            }

            ctx.ping(b"");
        });
    }
}
