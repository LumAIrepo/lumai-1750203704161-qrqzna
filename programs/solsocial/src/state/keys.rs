use anchor_lang::prelude::*;
use std::collections::BTreeMap;

#[account]
pub struct UserKeys {
    pub owner: Pubkey,
    pub total_supply: u64,
    pub holders: BTreeMap<Pubkey, u64>,
    pub price_per_key: u64,
    pub total_volume: u64,
    pub created_at: i64,
    pub last_trade_at: i64,
    pub bump: u8,
}

impl UserKeys {
    pub const LEN: usize = 8 + // discriminator
        32 + // owner
        8 + // total_supply
        4 + (32 + 8) * 100 + // holders (max 100 holders)
        8 + // price_per_key
        8 + // total_volume
        8 + // created_at
        8 + // last_trade_at
        1; // bump

    pub fn initialize(&mut self, owner: Pubkey, bump: u8) -> Result<()> {
        self.owner = owner;
        self.total_supply = 0;
        self.holders = BTreeMap::new();
        self.price_per_key = Self::calculate_initial_price();
        self.total_volume = 0;
        self.created_at = Clock::get()?.unix_timestamp;
        self.last_trade_at = Clock::get()?.unix_timestamp;
        self.bump = bump;
        Ok(())
    }

    pub fn buy_keys(&mut self, buyer: Pubkey, amount: u64) -> Result<u64> {
        require!(amount > 0, SolSocialError::InvalidAmount);
        require!(amount <= 10, SolSocialError::ExceedsMaxPurchase);

        let total_cost = self.calculate_buy_price(amount)?;
        
        // Update holder balance
        let current_balance = self.holders.get(&buyer).unwrap_or(&0);
        self.holders.insert(buyer, current_balance + amount);
        
        // Update total supply
        self.total_supply = self.total_supply.checked_add(amount)
            .ok_or(SolSocialError::MathOverflow)?;
        
        // Update price based on new supply
        self.price_per_key = self.calculate_current_price()?;
        
        // Update volume and timestamp
        self.total_volume = self.total_volume.checked_add(total_cost)
            .ok_or(SolSocialError::MathOverflow)?;
        self.last_trade_at = Clock::get()?.unix_timestamp;

        Ok(total_cost)
    }

    pub fn sell_keys(&mut self, seller: Pubkey, amount: u64) -> Result<u64> {
        require!(amount > 0, SolSocialError::InvalidAmount);
        
        let current_balance = self.holders.get(&seller).unwrap_or(&0);
        require!(*current_balance >= amount, SolSocialError::InsufficientKeys);

        let total_payout = self.calculate_sell_price(amount)?;
        
        // Update holder balance
        if *current_balance == amount {
            self.holders.remove(&seller);
        } else {
            self.holders.insert(seller, current_balance - amount);
        }
        
        // Update total supply
        self.total_supply = self.total_supply.checked_sub(amount)
            .ok_or(SolSocialError::MathUnderflow)?;
        
        // Update price based on new supply
        self.price_per_key = self.calculate_current_price()?;
        
        // Update volume and timestamp
        self.total_volume = self.total_volume.checked_add(total_payout)
            .ok_or(SolSocialError::MathOverflow)?;
        self.last_trade_at = Clock::get()?.unix_timestamp;

        Ok(total_payout)
    }

    pub fn calculate_buy_price(&self, amount: u64) -> Result<u64> {
        let mut total_cost = 0u64;
        let mut current_supply = self.total_supply;
        
        for _ in 0..amount {
            let price = Self::get_price_for_supply(current_supply)?;
            total_cost = total_cost.checked_add(price)
                .ok_or(SolSocialError::MathOverflow)?;
            current_supply = current_supply.checked_add(1)
                .ok_or(SolSocialError::MathOverflow)?;
        }
        
        Ok(total_cost)
    }

    pub fn calculate_sell_price(&self, amount: u64) -> Result<u64> {
        let mut total_payout = 0u64;
        let mut current_supply = self.total_supply;
        
        for _ in 0..amount {
            current_supply = current_supply.checked_sub(1)
                .ok_or(SolSocialError::MathUnderflow)?;
            let price = Self::get_price_for_supply(current_supply)?;
            total_payout = total_payout.checked_add(price)
                .ok_or(SolSocialError::MathOverflow)?;
        }
        
        Ok(total_payout)
    }

    fn calculate_current_price(&self) -> Result<u64> {
        Self::get_price_for_supply(self.total_supply)
    }

    fn calculate_initial_price() -> u64 {
        1_000_000 // 0.001 SOL in lamports
    }

    fn get_price_for_supply(supply: u64) -> Result<u64> {
        // Bonding curve: price = base_price * (1 + supply/1000)^2
        let base_price = 1_000_000u64; // 0.001 SOL
        
        if supply == 0 {
            return Ok(base_price);
        }
        
        // Calculate multiplier: (1000 + supply)^2 / 1000^2
        let numerator = (1000u64.checked_add(supply)
            .ok_or(SolSocialError::MathOverflow)?)
            .checked_pow(2)
            .ok_or(SolSocialError::MathOverflow)?;
        
        let denominator = 1_000_000u64; // 1000^2
        
        let price = base_price.checked_mul(numerator)
            .ok_or(SolSocialError::MathOverflow)?
            .checked_div(denominator)
            .ok_or(SolSocialError::MathUnderflow)?;
        
        Ok(price)
    }

    pub fn get_holder_balance(&self, holder: &Pubkey) -> u64 {
        *self.holders.get(holder).unwrap_or(&0)
    }

    pub fn get_holder_count(&self) -> usize {
        self.holders.len()
    }

    pub fn is_holder(&self, user: &Pubkey) -> bool {
        self.holders.contains_key(user) && *self.holders.get(user).unwrap() > 0
    }

    pub fn get_market_cap(&self) -> Result<u64> {
        if self.total_supply == 0 {
            return Ok(0);
        }
        
        self.price_per_key.checked_mul(self.total_supply)
            .ok_or(SolSocialError::MathOverflow.into())
    }

    pub fn calculate_creator_fee(&self, trade_amount: u64) -> Result<u64> {
        // 5% creator fee
        trade_amount.checked_mul(5)
            .ok_or(SolSocialError::MathOverflow)?
            .checked_div(100)
            .ok_or(SolSocialError::MathUnderflow.into())
    }

    pub fn calculate_protocol_fee(&self, trade_amount: u64) -> Result<u64> {
        // 2.5% protocol fee
        trade_amount.checked_mul(25)
            .ok_or(SolSocialError::MathOverflow)?
            .checked_div(1000)
            .ok_or(SolSocialError::MathUnderflow.into())
    }
}

#[account]
pub struct KeysGlobalState {
    pub authority: Pubkey,
    pub total_users: u64,
    pub total_volume: u64,
    pub total_fees_collected: u64,
    pub protocol_fee_rate: u16, // basis points (250 = 2.5%)
    pub creator_fee_rate: u16,  // basis points (500 = 5%)
    pub max_keys_per_purchase: u8,
    pub bump: u8,
}

impl KeysGlobalState {
    pub const LEN: usize = 8 + // discriminator
        32 + // authority
        8 + // total_users
        8 + // total_volume
        8 + // total_fees_collected
        2 + // protocol_fee_rate
        2 + // creator_fee_rate
        1 + // max_keys_per_purchase
        1; // bump

    pub fn initialize(&mut self, authority: Pubkey, bump: u8) -> Result<()> {
        self.authority = authority;
        self.total_users = 0;
        self.total_volume = 0;
        self.total_fees_collected = 0;
        self.protocol_fee_rate = 250; // 2.5%
        self.creator_fee_rate = 500;  // 5%
        self.max_keys_per_purchase = 10;
        self.bump = bump;
        Ok(())
    }

    pub fn increment_user_count(&mut self) -> Result<()> {
        self.total_users = self.total_users.checked_add(1)
            .ok_or(SolSocialError::MathOverflow)?;
        Ok(())
    }

    pub fn add_volume(&mut self, amount: u64) -> Result<()> {
        self.total_volume = self.total_volume.checked_add(amount)
            .ok_or(SolSocialError::MathOverflow)?;
        Ok(())
    }

    pub fn add_fees(&mut self, amount: u64) -> Result<()> {
        self.total_fees_collected = self.total_fees_collected.checked_add(amount)
            .ok_or(SolSocialError::MathOverflow)?;
        Ok(())
    }
}

#[error_code]
pub enum SolSocialError {
    #[msg("Invalid amount specified")]
    InvalidAmount,
    #[msg("Exceeds maximum purchase limit")]
    ExceedsMaxPurchase,
    #[msg("Insufficient keys to sell")]
    InsufficientKeys,
    #[msg("Math overflow error")]
    MathOverflow,
    #[msg("Math underflow error")]
    MathUnderflow,
    #[msg("Unauthorized access")]
    Unauthorized,
    #[msg("Invalid account provided")]
    InvalidAccount,
    #[msg("Account already initialized")]
    AlreadyInitialized,
    #[msg("Account not initialized")]
    NotInitialized,
}