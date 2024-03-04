use std::env;

use actix::prelude::*;
use actix::Actor;
use actix_web::middleware::Logger;
use actix_web::HttpResponse;
use actix_web::{web, App, Error, HttpRequest, HttpServer, Responder};
use actix_web_actors::ws;

mod libs;
use libs::{
    api,
    socket::{server, session::PlayerSession},
};
use tokio;

/// Entry point for our route
async fn socket_route(
    req: HttpRequest,
    stream: web::Payload,
    srv: web::Data<Addr<server::RoomServer>>,
) -> Result<impl Responder, Error> {
    ws::start(PlayerSession::new(srv.get_ref().clone()), &req, stream)
}

async fn default_service(req: HttpRequest) -> impl Responder {
    println!(
        "Received a request to an unknown route: {} {}",
        req.method(),
        req.path()
    );
    HttpResponse::NotFound().body("Route not found")
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let rust_log = std::env::var("RUST_LOG").unwrap_or_else(|_| String::from("debug"));
    env_logger::init_from_env(env_logger::Env::new().default_filter_or(rust_log));

    let bind_address = env::var("BIND_ADDRESS").unwrap_or_else(|_| String::from("localhost"));
    log::info!("Binding to address: {}:8080", bind_address);
    // start room server actor
    let server = server::RoomServer::default().start();

    let api_server = {
        let server = server.clone();
        HttpServer::new(move || {
            App::new()
                .app_data(web::Data::new(server.clone()))
                .service(actix_web::web::scope("/").configure(api::root))
                .service(actix_web::web::scope("/rooms").configure(api::rooms))
                .default_service(actix_web::web::route().to(default_service))
        })
        .bind((bind_address.to_owned(), 8080))?
        .run()
    };

    // Start the WebSocket server
    let ws_server = {
        let server = server.clone();
        HttpServer::new(move || {
            App::new()
                .app_data(web::Data::new(server.clone()))
                .route("/{code:.*}", web::get().to(socket_route)) // WebSocket route
                .wrap(Logger::default())
        })
        .bind((bind_address, 12345))?
        .run()
    };

    // Run both servers
    tokio::try_join!(api_server, ws_server)?;

    Ok(())
}
