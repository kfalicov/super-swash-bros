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

use super::responses::{self, Player};
use super::server::{self, RoomServer};

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

        //If the player starts with a room code already present, join that room
        if let Some(code) = &self.room {
            self.join_room(ctx, code.to_owned())
        }
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
                        Request::PlayerChoice(_p) => {}
                        Request::Join(j) => {
                            let Join { code } = j;
                            self.join_room(ctx, code);
                        }
                        Request::Create(_) => {
                            if let Some(room) = &self.room {
                                //session is already part of a room
                                let msg = responses::Response::RoomInfo(RoomInfo {
                                    //TODO get players of the room in case there are any
                                    players: Vec::new(),
                                    code: room.to_owned(),
                                });
                                if let Ok(str) = serde_json::to_string(&msg) {
                                    ctx.text(str);
                                }
                            } else {
                                let future = self.hub.send(server::CreateRoom {});
                                ctx.spawn(future.into_actor(self).then(|res, act, ctx| {
                                    match res {
                                        Ok(code) => act.join_room(ctx, code),
                                        _ => ctx.text("Failed to create room"),
                                    }
                                    actix::fut::ready(())
                                }));
                            }
                        }
                    }
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
        if let Ok(str) = serde_json::to_string(&msg) {
            ctx.text(str);
        }
    }
}

/// Helper methods
impl PlayerSession {
    pub fn new(hub: Addr<RoomServer>, code: Option<&str>) -> Self {
        Self {
            id: None,
            hub,
            hb: Instant::now(),
            room: code.map(|s| s.to_owned()),
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

    /// asynchronously request to join a room
    /// and update self with the room ID and session ID if successful
    fn join_room(&mut self, ctx: &mut <Self as Actor>::Context, code: String) {
        let future = self
            .hub
            .send(server::JoinRoom {
                addr: ctx.address(),
                code: code.to_owned(),
            })
            .into_actor(self)
            .then(|res, act, ctx| {
                match res {
                    Ok(hash) => {
                        act.id = Some(hash.clone());
                        if let Ok(msg) = serde_json::to_string(&responses::Response::You(Player {
                            id: hash,
                            c: None,
                        })) {
                            ctx.text(msg);
                        }
                    }
                    _ => (),
                }
                actix::fut::ready(())
            });

        ctx.spawn(future);
    }
}
