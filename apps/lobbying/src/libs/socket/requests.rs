use actix::Message;
use serde::{Deserialize, Serialize};

/// The message type for player decisions
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct PlayerChoice {
    /// selected character
    pub c: u8,
}

/// The message type for player joining a room
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Join {
    pub code: String,
}

/// The message type used for requesting a new room
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Create {}

/// client-session messaging- main message structure received from the client
#[derive(Message, Serialize, Deserialize, Clone, Debug)]
#[rtype(result = "()")]
#[serde(tag = "cmd")]
pub enum Request {
    #[serde(rename = "choice")]
    PlayerChoice(PlayerChoice),

    #[serde(rename = "join")]
    Join(Join),

    #[serde(rename = "create")]
    Create(Create),
}
