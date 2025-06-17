use anchor_lang::prelude::*;
use crate::state::*;
use crate::errors::*;

#[derive(Accounts)]
#[instruction(interaction_type: u8)]
pub struct InteractPost<'info> {
    #[account(
        mut,
        seeds = [b"post", post.author.as_ref(), &post.post_id.to_le_bytes()],
        bump = post.bump,
        constraint = post.is_active @ SolSocialError::PostNotActive
    )]
    pub post: Account<'info, Post>,

    #[account(
        mut,
        seeds = [b"user", user.authority.as_ref()],
        bump = user.bump,
        constraint = user.is_active @ SolSocialError::UserNotActive
    )]
    pub user: Account<'info, User>,

    #[account(
        init_if_needed,
        payer = authority,
        space = PostInteraction::LEN,
        seeds = [b"interaction", post.key().as_ref(), user.key().as_ref()],
        bump
    )]
    pub interaction: Account<'info, PostInteraction>,

    #[account(
        mut,
        seeds = [b"user", post.author.as_ref()],
        bump,
        constraint = post_author.is_active @ SolSocialError::UserNotActive
    )]
    pub post_author: Account<'info, User>,

    #[account(
        seeds = [b"user_keys", user.authority.as_ref()],
        bump = user_keys.bump,
        constraint = user_keys.supply > 0 @ SolSocialError::NoKeysOwned
    )]
    pub user_keys: Account<'info, UserKeys>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
    pub clock: Sysvar<'info, Clock>,
}

pub fn interact_post(
    ctx: Context<InteractPost>,
    interaction_type: u8,
    content: Option<String>,
) -> Result<()> {
    let post = &mut ctx.accounts.post;
    let user = &mut ctx.accounts.user;
    let interaction = &mut ctx.accounts.interaction;
    let post_author = &mut ctx.accounts.post_author;
    let user_keys = &ctx.accounts.user_keys;
    let clock = &ctx.accounts.clock;

    // Validate interaction type
    require!(
        interaction_type <= 2, // 0: like, 1: comment, 2: share
        SolSocialError::InvalidInteractionType
    );

    // Validate content for comments
    if interaction_type == 1 {
        require!(
            content.is_some() && content.as_ref().unwrap().len() <= 500,
            SolSocialError::InvalidCommentContent
        );
    }

    // Check if user can interact (must own keys or be the author)
    let can_interact = user.authority == post.author || user_keys.supply > 0;
    require!(can_interact, SolSocialError::InsufficientKeysForInteraction);

    // Calculate interaction weight based on key ownership
    let interaction_weight = if user.authority == post.author {
        10 // Author interactions have higher weight
    } else {
        std::cmp::min(user_keys.supply / 1_000_000, 100) // Max weight of 100
    };

    // Initialize interaction if needed
    if interaction.user == Pubkey::default() {
        interaction.user = user.key();
        interaction.post = post.key();
        interaction.bump = *ctx.bumps.get("interaction").unwrap();
        interaction.created_at = clock.unix_timestamp;
    }

    // Update interaction based on type
    match interaction_type {
        0 => {
            // Like/Unlike
            if interaction.liked {
                // Unlike
                interaction.liked = false;
                post.likes = post.likes.saturating_sub(1);
                post.engagement_score = post.engagement_score.saturating_sub(interaction_weight);
                
                // Update user stats
                user.total_likes_given = user.total_likes_given.saturating_sub(1);
                post_author.total_likes_received = post_author.total_likes_received.saturating_sub(1);
            } else {
                // Like
                interaction.liked = true;
                post.likes = post.likes.saturating_add(1);
                post.engagement_score = post.engagement_score.saturating_add(interaction_weight);
                
                // Update user stats
                user.total_likes_given = user.total_likes_given.saturating_add(1);
                post_author.total_likes_received = post_author.total_likes_received.saturating_add(1);
            }
        },
        1 => {
            // Comment
            require!(!interaction.commented, SolSocialError::AlreadyCommented);
            
            interaction.commented = true;
            interaction.comment_content = content.unwrap();
            post.comments = post.comments.saturating_add(1);
            post.engagement_score = post.engagement_score.saturating_add(interaction_weight * 2); // Comments worth more
            
            // Update user stats
            user.total_comments_made = user.total_comments_made.saturating_add(1);
            post_author.total_comments_received = post_author.total_comments_received.saturating_add(1);
        },
        2 => {
            // Share/Unshare
            if interaction.shared {
                // Unshare
                interaction.shared = false;
                post.shares = post.shares.saturating_sub(1);
                post.engagement_score = post.engagement_score.saturating_sub(interaction_weight * 3);
                
                // Update user stats
                user.total_shares_made = user.total_shares_made.saturating_sub(1);
                post_author.total_shares_received = post_author.total_shares_received.saturating_sub(1);
            } else {
                // Share
                interaction.shared = true;
                post.shares = post.shares.saturating_add(1);
                post.engagement_score = post.engagement_score.saturating_add(interaction_weight * 3); // Shares worth most
                
                // Update user stats
                user.total_shares_made = user.total_shares_made.saturating_add(1);
                post_author.total_shares_received = post_author.total_shares_received.saturating_add(1);
            }
        },
        _ => return Err(SolSocialError::InvalidInteractionType.into()),
    }

    // Update interaction timestamp
    interaction.updated_at = clock.unix_timestamp;

    // Update post last activity
    post.last_activity = clock.unix_timestamp;

    // Calculate and update user influence scores
    update_influence_scores(user, post_author)?;

    // Emit interaction event
    emit!(PostInteractionEvent {
        post: post.key(),
        user: user.key(),
        interaction_type,
        timestamp: clock.unix_timestamp,
        engagement_score: post.engagement_score,
        interaction_weight,
    });

    Ok(())
}

fn update_influence_scores(user: &mut User, post_author: &mut User) -> Result<()> {
    // Update user influence based on activity
    let user_activity_score = user.total_likes_given
        .saturating_add(user.total_comments_made * 2)
        .saturating_add(user.total_shares_made * 3);
    
    user.influence_score = std::cmp::min(user_activity_score / 10, 10000);

    // Update post author influence based on engagement received
    let author_engagement_score = post_author.total_likes_received
        .saturating_add(post_author.total_comments_received * 2)
        .saturating_add(post_author.total_shares_received * 3);
    
    post_author.influence_score = std::cmp::min(author_engagement_score / 5, 10000);

    Ok(())
}

#[event]
pub struct PostInteractionEvent {
    pub post: Pubkey,
    pub user: Pubkey,
    pub interaction_type: u8,
    pub timestamp: i64,
    pub engagement_score: u64,
    pub interaction_weight: u64,
}