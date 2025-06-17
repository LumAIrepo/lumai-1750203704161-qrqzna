use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use crate::state::*;
use crate::errors::*;
use crate::events::*;

#[derive(Accounts)]
#[instruction(amount: u64)]
pub struct BuyKeys<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,
    
    #[account(
        mut,
        seeds = [b"user", subject.key().as_ref()],
        bump = user_account.bump,
    )]
    pub user_account: Account<'info, UserAccount>,
    
    /// CHECK: This is the subject whose keys are being bought
    pub subject: AccountInfo<'info>,
    
    #[account(
        init_if_needed,
        payer = buyer,
        space = 8 + KeysBalance::INIT_SPACE,
        seeds = [b"keys_balance", buyer.key().as_ref(), subject.key().as_ref()],
        bump
    )]
    pub keys_balance: Account<'info, KeysBalance>,
    
    #[account(
        mut,
        seeds = [b"protocol_fees"],
        bump
    )]
    pub protocol_fees: Account<'info, ProtocolFees>,
    
    #[account(
        mut,
        associated_token::mint = payment_mint,
        associated_token::authority = buyer,
    )]
    pub buyer_token_account: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        associated_token::mint = payment_mint,
        associated_token::authority = user_account,
    )]
    pub subject_token_account: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        associated_token::mint = payment_mint,
        associated_token::authority = protocol_fees,
    )]
    pub protocol_token_account: Account<'info, TokenAccount>,
    
    /// CHECK: Payment mint for the transaction
    pub payment_mint: AccountInfo<'info>,
    
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn buy_keys(ctx: Context<BuyKeys>, amount: u64) -> Result<()> {
    require!(amount > 0, SolSocialError::InvalidAmount);
    require!(amount <= MAX_KEYS_PER_TRANSACTION, SolSocialError::ExceedsMaxAmount);
    
    let user_account = &mut ctx.accounts.user_account;
    let keys_balance = &mut ctx.accounts.keys_balance;
    let protocol_fees = &mut ctx.accounts.protocol_fees;
    
    // Validate user account is active
    require!(user_account.is_active, SolSocialError::UserAccountInactive);
    
    // Calculate current supply before purchase
    let current_supply = user_account.keys_supply;
    
    // Calculate price using bonding curve
    let price = calculate_buy_price(current_supply, amount)?;
    
    // Calculate fees
    let protocol_fee = price
        .checked_mul(protocol_fees.protocol_fee_percent as u64)
        .ok_or(SolSocialError::MathOverflow)?
        .checked_div(10000)
        .ok_or(SolSocialError::MathOverflow)?;
    
    let subject_fee = price
        .checked_mul(protocol_fees.subject_fee_percent as u64)
        .ok_or(SolSocialError::MathOverflow)?
        .checked_div(10000)
        .ok_or(SolSocialError::MathOverflow)?;
    
    let total_cost = price
        .checked_add(protocol_fee)
        .ok_or(SolSocialError::MathOverflow)?
        .checked_add(subject_fee)
        .ok_or(SolSocialError::MathOverflow)?;
    
    // Validate buyer has sufficient balance
    require!(
        ctx.accounts.buyer_token_account.amount >= total_cost,
        SolSocialError::InsufficientFunds
    );
    
    // Check for supply overflow
    let new_supply = current_supply
        .checked_add(amount)
        .ok_or(SolSocialError::MathOverflow)?;
    
    require!(new_supply <= MAX_KEYS_SUPPLY, SolSocialError::ExceedsMaxSupply);
    
    // Transfer payment from buyer to subject
    let transfer_to_subject_ctx = CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        Transfer {
            from: ctx.accounts.buyer_token_account.to_account_info(),
            to: ctx.accounts.subject_token_account.to_account_info(),
            authority: ctx.accounts.buyer.to_account_info(),
        },
    );
    token::transfer(transfer_to_subject_ctx, price)?;
    
    // Transfer protocol fee
    if protocol_fee > 0 {
        let transfer_protocol_fee_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.buyer_token_account.to_account_info(),
                to: ctx.accounts.protocol_token_account.to_account_info(),
                authority: ctx.accounts.buyer.to_account_info(),
            },
        );
        token::transfer(transfer_protocol_fee_ctx, protocol_fee)?;
    }
    
    // Transfer subject fee
    if subject_fee > 0 {
        let transfer_subject_fee_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.buyer_token_account.to_account_info(),
                to: ctx.accounts.subject_token_account.to_account_info(),
                authority: ctx.accounts.buyer.to_account_info(),
            },
        );
        token::transfer(transfer_subject_fee_ctx, subject_fee)?;
    }
    
    // Initialize keys balance if needed
    if keys_balance.owner == Pubkey::default() {
        keys_balance.owner = ctx.accounts.buyer.key();
        keys_balance.subject = ctx.accounts.subject.key();
        keys_balance.balance = 0;
        keys_balance.bump = ctx.bumps.keys_balance;
    }
    
    // Update balances
    keys_balance.balance = keys_balance.balance
        .checked_add(amount)
        .ok_or(SolSocialError::MathOverflow)?;
    
    user_account.keys_supply = new_supply;
    user_account.total_volume = user_account.total_volume
        .checked_add(total_cost)
        .ok_or(SolSocialError::MathOverflow)?;
    
    // Update protocol fees collected
    protocol_fees.total_fees_collected = protocol_fees.total_fees_collected
        .checked_add(protocol_fee)
        .ok_or(SolSocialError::MathOverflow)?;
    
    // Update user stats
    user_account.holders_count = user_account.holders_count
        .checked_add(if keys_balance.balance == amount { 1 } else { 0 })
        .ok_or(SolSocialError::MathOverflow)?;
    
    user_account.last_activity_timestamp = Clock::get()?.unix_timestamp;
    
    // Emit event
    emit!(KeysPurchased {
        buyer: ctx.accounts.buyer.key(),
        subject: ctx.accounts.subject.key(),
        amount,
        price,
        protocol_fee,
        subject_fee,
        new_supply,
        timestamp: Clock::get()?.unix_timestamp,
    });
    
    Ok(())
}

fn calculate_buy_price(supply: u64, amount: u64) -> Result<u64> {
    // Bonding curve: price = (supply^2 + supply * amount + amount^2) / 3 * BASE_PRICE
    const BASE_PRICE: u64 = 1_000_000; // 0.001 SOL in lamports
    
    let supply_squared = supply
        .checked_mul(supply)
        .ok_or(SolSocialError::MathOverflow)?;
    
    let supply_times_amount = supply
        .checked_mul(amount)
        .ok_or(SolSocialError::MathOverflow)?;
    
    let amount_squared = amount
        .checked_mul(amount)
        .ok_or(SolSocialError::MathOverflow)?;
    
    let numerator = supply_squared
        .checked_add(supply_times_amount)
        .ok_or(SolSocialError::MathOverflow)?
        .checked_add(amount_squared)
        .ok_or(SolSocialError::MathOverflow)?;
    
    let price_factor = numerator
        .checked_div(3)
        .ok_or(SolSocialError::MathOverflow)?;
    
    let final_price = price_factor
        .checked_mul(BASE_PRICE)
        .ok_or(SolSocialError::MathOverflow)?
        .checked_div(1000)
        .ok_or(SolSocialError::MathOverflow)?;
    
    // Minimum price protection
    let min_price = amount
        .checked_mul(BASE_PRICE)
        .ok_or(SolSocialError::MathOverflow)?
        .checked_div(1000)
        .ok_or(SolSocialError::MathOverflow)?;
    
    Ok(std::cmp::max(final_price, min_price))
}

const MAX_KEYS_PER_TRANSACTION: u64 = 1000;
const MAX_KEYS_SUPPLY: u64 = 1_000_000;