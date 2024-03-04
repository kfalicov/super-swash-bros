use actix_web::{get, web, HttpResponse, Responder};

#[get("")]
async fn up() -> impl Responder {
    log::info!("server is up!");
    HttpResponse::Ok()
}

pub fn api(cfg: &mut web::ServiceConfig) {
    cfg.service(up);
}
