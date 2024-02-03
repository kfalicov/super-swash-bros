use actix::Addr;
use actix_web::{post, web, HttpResponse, Responder};
use serde::Deserialize;

use crate::libs::socket::server;

// Define your payload struct
#[derive(Deserialize)]
pub struct Announcement {
    message: String,
}

#[post("/announce")]
async fn announce(
    srv: web::Data<Addr<server::RoomServer>>,
    announcement: web::Json<Announcement>,
) -> impl Responder {
    // Send a message to the RoomServer to broadcast to the room
    srv.do_send(server::Broadcast::all(announcement.message.clone()));

    HttpResponse::Ok()
}

pub fn api(cfg: &mut web::ServiceConfig) {
    cfg.service(announce);
}
