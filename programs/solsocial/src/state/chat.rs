use anchor_lang::prelude::*;
use std::collections::BTreeMap;

#[account]
pub struct ChatRoom {
    pub room_id: u64,
    pub creator: Pubkey,
    pub required_key_amount: u64,
    pub participants: Vec<Pubkey>,
    pub message_count: u64,
    pub created_at: i64,
    pub is_active: bool,
    pub room_type: ChatRoomType,
    pub metadata: ChatRoomMetadata,
    pub access_control: AccessControl,
    pub bump: u8,
}

#[account]
pub struct Message {
    pub message_id: u64,
    pub room_id: u64,
    pub sender: Pubkey,
    pub content: String,
    pub timestamp: i64,
    pub message_type: MessageType,
    pub reply_to: Option<u64>,
    pub reactions: BTreeMap<String, Vec<Pubkey>>,
    pub is_deleted: bool,
    pub edit_history: Vec<MessageEdit>,
    pub attachments: Vec<MessageAttachment>,
    pub bump: u8,
}

#[account]
pub struct ChatParticipant {
    pub user: Pubkey,
    pub room_id: u64,
    pub joined_at: i64,
    pub last_read_message: u64,
    pub role: ParticipantRole,
    pub permissions: ParticipantPermissions,
    pub is_muted: bool,
    pub muted_until: Option<i64>,
    pub bump: u8,
}

#[account]
pub struct ChatInvite {
    pub invite_id: u64,
    pub room_id: u64,
    pub inviter: Pubkey,
    pub invitee: Pubkey,
    pub created_at: i64,
    pub expires_at: Option<i64>,
    pub is_used: bool,
    pub invite_type: InviteType,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum ChatRoomType {
    Public,
    Private,
    KeyGated,
    Premium,
    Group,
    DirectMessage,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct ChatRoomMetadata {
    pub name: String,
    pub description: String,
    pub image_url: Option<String>,
    pub tags: Vec<String>,
    pub max_participants: Option<u32>,
    pub is_nsfw: bool,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct AccessControl {
    pub min_key_balance: u64,
    pub required_nft_collection: Option<Pubkey>,
    pub whitelist: Vec<Pubkey>,
    pub blacklist: Vec<Pubkey>,
    pub require_verification: bool,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum MessageType {
    Text,
    Image,
    Video,
    Audio,
    File,
    System,
    Trade,
    Tip,
    Poll,
    Reaction,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct MessageEdit {
    pub timestamp: i64,
    pub previous_content: String,
    pub edit_reason: Option<String>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct MessageAttachment {
    pub attachment_type: AttachmentType,
    pub url: String,
    pub filename: Option<String>,
    pub size: Option<u64>,
    pub mime_type: Option<String>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum AttachmentType {
    Image,
    Video,
    Audio,
    Document,
    Link,
    Gif,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum ParticipantRole {
    Owner,
    Admin,
    Moderator,
    Member,
    Guest,
    Restricted,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct ParticipantPermissions {
    pub can_send_messages: bool,
    pub can_send_media: bool,
    pub can_invite_users: bool,
    pub can_kick_users: bool,
    pub can_mute_users: bool,
    pub can_delete_messages: bool,
    pub can_pin_messages: bool,
    pub can_manage_room: bool,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum InviteType {
    Direct,
    Link,
    QrCode,
    Temporary,
}

impl ChatRoom {
    pub const LEN: usize = 8 + // discriminator
        8 + // room_id
        32 + // creator
        8 + // required_key_amount
        4 + (32 * 100) + // participants (max 100)
        8 + // message_count
        8 + // created_at
        1 + // is_active
        1 + // room_type
        4 + 100 + // metadata.name
        4 + 500 + // metadata.description
        1 + 4 + 200 + // metadata.image_url
        4 + (4 + 50) * 10 + // metadata.tags (max 10)
        1 + 4 + // metadata.max_participants
        1 + // metadata.is_nsfw
        8 + // access_control.min_key_balance
        1 + 32 + // access_control.required_nft_collection
        4 + (32 * 50) + // access_control.whitelist (max 50)
        4 + (32 * 50) + // access_control.blacklist (max 50)
        1 + // access_control.require_verification
        1; // bump

    pub fn new(
        room_id: u64,
        creator: Pubkey,
        required_key_amount: u64,
        room_type: ChatRoomType,
        metadata: ChatRoomMetadata,
        access_control: AccessControl,
        bump: u8,
    ) -> Self {
        Self {
            room_id,
            creator,
            required_key_amount,
            participants: vec![creator],
            message_count: 0,
            created_at: Clock::get().unwrap().unix_timestamp,
            is_active: true,
            room_type,
            metadata,
            access_control,
            bump,
        }
    }

    pub fn add_participant(&mut self, participant: Pubkey) -> Result<()> {
        if self.participants.contains(&participant) {
            return Err(error!(ChatError::ParticipantAlreadyExists));
        }

        if let Some(max_participants) = self.metadata.max_participants {
            if self.participants.len() >= max_participants as usize {
                return Err(error!(ChatError::RoomFull));
            }
        }

        self.participants.push(participant);
        Ok(())
    }

    pub fn remove_participant(&mut self, participant: Pubkey) -> Result<()> {
        let position = self.participants.iter().position(|&x| x == participant)
            .ok_or(ChatError::ParticipantNotFound)?;
        
        self.participants.remove(position);
        Ok(())
    }

    pub fn is_participant(&self, user: &Pubkey) -> bool {
        self.participants.contains(user)
    }

    pub fn increment_message_count(&mut self) {
        self.message_count += 1;
    }

    pub fn deactivate(&mut self) {
        self.is_active = false;
    }
}

impl Message {
    pub const LEN: usize = 8 + // discriminator
        8 + // message_id
        8 + // room_id
        32 + // sender
        4 + 1000 + // content (max 1000 chars)
        8 + // timestamp
        1 + // message_type
        1 + 8 + // reply_to
        4 + (4 + 10 + 4 + 32 * 10) * 10 + // reactions (max 10 types, 10 users each)
        1 + // is_deleted
        4 + (8 + 4 + 1000 + 1 + 4 + 100) * 5 + // edit_history (max 5 edits)
        4 + (1 + 4 + 200 + 1 + 4 + 100 + 1 + 8 + 1 + 4 + 50) * 5 + // attachments (max 5)
        1; // bump

    pub fn new(
        message_id: u64,
        room_id: u64,
        sender: Pubkey,
        content: String,
        message_type: MessageType,
        reply_to: Option<u64>,
        attachments: Vec<MessageAttachment>,
        bump: u8,
    ) -> Self {
        Self {
            message_id,
            room_id,
            sender,
            content,
            timestamp: Clock::get().unwrap().unix_timestamp,
            message_type,
            reply_to,
            reactions: BTreeMap::new(),
            is_deleted: false,
            edit_history: Vec::new(),
            attachments,
            bump,
        }
    }

    pub fn add_reaction(&mut self, reaction: String, user: Pubkey) -> Result<()> {
        let users = self.reactions.entry(reaction).or_insert_with(Vec::new);
        
        if users.contains(&user) {
            return Err(error!(ChatError::ReactionAlreadyExists));
        }

        users.push(user);
        Ok(())
    }

    pub fn remove_reaction(&mut self, reaction: &str, user: &Pubkey) -> Result<()> {
        if let Some(users) = self.reactions.get_mut(reaction) {
            let position = users.iter().position(|x| x == user)
                .ok_or(ChatError::ReactionNotFound)?;
            users.remove(position);
            
            if users.is_empty() {
                self.reactions.remove(reaction);
            }
        } else {
            return Err(error!(ChatError::ReactionNotFound));
        }
        
        Ok(())
    }

    pub fn edit_content(&mut self, new_content: String, edit_reason: Option<String>) -> Result<()> {
        if self.is_deleted {
            return Err(error!(ChatError::MessageDeleted));
        }

        let edit = MessageEdit {
            timestamp: Clock::get().unwrap().unix_timestamp,
            previous_content: self.content.clone(),
            edit_reason,
        };

        self.edit_history.push(edit);
        self.content = new_content;
        Ok(())
    }

    pub fn delete(&mut self) {
        self.is_deleted = true;
        self.content = "[Message deleted]".to_string();
    }

    pub fn is_system_message(&self) -> bool {
        self.message_type == MessageType::System
    }
}

impl ChatParticipant {
    pub const LEN: usize = 8 + // discriminator
        32 + // user
        8 + // room_id
        8 + // joined_at
        8 + // last_read_message
        1 + // role
        8 + // permissions (8 bools)
        1 + // is_muted
        1 + 8 + // muted_until
        1; // bump

    pub fn new(
        user: Pubkey,
        room_id: u64,
        role: ParticipantRole,
        bump: u8,
    ) -> Self {
        let permissions = match role {
            ParticipantRole::Owner => ParticipantPermissions {
                can_send_messages: true,
                can_send_media: true,
                can_invite_users: true,
                can_kick_users: true,
                can_mute_users: true,
                can_delete_messages: true,
                can_pin_messages: true,
                can_manage_room: true,
            },
            ParticipantRole::Admin => ParticipantPermissions {
                can_send_messages: true,
                can_send_media: true,
                can_invite_users: true,
                can_kick_users: true,
                can_mute_users: true,
                can_delete_messages: true,
                can_pin_messages: true,
                can_manage_room: false,
            },
            ParticipantRole::Moderator => ParticipantPermissions {
                can_send_messages: true,
                can_send_media: true,
                can_invite_users: true,
                can_kick_users: false,
                can_mute_users: true,
                can_delete_messages: true,
                can_pin_messages: true,
                can_manage_room: false,
            },
            ParticipantRole::Member => ParticipantPermissions {
                can_send_messages: true,
                can_send_media: true,
                can_invite_users: false,
                can_kick_users: false,
                can_mute_users: false,
                can_delete_messages: false,
                can_pin_messages: false,
                can_manage_room: false,
            },
            ParticipantRole::Guest => ParticipantPermissions {
                can_send_messages: true,
                can_send_media: false,
                can_invite_users: false,
                can_kick_users: false,
                can_mute_users: false,
                can_delete_messages: false,
                can_pin_messages: false,
                can_manage_room: false,
            },
            ParticipantRole::Restricted => ParticipantPermissions {
                can_send_messages: false,
                can_send_media: false,
                can_invite_users: false,
                can_kick_users: false,
                can_mute_users: false,
                can_delete_messages: false,
                can_pin_messages: false,
                can_manage_room: false,
            },
        };

        Self {
            user,
            room_id,
            joined_at: Clock::get().unwrap().unix_timestamp,
            last_read_message: 0,
            role,
            permissions,
            is_muted: false,
            muted_until: None,
            bump,
        }
    }

    pub fn update_last_read(&mut self, message_id: u64) {
        if message_id > self.last_read_message {
            self.last_read_message = message_id;
        }
    }

    pub fn mute(&mut self, duration_seconds: Option<i64>) {
        self.is_muted = true;
        if let Some(duration) = duration_seconds {
            self.muted_until = Some(Clock::get().unwrap().unix_timestamp + duration);
        }
    }

    pub fn unmute(&mut self) {
        self.is_muted = false;
        self.muted_until = None;
    }

    pub fn is_currently_muted(&self) -> bool {
        if !self.is_muted {
            return false;
        }

        if let Some(muted_until) = self