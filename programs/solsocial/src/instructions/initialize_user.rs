use anchor_lang::prelude::*;
use crate::state::*;
use crate::errors::*;

#[derive(Accounts)]
#[instruction(username: String)]
pub struct InitializeUser<'info> {
    #[account(
        init,
        payer = authority,
        space = UserProfile::SPACE,
        seeds = [b"user", authority.key().as_ref()],
        bump
    )]
    pub user_profile: Account<'info, UserProfile>,
    
    #[account(
        init,
        payer = authority,
        space = UserKeys::SPACE,
        seeds = [b"keys", authority.key().as_ref()],
        bump
    )]
    pub user_keys: Account<'info, UserKeys>,
    
    #[account(
        init,
        payer = authority,
        space = UserStats::SPACE,
        seeds = [b"stats", authority.key().as_ref()],
        bump
    )]
    pub user_stats: Account<'info, UserStats>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
    
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn handler(
    ctx: Context<InitializeUser>,
    username: String,
    display_name: String,
    bio: String,
    avatar_url: String,
) -> Result<()> {
    require!(username.len() >= 3 && username.len() <= 32, SolSocialError::InvalidUsername);
    require!(display_name.len() >= 1 && display_name.len() <= 64, SolSocialError::InvalidDisplayName);
    require!(bio.len() <= 280, SolSocialError::BioTooLong);
    require!(avatar_url.len() <= 200, SolSocialError::InvalidAvatarUrl);
    
    // Validate username format (alphanumeric and underscores only)
    require!(
        username.chars().all(|c| c.is_alphanumeric() || c == '_'),
        SolSocialError::InvalidUsernameFormat
    );
    
    let user_profile = &mut ctx.accounts.user_profile;
    let user_keys = &mut ctx.accounts.user_keys;
    let user_stats = &mut ctx.accounts.user_stats;
    let authority = &ctx.accounts.authority;
    
    let clock = Clock::get()?;
    
    // Initialize user profile
    user_profile.authority = authority.key();
    user_profile.username = username.clone();
    user_profile.display_name = display_name;
    user_profile.bio = bio;
    user_profile.avatar_url = avatar_url;
    user_profile.created_at = clock.unix_timestamp;
    user_profile.updated_at = clock.unix_timestamp;
    user_profile.is_verified = false;
    user_profile.is_active = true;
    user_profile.reputation_score = 100; // Starting reputation
    user_profile.influence_score = 0;
    user_profile.total_earnings = 0;
    user_profile.followers_count = 0;
    user_profile.following_count = 0;
    user_profile.posts_count = 0;
    user_profile.bump = ctx.bumps.user_profile;
    
    // Initialize user keys
    user_keys.authority = authority.key();
    user_keys.total_supply = 1_000_000_000; // 1 billion tokens with 9 decimals
    user_keys.circulating_supply = 0;
    user_keys.price = 1_000_000; // Starting price: 0.001 SOL (1M lamports)
    user_keys.market_cap = 0;
    user_keys.total_volume = 0;
    user_keys.holders_count = 0;
    user_keys.created_at = clock.unix_timestamp;
    user_keys.last_trade_at = 0;
    user_keys.is_tradeable = true;
    user_keys.creator_fee_percentage = 500; // 5% creator fee
    user_keys.platform_fee_percentage = 250; // 2.5% platform fee
    user_keys.bump = ctx.bumps.user_keys;
    
    // Initialize user stats
    user_stats.authority = authority.key();
    user_stats.total_interactions = 0;
    user_stats.total_likes_given = 0;
    user_stats.total_likes_received = 0;
    user_stats.total_comments_given = 0;
    user_stats.total_comments_received = 0;
    user_stats.total_shares_given = 0;
    user_stats.total_shares_received = 0;
    user_stats.total_tips_given = 0;
    user_stats.total_tips_received = 0;
    user_stats.total_key_trades = 0;
    user_stats.total_key_volume = 0;
    user_stats.total_revenue_earned = 0;
    user_stats.total_fees_paid = 0;
    user_stats.streak_days = 0;
    user_stats.last_active_at = clock.unix_timestamp;
    user_stats.created_at = clock.unix_timestamp;
    user_stats.bump = ctx.bumps.user_stats;
    
    // Emit user initialization event
    emit!(UserInitializedEvent {
        user: authority.key(),
        username: username,
        timestamp: clock.unix_timestamp,
        initial_key_supply: user_keys.total_supply,
        initial_price: user_keys.price,
    });
    
    msg!("User profile initialized successfully for: {}", user_profile.username);
    
    Ok(())
}

#[event]
pub struct UserInitializedEvent {
    pub user: Pubkey,
    pub username: String,
    pub timestamp: i64,
    pub initial_key_supply: u64,
    pub initial_price: u64,
}