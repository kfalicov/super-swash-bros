use actix_cors::Cors;
use actix_web::{
    get,
    http::header::{self, ContentType},
    post,
    rt::System,
    web, App, HttpResponse, HttpServer, Responder,
};
use mime;
use serde::{Deserialize, Serialize};

#[derive(Serialize)]
struct Room {
    code: String,
}

#[get("/")]
async fn hello() -> impl Responder {
    HttpResponse::Ok().body("Hello world!")
}

#[post("/rooms/new")]
async fn create_room() -> impl Responder {
    HttpResponse::Created()
        .content_type(ContentType(mime::APPLICATION_JSON))
        .json(Room {
            code: String::from("1234"),
        })
}

#[get("/rooms/{room_id}")]
async fn join_room(path: web::Path<String>) -> impl Responder {
    let room_id = path.into_inner();
    HttpResponse::Ok()
        .insert_header(header::ContentType(mime::APPLICATION_JSON))
        .json(Room { code: room_id })
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    HttpServer::new(|| {
        let cors = Cors::default().allow_any_origin().send_wildcard();
        App::new()
            .wrap(cors)
            .service(hello)
            .service(create_room)
            .service(join_room)
    })
    .bind(("127.0.0.1", 8080))?
    .run()
    .await
}
