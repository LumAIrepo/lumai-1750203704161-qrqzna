use anchor_lang::prelude::*;
use crate::state::*;
use crate::errors::*;

#[derive(Accounts)]
#[instruction(chat_id: String)]
pub struct CreateChat<'info> {
    #[account(
        init,
        payer = creator,
        space = Chat::SPACE,
        seeds = [b"chat", creator.key().as_ref(), chat_id.as_bytes()],
        bump
    )]
    pub chat: Account<'info, Chat>,

    #[account(
        mut,
        seeds = [b"user", creator.key().as_ref()],
        bump = user_profile.bump,
        constraint = user_profile.owner == creator.key() @ SolSocialError::UnauthorizedUser
    )]
    pub user_profile: Account<'info, UserProfile>,

    #[account(
        seeds = [b"user_keys", user_profile.key().as_ref()],
        bump = user_keys.bump
    )]
    pub user_keys: Account<'info, UserKeys>,

    #[account(mut)]
    pub creator: Signer<'info>,

    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn create_chat(
    ctx: Context<CreateChat>,
    chat_id: String,
    name: String,
    description: String,
    is_private: bool,
    required_keys: u64,
    max_participants: u32,
) -> Result<()> {
    require!(chat_id.len() <= 32, SolSocialError::ChatIdTooLong);
    require!(name.len() <= 64, SolSocialError::ChatNameTooLong);
    require!(description.len() <= 256, SolSocialError::ChatDescriptionTooLong);
    require!(max_participants > 0 && max_participants <= 1000, SolSocialError::InvalidMaxParticipants);
    
    if is_private {
        require!(required_keys > 0, SolSocialError::PrivateChatRequiresKeys);
    }

    let chat = &mut ctx.accounts.chat;
    let user_profile = &mut ctx.accounts.user_profile;
    let user_keys = &ctx.accounts.user_keys;
    let creator = &ctx.accounts.creator;

    // Verify creator has sufficient reputation for chat creation
    require!(
        user_profile.reputation_score >= 100,
        SolSocialError::InsufficientReputation
    );

    // Initialize chat account
    chat.chat_id = chat_id.clone();
    chat.name = name.clone();
    chat.description = description.clone();
    chat.creator = creator.key();
    chat.is_private = is_private;
    chat.required_keys = required_keys;
    chat.max_participants = max_participants;
    chat.participant_count = 1; // Creator is first participant
    chat.message_count = 0;
    chat.created_at = Clock::get()?.unix_timestamp;
    chat.last_activity = Clock::get()?.unix_timestamp;
    chat.is_active = true;
    chat.bump = ctx.bumps.chat;

    // Add creator as first participant
    chat.participants.push(creator.key());

    // Update user profile stats
    user_profile.chats_created = user_profile.chats_created.saturating_add(1);
    user_profile.last_activity = Clock::get()?.unix_timestamp;

    // Emit event
    emit!(ChatCreatedEvent {
        chat: chat.key(),
        chat_id: chat_id.clone(),
        creator: creator.key(),
        name: name.clone(),
        is_private,
        required_keys,
        max_participants,
        timestamp: Clock::get()?.unix_timestamp,
    });

    msg!("Chat created: {} by {}", name, creator.key());

    Ok(())
}

#[event]
pub struct ChatCreatedEvent {
    pub chat: Pubkey,
    pub chat_id: String,
    pub creator: Pubkey,
    pub name: String,
    pub is_private: bool,
    pub required_keys: u64,
    pub max_participants: u32,
    pub timestamp: i64,
}