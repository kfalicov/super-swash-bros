//! `PlayerSession` is an actor, it manages peer tcp connection and
//! proxies commands from peer to `RoomServer`.

use std::{
    io, str,
    time::{Duration, Instant},
};

use actix::{prelude::*, spawn};
use actix_web_actors::ws;
use serde::{Deserialize, Serialize};

use super::server::{self, RoomServer};

/// How often heartbeat pings are sent
const HEARTBEAT_INTERVAL: Duration = Duration::from_secs(5);

/// How long before lack of client response causes a timeout
const CLIENT_TIMEOUT: Duration = Duration::from_secs(10);

/// The message type used by this actor
#[derive(Serialize, Deserialize)]
pub struct PlayerChoice {
    /// player #
    pub p: u8,
    /// selected character
    pub c: u8,
}

/// The message type used by this actor
#[derive(Serialize, Deserialize)]
pub struct Join {
    pub code: String,
}

/// Chat server sends this messages to session
#[derive(Message)]
#[rtype(result = "()")]
pub enum Message {
    PlayerChoice,
    Join,
}

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
    room: String,
}

impl Actor for PlayerSession {
    type Context = ws::WebsocketContext<Self>;

    fn started(&mut self, ctx: &mut Self::Context) {
        // we'll start heartbeat process on session start.
        self.hb(ctx);

        // register self in chat server. `AsyncContext::wait` register
        // future within context, but context waits until this future resolves
        // before processing any other events.
        let addr = ctx.address();
        self.addr
            .send(server::Connect {
                addr: addr.recipient(),
            })
            .into_actor(self)
            .then(|res, act, ctx| {
                match res {
                    Ok(res) => act.id = res,
                    // something is wrong with chat server
                    _ => {
                        ctx.stop();
                        println!("something went wrong {}", res.unwrap_err());
                    }
                }
                actix::fut::ready(())
            })
            .wait(ctx);
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
            ws::Message::Binary(msg) => {
                // Deserialize the binary data into a JSON object
                let json_str = str::from_utf8(&msg).unwrap();
                let json: Message = serde_json::from_str(json_str).unwrap();
                match json {
                    Message::PlayerChoice { p, c } => {}
                    Message::Join { code } => {
                        // get address of client session
                        let addr = ctx.address();
                        println!("Join to room: {code}");
                        self.room = code.clone();
                        self.addr.do_send(server::Join {
                            addr: addr.recipient(),
                            code: code.clone(),
                        });
                    }
                    _ => {}
                }
            }
            _ => (),
        }
    }
}

/// Handle messages from chat server, we simply send it to peer websocket
impl Handler<Message> for PlayerSession {
    type Result = ();

    fn handle(&mut self, msg: Message, ctx: &mut Self::Context) {
        ctx.binary(msg);
    }
}
/// Helper methods
impl PlayerSession {
    pub fn new(addr: Addr<RoomServer>) -> PlayerSession {
        PlayerSession {
            id: 0,
            addr,
            hb: Instant::now(),
            room: "main".to_owned(),
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
                    room: act.room,
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
