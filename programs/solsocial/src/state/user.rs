use anchor_lang::prelude::*;
use std::collections::BTreeMap;

#[account]
#[derive(Default)]
pub struct User {
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
    pub key_supply: u64,
    pub key_price: u64,
    pub total_volume: u64,
    pub reputation_score: u64,
    pub influence_score: u64,
    pub verified: bool,
    pub premium: bool,
    pub banned: bool,
    pub key_holders: Vec<KeyHolder>,
    pub social_stats: SocialStats,
    pub revenue_stats: RevenueStats,
    pub settings: UserSettings,
    pub badges: Vec<Badge>,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Default)]
pub struct KeyHolder {
    pub holder: Pubkey,
    pub amount: u64,
    pub purchased_at: i64,
    pub last_interaction: i64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Default)]
pub struct SocialStats {
    pub total_likes_received: u64,
    pub total_likes_given: u64,
    pub total_comments_received: u64,
    pub total_comments_given: u64,
    pub total_shares_received: u64,
    pub total_shares_given: u64,
    pub engagement_rate: u64,
    pub avg_post_performance: u64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Default)]
pub struct RevenueStats {
    pub total_earned: u64,
    pub total_spent: u64,
    pub key_trade_revenue: u64,
    pub content_revenue: u64,
    pub tip_revenue: u64,
    pub subscription_revenue: u64,
    pub last_payout: i64,
    pub pending_payout: u64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Default)]
pub struct UserSettings {
    pub privacy_level: u8,
    pub notifications_enabled: bool,
    pub dm_permissions: u8,
    pub content_monetization: bool,
    pub auto_follow_back: bool,
    pub show_key_price: bool,
    pub allow_tips: bool,
    pub mature_content: bool,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Default)]
pub struct Badge {
    pub badge_type: u8,
    pub name: String,
    pub description: String,
    pub image_uri: String,
    pub earned_at: i64,
    pub rarity: u8,
}

impl User {
    pub const LEN: usize = 8 + // discriminator
        32 + // authority
        4 + 32 + // username (max 32 chars)
        4 + 64 + // display_name (max 64 chars)
        4 + 280 + // bio (max 280 chars)
        4 + 200 + // profile_image_uri
        4 + 200 + // banner_image_uri
        8 + // created_at
        8 + // updated_at
        8 + // follower_count
        8 + // following_count
        8 + // post_count
        8 + // key_supply
        8 + // key_price
        8 + // total_volume
        8 + // reputation_score
        8 + // influence_score
        1 + // verified
        1 + // premium
        1 + // banned
        4 + (1000 * (32 + 8 + 8 + 8)) + // key_holders (max 1000)
        (8 * 8) + // social_stats
        (8 * 8) + // revenue_stats
        8 + // settings
        4 + (50 * (1 + 4 + 32 + 4 + 200 + 8 + 1)) + // badges (max 50)
        1 + // bump
        100; // padding

    pub fn initialize(
        &mut self,
        authority: Pubkey,
        username: String,
        display_name: String,
        bump: u8,
        clock: &Clock,
    ) -> Result<()> {
        require!(username.len() <= 32, SolSocialError::UsernameTooLong);
        require!(display_name.len() <= 64, SolSocialError::DisplayNameTooLong);
        require!(!username.is_empty(), SolSocialError::UsernameEmpty);
        require!(Self::is_valid_username(&username), SolSocialError::InvalidUsername);

        self.authority = authority;
        self.username = username;
        self.display_name = display_name;
        self.bio = String::new();
        self.profile_image_uri = String::new();
        self.banner_image_uri = String::new();
        self.created_at = clock.unix_timestamp;
        self.updated_at = clock.unix_timestamp;
        self.follower_count = 0;
        self.following_count = 0;
        self.post_count = 0;
        self.key_supply = 0;
        self.key_price = 1_000_000; // 0.001 SOL initial price
        self.total_volume = 0;
        self.reputation_score = 100;
        self.influence_score = 0;
        self.verified = false;
        self.premium = false;
        self.banned = false;
        self.key_holders = Vec::new();
        self.social_stats = SocialStats::default();
        self.revenue_stats = RevenueStats::default();
        self.settings = UserSettings {
            privacy_level: 0,
            notifications_enabled: true,
            dm_permissions: 0,
            content_monetization: true,
            auto_follow_back: false,
            show_key_price: true,
            allow_tips: true,
            mature_content: false,
        };
        self.badges = Vec::new();
        self.bump = bump;

        Ok(())
    }

    pub fn update_profile(
        &mut self,
        display_name: Option<String>,
        bio: Option<String>,
        profile_image_uri: Option<String>,
        banner_image_uri: Option<String>,
        clock: &Clock,
    ) -> Result<()> {
        if let Some(name) = display_name {
            require!(name.len() <= 64, SolSocialError::DisplayNameTooLong);
            self.display_name = name;
        }

        if let Some(bio_text) = bio {
            require!(bio_text.len() <= 280, SolSocialError::BioTooLong);
            self.bio = bio_text;
        }

        if let Some(profile_uri) = profile_image_uri {
            require!(profile_uri.len() <= 200, SolSocialError::UriTooLong);
            self.profile_image_uri = profile_uri;
        }

        if let Some(banner_uri) = banner_image_uri {
            require!(banner_uri.len() <= 200, SolSocialError::UriTooLong);
            self.banner_image_uri = banner_uri;
        }

        self.updated_at = clock.unix_timestamp;
        Ok(())
    }

    pub fn add_key_holder(&mut self, holder: Pubkey, amount: u64, clock: &Clock) -> Result<()> {
        require!(amount > 0, SolSocialError::InvalidAmount);
        
        if let Some(existing) = self.key_holders.iter_mut().find(|kh| kh.holder == holder) {
            existing.amount = existing.amount.checked_add(amount)
                .ok_or(SolSocialError::MathOverflow)?;
            existing.last_interaction = clock.unix_timestamp;
        } else {
            require!(self.key_holders.len() < 1000, SolSocialError::TooManyKeyHolders);
            self.key_holders.push(KeyHolder {
                holder,
                amount,
                purchased_at: clock.unix_timestamp,
                last_interaction: clock.unix_timestamp,
            });
        }

        self.key_supply = self.key_supply.checked_add(amount)
            .ok_or(SolSocialError::MathOverflow)?;
        
        Ok(())
    }

    pub fn remove_key_holder(&mut self, holder: Pubkey, amount: u64) -> Result<()> {
        require!(amount > 0, SolSocialError::InvalidAmount);
        
        if let Some(pos) = self.key_holders.iter().position(|kh| kh.holder == holder) {
            let key_holder = &mut self.key_holders[pos];
            require!(key_holder.amount >= amount, SolSocialError::InsufficientKeys);
            
            key_holder.amount = key_holder.amount.checked_sub(amount)
                .ok_or(SolSocialError::MathOverflow)?;
            
            if key_holder.amount == 0 {
                self.key_holders.remove(pos);
            }
            
            self.key_supply = self.key_supply.checked_sub(amount)
                .ok_or(SolSocialError::MathOverflow)?;
        } else {
            return Err(SolSocialError::KeyHolderNotFound.into());
        }
        
        Ok(())
    }

    pub fn calculate_key_price(&self, supply: u64, amount: u64, is_buy: bool) -> Result<u64> {
        if supply == 0 && amount == 0 {
            return Ok(0);
        }

        let sum1 = if supply == 0 { 0 } else { Self::get_price_sum(supply) };
        let sum2 = Self::get_price_sum(if is_buy { 
            supply.checked_add(amount).ok_or(SolSocialError::MathOverflow)? 
        } else { 
            supply.checked_sub(amount).ok_or(SolSocialError::MathOverflow)? 
        });

        let price_diff = if sum2 > sum1 { sum2 - sum1 } else { sum1 - sum2 };
        Ok(price_diff)
    }

    fn get_price_sum(supply: u64) -> u64 {
        if supply == 0 {
            return 0;
        }
        
        // Bonding curve: price = supply^2 / 16000 + supply / 1000
        let supply_squared = supply.saturating_mul(supply);
        let term1 = supply_squared / 16000;
        let term2 = supply / 1000;
        term1.saturating_add(term2)
    }

    pub fn update_social_stats(&mut self, stat_type: SocialStatType, amount: u64, is_given: bool) -> Result<()> {
        match stat_type {
            SocialStatType::Like => {
                if is_given {
                    self.social_stats.total_likes_given = self.social_stats.total_likes_given
                        .checked_add(amount).ok_or(SolSocialError::MathOverflow)?;
                } else {
                    self.social_stats.total_likes_received = self.social_stats.total_likes_received
                        .checked_add(amount).ok_or(SolSocialError::MathOverflow)?;
                }
            },
            SocialStatType::Comment => {
                if is_given {
                    self.social_stats.total_comments_given = self.social_stats.total_comments_given
                        .checked_add(amount).ok_or(SolSocialError::MathOverflow)?;
                } else {
                    self.social_stats.total_comments_received = self.social_stats.total_comments_received
                        .checked_add(amount).ok_or(SolSocialError::MathOverflow)?;
                }
            },
            SocialStatType::Share => {
                if is_given {
                    self.social_stats.total_shares_given = self.social_stats.total_shares_given
                        .checked_add(amount).ok_or(SolSocialError::MathOverflow)?;
                } else {
                    self.social_stats.total_shares_received = self.social_stats.total_shares_received
                        .checked_add(amount).ok_or(SolSocialError::MathOverflow)?;
                }
            },
        }
        
        self.calculate_engagement_rate()?;
        self.calculate_influence_score()?;
        Ok(())
    }

    pub fn update_revenue(&mut self, revenue_type: RevenueType, amount: u64, clock: &Clock) -> Result<()> {
        self.revenue_stats.total_earned = self.revenue_stats.total_earned
            .checked_add(amount).ok_or(SolSocialError::MathOverflow)?;
        
        match revenue_type {
            RevenueType::KeyTrade => {
                self.revenue_stats.key_trade_revenue = self.revenue_stats.key_trade_revenue
                    .checked_add(amount).ok_or(SolSocialError::MathOverflow)?;
            },
            RevenueType::Content => {
                self.revenue_stats.content_revenue = self.revenue_stats.content_revenue
                    .checked_add(amount).ok_or(SolSocialError::MathOverflow)?;
            },
            RevenueType::Tip => {
                self.revenue_stats.tip_revenue = self.revenue_stats.tip_revenue
                    .checked_add(amount).ok_or(SolSocialError::MathOverflow)?;
            },
            RevenueType::Subscription => {
                self.revenue_stats.subscription_revenue = self.revenue_stats.subscription_revenue
                    .checked_add(amount).ok_or(SolSocialError::MathOverflow)?;
            },
        }
        
        self.revenue_stats.pending_payout = self.revenue_stats.pending_payout
            .checked_add(amount).ok_or(SolSocialError::MathOverflow)?;
        
        Ok(())
    }

    pub fn add_badge(&mut self, badge: Badge) -> Result<()> {
        require!(self.badges.len() < 50, SolSocialError::TooManyBadges);
        require!(!self.badges.iter().any(|b| b.name == badge.name), SolSocialError::BadgeAlreadyExists);
        
        self.badges.push(badge);
        Ok(())
    }

    pub fn increment_follower_count(&mut self) -> Result<()> {
        self.follower_count = self.follower_count.checked_add(1)
            .ok_or(SolSocialError::MathOverflow)?;
        self.calculate_influence_score()?;
        Ok(())
    }

    pub fn decrement_follower_count(&mut self) -> Result<()> {
        self.follower_count = self.follower_count.checked_sub(1)
            .ok_or(SolSocialError::MathOverflow)?;
        self.calculate_influence