use actix::prelude::*;
use actix::Actor;
use actix_cors::Cors;
use actix_web::http::header;
use actix_web::middleware::Logger;
use actix_web::{get, web, App, Error, HttpRequest, HttpResponse, HttpServer, Responder};
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
    let code_option = req.match_info().get("code");
    let code = match code_option {
        Some("") | None => None,
        c => c,
    };
    log::info!("code: {:?}", code);
    ws::start(
        PlayerSession::new(srv.get_ref().clone(), code),
        &req,
        stream,
    )
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let rust_log = std::env::var("RUST_LOG").unwrap_or_else(|_| String::from("debug"));
    println!("RUST_LOG={}", rust_log);
    env_logger::init_from_env(env_logger::Env::new().default_filter_or(rust_log));

    // start room server actor
    let server = server::RoomServer::default().start();

    let api_server = {
        let server = server.clone();
        HttpServer::new(move || {
            // TODO change allowed origin to known FE domain
            let cors = Cors::default()
                .allowed_origin("http://localhost:4200")
                .allowed_methods(vec!["GET", "POST", "OPTIONS"])
                .allowed_headers(vec![
                    header::AUTHORIZATION,
                    header::ACCEPT,
                    header::CONTENT_TYPE,
                ]);

            App::new()
                .app_data(web::Data::new(server.clone()))
                .wrap(cors)
                .service(actix_web::web::scope("/rooms").configure(api::rooms))
        })
        .bind(("localhost", 8080))?
        .run()
    };

    // Start the WebSocket server
    let ws_server = {
        let server = server.clone();
        HttpServer::new(move || {
            // TODO change allowed origin to known FE domain
            let cors = Cors::default().allowed_origin("http://localhost:4200");
            App::new()
                .app_data(web::Data::new(server.clone()))
                .wrap(cors)
                .route("/{code:.*}", web::get().to(socket_route)) // WebSocket route
                .wrap(Logger::default())
        })
        .bind(("localhost", 12345))?
        .run()
    };

    // Run both servers
    tokio::try_join!(api_server, ws_server)?;

    Ok(())
}
