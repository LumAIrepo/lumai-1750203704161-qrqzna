use anchor_lang::prelude::*;
use crate::state::*;
use crate::errors::*;

#[derive(Accounts)]
#[instruction(room_id: String, content: String)]
pub struct SendMessage<'info> {
    #[account(mut)]
    pub sender: Signer<'info>,
    
    #[account(
        seeds = [b"user", sender.key().as_ref()],
        bump = user_account.bump,
    )]
    pub user_account: Account<'info, UserAccount>,
    
    #[account(
        mut,
        seeds = [b"chat_room", room_id.as_bytes()],
        bump = chat_room.bump,
    )]
    pub chat_room: Account<'info, ChatRoom>,
    
    #[account(
        init,
        payer = sender,
        space = Message::LEN,
        seeds = [
            b"message",
            chat_room.key().as_ref(),
            &chat_room.message_count.to_le_bytes()
        ],
        bump
    )]
    pub message: Account<'info, Message>,
    
    #[account(
        mut,
        seeds = [b"user_key", chat_room.creator.as_ref()],
        bump = creator_key.bump,
    )]
    pub creator_key: Account<'info, UserKey>,
    
    #[account(
        seeds = [
            b"key_holder",
            creator_key.key().as_ref(),
            sender.key().as_ref()
        ],
        bump = key_holder.bump,
    )]
    pub key_holder: Account<'info, KeyHolder>,
    
    pub system_program: Program<'info, System>,
    pub clock: Sysvar<'info, Clock>,
}

pub fn send_message(
    ctx: Context<SendMessage>,
    room_id: String,
    content: String,
) -> Result<()> {
    let sender = &ctx.accounts.sender;
    let user_account = &mut ctx.accounts.user_account;
    let chat_room = &mut ctx.accounts.chat_room;
    let message = &mut ctx.accounts.message;
    let creator_key = &ctx.accounts.creator_key;
    let key_holder = &ctx.accounts.key_holder;
    let clock = &ctx.accounts.clock;

    // Validate room ID length
    require!(
        room_id.len() <= 32,
        SolSocialError::RoomIdTooLong
    );

    // Validate content length
    require!(
        content.len() > 0 && content.len() <= 500,
        SolSocialError::InvalidMessageLength
    );

    // Check if chat room is active
    require!(
        chat_room.is_active,
        SolSocialError::ChatRoomInactive
    );

    // Verify sender has access to this chat room
    require!(
        key_holder.amount > 0,
        SolSocialError::InsufficientKeyBalance
    );

    // Check if user is not banned from the room
    require!(
        !chat_room.banned_users.contains(&sender.key()),
        SolSocialError::UserBannedFromRoom
    );

    // Rate limiting check - max 10 messages per minute
    let current_time = clock.unix_timestamp;
    let time_window = 60; // 1 minute
    let max_messages_per_window = 10;

    if let Some(last_message_time) = user_account.last_message_time {
        if current_time - last_message_time < time_window {
            user_account.messages_in_window += 1;
            require!(
                user_account.messages_in_window <= max_messages_per_window,
                SolSocialError::RateLimitExceeded
            );
        } else {
            user_account.messages_in_window = 1;
        }
    } else {
        user_account.messages_in_window = 1;
    }

    // Initialize message
    message.id = chat_room.message_count;
    message.sender = sender.key();
    message.chat_room = chat_room.key();
    message.content = content.clone();
    message.timestamp = current_time;
    message.is_deleted = false;
    message.reply_to = None;
    message.reactions = Vec::new();
    message.bump = *ctx.bumps.get("message").unwrap();

    // Update chat room
    chat_room.message_count += 1;
    chat_room.last_message_time = current_time;
    chat_room.last_message_sender = sender.key();

    // Update user account
    user_account.last_message_time = Some(current_time);
    user_account.total_messages_sent += 1;

    // Update user reputation based on key holdings
    let reputation_boost = if key_holder.amount >= 10 {
        5
    } else if key_holder.amount >= 5 {
        3
    } else {
        1
    };
    
    user_account.reputation_score = user_account.reputation_score
        .saturating_add(reputation_boost);

    // Emit message sent event
    emit!(MessageSentEvent {
        message_id: message.id,
        sender: sender.key(),
        chat_room: chat_room.key(),
        content: content.clone(),
        timestamp: current_time,
        sender_key_balance: key_holder.amount,
    });

    // Update creator key activity metrics
    let creator_key = &mut ctx.accounts.creator_key;
    creator_key.total_messages += 1;
    creator_key.last_activity = current_time;

    msg!("Message sent successfully in room: {}", room_id);
    
    Ok(())
}

#[event]
pub struct MessageSentEvent {
    pub message_id: u64,
    pub sender: Pubkey,
    pub chat_room: Pubkey,
    pub content: String,
    pub timestamp: i64,
    pub sender_key_balance: u64,
}