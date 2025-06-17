use anchor_lang::prelude::*;
use std::cmp;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BondingCurveError {
    InvalidSupply,
    InvalidAmount,
    InsufficientFunds,
    Overflow,
    PriceCalculationFailed,
    InvalidCurveParameters,
}

impl From<BondingCurveError> for Error {
    fn from(e: BondingCurveError) -> Self {
        match e {
            BondingCurveError::InvalidSupply => Error::from(ErrorCode::InvalidSupply),
            BondingCurveError::InvalidAmount => Error::from(ErrorCode::InvalidAmount),
            BondingCurveError::InsufficientFunds => Error::from(ErrorCode::InsufficientFunds),
            BondingCurveError::Overflow => Error::from(ErrorCode::Overflow),
            BondingCurveError::PriceCalculationFailed => Error::from(ErrorCode::PriceCalculationFailed),
            BondingCurveError::InvalidCurveParameters => Error::from(ErrorCode::InvalidCurveParameters),
        }
    }
}

#[error_code]
pub enum ErrorCode {
    #[msg("Invalid supply amount")]
    InvalidSupply,
    #[msg("Invalid amount")]
    InvalidAmount,
    #[msg("Insufficient funds")]
    InsufficientFunds,
    #[msg("Arithmetic overflow")]
    Overflow,
    #[msg("Price calculation failed")]
    PriceCalculationFailed,
    #[msg("Invalid curve parameters")]
    InvalidCurveParameters,
}

pub struct BondingCurve {
    pub base_price: u64,
    pub slope: u64,
    pub max_supply: u64,
    pub creator_fee_bps: u16,
    pub protocol_fee_bps: u16,
}

impl BondingCurve {
    pub const PRECISION: u64 = 1_000_000_000;
    pub const MAX_FEE_BPS: u16 = 1000;
    pub const DEFAULT_BASE_PRICE: u64 = 1_000_000;
    pub const DEFAULT_SLOPE: u64 = 16_000;
    pub const DEFAULT_MAX_SUPPLY: u64 = 1_000_000_000_000;
    pub const DEFAULT_CREATOR_FEE_BPS: u16 = 500;
    pub const DEFAULT_PROTOCOL_FEE_BPS: u16 = 250;

    pub fn new(
        base_price: Option<u64>,
        slope: Option<u64>,
        max_supply: Option<u64>,
        creator_fee_bps: Option<u16>,
        protocol_fee_bps: Option<u16>,
    ) -> Result<Self> {
        let creator_fee = creator_fee_bps.unwrap_or(Self::DEFAULT_CREATOR_FEE_BPS);
        let protocol_fee = protocol_fee_bps.unwrap_or(Self::DEFAULT_PROTOCOL_FEE_BPS);

        require!(
            creator_fee <= Self::MAX_FEE_BPS,
            BondingCurveError::InvalidCurveParameters
        );
        require!(
            protocol_fee <= Self::MAX_FEE_BPS,
            BondingCurveError::InvalidCurveParameters
        );
        require!(
            creator_fee + protocol_fee <= Self::MAX_FEE_BPS,
            BondingCurveError::InvalidCurveParameters
        );

        let base = base_price.unwrap_or(Self::DEFAULT_BASE_PRICE);
        let slope_val = slope.unwrap_or(Self::DEFAULT_SLOPE);
        let max_sup = max_supply.unwrap_or(Self::DEFAULT_MAX_SUPPLY);

        require!(base > 0, BondingCurveError::InvalidCurveParameters);
        require!(slope_val > 0, BondingCurveError::InvalidCurveParameters);
        require!(max_sup > 0, BondingCurveError::InvalidCurveParameters);

        Ok(Self {
            base_price: base,
            slope: slope_val,
            max_supply: max_sup,
            creator_fee_bps: creator_fee,
            protocol_fee_bps: protocol_fee,
        })
    }

    pub fn get_price(&self, supply: u64) -> Result<u64> {
        require!(supply <= self.max_supply, BondingCurveError::InvalidSupply);

        let supply_squared = supply
            .checked_mul(supply)
            .ok_or(BondingCurveError::Overflow)?;

        let slope_component = supply_squared
            .checked_mul(self.slope)
            .ok_or(BondingCurveError::Overflow)?
            .checked_div(Self::PRECISION)
            .ok_or(BondingCurveError::PriceCalculationFailed)?;

        let price = self.base_price
            .checked_add(slope_component)
            .ok_or(BondingCurveError::Overflow)?;

        Ok(price)
    }

    pub fn get_buy_price(&self, supply: u64, amount: u64) -> Result<u64> {
        require!(amount > 0, BondingCurveError::InvalidAmount);
        require!(supply <= self.max_supply, BondingCurveError::InvalidSupply);
        
        let new_supply = supply
            .checked_add(amount)
            .ok_or(BondingCurveError::Overflow)?;
        
        require!(new_supply <= self.max_supply, BondingCurveError::InvalidSupply);

        let price_before = self.get_price(supply)?;
        let price_after = self.get_price(new_supply)?;

        let average_price = price_before
            .checked_add(price_after)
            .ok_or(BondingCurveError::Overflow)?
            .checked_div(2)
            .ok_or(BondingCurveError::PriceCalculationFailed)?;

        let total_cost = average_price
            .checked_mul(amount)
            .ok_or(BondingCurveError::Overflow)?;

        Ok(total_cost)
    }

    pub fn get_sell_price(&self, supply: u64, amount: u64) -> Result<u64> {
        require!(amount > 0, BondingCurveError::InvalidAmount);
        require!(supply >= amount, BondingCurveError::InvalidSupply);

        let new_supply = supply
            .checked_sub(amount)
            .ok_or(BondingCurveError::InvalidSupply)?;

        let price_before = self.get_price(supply)?;
        let price_after = self.get_price(new_supply)?;

        let average_price = price_before
            .checked_add(price_after)
            .ok_or(BondingCurveError::Overflow)?
            .checked_div(2)
            .ok_or(BondingCurveError::PriceCalculationFailed)?;

        let total_value = average_price
            .checked_mul(amount)
            .ok_or(BondingCurveError::Overflow)?;

        Ok(total_value)
    }

    pub fn get_buy_price_after_fees(&self, supply: u64, amount: u64) -> Result<BuyPriceBreakdown> {
        let base_price = self.get_buy_price(supply, amount)?;
        
        let creator_fee = base_price
            .checked_mul(self.creator_fee_bps as u64)
            .ok_or(BondingCurveError::Overflow)?
            .checked_div(10000)
            .ok_or(BondingCurveError::PriceCalculationFailed)?;

        let protocol_fee = base_price
            .checked_mul(self.protocol_fee_bps as u64)
            .ok_or(BondingCurveError::Overflow)?
            .checked_div(10000)
            .ok_or(BondingCurveError::PriceCalculationFailed)?;

        let total_price = base_price
            .checked_add(creator_fee)
            .ok_or(BondingCurveError::Overflow)?
            .checked_add(protocol_fee)
            .ok_or(BondingCurveError::Overflow)?;

        Ok(BuyPriceBreakdown {
            base_price,
            creator_fee,
            protocol_fee,
            total_price,
        })
    }

    pub fn get_sell_price_after_fees(&self, supply: u64, amount: u64) -> Result<SellPriceBreakdown> {
        let base_price = self.get_sell_price(supply, amount)?;
        
        let creator_fee = base_price
            .checked_mul(self.creator_fee_bps as u64)
            .ok_or(BondingCurveError::Overflow)?
            .checked_div(10000)
            .ok_or(BondingCurveError::PriceCalculationFailed)?;

        let protocol_fee = base_price
            .checked_mul(self.protocol_fee_bps as u64)
            .ok_or(BondingCurveError::Overflow)?
            .checked_div(10000)
            .ok_or(BondingCurveError::PriceCalculationFailed)?;

        let net_price = base_price
            .checked_sub(creator_fee)
            .ok_or(BondingCurveError::InsufficientFunds)?
            .checked_sub(protocol_fee)
            .ok_or(BondingCurveError::InsufficientFunds)?;

        Ok(SellPriceBreakdown {
            base_price,
            creator_fee,
            protocol_fee,
            net_price,
        })
    }

    pub fn calculate_max_buy_amount(&self, supply: u64, max_payment: u64) -> Result<u64> {
        require!(max_payment > 0, BondingCurveError::InvalidAmount);
        require!(supply < self.max_supply, BondingCurveError::InvalidSupply);

        let mut low = 0u64;
        let mut high = cmp::min(self.max_supply - supply, max_payment);
        let mut result = 0u64;

        while low <= high {
            let mid = low + (high - low) / 2;
            
            if mid == 0 {
                break;
            }

            match self.get_buy_price_after_fees(supply, mid) {
                Ok(breakdown) => {
                    if breakdown.total_price <= max_payment {
                        result = mid;
                        low = mid + 1;
                    } else {
                        if mid == 0 {
                            break;
                        }
                        high = mid - 1;
                    }
                }
                Err(_) => {
                    if mid == 0 {
                        break;
                    }
                    high = mid - 1;
                }
            }
        }

        Ok(result)
    }

    pub fn get_market_cap(&self, supply: u64) -> Result<u64> {
        let price = self.get_price(supply)?;
        let market_cap = price
            .checked_mul(supply)
            .ok_or(BondingCurveError::Overflow)?;
        Ok(market_cap)
    }

    pub fn get_liquidity(&self, supply: u64) -> Result<u64> {
        if supply == 0 {
            return Ok(0);
        }

        let total_value = self.get_sell_price(supply, supply)?;
        Ok(total_value)
    }
}

#[derive(Debug, Clone, Copy)]
pub struct BuyPriceBreakdown {
    pub base_price: u64,
    pub creator_fee: u64,
    pub protocol_fee: u64,
    pub total_price: u64,
}

#[derive(Debug, Clone, Copy)]
pub struct SellPriceBreakdown {
    pub base_price: u64,
    pub creator_fee: u64,
    pub protocol_fee: u64,
    pub net_price: u64,
}

#[derive(Debug, Clone, Copy)]
pub struct CurveStats {
    pub current_price: u64,
    pub market_cap: u64,
    pub liquidity: u64,
    pub supply: u64,
    pub max_supply: u64,
}

impl BondingCurve {
    pub fn get_curve_stats(&self, supply: u64) -> Result<CurveStats> {
        let current_price = self.get_price(supply)?;
        let market_cap = self.get_market_cap(supply)?;
        let liquidity = self.get_liquidity(supply)?;

        Ok(CurveStats {
            current_price,
            market_cap,
            liquidity,
            supply,
            max_supply: self.max_supply,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_bonding_curve_creation() {
        let curve = BondingCurve::new(None, None, None, None, None).unwrap();
        assert_eq!(curve.base_price, BondingCurve::DEFAULT_BASE_PRICE);
        assert_eq!(curve.slope, BondingCurve::DEFAULT_SLOPE);
        assert_eq!(curve.creator_fee_bps, BondingCurve::DEFAULT_CREATOR_FEE_BPS);
        assert_eq!(curve.protocol_fee_bps, BondingCurve::DEFAULT_PROTOCOL_FEE_BPS);
    }

    #[test]
    fn test_price_calculation() {
        let curve = BondingCurve::new(
            Some(1_000_000),
            Some(16_000),
            Some(1_000_000_000_000),
            Some(500),
            Some(250),
        ).unwrap();

        let price_at_zero = curve.get_price(0).unwrap();
        assert_eq!(price_at_zero, 1_000_000);

        let price_at_1000 = curve.get_price(1000).unwrap();
        assert!(price_at_1000 > price_at_zero);
    }

    #[test]
    fn test_buy_sell_symmetry() {
        let curve = BondingCurve::new(None, None, None, Some(0), Some(0)).unwrap();
        let supply = 1000;
        let amount = 100;

        let buy_price = curve.get_buy_price(supply, amount).unwrap();
        let sell_price = curve.get_sell_price(supply + amount, amount).unwrap();

        assert_eq!(buy_price, sell_price);
    }

    #[test]
    fn test_fee_calculation() {
        let curve = BondingCurve::new(None, None, None, Some(500), Some(250)).unwrap();
        let supply = 1000;
        let amount = 100;

        let breakdown = curve.get_buy_price_after_fees(supply, amount).unwrap();
        
        assert!(breakdown.creator_fee > 0);
        assert!(breakdown.protocol_fee > 0);
        assert_eq!(
            breakdown.total_price,
            breakdown.base_price + breakdown.creator_fee + breakdown.protocol_fee
        );
    }