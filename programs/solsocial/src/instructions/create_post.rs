use anchor_lang::prelude::*;
use crate::state::*;
use crate::errors::*;

#[derive(Accounts)]
#[instruction(content: String, media_urls: Vec<String>)]
pub struct CreatePost<'info> {
    #[account(
        init,
        payer = user,
        space = Post::SPACE + content.len() + media_urls.iter().map(|url| url.len()).sum::<usize>() + 100,
        seeds = [b"post", user.key().as_ref(), &user_profile.post_count.to_le_bytes()],
        bump
    )]
    pub post: Account<'info, Post>,

    #[account(
        mut,
        seeds = [b"user_profile", user.key().as_ref()],
        bump = user_profile.bump,
        constraint = user_profile.owner == user.key() @ SolSocialError::UnauthorizedUser
    )]
    pub user_profile: Account<'info, UserProfile>,

    #[account(
        mut,
        seeds = [b"platform_state"],
        bump = platform_state.bump
    )]
    pub platform_state: Account<'info, PlatformState>,

    #[account(mut)]
    pub user: Signer<'info>,

    pub system_program: Program<'info, System>,
    pub clock: Sysvar<'info, Clock>,
}

pub fn create_post(
    ctx: Context<CreatePost>,
    content: String,
    media_urls: Vec<String>,
    post_type: PostType,
    reply_to: Option<Pubkey>,
    tags: Vec<String>,
) -> Result<()> {
    let clock = &ctx.accounts.clock;
    let current_timestamp = clock.unix_timestamp;

    // Validate content length
    require!(
        content.len() >= 1 && content.len() <= 2000,
        SolSocialError::InvalidContentLength
    );

    // Validate media URLs count
    require!(
        media_urls.len() <= 10,
        SolSocialError::TooManyMediaUrls
    );

    // Validate each media URL length
    for url in &media_urls {
        require!(
            url.len() <= 200,
            SolSocialError::MediaUrlTooLong
        );
    }

    // Validate tags
    require!(
        tags.len() <= 20,
        SolSocialError::TooManyTags
    );

    for tag in &tags {
        require!(
            tag.len() >= 1 && tag.len() <= 50,
            SolSocialError::InvalidTagLength
        );
    }

    // Validate reply_to if it's a reply
    if post_type == PostType::Reply {
        require!(
            reply_to.is_some(),
            SolSocialError::ReplyMissingParent
        );
    }

    // Check user reputation for posting limits
    let user_profile = &mut ctx.accounts.user_profile;
    require!(
        user_profile.reputation >= 0,
        SolSocialError::InsufficientReputation
    );

    // Rate limiting based on reputation
    let time_since_last_post = current_timestamp - user_profile.last_post_timestamp;
    let min_interval = match user_profile.reputation {
        0..=100 => 300,      // 5 minutes for new users
        101..=500 => 60,     // 1 minute for established users
        501..=1000 => 30,    // 30 seconds for reputable users
        _ => 10,             // 10 seconds for highly reputable users
    };

    require!(
        time_since_last_post >= min_interval,
        SolSocialError::PostingTooFrequently
    );

    // Initialize post
    let post = &mut ctx.accounts.post;
    post.author = ctx.accounts.user.key();
    post.content = content;
    post.media_urls = media_urls;
    post.post_type = post_type;
    post.reply_to = reply_to;
    post.tags = tags;
    post.timestamp = current_timestamp;
    post.likes = 0;
    post.reposts = 0;
    post.replies = 0;
    post.tips_received = 0;
    post.engagement_score = 0;
    post.is_pinned = false;
    post.is_deleted = false;
    post.bump = *ctx.bumps.get("post").unwrap();

    // Update user profile
    user_profile.post_count += 1;
    user_profile.last_post_timestamp = current_timestamp;
    
    // Increase reputation for posting (small amount)
    user_profile.reputation += 1;

    // Update platform statistics
    let platform_state = &mut ctx.accounts.platform_state;
    platform_state.total_posts += 1;

    // Calculate initial engagement score based on user reputation
    let initial_score = (user_profile.reputation as f64 * 0.1) as u64;
    post.engagement_score = initial_score;

    // Emit event
    emit!(PostCreated {
        post_id: post.key(),
        author: post.author,
        content: post.content.clone(),
        post_type: post.post_type,
        timestamp: post.timestamp,
        reply_to: post.reply_to,
        tags: post.tags.clone(),
    });

    msg!("Post created successfully by user: {}", ctx.accounts.user.key());
    msg!("Post ID: {}", post.key());
    msg!("Content length: {} characters", post.content.len());
    msg!("Media URLs: {}", post.media_urls.len());
    msg!("Tags: {:?}", post.tags);

    Ok(())
}

#[event]
pub struct PostCreated {
    pub post_id: Pubkey,
    pub author: Pubkey,
    pub content: String,
    pub post_type: PostType,
    pub timestamp: i64,
    pub reply_to: Option<Pubkey>,
    pub tags: Vec<String>,
}