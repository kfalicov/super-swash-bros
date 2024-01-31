use actix::Actor;
use actix_cors::Cors;
use actix_web::{get, App, HttpResponse, HttpServer, Responder};

mod libs;
use libs::{
    api,
    socket::{server, session},
};

#[get("/")]
async fn hello() -> impl Responder {
    HttpResponse::Ok().body("Hello world!")
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    // start room server actor
    let server = server::RoomServer::default().start();

    // start TCP server in separate thread
    let srv = server.clone();
    session::tcp_server("127.0.0.1:12345", srv);

    HttpServer::new(|| {
        // TODO change allowed origin to known FE domain
        let cors = Cors::default().allow_any_origin().send_wildcard();

        App::new()
            .wrap(cors)
            .service(hello)
            .service(actix_web::web::scope("/rooms").configure(api::rooms))
    })
    .bind(("127.0.0.1", 8080))?
    .run()
    .await
}
