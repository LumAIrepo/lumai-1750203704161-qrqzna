use anchor_lang::prelude::*;

#[account]
pub struct UserProfile {
    pub authority: Pubkey,
    pub username: String,
    pub display_name: String,
    pub bio: String,
    pub profile_image_uri: String,
    pub banner_image_uri: String,
    pub created_at: i64,
    pub updated_at: i64,
    pub follower_count: u64,
    pub following_count: u64,
    pub post_count: u64,
    pub reputation_score: u64,
    pub total_keys_owned: u64,
    pub total_keys_sold: u64,
    pub total_revenue_earned: u64,
    pub is_verified: bool,
    pub is_active: bool,
    pub bump: u8,
}

impl UserProfile {
    pub const LEN: usize = 8 + // discriminator
        32 + // authority
        4 + 32 + // username (max 32 chars)
        4 + 64 + // display_name (max 64 chars)
        4 + 256 + // bio (max 256 chars)
        4 + 200 + // profile_image_uri (max 200 chars)
        4 + 200 + // banner_image_uri (max 200 chars)
        8 + // created_at
        8 + // updated_at
        8 + // follower_count
        8 + // following_count
        8 + // post_count
        8 + // reputation_score
        8 + // total_keys_owned
        8 + // total_keys_sold
        8 + // total_revenue_earned
        1 + // is_verified
        1 + // is_active
        1; // bump
}

#[account]
pub struct UserKey {
    pub subject: Pubkey,
    pub supply: u64,
    pub price: u64,
    pub protocol_fee_percent: u16,
    pub subject_fee_percent: u16,
    pub total_volume: u64,
    pub holder_count: u64,
    pub created_at: i64,
    pub last_trade_at: i64,
    pub is_tradeable: bool,
    pub bump: u8,
}

impl UserKey {
    pub const LEN: usize = 8 + // discriminator
        32 + // subject
        8 + // supply
        8 + // price
        2 + // protocol_fee_percent
        2 + // subject_fee_percent
        8 + // total_volume
        8 + // holder_count
        8 + // created_at
        8 + // last_trade_at
        1 + // is_tradeable
        1; // bump
}

#[account]
pub struct KeyHolder {
    pub holder: Pubkey,
    pub subject: Pubkey,
    pub amount: u64,
    pub average_price: u64,
    pub total_invested: u64,
    pub first_purchase_at: i64,
    pub last_trade_at: i64,
    pub bump: u8,
}

impl KeyHolder {
    pub const LEN: usize = 8 + // discriminator
        32 + // holder
        32 + // subject
        8 + // amount
        8 + // average_price
        8 + // total_invested
        8 + // first_purchase_at
        8 + // last_trade_at
        1; // bump
}

#[account]
pub struct SocialPost {
    pub author: Pubkey,
    pub content: String,
    pub image_uri: String,
    pub created_at: i64,
    pub updated_at: i64,
    pub like_count: u64,
    pub comment_count: u64,
    pub share_count: u64,
    pub engagement_score: u64,
    pub is_premium: bool,
    pub required_keys: u64,
    pub is_active: bool,
    pub bump: u8,
}

impl SocialPost {
    pub const LEN: usize = 8 + // discriminator
        32 + // author
        4 + 1000 + // content (max 1000 chars)
        4 + 200 + // image_uri (max 200 chars)
        8 + // created_at
        8 + // updated_at
        8 + // like_count
        8 + // comment_count
        8 + // share_count
        8 + // engagement_score
        1 + // is_premium
        8 + // required_keys
        1 + // is_active
        1; // bump
}

#[account]
pub struct PostInteraction {
    pub user: Pubkey,
    pub post: Pubkey,
    pub interaction_type: InteractionType,
    pub created_at: i64,
    pub token_weight: u64,
    pub bump: u8,
}

impl PostInteraction {
    pub const LEN: usize = 8 + // discriminator
        32 + // user
        32 + // post
        1 + // interaction_type
        8 + // created_at
        8 + // token_weight
        1; // bump
}

#[account]
pub struct ChatRoom {
    pub creator: Pubkey,
    pub name: String,
    pub description: String,
    pub required_keys: u64,
    pub member_count: u64,
    pub message_count: u64,
    pub created_at: i64,
    pub last_activity_at: i64,
    pub is_active: bool,
    pub is_private: bool,
    pub bump: u8,
}

impl ChatRoom {
    pub const LEN: usize = 8 + // discriminator
        32 + // creator
        4 + 64 + // name (max 64 chars)
        4 + 256 + // description (max 256 chars)
        8 + // required_keys
        8 + // member_count
        8 + // message_count
        8 + // created_at
        8 + // last_activity_at
        1 + // is_active
        1 + // is_private
        1; // bump
}

#[account]
pub struct ChatMessage {
    pub sender: Pubkey,
    pub room: Pubkey,
    pub content: String,
    pub created_at: i64,
    pub is_deleted: bool,
    pub bump: u8,
}

impl ChatMessage {
    pub const LEN: usize = 8 + // discriminator
        32 + // sender
        32 + // room
        4 + 500 + // content (max 500 chars)
        8 + // created_at
        1 + // is_deleted
        1; // bump
}

#[account]
pub struct FollowRelation {
    pub follower: Pubkey,
    pub following: Pubkey,
    pub created_at: i64,
    pub bump: u8,
}

impl FollowRelation {
    pub const LEN: usize = 8 + // discriminator
        32 + // follower
        32 + // following
        8 + // created_at
        1; // bump
}

#[account]
pub struct PlatformConfig {
    pub authority: Pubkey,
    pub protocol_fee_destination: Pubkey,
    pub protocol_fee_percent: u16,
    pub subject_fee_percent: u16,
    pub min_key_price: u64,
    pub max_key_price: u64,
    pub bonding_curve_coefficient: u64,
    pub reputation_decay_rate: u16,
    pub engagement_multiplier: u16,
    pub is_trading_enabled: bool,
    pub is_posting_enabled: bool,
    pub bump: u8,
}

impl PlatformConfig {
    pub const LEN: usize = 8 + // discriminator
        32 + // authority
        32 + // protocol_fee_destination
        2 + // protocol_fee_percent
        2 + // subject_fee_percent
        8 + // min_key_price
        8 + // max_key_price
        8 + // bonding_curve_coefficient
        2 + // reputation_decay_rate
        2 + // engagement_multiplier
        1 + // is_trading_enabled
        1 + // is_posting_enabled
        1; // bump
}

#[account]
pub struct RevenueShare {
    pub subject: Pubkey,
    pub total_earned: u64,
    pub total_withdrawn: u64,
    pub pending_withdrawal: u64,
    pub last_withdrawal_at: i64,
    pub bump: u8,
}

impl RevenueShare {
    pub const LEN: usize = 8 + // discriminator
        32 + // subject
        8 + // total_earned
        8 + // total_withdrawn
        8 + // pending_withdrawal
        8 + // last_withdrawal_at
        1; // bump
}

#[account]
pub struct UserBadge {
    pub user: Pubkey,
    pub badge_type: BadgeType,
    pub metadata_uri: String,
    pub earned_at: i64,
    pub is_active: bool,
    pub bump: u8,
}

impl UserBadge {
    pub const LEN: usize = 8 + // discriminator
        32 + // user
        1 + // badge_type
        4 + 200 + // metadata_uri (max 200 chars)
        8 + // earned_at
        1 + // is_active
        1; // bump
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum InteractionType {
    Like,
    Comment,
    Share,
    Tip,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum BadgeType {
    EarlyAdopter,
    TopTrader,
    Influencer,
    Creator,
    Verified,
    Premium,
    KeyHolder,
    Community,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum TradeType {
    Buy,
    Sell,
}

pub mod bonding_curve {
    use super::*;

    pub fn get_price(supply: u64, amount: u64, coefficient: u64) -> Result<u64> {
        if amount == 0 {
            return Ok(0);
        }

        let sum_1_to_supply = supply.checked_mul(supply.checked_add(1).ok_or(ErrorCode::MathOverflow)?).ok_or(ErrorCode::MathOverflow)?.checked_div(2).ok_or(ErrorCode::MathOverflow)?;
        let sum_1_to_supply_plus_amount = (supply.checked_add(amount).ok_or(ErrorCode::MathOverflow)?)
            .checked_mul((supply.checked_add(amount).ok_or(ErrorCode::MathOverflow)?).checked_add(1).ok_or(ErrorCode::MathOverflow)?)
            .ok_or(ErrorCode::MathOverflow)?
            .checked_div(2)
            .ok_or(ErrorCode::MathOverflow)?;

        let sum_of_prices = sum_1_to_supply_plus_amount.checked_sub(sum_1_to_supply).ok_or(ErrorCode::MathOverflow)?;
        
        sum_of_prices.checked_mul(coefficient).ok_or(ErrorCode::MathOverflow)?.checked_div(16000).ok_or(ErrorCode::MathOverflow)
    }

    pub fn get_buy_price(supply: u64, amount: u64, coefficient: u64) -> Result<u64> {
        get_price(supply, amount, coefficient)
    }

    pub fn get_sell_price(supply: u64, amount: u64, coefficient: u64) -> Result<u64> {
        if supply < amount {
            return Err(ErrorCode::InsufficientSupply.into());
        }
        get_price(supply.checked_sub(amount).ok_or(ErrorCode::MathOverflow)?, amount, coefficient)
    }

    pub fn get_buy_price_after_fee(supply: u64, amount: u64, coefficient: u64, protocol_fee_percent: u16, subject_fee_percent: u16) -> Result<u64> {
        let price = get_buy_price(supply, amount, coefficient)?;
        let protocol_fee = price.checked_mul(protocol_fee_percent as u64).ok_or(ErrorCode::MathOverflow)?.checked_div(10000).ok_or(ErrorCode::MathOverflow)?;
        let subject_fee = price.checked_mul(subject_fee_percent as u64).ok_or(ErrorCode::MathOverflow)?.checked_div(10000).ok_or(ErrorCode::MathOverflow)?;
        price.checked_add(protocol_fee).ok_or(ErrorCode::MathOverflow)?.checked_add(subject_fee).ok_or(ErrorCode::MathOverflow)
    }

    pub fn get_sell_price_after_fee(supply: u64, amount: u64, coefficient: u64, protocol_fee_percent: u16, subject_fee_percent: u16) -> Result<u64> {
        let price = get_sell_price(supply, amount, coefficient)?;
        let protocol_fee = price.checked_mul(protocol_fee_percent as u64).ok_or(ErrorCode::MathOverflow)?.checked_div(10000).ok_or(ErrorCode::MathOverflow)?;
        let subject_fee = price.checked_mul(subject_fee_percent as u64).ok_or(ErrorCode::MathOverflow)?.checked_div(10000).ok_or(ErrorCode::MathOverflow)?;
        price.checked_sub(protocol_fee).ok_or(ErrorCode::MathOverflow)?.checked_sub(subject_fee).ok_or(ErrorCode::MathOverflow)
    }
}

#[error_code]
pub enum ErrorCode {
    #[msg("Math overflow")]
    MathOverflow,
    #[msg("Insufficient supply")]
    InsufficientSupply,
    #[msg("Invalid amount")]
    InvalidAmount,
    #[msg("Trading disabled")]
    TradingDisabled,
    #[msg("Posting disabled")]
    PostingDisabled,
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Invalid username")]
    InvalidUsername,
    #[msg("Username already taken")]
    UsernameTaken,
    #[msg("Insufficient keys")]
    InsufficientKeys,
    #[msg("Invalid price")]
    InvalidPrice,
    #[msg("Account not found")]
    AccountNotFound,
    #[msg("Invalid interaction type")]
    InvalidInteractionType,
    #[msg("Content too long")]
    ContentTooLong,
    #[msg("Room access denied")]
    RoomAccessDenied,
    #[msg("Already following")]
    AlreadyFollowing,
    #[msg("Not following")]
    NotFollowing,
    #[msg("Cannot follow self")]
    CannotFollowSelf,
    #[msg("Insufficient balance")]
    InsufficientBalance,
    #[msg("Invalid fee percentage")]
    InvalidFeePercentage,
    #[msg("Account already initialized")]
    AccountAlreadyInitialized,
    #[msg("Invalid badge type")]
    InvalidBadgeType,
    #[msg("Badge already earned")]
    BadgeAlreadyEarned,
    #[msg("Reputation too low")]
    ReputationTooLow,
    #[msg("Invalid engagement score")]
    InvalidEngagementScore,
}