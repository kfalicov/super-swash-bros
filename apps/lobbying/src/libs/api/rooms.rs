use actix::Actor;
use actix_web::{
    get,
    http::header::{self, ContentType},
    post, web, HttpResponse, Responder,
};
use actix_web_actors::ws;
use mime;
use serde::{Deserialize, Serialize};

#[derive(Serialize)]
struct Room {
    code: String,
}

#[post("/new")]
async fn create_room() -> impl Responder {
    HttpResponse::Created()
        .content_type(ContentType(mime::APPLICATION_JSON))
        .json(Room {
            code: String::from("1234"),
        })
}

#[get("/{room_id}")]
async fn join_room(path: web::Path<String>) -> impl Responder {
    let room_id = path.into_inner();
    HttpResponse::Ok()
        .insert_header(header::ContentType(mime::APPLICATION_JSON))
        .json(Room { code: room_id })
}

pub fn api(cfg: &mut web::ServiceConfig) {
    cfg.service(create_room).service(join_room);
}