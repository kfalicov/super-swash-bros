use actix::prelude::*;
use actix::Actor;
use actix_cors::Cors;
use actix_web::middleware::Logger;
use actix_web::{get, web, App, Error, HttpRequest, HttpResponse, HttpServer, Responder};
use actix_web_actors::ws;

mod libs;
use libs::{
    api,
    socket::{
        server,
        session::{self, PlayerSession},
    },
};
use tokio;

#[get("/")]
async fn hello() -> impl Responder {
    HttpResponse::Ok().body("Hello world!")
}

/// Entry point for our route
async fn socket_route(
    req: HttpRequest,
    stream: web::Payload,
    srv: web::Data<Addr<server::RoomServer>>,
) -> Result<impl Responder, Error> {
    ws::start(PlayerSession::new(srv.get_ref().clone()), &req, stream)
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let rust_log = std::env::var("RUST_LOG").unwrap_or_else(|_| String::from("debug"));
    println!("RUST_LOG={}", rust_log);
    env_logger::init_from_env(env_logger::Env::new().default_filter_or(rust_log));

    // start room server actor
    let server = server::RoomServer::default().start();

    let api_server = HttpServer::new(|| {
        // TODO change allowed origin to known FE domain
        let cors = Cors::default().allow_any_origin().send_wildcard();

        App::new()
            .wrap(cors)
            .service(hello)
            .service(actix_web::web::scope("/rooms").configure(api::rooms))
    })
    .bind(("127.0.0.1", 8080))?
    .run();

    // Start the WebSocket server
    let ws_server = HttpServer::new(|| {
        App::new()
            .app_data(web::Data::new(server.clone()))
            .route("/", web::get().to(socket_route)) // WebSocket route
            .wrap(Logger::default())
    })
    .bind(("127.0.0.1", 12345))?
    .run();

    // Run both servers
    tokio::try_join!(api_server, ws_server)?;

    Ok(())
}
