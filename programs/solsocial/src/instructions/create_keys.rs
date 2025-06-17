use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Mint};
use crate::state::*;
use crate::errors::*;
use crate::constants::*;

#[derive(Accounts)]
#[instruction(user_pubkey: Pubkey)]
pub struct CreateKeys<'info> {
    #[account(
        init,
        payer = payer,
        space = 8 + UserKeys::INIT_SPACE,
        seeds = [b"user_keys", user_pubkey.as_ref()],
        bump
    )]
    pub user_keys: Account<'info, UserKeys>,
    
    #[account(
        init,
        payer = payer,
        mint::decimals = 6,
        mint::authority = user_keys,
        seeds = [b"keys_mint", user_pubkey.as_ref()],
        bump
    )]
    pub keys_mint: Account<'info, Mint>,
    
    #[account(
        init,
        payer = payer,
        associated_token::mint = keys_mint,
        associated_token::authority = user_keys,
    )]
    pub keys_vault: Account<'info, TokenAccount>,
    
    #[account(
        init,
        payer = payer,
        associated_token::mint = keys_mint,
        associated_token::authority = payer,
    )]
    pub creator_keys_account: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub payer: Signer<'info>,
    
    #[account(
        mut,
        seeds = [b"protocol_config"],
        bump
    )]
    pub protocol_config: Account<'info, ProtocolConfig>,
    
    #[account(
        mut,
        seeds = [b"protocol_treasury"],
        bump
    )]
    pub protocol_treasury: SystemAccount<'info>,
    
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, anchor_spl::associated_token::AssociatedToken>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn create_keys(
    ctx: Context<CreateKeys>,
    user_pubkey: Pubkey,
    name: String,
    symbol: String,
    uri: String,
) -> Result<()> {
    require!(name.len() <= MAX_NAME_LENGTH, SolSocialError::NameTooLong);
    require!(symbol.len() <= MAX_SYMBOL_LENGTH, SolSocialError::SymbolTooLong);
    require!(uri.len() <= MAX_URI_LENGTH, SolSocialError::UriTooLong);
    require!(!name.is_empty(), SolSocialError::NameEmpty);
    require!(!symbol.is_empty(), SolSocialError::SymbolEmpty);
    
    let user_keys = &mut ctx.accounts.user_keys;
    let protocol_config = &ctx.accounts.protocol_config;
    let clock = Clock::get()?;
    
    // Initialize user keys account
    user_keys.user = user_pubkey;
    user_keys.creator = ctx.accounts.payer.key();
    user_keys.keys_mint = ctx.accounts.keys_mint.key();
    user_keys.name = name.clone();
    user_keys.symbol = symbol.clone();
    user_keys.uri = uri.clone();
    user_keys.total_supply = 0;
    user_keys.created_at = clock.unix_timestamp;
    user_keys.last_trade_at = clock.unix_timestamp;
    user_keys.bump = ctx.bumps.user_keys;
    user_keys.keys_mint_bump = ctx.bumps.keys_mint;
    
    // Calculate initial key price (first key is free for creator)
    let initial_supply = CREATOR_INITIAL_KEYS;
    let price = calculate_bonding_curve_price(0, initial_supply)?;
    
    // Calculate protocol fee
    let protocol_fee = price
        .checked_mul(protocol_config.protocol_fee_percent as u64)
        .ok_or(SolSocialError::MathOverflow)?
        .checked_div(10000)
        .ok_or(SolSocialError::MathOverflow)?;
    
    let creator_fee = price
        .checked_mul(protocol_config.creator_fee_percent as u64)
        .ok_or(SolSocialError::MathOverflow)?
        .checked_div(10000)
        .ok_or(SolSocialError::MathOverflow)?;
    
    let total_cost = price.checked_add(protocol_fee).ok_or(SolSocialError::MathOverflow)?;
    
    // Transfer protocol fee to treasury
    if protocol_fee > 0 {
        let transfer_instruction = anchor_lang::solana_program::system_instruction::transfer(
            &ctx.accounts.payer.key(),
            &ctx.accounts.protocol_treasury.key(),
            protocol_fee,
        );
        
        anchor_lang::solana_program::program::invoke(
            &transfer_instruction,
            &[
                ctx.accounts.payer.to_account_info(),
                ctx.accounts.protocol_treasury.to_account_info(),
            ],
        )?;
    }
    
    // Mint initial keys to creator
    let seeds = &[
        b"user_keys",
        user_pubkey.as_ref(),
        &[user_keys.bump],
    ];
    let signer = &[&seeds[..]];
    
    let cpi_accounts = token::MintTo {
        mint: ctx.accounts.keys_mint.to_account_info(),
        to: ctx.accounts.creator_keys_account.to_account_info(),
        authority: user_keys.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);
    
    token::mint_to(cpi_ctx, initial_supply * 10_u64.pow(6))?;
    
    // Update supply
    user_keys.total_supply = initial_supply;
    
    // Update protocol stats
    let protocol_config = &mut ctx.accounts.protocol_config;
    protocol_config.total_keys_created = protocol_config
        .total_keys_created
        .checked_add(1)
        .ok_or(SolSocialError::MathOverflow)?;
    
    protocol_config.total_volume = protocol_config
        .total_volume
        .checked_add(total_cost)
        .ok_or(SolSocialError::MathOverflow)?;
    
    // Emit event
    emit!(KeysCreatedEvent {
        user: user_pubkey,
        creator: ctx.accounts.payer.key(),
        keys_mint: ctx.accounts.keys_mint.key(),
        name: name,
        symbol: symbol,
        uri: uri,
        initial_supply: initial_supply,
        price: price,
        protocol_fee: protocol_fee,
        creator_fee: creator_fee,
        timestamp: clock.unix_timestamp,
    });
    
    Ok(())
}

fn calculate_bonding_curve_price(current_supply: u64, amount: u64) -> Result<u64> {
    // Quadratic bonding curve: price = base_price + (supply^2 * curve_factor)
    let base_price = BASE_KEY_PRICE;
    let curve_factor = BONDING_CURVE_FACTOR;
    
    let mut total_cost = 0u64;
    
    for i in 0..amount {
        let supply_at_step = current_supply
            .checked_add(i)
            .ok_or(SolSocialError::MathOverflow)?;
        
        let supply_squared = supply_at_step
            .checked_mul(supply_at_step)
            .ok_or(SolSocialError::MathOverflow)?;
        
        let curve_component = supply_squared
            .checked_mul(curve_factor)
            .ok_or(SolSocialError::MathOverflow)?
            .checked_div(1_000_000)
            .ok_or(SolSocialError::MathOverflow)?;
        
        let step_price = base_price
            .checked_add(curve_component)
            .ok_or(SolSocialError::MathOverflow)?;
        
        total_cost = total_cost
            .checked_add(step_price)
            .ok_or(SolSocialError::MathOverflow)?;
    }
    
    Ok(total_cost)
}

#[event]
pub struct KeysCreatedEvent {
    pub user: Pubkey,
    pub creator: Pubkey,
    pub keys_mint: Pubkey,
    pub name: String,
    pub symbol: String,
    pub uri: String,
    pub initial_supply: u64,
    pub price: u64,
    pub protocol_fee: u64,
    pub creator_fee: u64,
    pub timestamp: i64,
}