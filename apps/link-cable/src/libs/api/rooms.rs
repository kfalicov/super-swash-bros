use actix::Addr;
use actix_web::{get, post, web, HttpResponse, Responder};
use serde::Deserialize;

use crate::libs::socket::server;

// Define your payload struct
#[derive(Deserialize)]
pub struct Announcement {
    message: String,
}

#[get("")]
async fn get_rooms(srv: web::Data<Addr<server::RoomServer>>) -> impl Responder {
    HttpResponse::Ok().body("rooms response")
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
    cfg.service(get_rooms).service(announce);
}
