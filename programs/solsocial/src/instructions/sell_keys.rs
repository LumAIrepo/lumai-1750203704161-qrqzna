use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use crate::state::*;
use crate::errors::*;
use crate::events::*;
use crate::constants::*;

#[derive(Accounts)]
pub struct SellKeys<'info> {
    #[account(mut)]
    pub seller: Signer<'info>,
    
    #[account(
        mut,
        seeds = [b"user", seller.key().as_ref()],
        bump = seller_profile.bump,
    )]
    pub seller_profile: Account<'info, UserProfile>,
    
    #[account(
        mut,
        seeds = [b"user", subject.key().as_ref()],
        bump = subject_profile.bump,
    )]
    pub subject_profile: Account<'info, UserProfile>,
    
    /// CHECK: Subject account for key trading
    pub subject: AccountInfo<'info>,
    
    #[account(
        mut,
        seeds = [b"keys", subject.key().as_ref(), seller.key().as_ref()],
        bump = key_holding.bump,
    )]
    pub key_holding: Account<'info, KeyHolding>,
    
    #[account(
        mut,
        seeds = [b"treasury"],
        bump = treasury.bump,
    )]
    pub treasury: Account<'info, Treasury>,
    
    #[account(
        mut,
        associated_token::mint = treasury.sol_mint,
        associated_token::authority = seller,
    )]
    pub seller_token_account: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        associated_token::mint = treasury.sol_mint,
        associated_token::authority = subject,
    )]
    pub subject_token_account: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        associated_token::mint = treasury.sol_mint,
        associated_token::authority = treasury,
    )]
    pub treasury_token_account: Account<'info, TokenAccount>,
    
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn sell_keys(ctx: Context<SellKeys>, amount: u64) -> Result<()> {
    let seller = &ctx.accounts.seller;
    let seller_profile = &mut ctx.accounts.seller_profile;
    let subject_profile = &mut ctx.accounts.subject_profile;
    let subject = &ctx.accounts.subject;
    let key_holding = &mut ctx.accounts.key_holding;
    let treasury = &mut ctx.accounts.treasury;
    
    // Validate inputs
    require!(amount > 0, SolSocialError::InvalidAmount);
    require!(key_holding.amount >= amount, SolSocialError::InsufficientKeys);
    require!(subject_profile.total_supply >= amount, SolSocialError::InsufficientSupply);
    
    // Prevent selling the last key if seller is the subject (must maintain at least 1)
    if seller.key() == subject.key() {
        require!(
            key_holding.amount > amount || subject_profile.total_supply > amount,
            SolSocialError::CannotSellLastKey
        );
    }
    
    // Calculate sell price using bonding curve
    let current_supply = subject_profile.total_supply;
    let sell_price = calculate_sell_price(current_supply, amount)?;
    
    // Calculate fees
    let protocol_fee = sell_price
        .checked_mul(PROTOCOL_FEE_PERCENT)
        .ok_or(SolSocialError::MathOverflow)?
        .checked_div(10000)
        .ok_or(SolSocialError::MathOverflow)?;
    
    let subject_fee = sell_price
        .checked_mul(SUBJECT_FEE_PERCENT)
        .ok_or(SolSocialError::MathOverflow)?
        .checked_div(10000)
        .ok_or(SolSocialError::MathOverflow)?;
    
    let seller_proceeds = sell_price
        .checked_sub(protocol_fee)
        .ok_or(SolSocialError::MathOverflow)?
        .checked_sub(subject_fee)
        .ok_or(SolSocialError::MathOverflow)?;
    
    // Update key holding
    key_holding.amount = key_holding.amount
        .checked_sub(amount)
        .ok_or(SolSocialError::MathOverflow)?;
    
    key_holding.last_trade_timestamp = Clock::get()?.unix_timestamp;
    
    // Update subject profile
    subject_profile.total_supply = subject_profile.total_supply
        .checked_sub(amount)
        .ok_or(SolSocialError::MathOverflow)?;
    
    subject_profile.total_volume = subject_profile.total_volume
        .checked_add(sell_price)
        .ok_or(SolSocialError::MathOverflow)?;
    
    subject_profile.last_trade_timestamp = Clock::get()?.unix_timestamp;
    
    // Update seller profile
    seller_profile.total_trades = seller_profile.total_trades
        .checked_add(1)
        .ok_or(SolSocialError::MathOverflow)?;
    
    seller_profile.total_volume = seller_profile.total_volume
        .checked_add(sell_price)
        .ok_or(SolSocialError::MathOverflow)?;
    
    // Update treasury
    treasury.total_volume = treasury.total_volume
        .checked_add(sell_price)
        .ok_or(SolSocialError::MathOverflow)?;
    
    treasury.protocol_fees_collected = treasury.protocol_fees_collected
        .checked_add(protocol_fee)
        .ok_or(SolSocialError::MathOverflow)?;
    
    // Transfer seller proceeds
    if seller_proceeds > 0 {
        let transfer_instruction = Transfer {
            from: ctx.accounts.treasury_token_account.to_account_info(),
            to: ctx.accounts.seller_token_account.to_account_info(),
            authority: treasury.to_account_info(),
        };
        
        let treasury_seeds = &[
            b"treasury",
            &[treasury.bump],
        ];
        let signer_seeds = &[&treasury_seeds[..]];
        
        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            transfer_instruction,
            signer_seeds,
        );
        
        token::transfer(cpi_ctx, seller_proceeds)?;
    }
    
    // Transfer subject fee
    if subject_fee > 0 {
        let transfer_instruction = Transfer {
            from: ctx.accounts.treasury_token_account.to_account_info(),
            to: ctx.accounts.subject_token_account.to_account_info(),
            authority: treasury.to_account_info(),
        };
        
        let treasury_seeds = &[
            b"treasury",
            &[treasury.bump],
        ];
        let signer_seeds = &[&treasury_seeds[..]];
        
        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            transfer_instruction,
            signer_seeds,
        );
        
        token::transfer(cpi_ctx, subject_fee)?;
    }
    
    // Close key holding account if amount reaches zero
    if key_holding.amount == 0 {
        key_holding.close(seller.to_account_info())?;
    }
    
    // Emit sell event
    emit!(KeysSold {
        seller: seller.key(),
        subject: subject.key(),
        amount,
        price: sell_price,
        protocol_fee,
        subject_fee,
        seller_proceeds,
        supply_after: subject_profile.total_supply,
        timestamp: Clock::get()?.unix_timestamp,
    });
    
    msg!(
        "Keys sold: seller={}, subject={}, amount={}, price={}, supply_after={}",
        seller.key(),
        subject.key(),
        amount,
        sell_price,
        subject_profile.total_supply
    );
    
    Ok(())
}

fn calculate_sell_price(supply: u64, amount: u64) -> Result<u64> {
    if supply == 0 || amount == 0 {
        return Ok(0);
    }
    
    // Bonding curve: price = supply^2 / 16000
    // For selling, we calculate the area under the curve from (supply - amount) to supply
    let supply_before = supply.checked_sub(amount).ok_or(SolSocialError::MathOverflow)?;
    
    // Calculate sum of squares from supply_before to supply-1
    let mut total_price = 0u64;
    
    for i in supply_before..supply {
        let price = i
            .checked_mul(i)
            .ok_or(SolSocialError::MathOverflow)?
            .checked_div(16000)
            .ok_or(SolSocialError::MathOverflow)?;
        
        total_price = total_price
            .checked_add(price)
            .ok_or(SolSocialError::MathOverflow)?;
    }
    
    // Minimum price floor
    if total_price < MIN_KEY_PRICE {
        total_price = MIN_KEY_PRICE;
    }
    
    Ok(total_price)
}