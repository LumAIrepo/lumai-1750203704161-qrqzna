use anchor_lang::prelude::*;
use crate::state::*;
use crate::errors::*;

pub const CREATOR_SHARE_BPS: u16 = 500; // 5%
pub const PROTOCOL_SHARE_BPS: u16 = 250; // 2.5%
pub const REFERRER_SHARE_BPS: u16 = 100; // 1%
pub const BASIS_POINTS: u16 = 10000;

#[derive(Debug, Clone, Copy)]
pub struct RevenueDistribution {
    pub creator_amount: u64,
    pub protocol_amount: u64,
    pub referrer_amount: u64,
    pub remaining_amount: u64,
}

pub fn calculate_revenue_distribution(
    total_amount: u64,
    has_referrer: bool,
) -> Result<RevenueDistribution> {
    require!(total_amount > 0, SolSocialError::InvalidAmount);

    let creator_amount = total_amount
        .checked_mul(CREATOR_SHARE_BPS as u64)
        .ok_or(SolSocialError::MathOverflow)?
        .checked_div(BASIS_POINTS as u64)
        .ok_or(SolSocialError::MathOverflow)?;

    let protocol_amount = total_amount
        .checked_mul(PROTOCOL_SHARE_BPS as u64)
        .ok_or(SolSocialError::MathOverflow)?
        .checked_div(BASIS_POINTS as u64)
        .ok_or(SolSocialError::MathOverflow)?;

    let referrer_amount = if has_referrer {
        total_amount
            .checked_mul(REFERRER_SHARE_BPS as u64)
            .ok_or(SolSocialError::MathOverflow)?
            .checked_div(BASIS_POINTS as u64)
            .ok_or(SolSocialError::MathOverflow)?
    } else {
        0
    };

    let distributed_amount = creator_amount
        .checked_add(protocol_amount)
        .ok_or(SolSocialError::MathOverflow)?
        .checked_add(referrer_amount)
        .ok_or(SolSocialError::MathOverflow)?;

    let remaining_amount = total_amount
        .checked_sub(distributed_amount)
        .ok_or(SolSocialError::MathUnderflow)?;

    Ok(RevenueDistribution {
        creator_amount,
        protocol_amount,
        referrer_amount,
        remaining_amount,
    })
}

pub fn distribute_buy_revenue<'info>(
    user_profile: &mut Account<'info, UserProfile>,
    protocol_treasury: &mut AccountInfo<'info>,
    referrer_profile: Option<&mut Account<'info, UserProfile>>,
    buyer: &mut AccountInfo<'info>,
    system_program: &Program<'info, System>,
    total_amount: u64,
) -> Result<RevenueDistribution> {
    let distribution = calculate_revenue_distribution(
        total_amount,
        referrer_profile.is_some(),
    )?;

    // Transfer creator share
    if distribution.creator_amount > 0 {
        let creator_lamports = user_profile.to_account_info().lamports();
        **user_profile.to_account_info().lamports.borrow_mut() = creator_lamports
            .checked_add(distribution.creator_amount)
            .ok_or(SolSocialError::MathOverflow)?;

        let buyer_lamports = buyer.lamports();
        **buyer.lamports.borrow_mut() = buyer_lamports
            .checked_sub(distribution.creator_amount)
            .ok_or(SolSocialError::InsufficientFunds)?;

        user_profile.total_earnings = user_profile.total_earnings
            .checked_add(distribution.creator_amount)
            .ok_or(SolSocialError::MathOverflow)?;
    }

    // Transfer protocol share
    if distribution.protocol_amount > 0 {
        let protocol_lamports = protocol_treasury.lamports();
        **protocol_treasury.lamports.borrow_mut() = protocol_lamports
            .checked_add(distribution.protocol_amount)
            .ok_or(SolSocialError::MathOverflow)?;

        let buyer_lamports = buyer.lamports();
        **buyer.lamports.borrow_mut() = buyer_lamports
            .checked_sub(distribution.protocol_amount)
            .ok_or(SolSocialError::InsufficientFunds)?;
    }

    // Transfer referrer share if applicable
    if let Some(ref mut referrer) = referrer_profile {
        if distribution.referrer_amount > 0 {
            let referrer_lamports = referrer.to_account_info().lamports();
            **referrer.to_account_info().lamports.borrow_mut() = referrer_lamports
                .checked_add(distribution.referrer_amount)
                .ok_or(SolSocialError::MathOverflow)?;

            let buyer_lamports = buyer.lamports();
            **buyer.lamports.borrow_mut() = buyer_lamports
                .checked_sub(distribution.referrer_amount)
                .ok_or(SolSocialError::InsufficientFunds)?;

            referrer.total_earnings = referrer.total_earnings
                .checked_add(distribution.referrer_amount)
                .ok_or(SolSocialError::MathOverflow)?;

            referrer.referral_earnings = referrer.referral_earnings
                .checked_add(distribution.referrer_amount)
                .ok_or(SolSocialError::MathOverflow)?;
        }
    }

    Ok(distribution)
}

pub fn distribute_sell_revenue<'info>(
    user_profile: &mut Account<'info, UserProfile>,
    protocol_treasury: &mut AccountInfo<'info>,
    referrer_profile: Option<&mut Account<'info, UserProfile>>,
    seller: &mut AccountInfo<'info>,
    total_amount: u64,
) -> Result<RevenueDistribution> {
    let distribution = calculate_revenue_distribution(
        total_amount,
        referrer_profile.is_some(),
    )?;

    // Calculate seller proceeds (total minus all fees)
    let seller_proceeds = distribution.remaining_amount;

    // Transfer seller proceeds
    if seller_proceeds > 0 {
        let seller_lamports = seller.lamports();
        **seller.lamports.borrow_mut() = seller_lamports
            .checked_add(seller_proceeds)
            .ok_or(SolSocialError::MathOverflow)?;
    }

    // Transfer creator share
    if distribution.creator_amount > 0 {
        let creator_lamports = user_profile.to_account_info().lamports();
        **user_profile.to_account_info().lamports.borrow_mut() = creator_lamports
            .checked_add(distribution.creator_amount)
            .ok_or(SolSocialError::MathOverflow)?;

        user_profile.total_earnings = user_profile.total_earnings
            .checked_add(distribution.creator_amount)
            .ok_or(SolSocialError::MathOverflow)?;
    }

    // Transfer protocol share
    if distribution.protocol_amount > 0 {
        let protocol_lamports = protocol_treasury.lamports();
        **protocol_treasury.lamports.borrow_mut() = protocol_lamports
            .checked_add(distribution.protocol_amount)
            .ok_or(SolSocialError::MathOverflow)?;
    }

    // Transfer referrer share if applicable
    if let Some(ref mut referrer) = referrer_profile {
        if distribution.referrer_amount > 0 {
            let referrer_lamports = referrer.to_account_info().lamports();
            **referrer.to_account_info().lamports.borrow_mut() = referrer_lamports
                .checked_add(distribution.referrer_amount)
                .ok_or(SolSocialError::MathOverflow)?;

            referrer.total_earnings = referrer.total_earnings
                .checked_add(distribution.referrer_amount)
                .ok_or(SolSocialError::MathOverflow)?;

            referrer.referral_earnings = referrer.referral_earnings
                .checked_add(distribution.referrer_amount)
                .ok_or(SolSocialError::MathOverflow)?;
        }
    }

    Ok(distribution)
}

pub fn calculate_creator_lifetime_value(
    total_key_supply: u64,
    current_price: u64,
    total_volume: u64,
) -> Result<u64> {
    let market_cap = total_key_supply
        .checked_mul(current_price)
        .ok_or(SolSocialError::MathOverflow)?;

    let volume_multiplier = if total_volume > 0 {
        let volume_factor = total_volume
            .checked_div(1_000_000_000) // 1 SOL in lamports
            .unwrap_or(1)
            .min(10); // Cap at 10x multiplier
        
        volume_factor
            .checked_add(10)
            .ok_or(SolSocialError::MathOverflow)?
    } else {
        10
    };

    let lifetime_value = market_cap
        .checked_mul(CREATOR_SHARE_BPS as u64)
        .ok_or(SolSocialError::MathOverflow)?
        .checked_div(BASIS_POINTS as u64)
        .ok_or(SolSocialError::MathOverflow)?
        .checked_mul(volume_multiplier)
        .ok_or(SolSocialError::MathOverflow)?
        .checked_div(10)
        .ok_or(SolSocialError::MathOverflow)?;

    Ok(lifetime_value)
}

pub fn update_revenue_metrics(
    user_profile: &mut UserProfile,
    trade_amount: u64,
    is_buy: bool,
) -> Result<()> {
    user_profile.total_volume = user_profile.total_volume
        .checked_add(trade_amount)
        .ok_or(SolSocialError::MathOverflow)?;

    if is_buy {
        user_profile.buy_volume = user_profile.buy_volume
            .checked_add(trade_amount)
            .ok_or(SolSocialError::MathOverflow)?;
    } else {
        user_profile.sell_volume = user_profile.sell_volume
            .checked_add(trade_amount)
            .ok_or(SolSocialError::MathOverflow)?;
    }

    let current_time = Clock::get()?.unix_timestamp;
    user_profile.last_trade_timestamp = current_time;

    Ok(())
}

pub fn calculate_dynamic_fee_rate(
    base_fee_bps: u16,
    volume_24h: u64,
    holder_count: u32,
) -> Result<u16> {
    let mut adjusted_fee = base_fee_bps;

    // Volume-based discount (higher volume = lower fees)
    if volume_24h > 100_000_000_000 { // > 100 SOL
        adjusted_fee = adjusted_fee
            .checked_mul(90)
            .ok_or(SolSocialError::MathOverflow)?
            .checked_div(100)
            .ok_or(SolSocialError::MathOverflow)?;
    } else if volume_24h > 10_000_000_000 { // > 10 SOL
        adjusted_fee = adjusted_fee
            .checked_mul(95)
            .ok_or(SolSocialError::MathOverflow)?
            .checked_div(100)
            .ok_or(SolSocialError::MathOverflow)?;
    }

    // Holder count bonus (more holders = lower fees)
    if holder_count > 1000 {
        adjusted_fee = adjusted_fee
            .checked_mul(85)
            .ok_or(SolSocialError::MathOverflow)?
            .checked_div(100)
            .ok_or(SolSocialError::MathOverflow)?;
    } else if holder_count > 100 {
        adjusted_fee = adjusted_fee
            .checked_mul(90)
            .ok_or(SolSocialError::MathOverflow)?
            .checked_div(100)
            .ok_or(SolSocialError::MathOverflow)?;
    }

    // Ensure minimum fee
    let min_fee = base_fee_bps
        .checked_div(2)
        .ok_or(SolSocialError::MathOverflow)?;
    
    Ok(adjusted_fee.max(min_fee))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_revenue_distribution_calculation() {
        let total_amount = 1_000_000_000; // 1 SOL
        let distribution = calculate_revenue_distribution(total_amount, true).unwrap();
        
        assert_eq!(distribution.creator_amount, 50_000_000); // 5%
        assert_eq!(distribution.protocol_amount, 25_000_000); // 2.5%
        assert_eq!(distribution.referrer_amount, 10_000_000); // 1%
        assert_eq!(distribution.remaining_amount, 915_000_000); // 91.5%
    }

    #[test]
    fn test_revenue_distribution_no_referrer() {
        let total_amount = 1_000_000_000; // 1 SOL
        let distribution = calculate_revenue_distribution(total_amount, false).unwrap();
        
        assert_eq!(distribution.creator_amount, 50_000_000); // 5%
        assert_eq!(distribution.protocol_amount, 25_000_000); // 2.5%
        assert_eq!(distribution.referrer_amount, 0); // 0%
        assert_eq!(distribution.remaining_amount, 925_000_000); // 92.5%
    }

    #[test]
    fn test_dynamic_fee_calculation() {
        let base_fee = 500; // 5%
        
        // Low volume, low holders
        let fee1 = calculate_dynamic_fee_rate(base_fee, 1_000_000_000, 10).unwrap();
        assert_eq!(fee1, base_fee);
        
        // High volume, high holders
        let fee2 = calculate_dynamic_fee_rate(base_fee, 200_000_000_000, 2000).unwrap();
        assert!(fee2 < base_fee);
    }
}