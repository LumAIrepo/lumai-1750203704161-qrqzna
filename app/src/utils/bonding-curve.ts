```typescript
import { PublicKey } from '@solana/web3.js';
import BN from 'bn.js';

export interface BondingCurveConfig {
  basePrice: number;
  priceIncrement: number;
  maxSupply: number;
  creatorFeePercent: number;
  protocolFeePercent: number;
}

export interface TradeQuote {
  price: number;
  priceAfterFees: number;
  creatorFee: number;
  protocolFee: number;
  totalCost: number;
  newSupply: number;
  priceImpact: number;
}

export interface KeyMetrics {
  currentPrice: number;
  marketCap: number;
  totalVolume: number;
  holders: number;
  supply: number;
  maxSupply: number;
  creatorEarnings: number;
}

export class BondingCurveCalculator {
  private config: BondingCurveConfig;

  constructor(config: BondingCurveConfig) {
    this.config = {
      basePrice: Math.max(0.001, config.basePrice),
      priceIncrement: Math.max(0.0001, config.priceIncrement),
      maxSupply: Math.max(1, config.maxSupply),
      creatorFeePercent: Math.max(0, Math.min(10, config.creatorFeePercent)),
      protocolFeePercent: Math.max(0, Math.min(5, config.protocolFeePercent))
    };
  }

  calculatePrice(supply: number): number {
    if (supply < 0) return this.config.basePrice;
    if (supply >= this.config.maxSupply) return this.getPriceAtSupply(this.config.maxSupply);
    
    return this.config.basePrice + (supply * this.config.priceIncrement);
  }

  private getPriceAtSupply(supply: number): number {
    return this.config.basePrice + (supply * this.config.priceIncrement);
  }

  calculateBuyQuote(currentSupply: number, amount: number): TradeQuote {
    if (amount <= 0) {
      throw new Error('Amount must be greater than 0');
    }

    if (currentSupply < 0) {
      throw new Error('Current supply cannot be negative');
    }

    const newSupply = Math.min(currentSupply + amount, this.config.maxSupply);
    const actualAmount = newSupply - currentSupply;

    if (actualAmount <= 0) {
      throw new Error('Cannot buy more keys, max supply reached');
    }

    const averagePrice = this.calculateAveragePrice(currentSupply, newSupply);
    const totalCost = averagePrice * actualAmount;
    
    const creatorFee = totalCost * (this.config.creatorFeePercent / 100);
    const protocolFee = totalCost * (this.config.protocolFeePercent / 100);
    const priceAfterFees = totalCost + creatorFee + protocolFee;

    const priceImpact = actualAmount < amount ? 
      ((amount - actualAmount) / amount) * 100 : 0;

    return {
      price: averagePrice,
      priceAfterFees,
      creatorFee,
      protocolFee,
      totalCost: priceAfterFees,
      newSupply,
      priceImpact
    };
  }

  calculateSellQuote(currentSupply: number, amount: number): TradeQuote {
    if (amount <= 0) {
      throw new Error('Amount must be greater than 0');
    }

    if (currentSupply <= 0) {
      throw new Error('No keys to sell');
    }

    const newSupply = Math.max(currentSupply - amount, 0);
    const actualAmount = currentSupply - newSupply;

    if (actualAmount <= 0) {
      throw new Error('Cannot sell more keys than available');
    }

    const averagePrice = this.calculateAveragePrice(newSupply, currentSupply);
    const totalRevenue = averagePrice * actualAmount;
    
    const creatorFee = totalRevenue * (this.config.creatorFeePercent / 100);
    const protocolFee = totalRevenue * (this.config.protocolFeePercent / 100);
    const priceAfterFees = totalRevenue - creatorFee - protocolFee;

    const priceImpact = actualAmount < amount ? 
      ((amount - actualAmount) / amount) * 100 : 0;

    return {
      price: averagePrice,
      priceAfterFees,
      creatorFee,
      protocolFee,
      totalCost: priceAfterFees,
      newSupply,
      priceImpact
    };
  }

  private calculateAveragePrice(startSupply: number, endSupply: number): number {
    if (startSupply === endSupply) {
      return this.calculatePrice(startSupply);
    }

    const start = Math.max(0, startSupply);
    const end = Math.max(0, endSupply);
    
    if (start > end) {
      return this.calculateAveragePrice(end, start);
    }

    // Calculate integral of linear price function
    const startPrice = this.calculatePrice(start);
    const endPrice = this.calculatePrice(end);
    
    return (startPrice + endPrice) / 2;
  }

  calculateMarketCap(supply: number): number {
    if (supply <= 0) return 0;
    
    const currentPrice = this.calculatePrice(supply);
    return currentPrice * supply;
  }

  getKeyMetrics(
    supply: number, 
    totalVolume: number, 
    holders: number, 
    creatorEarnings: number
  ): KeyMetrics {
    return {
      currentPrice: this.calculatePrice(supply),
      marketCap: this.calculateMarketCap(supply),
      totalVolume: Math.max(0, totalVolume),
      holders: Math.max(0, holders),
      supply: Math.max(0, supply),
      maxSupply: this.config.maxSupply,
      creatorEarnings: Math.max(0, creatorEarnings)
    };
  }

  validateTradeAmount(amount: number, maxAmount: number): boolean {
    return amount > 0 && amount <= maxAmount && Number.isFinite(amount);
  }

  calculatePriceImpact(currentSupply: number, tradeAmount: number, isBuy: boolean): number {
    try {
      if (isBuy) {
        const quote = this.calculateBuyQuote(currentSupply, tradeAmount);
        return quote.priceImpact;
      } else {
        const quote = this.calculateSellQuote(currentSupply, tradeAmount);
        return quote.priceImpact;
      }
    } catch {
      return 100; // Maximum impact if calculation fails
    }
  }

  getOptimalTradeSize(
    currentSupply: number, 
    maxPriceImpact: number, 
    isBuy: boolean
  ): number {
    let low = 0.1;
    let high = isBuy ? 
      Math.max(1, this.config.maxSupply - currentSupply) : 
      Math.max(1, currentSupply);
    
    let optimalSize = low;

    while (high - low > 0.01) {
      const mid = (low + high) / 2;
      const impact = this.calculatePriceImpact(currentSupply, mid, isBuy);
      
      if (impact <= maxPriceImpact) {
        optimalSize = mid;
        low = mid;
      } else {
        high = mid;
      }
    }

    return Math.max(0.1, optimalSize);
  }

  formatPrice(price: number): string {
    if (price < 0.001) {
      return price.toExponential(2);
    } else if (price < 1) {
      return price.toFixed(4);
    } else if (price < 1000) {
      return price.toFixed(2);
    } else {
      return price.toLocaleString(undefined, { 
        minimumFractionDigits: 0,
        maximumFractionDigits: 0 
      });
    }
  }

  formatAmount(amount: number): string {
    if (amount < 1000) {
      return amount.toFixed(1);
    } else if (amount < 1000000) {
      return `${(amount / 1000).toFixed(1)}K`;
    } else {
      return `${(amount / 1000000).toFixed(1)}M`;
    }
  }
}

export const DEFAULT_BONDING_CURVE_CONFIG: BondingCurveConfig = {
  basePrice: 0.001,
  priceIncrement: 0.0001,
  maxSupply: 1000000,
  creatorFeePercent: 5,
  protocolFeePercent: 2.5
};

export function createBondingCurve(config?: Partial<BondingCurveConfig>): BondingCurveCalculator {
  const finalConfig = { ...DEFAULT_BONDING_CURVE_CONFIG, ...config };
  return new BondingCurveCalculator(finalConfig);
}

export function calculateKeyPrice(supply: number, config?: BondingCurveConfig): number {
  const curve = new BondingCurveCalculator(config || DEFAULT_BONDING_CURVE_CONFIG);
  return curve.calculatePrice(supply);
}

export function calculateTradeQuote(
  currentSupply: number,
  amount: number,
  isBuy: boolean,
  config?: BondingCurveConfig
): TradeQuote {
  const curve = new BondingCurveCalculator(config || DEFAULT_BONDING_CURVE_CONFIG);
  return isBuy ? 
    curve.calculateBuyQuote(currentSupply, amount) :
    curve.calculateSellQuote(currentSupply, amount);
}

export function validateBondingCurveConfig(config: BondingCurveConfig): boolean {
  return (
    config.basePrice > 0 &&
    config.priceIncrement > 0 &&
    config.maxSupply > 0 &&
    config.creatorFeePercent >= 0 &&
    config.creatorFeePercent <= 100 &&
    config.protocolFeePercent >= 0 &&
    config.protocolFeePercent <= 100 &&
    (config.creatorFeePercent + config.protocolFeePercent) <= 100
  );
}
```