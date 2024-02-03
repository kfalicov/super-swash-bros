use actix::prelude::*;
use serde::Serialize;

#[derive(Serialize, Clone)]
pub struct Player {
    pub id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub c: Option<u8>,
}

#[derive(Serialize)]
pub struct RoomInfo {
    pub code: String,
    pub players: Vec<Player>,
}

#[derive(Serialize)]
pub struct Chat {
    pub msg: String,
}

/// client-session messaging- main message structure received from the client
#[derive(Message, Serialize)]
#[rtype(result = "()")]
#[serde(tag = "cmd")]
pub enum Response {
    #[serde(rename = "room")]
    RoomInfo(RoomInfo),
    #[serde(rename = "you")]
    You(Player),
    #[serde(rename = "player")]
    Player(Player),
    #[serde(rename = "chat")]
    Chat(Chat),
    #[serde(rename = "alert")]
    Alert(Chat),
}
