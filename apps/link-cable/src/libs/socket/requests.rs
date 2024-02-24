use actix::Message;
use serde::{Deserialize, Serialize};
use serde_json::Value;

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

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct SDPOffer {
    pub r#type: String,
    pub sdp: String,
}

/// The message type used for webRTC peer connection
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Offer {
    pub offer: SDPOffer,
}

/// The message type used for webRTC peer connection
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct IceCandidate {
    pub candidate: Value,
}

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

    #[serde(rename = "offer")]
    Offer(Offer),
    #[serde(rename = "answer")]
    Answer(Offer),

    #[serde(rename = "ice")]
    IceCandidate(IceCandidate),
}
