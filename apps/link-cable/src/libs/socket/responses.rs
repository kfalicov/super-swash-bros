use actix::prelude::*;
use serde::Serialize;
use typeshare::typeshare;

use super::requests::{IceCandidate, Offer};

#[derive(Serialize, Clone, Debug)]
#[typeshare]
pub struct Player {
    pub id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub c: Option<u8>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub i: Option<usize>,
}

#[derive(Serialize, Clone, Debug)]
#[typeshare]
pub struct RoomInfo {
    pub code: String,
    pub players: Vec<Option<Player>>,
}

#[derive(Serialize, Clone, Debug)]
#[typeshare]
pub struct Chat {
    pub msg: String,
}

/// client-session messaging- main message structure received from the client
#[derive(Message, Serialize, Clone, Debug)]
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
    #[serde(rename = "offer")]
    Offer(Offer),
    #[serde(rename = "answer")]
    Answer(Offer),
    #[serde(rename = "ice")]
    IceCandidate(IceCandidate),
}
