use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use std::collections::BTreeMap;

declare_id!("SoLSociaL1111111111111111111111111111111111");

#[program]
pub mod solsocial {
    use super::*;

    pub fn initialize_platform(
        ctx: Context<InitializePlatform>,
        fee_rate: u64,
        creator_fee_rate: u64,
    ) -> Result<()> {
        let platform = &mut ctx.accounts.platform;
        platform.authority = ctx.accounts.authority.key();
        platform.fee_rate = fee_rate;
        platform.creator_fee_rate = creator_fee_rate;
        platform.total_users = 0;
        platform.total_volume = 0;
        platform.bump = ctx.bumps.platform;
        
        emit!(PlatformInitialized {
            authority: platform.authority,
            fee_rate,
            creator_fee_rate,
        });
        
        Ok(())
    }

    pub fn create_user_profile(
        ctx: Context<CreateUserProfile>,
        username: String,
        display_name: String,
        bio: String,
        avatar_url: String,
    ) -> Result<()> {
        require!(username.len() <= 32, SolSocialError::UsernameTooLong);
        require!(display_name.len() <= 64, SolSocialError::DisplayNameTooLong);
        require!(bio.len() <= 280, SolSocialError::BioTooLong);
        require!(avatar_url.len() <= 200, SolSocialError::AvatarUrlTooLong);

        let user_profile = &mut ctx.accounts.user_profile;
        let platform = &mut ctx.accounts.platform;
        
        user_profile.owner = ctx.accounts.user.key();
        user_profile.username = username.clone();
        user_profile.display_name = display_name.clone();
        user_profile.bio = bio.clone();
        user_profile.avatar_url = avatar_url.clone();
        user_profile.followers_count = 0;
        user_profile.following_count = 0;
        user_profile.posts_count = 0;
        user_profile.reputation_score = 1000;
        user_profile.total_key_supply = 0;
        user_profile.key_price = 1_000_000; // 0.001 SOL in lamports
        user_profile.total_volume = 0;
        user_profile.created_at = Clock::get()?.unix_timestamp;
        user_profile.bump = ctx.bumps.user_profile;
        user_profile.is_verified = false;
        user_profile.is_active = true;

        platform.total_users = platform.total_users.checked_add(1).unwrap();

        emit!(UserProfileCreated {
            user: user_profile.owner,
            username,
            display_name,
            created_at: user_profile.created_at,
        });

        Ok(())
    }

    pub fn buy_user_keys(
        ctx: Context<BuyUserKeys>,
        amount: u64,
    ) -> Result<()> {
        require!(amount > 0, SolSocialError::InvalidAmount);
        require!(amount <= 100, SolSocialError::AmountTooLarge);

        let user_profile = &mut ctx.accounts.user_profile;
        let buyer_profile = &mut ctx.accounts.buyer_profile;
        let platform = &mut ctx.accounts.platform;
        let key_holding = &mut ctx.accounts.key_holding;

        let current_supply = user_profile.total_key_supply;
        let price = calculate_buy_price(current_supply, amount)?;
        let platform_fee = price.checked_mul(platform.fee_rate).unwrap().checked_div(10000).unwrap();
        let creator_fee = price.checked_mul(platform.creator_fee_rate).unwrap().checked_div(10000).unwrap();
        let total_cost = price.checked_add(platform_fee).unwrap().checked_add(creator_fee).unwrap();

        // Transfer SOL from buyer to escrow
        let transfer_instruction = anchor_lang::system_program::Transfer {
            from: ctx.accounts.buyer.to_account_info(),
            to: ctx.accounts.escrow_account.to_account_info(),
        };
        anchor_lang::system_program::transfer(
            CpiContext::new(ctx.accounts.system_program.to_account_info(), transfer_instruction),
            total_cost,
        )?;

        // Update key holding
        key_holding.holder = ctx.accounts.buyer.key();
        key_holding.subject = user_profile.owner;
        key_holding.amount = key_holding.amount.checked_add(amount).unwrap();
        key_holding.last_updated = Clock::get()?.unix_timestamp;

        // Update user profile
        user_profile.total_key_supply = current_supply.checked_add(amount).unwrap();
        user_profile.key_price = calculate_current_price(user_profile.total_key_supply)?;
        user_profile.total_volume = user_profile.total_volume.checked_add(price).unwrap();

        // Update platform stats
        platform.total_volume = platform.total_volume.checked_add(price).unwrap();

        // Update buyer reputation
        buyer_profile.reputation_score = buyer_profile.reputation_score.checked_add(amount.checked_mul(10).unwrap()).unwrap();

        emit!(KeysPurchased {
            buyer: ctx.accounts.buyer.key(),
            subject: user_profile.owner,
            amount,
            price,
            total_cost,
            new_supply: user_profile.total_key_supply,
        });

        Ok(())
    }

    pub fn sell_user_keys(
        ctx: Context<SellUserKeys>,
        amount: u64,
    ) -> Result<()> {
        require!(amount > 0, SolSocialError::InvalidAmount);
        
        let user_profile = &mut ctx.accounts.user_profile;
        let seller_profile = &mut ctx.accounts.seller_profile;
        let platform = &mut ctx.accounts.platform;
        let key_holding = &mut ctx.accounts.key_holding;

        require!(key_holding.amount >= amount, SolSocialError::InsufficientKeys);
        require!(user_profile.total_key_supply >= amount, SolSocialError::InsufficientSupply);

        let current_supply = user_profile.total_key_supply;
        let price = calculate_sell_price(current_supply, amount)?;
        let platform_fee = price.checked_mul(platform.fee_rate).unwrap().checked_div(10000).unwrap();
        let creator_fee = price.checked_mul(platform.creator_fee_rate).unwrap().checked_div(10000).unwrap();
        let seller_proceeds = price.checked_sub(platform_fee).unwrap().checked_sub(creator_fee).unwrap();

        // Transfer SOL from escrow to seller
        **ctx.accounts.escrow_account.to_account_info().try_borrow_mut_lamports()? -= seller_proceeds;
        **ctx.accounts.seller.to_account_info().try_borrow_mut_lamports()? += seller_proceeds;

        // Update key holding
        key_holding.amount = key_holding.amount.checked_sub(amount).unwrap();
        key_holding.last_updated = Clock::get()?.unix_timestamp;

        // Update user profile
        user_profile.total_key_supply = current_supply.checked_sub(amount).unwrap();
        user_profile.key_price = calculate_current_price(user_profile.total_key_supply)?;
        user_profile.total_volume = user_profile.total_volume.checked_add(price).unwrap();

        // Update platform stats
        platform.total_volume = platform.total_volume.checked_add(price).unwrap();

        emit!(KeysSold {
            seller: ctx.accounts.seller.key(),
            subject: user_profile.owner,
            amount,
            price,
            proceeds: seller_proceeds,
            new_supply: user_profile.total_key_supply,
        });

        Ok(())
    }

    pub fn create_post(
        ctx: Context<CreatePost>,
        content: String,
        media_urls: Vec<String>,
        is_premium: bool,
    ) -> Result<()> {
        require!(content.len() <= 2000, SolSocialError::ContentTooLong);
        require!(media_urls.len() <= 4, SolSocialError::TooManyMediaFiles);

        let post = &mut ctx.accounts.post;
        let user_profile = &mut ctx.accounts.user_profile;

        post.author = ctx.accounts.author.key();
        post.content = content.clone();
        post.media_urls = media_urls.clone();
        post.is_premium = is_premium;
        post.likes_count = 0;
        post.comments_count = 0;
        post.reposts_count = 0;
        post.created_at = Clock::get()?.unix_timestamp;
        post.is_active = true;
        post.bump = ctx.bumps.post;

        user_profile.posts_count = user_profile.posts_count.checked_add(1).unwrap();
        user_profile.reputation_score = user_profile.reputation_score.checked_add(50).unwrap();

        emit!(PostCreated {
            author: post.author,
            post_id: post.key(),
            content,
            is_premium,
            created_at: post.created_at,
        });

        Ok(())
    }

    pub fn like_post(ctx: Context<LikePost>) -> Result<()> {
        let post = &mut ctx.accounts.post;
        let user_profile = &mut ctx.accounts.user_profile;
        let author_profile = &mut ctx.accounts.author_profile;
        let like_record = &mut ctx.accounts.like_record;

        require!(!like_record.is_active, SolSocialError::AlreadyLiked);

        like_record.user = ctx.accounts.user.key();
        like_record.post = post.key();
        like_record.created_at = Clock::get()?.unix_timestamp;
        like_record.is_active = true;
        like_record.bump = ctx.bumps.like_record;

        post.likes_count = post.likes_count.checked_add(1).unwrap();
        user_profile.reputation_score = user_profile.reputation_score.checked_add(5).unwrap();
        author_profile.reputation_score = author_profile.reputation_score.checked_add(10).unwrap();

        emit!(PostLiked {
            user: ctx.accounts.user.key(),
            post: post.key(),
            author: post.author,
            new_likes_count: post.likes_count,
        });

        Ok(())
    }

    pub fn follow_user(ctx: Context<FollowUser>) -> Result<()> {
        let follower_profile = &mut ctx.accounts.follower_profile;
        let following_profile = &mut ctx.accounts.following_profile;
        let follow_record = &mut ctx.accounts.follow_record;

        require!(
            follower_profile.owner != following_profile.owner,
            SolSocialError::CannotFollowSelf
        );
        require!(!follow_record.is_active, SolSocialError::AlreadyFollowing);

        follow_record.follower = ctx.accounts.follower.key();
        follow_record.following = following_profile.owner;
        follow_record.created_at = Clock::get()?.unix_timestamp;
        follow_record.is_active = true;
        follow_record.bump = ctx.bumps.follow_record;

        follower_profile.following_count = follower_profile.following_count.checked_add(1).unwrap();
        following_profile.followers_count = following_profile.followers_count.checked_add(1).unwrap();

        follower_profile.reputation_score = follower_profile.reputation_score.checked_add(5).unwrap();
        following_profile.reputation_score = following_profile.reputation_score.checked_add(20).unwrap();

        emit!(UserFollowed {
            follower: ctx.accounts.follower.key(),
            following: following_profile.owner,
            follower_count: following_profile.followers_count,
        });

        Ok(())
    }

    pub fn create_chat_room(
        ctx: Context<CreateChatRoom>,
        name: String,
        description: String,
        min_keys_required: u64,
    ) -> Result<()> {
        require!(name.len() <= 64, SolSocialError::NameTooLong);
        require!(description.len() <= 280, SolSocialError::DescriptionTooLong);
        require!(min_keys_required > 0, SolSocialError::InvalidMinKeys);

        let chat_room = &mut ctx.accounts.chat_room;
        let user_profile = &mut ctx.accounts.user_profile;

        chat_room.creator = ctx.accounts.creator.key();
        chat_room.name = name.clone();
        chat_room.description = description.clone();
        chat_room.min_keys_required = min_keys_required;
        chat_room.members_count = 1;
        chat_room.messages_count = 0;
        chat_room.created_at = Clock::get()?.unix_timestamp;
        chat_room.is_active = true;
        chat_room.bump = ctx.bumps.chat_room;

        user_profile.reputation_score = user_profile.reputation_score.checked_add(100).unwrap();

        emit!(ChatRoomCreated {
            creator: chat_room.creator,
            room_id: chat_room.key(),
            name,
            min_keys_required,
            created_at: chat_room.created_at,
        });

        Ok(())
    }

    pub fn send_message(
        ctx: Context<SendMessage>,
        content: String,
        message_type: u8,
    ) -> Result<()> {
        require!(content.len() <= 1000, SolSocialError::MessageTooLong);
        require!(message_type <= 2, SolSocialError::InvalidMessageType);

        let message = &mut ctx.accounts.message;
        let chat_room = &mut ctx.accounts.chat_room;
        let user_profile = &mut ctx.accounts.user_profile;
        let key_holding = &ctx.accounts.key_holding;

        require!(
            key_holding.amount >= chat_room.min_keys_required,
            SolSocialError::InsufficientKeysForChat
        );

        message.sender = ctx.accounts.sender.key();
        message.chat_room = chat_room.key();
        message.content = content.clone();
        message.message_type = message_type;
        message.created_at = Clock::get()?.unix_timestamp;
        message.is_active = true;
        message.bump = ctx.bumps.message;

        chat_room.messages_count = chat_room.messages_count.checked_add(1).unwrap();
        user_profile.reputation_score = user_profile.reputation_score.checked_add(2).unwrap();

        emit!(MessageSent {
            sender: message.sender,
            chat_room: chat_room.key(),
            content,
            message_type,
            created_at: message.created_at,
        });

        Ok(())
    }

    pub fn update_platform_settings(
        ctx: Context<UpdatePlatformSettings>,
        fee_rate: Option<u64>,