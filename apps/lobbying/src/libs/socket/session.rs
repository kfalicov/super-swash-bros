//! `ClientSession` is an actor, it manages peer tcp connection and
//! proxies commands from peer to `RoomServer`.

use std::{
    io, net,
    str::FromStr,
    time::{Duration, Instant},
};

use actix::{prelude::*, spawn};
use tokio::{
    io::{split, WriteHalf},
    net::{TcpListener, TcpStream},
};
use tokio_util::codec::FramedRead;

use super::{
    codec::{ChatCodec, ChatRequest, ChatResponse},
    server::{self, RoomServer},
};

/// The message type used by this actor
#[derive(Message)]
#[rtype(result = "()")]
pub struct Message {
    /// player #
    pub p: u8,
    /// selected character
    pub c: u8,
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
    /// Framed wrapper
    framed: actix::io::FramedWrite<ChatResponse, WriteHalf<TcpStream>, ChatCodec>,
}

impl Actor for PlayerSession {
    /// For tcp communication we are going to use `FramedContext`.
    /// It is convenient wrapper around `Framed` object from `tokio_io`
    type Context = Context<Self>;

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
                    _ => ctx.stop(),
                }
                actix::fut::ready(())
            })
            .wait(ctx);
    }

    fn stopping(&mut self, _: &mut Self::Context) -> Running {
        // notify chat server
        self.addr.do_send(server::Disconnect {
            id: self.id,
            room: self.room.clone(),
        });
        Running::Stop
    }
}

impl actix::io::WriteHandler<io::Error> for PlayerSession {}

/// To use `Framed` we have to define Io type and Codec
impl StreamHandler<Result<ChatRequest, io::Error>> for PlayerSession {
    /// This is main event loop for client requests
    fn handle(&mut self, msg: Result<ChatRequest, io::Error>, ctx: &mut Context<Self>) {
        match msg {
            Ok(ChatRequest::Join(code)) => {
                // start heartbeat process when room is joined
                self.hb(ctx);

                // get address of client session
                let addr = ctx.address();
                println!("Join to room: {code}");
                self.room = code.clone();
                self.addr.do_send(server::Join {
                    addr: addr.recipient(),
                    code: code.clone(),
                });
                self.framed.write(ChatResponse::Joined(code));
            }
            Ok(ChatRequest::Message(message)) => {
                // send message to chat server
                println!("Peer message: {message}");
                self.addr.do_send(server::Message {
                    id: self.id,
                    msg: message,
                    room: self.room.clone(),
                })
            }
            // we update heartbeat time on ping from peer
            Ok(ChatRequest::Ping) => self.hb = Instant::now(),
            _ => ctx.stop(),
        }
    }
}

/// Handler for Message, chat server sends this message, we just send string to
/// peer
impl Handler<Message> for PlayerSession {
    type Result = ();

    fn handle(&mut self, msg: Message, _: &mut Context<Self>) {
        // send message to peer
        self.framed.write(ChatResponse::Message(msg.p.to_string()));
    }
}

/// Helper methods
impl PlayerSession {
    pub fn new(
        addr: Addr<RoomServer>,
        framed: actix::io::FramedWrite<ChatResponse, WriteHalf<TcpStream>, ChatCodec>,
    ) -> PlayerSession {
        PlayerSession {
            id: 0,
            addr,
            hb: Instant::now(),
            room: "main".to_owned(),
            framed,
        }
    }

    /// helper method that sends ping to client every second.
    ///
    /// also this method check heartbeats from client
    fn hb(&self, ctx: &mut Context<Self>) {
        ctx.run_interval(Duration::new(1, 0), |act, ctx| {
            // check client heartbeats
            if Instant::now().duration_since(act.hb) > Duration::new(10, 0) {
                // heartbeat timed out
                println!("Client heartbeat failed, disconnecting!");

                // notify chat server
                act.addr.do_send(server::Disconnect {
                    id: act.id,
                    room: act.room.clone(),
                });

                // stop actor
                ctx.stop();
            }

            act.framed.write(ChatResponse::Ping);
            // if we can not send message to sink, sink is closed (disconnected)
        });
    }
}

/// Define TCP server that will accept incoming TCP connection and create
/// chat actors.
pub fn tcp_server(s: &str, server: Addr<RoomServer>) {
    // Create server listener
    let addr = net::SocketAddr::from_str(s).unwrap();

    println!("Listening on {addr}");

    spawn(async move {
        let listener = TcpListener::bind(&addr).await.unwrap();

        while let Ok((stream, _)) = listener.accept().await {
            let server = server.clone();
            PlayerSession::create(|ctx| {
                let (r, w) = split(stream);
                PlayerSession::add_stream(FramedRead::new(r, ChatCodec), ctx);
                PlayerSession::new(server, actix::io::FramedWrite::new(w, ChatCodec, ctx))
            });
        }
    });
}
