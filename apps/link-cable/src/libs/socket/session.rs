//! `PlayerSession` is an actor, it manages peer tcp connection and
//! proxies commands from peer to `RoomServer`.

use std::{
    str,
    time::{Duration, Instant},
};

use actix::prelude::*;
use actix_web_actors::ws;
use serde::{Deserialize, Serialize};
use serde_json;

use crate::libs::socket::{
    requests::{Join, Request},
    responses::RoomInfo,
};

use super::{
    requests,
    server::{self, RoomServer},
};
use super::{
    responses::{self, Player},
    server::ToRoom,
};

/// How often heartbeat pings are sent
const HEARTBEAT_INTERVAL: Duration = Duration::from_secs(5);

/// How long before lack of client response causes a timeout
const CLIENT_TIMEOUT: Duration = Duration::from_secs(10);

/// client-session messaging- main message structure received from the client
#[derive(Message, Serialize, Deserialize, Clone, Debug)]
#[rtype(result = "()")]
pub struct Plain(pub String);

/// `PlayerSession` actor is responsible for tcp peer communications.
pub struct PlayerSession {
    /// unique room member id (only present while in a room)
    id: Option<String>,
    /// this is address of room hub
    hub: Addr<RoomServer>,
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
        log::info!("killing {:?}", self.id);
        // notify hub/room server of disconnect
        self.hub.do_send(server::Disconnect {
            id: self.id.clone(),
            room: self.room.clone(),
        });
        Running::Stop
    }
}

/// handle messages from the client. We need to figure out what the client is trying to do and then
/// send the appropriate message to the server actor
impl StreamHandler<Result<ws::Message, ws::ProtocolError>> for PlayerSession {
    /// This is main event loop for client requests
    fn handle(&mut self, msg: Result<ws::Message, ws::ProtocolError>, ctx: &mut Self::Context) {
        // early exit on errors, otherwise pipe through
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
                if let Ok(json) = serde_json::from_str::<Request>(&msg) {
                    match json {
                        Request::PlayerChoice(p) => {
                            if let (Some(id), Some(room)) = (self.id.clone(), self.room.clone()) {
                                self.hub.do_send(ToRoom {
                                    msg: responses::Response::Player(Player {
                                        id: id.clone(),
                                        c: Some(p.c),
                                        i: None,
                                    }),
                                    id,
                                    room,
                                })
                            }
                        }
                        Request::Join(j) => {
                            let code = j.code;
                            self.hub.do_send(server::JoinRoom {
                                addr: ctx.address(),
                                code: code.to_owned(),
                            });
                        }
                        Request::Create(_) => {
                            if let Some(room) = &self.room {
                                //TODO request existing room info from server
                            } else {
                                self.hub.do_send(server::CreateRoom {
                                    addr: ctx.address(),
                                });
                            }
                        }
                        Request::Offer(offer) => {
                            if let Some(room) = &self.room {
                                if let Some(id) = &self.id {
                                    self.hub.do_send(server::ToRoom {
                                        msg: responses::Response::Offer(offer),
                                        id: id.to_string(),
                                        room: room.to_string(),
                                    })
                                }
                            }
                        }
                        Request::Answer(offer) => {
                            if let Some(room) = &self.room {
                                if let Some(id) = &self.id {
                                    self.hub.do_send(server::ToRoom {
                                        msg: responses::Response::Answer(offer),
                                        id: id.to_string(),
                                        room: room.to_string(),
                                    })
                                }
                            }
                        }
                        Request::IceCandidate(ice) => {
                            if let Some(room) = &self.room {
                                if let Some(id) = &self.id {
                                    self.hub.do_send(server::ToRoom {
                                        msg: responses::Response::IceCandidate(ice),
                                        id: id.to_string(),
                                        room: room.to_string(),
                                    })
                                }
                            }
                        }
                    }
                } else {
                    log::debug!("Failed to deserialize message: {:#?}", msg)
                }
            }
            _ => {
                log::debug!("unhandled message: {:?}", msg);
            }
        }
    }
}

/// Handle messages from hub, we simply send it to peer websocket
impl Handler<responses::Response> for PlayerSession {
    type Result = ();

    fn handle(&mut self, msg: responses::Response, ctx: &mut Self::Context) {
        match msg.clone() {
            responses::Response::You(player) => {
                self.id = Some(player.id.clone());
            }
            responses::Response::RoomInfo(room) => {
                self.room = Some(room.code.clone());
            }
            _ => log::debug!("forwarding message without modification: {:?}", msg),
        }
        if let Ok(str) = serde_json::to_string(&msg) {
            ctx.text(str);
        }
    }
}

/// Helper methods
impl PlayerSession {
    pub fn new(hub: Addr<RoomServer>) -> Self {
        Self {
            id: None,
            hub,
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
                act.hub.do_send(server::Disconnect {
                    id: act.id.clone(),
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
