use anchor_lang::prelude::*;
use crate::constants::*;
use crate::errors::SolSocialError;

#[account]
pub struct Post {
    pub id: u64,
    pub author: Pubkey,
    pub content: String,
    pub content_hash: [u8; 32],
    pub timestamp: i64,
    pub likes: u64,
    pub reposts: u64,
    pub replies: u64,
    pub token_weight: u64,
    pub engagement_score: u64,
    pub is_premium: bool,
    pub required_keys: u64,
    pub reply_to: Option<u64>,
    pub media_urls: Vec<String>,
    pub tags: Vec<String>,
    pub mentions: Vec<Pubkey>,
    pub visibility: PostVisibility,
    pub status: PostStatus,
    pub bump: u8,
}

impl Post {
    pub const LEN: usize = 8 + // discriminator
        8 + // id
        32 + // author
        4 + MAX_CONTENT_LENGTH + // content
        32 + // content_hash
        8 + // timestamp
        8 + // likes
        8 + // reposts
        8 + // replies
        8 + // token_weight
        8 + // engagement_score
        1 + // is_premium
        8 + // required_keys
        1 + 8 + // reply_to (Option<u64>)
        4 + (MAX_MEDIA_URLS * (4 + MAX_URL_LENGTH)) + // media_urls
        4 + (MAX_TAGS * (4 + MAX_TAG_LENGTH)) + // tags
        4 + (MAX_MENTIONS * 32) + // mentions
        1 + // visibility
        1 + // status
        1; // bump

    pub fn initialize(
        &mut self,
        id: u64,
        author: Pubkey,
        content: String,
        content_hash: [u8; 32],
        timestamp: i64,
        is_premium: bool,
        required_keys: u64,
        reply_to: Option<u64>,
        media_urls: Vec<String>,
        tags: Vec<String>,
        mentions: Vec<Pubkey>,
        visibility: PostVisibility,
        bump: u8,
    ) -> Result<()> {
        require!(content.len() <= MAX_CONTENT_LENGTH, SolSocialError::ContentTooLong);
        require!(media_urls.len() <= MAX_MEDIA_URLS, SolSocialError::TooManyMediaUrls);
        require!(tags.len() <= MAX_TAGS, SolSocialError::TooManyTags);
        require!(mentions.len() <= MAX_MENTIONS, SolSocialError::TooManyMentions);
        
        for url in &media_urls {
            require!(url.len() <= MAX_URL_LENGTH, SolSocialError::UrlTooLong);
        }
        
        for tag in &tags {
            require!(tag.len() <= MAX_TAG_LENGTH, SolSocialError::TagTooLong);
        }

        self.id = id;
        self.author = author;
        self.content = content;
        self.content_hash = content_hash;
        self.timestamp = timestamp;
        self.likes = 0;
        self.reposts = 0;
        self.replies = 0;
        self.token_weight = 0;
        self.engagement_score = 0;
        self.is_premium = is_premium;
        self.required_keys = required_keys;
        self.reply_to = reply_to;
        self.media_urls = media_urls;
        self.tags = tags;
        self.mentions = mentions;
        self.visibility = visibility;
        self.status = PostStatus::Active;
        self.bump = bump;

        Ok(())
    }

    pub fn like(&mut self) -> Result<()> {
        require!(self.status == PostStatus::Active, SolSocialError::PostNotActive);
        
        self.likes = self.likes.checked_add(1).ok_or(SolSocialError::MathOverflow)?;
        self.update_engagement_score()?;
        
        Ok(())
    }

    pub fn unlike(&mut self) -> Result<()> {
        require!(self.status == PostStatus::Active, SolSocialError::PostNotActive);
        require!(self.likes > 0, SolSocialError::CannotUnlikeZeroLikes);
        
        self.likes = self.likes.checked_sub(1).ok_or(SolSocialError::MathUnderflow)?;
        self.update_engagement_score()?;
        
        Ok(())
    }

    pub fn repost(&mut self) -> Result<()> {
        require!(self.status == PostStatus::Active, SolSocialError::PostNotActive);
        
        self.reposts = self.reposts.checked_add(1).ok_or(SolSocialError::MathOverflow)?;
        self.update_engagement_score()?;
        
        Ok(())
    }

    pub fn add_reply(&mut self) -> Result<()> {
        require!(self.status == PostStatus::Active, SolSocialError::PostNotActive);
        
        self.replies = self.replies.checked_add(1).ok_or(SolSocialError::MathOverflow)?;
        self.update_engagement_score()?;
        
        Ok(())
    }

    pub fn update_token_weight(&mut self, weight: u64) -> Result<()> {
        self.token_weight = weight;
        self.update_engagement_score()?;
        
        Ok(())
    }

    pub fn update_engagement_score(&mut self) -> Result<()> {
        let like_weight = self.likes.checked_mul(LIKE_WEIGHT).ok_or(SolSocialError::MathOverflow)?;
        let repost_weight = self.reposts.checked_mul(REPOST_WEIGHT).ok_or(SolSocialError::MathOverflow)?;
        let reply_weight = self.replies.checked_mul(REPLY_WEIGHT).ok_or(SolSocialError::MathOverflow)?;
        let token_weight = self.token_weight.checked_mul(TOKEN_WEIGHT).ok_or(SolSocialError::MathOverflow)?;
        
        let total_engagement = like_weight
            .checked_add(repost_weight).ok_or(SolSocialError::MathOverflow)?
            .checked_add(reply_weight).ok_or(SolSocialError::MathOverflow)?
            .checked_add(token_weight).ok_or(SolSocialError::MathOverflow)?;
        
        let time_decay = self.calculate_time_decay()?;
        self.engagement_score = total_engagement
            .checked_mul(time_decay).ok_or(SolSocialError::MathOverflow)?
            .checked_div(100).ok_or(SolSocialError::MathDivisionByZero)?;
        
        Ok(())
    }

    pub fn calculate_time_decay(&self) -> Result<u64> {
        let current_time = Clock::get()?.unix_timestamp;
        let age_hours = (current_time - self.timestamp) / 3600;
        
        if age_hours < 0 {
            return Ok(100);
        }
        
        let decay_factor = match age_hours {
            0..=1 => 100,
            2..=6 => 95,
            7..=24 => 85,
            25..=72 => 70,
            73..=168 => 50,
            169..=720 => 30,
            _ => 10,
        };
        
        Ok(decay_factor)
    }

    pub fn can_view(&self, viewer: &Pubkey, viewer_keys: u64) -> bool {
        match self.visibility {
            PostVisibility::Public => true,
            PostVisibility::KeyHolders => viewer_keys >= self.required_keys,
            PostVisibility::Private => self.author == *viewer,
            PostVisibility::Followers => false, // Would need follower check
        }
    }

    pub fn moderate(&mut self, status: PostStatus) -> Result<()> {
        require!(
            status == PostStatus::Hidden || status == PostStatus::Removed,
            SolSocialError::InvalidModerationAction
        );
        
        self.status = status;
        Ok(())
    }

    pub fn restore(&mut self) -> Result<()> {
        require!(
            self.status == PostStatus::Hidden || self.status == PostStatus::Removed,
            SolSocialError::PostNotModerated
        );
        
        self.status = PostStatus::Active;
        Ok(())
    }

    pub fn is_reply(&self) -> bool {
        self.reply_to.is_some()
    }

    pub fn has_media(&self) -> bool {
        !self.media_urls.is_empty()
    }

    pub fn has_tags(&self) -> bool {
        !self.tags.is_empty()
    }

    pub fn has_mentions(&self) -> bool {
        !self.mentions.is_empty()
    }

    pub fn get_age_hours(&self) -> Result<i64> {
        let current_time = Clock::get()?.unix_timestamp;
        Ok((current_time - self.timestamp) / 3600)
    }

    pub fn is_trending(&self) -> Result<bool> {
        let age_hours = self.get_age_hours()?;
        Ok(age_hours <= 24 && self.engagement_score >= TRENDING_THRESHOLD)
    }

    pub fn calculate_virality_score(&self) -> Result<u64> {
        let age_hours = self.get_age_hours()?;
        if age_hours <= 0 {
            return Ok(0);
        }
        
        let engagement_per_hour = self.engagement_score
            .checked_div(age_hours as u64)
            .ok_or(SolSocialError::MathDivisionByZero)?;
        
        let virality_multiplier = if self.is_premium { 150 } else { 100 };
        
        engagement_per_hour
            .checked_mul(virality_multiplier)
            .ok_or(SolSocialError::MathOverflow)
            .map(|score| score / 100)
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum PostVisibility {
    Public,
    KeyHolders,
    Private,
    Followers,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum PostStatus {
    Active,
    Hidden,
    Removed,
    Archived,
}

#[account]
pub struct PostInteraction {
    pub post_id: u64,
    pub user: Pubkey,
    pub interaction_type: InteractionType,
    pub timestamp: i64,
    pub token_amount: u64,
    pub bump: u8,
}

impl PostInteraction {
    pub const LEN: usize = 8 + // discriminator
        8 + // post_id
        32 + // user
        1 + // interaction_type
        8 + // timestamp
        8 + // token_amount
        1; // bump

    pub fn initialize(
        &mut self,
        post_id: u64,
        user: Pubkey,
        interaction_type: InteractionType,
        timestamp: i64,
        token_amount: u64,
        bump: u8,
    ) -> Result<()> {
        self.post_id = post_id;
        self.user = user;
        self.interaction_type = interaction_type;
        self.timestamp = timestamp;
        self.token_amount = token_amount;
        self.bump = bump;
        
        Ok(())
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum InteractionType {
    Like,
    Unlike,
    Repost,
    Reply,
    Tip,
    Share,
}

#[account]
pub struct PostStats {
    pub post_id: u64,
    pub total_likes: u64,
    pub total_reposts: u64,
    pub total_replies: u64,
    pub total_tips: u64,
    pub total_tip_amount: u64,
    pub unique_viewers: u64,
    pub total_views: u64,
    pub peak_engagement_hour: i64,
    pub last_updated: i64,
    pub bump: u8,
}

impl PostStats {
    pub const LEN: usize = 8 + // discriminator
        8 + // post_id
        8 + // total_likes
        8 + // total_reposts
        8 + // total_replies
        8 + // total_tips
        8 + // total_tip_amount
        8 + // unique_viewers
        8 + // total_views
        8 + // peak_engagement_hour
        8 + // last_updated
        1; // bump

    pub fn initialize(&mut self, post_id: u64, bump: u8) -> Result<()> {
        self.post_id = post_id;
        self.total_likes = 0;
        self.total_reposts = 0;
        self.total_replies = 0;
        self.total_tips = 0;
        self.total_tip_amount = 0;
        self.unique_viewers = 0;
        self.total_views = 0;
        self.peak_engagement_hour = 0;
        self.last_updated = Clock::get()?.unix_timestamp;
        self.bump = bump;
        
        Ok(())
    }

    pub fn update_stats(
        &mut self,
        interaction_type: &InteractionType,
        amount: u64,
    ) -> Result<()> {
        match interaction_type {
            InteractionType::Like => {
                self.total_likes = self.total_likes.checked_add(1).ok_or(SolSocialError::MathOverflow)?;
            }
            InteractionType::Unlike => {
                if self.total_likes > 0 {
                    self.total_likes = self.total_likes.checked_sub(1).ok_or(SolSocialError::MathUnderflow)?;
                }
            }
            InteractionType::Repost => {
                self.total_reposts = self.total_reposts.checked_add(1).ok_or(SolSocialError::MathOverflow)?;
            }
            InteractionType::Reply => {
                self.total_replies = self.total_replies.checked_add(1).ok_or(SolSocialError::MathOverflow)?;
            }
            InteractionType::Tip => {
                self.total_tips = self.total_tips.checked_add(1).ok_or(SolSocialError::MathOverflow)?;
                self.total_tip_amount = self.total_tip_amount.checked_add(amount).ok_or(SolSocialError::MathOverflow)?;
            }
            _ => {}
        }
        
        self.last_updated = Clock::get()?.unix_timestamp;
        Ok(())
    }

    pub fn add_view(&mut self, is_unique: bool) -> Result<()> {
        self.total_views = self.total_views.checked_add(1).ok_or(SolSocialError::MathOverflow)?;
        
        if is_unique {
            self.unique_