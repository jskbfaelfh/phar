import { describe, it, expect } from '@jest/globals';

/**
 * Iraqi Dinar Currency & Pharmaceutical Pricing Mathematical Model
 */
export const MIN_IQD_UNIT = 250;

export const roundTo250 = (amount: number): number => {
  if (!amount || amount <= 0) return 0;
  return Math.max(MIN_IQD_UNIT, Math.round(amount / MIN_IQD_UNIT) * MIN_IQD_UNIT);
};

export const calculateStripPrice = (packPrice: number, unitsPerPack: number): number => {
  if (!packPrice || packPrice <= 0 || !unitsPerPack || unitsPerPack <= 0) return 0;
  return Math.max(MIN_IQD_UNIT, Math.round(packPrice / unitsPerPack / MIN_IQD_UNIT) * MIN_IQD_UNIT);
};

export const validateMinimumMarginPrice = (sellingPrice: number, purchaseCost: number): { isValid: boolean; minimumAllowedPrice: number } => {
  const minAllowed = Math.round(purchaseCost * 1.2);
  return {
    isValid: sellingPrice >= minAllowed,
    minimumAllowedPrice: minAllowed,
  };
};

export const calculateBonusAmortization = (
  quantityPacks: number,
  bonusPacks: number,
  purchasePricePack: number,
  discountPercent: number = 0,
  amortizeBonus: boolean = true,
): { effectiveCostPerPack: number; totalCost: number; totalPacksReceived: number } => {
  const lineGrossCost = quantityPacks * purchasePricePack;
  const lineDiscountAmount = lineGrossCost * (discountPercent / 100);
  const totalCost = lineGrossCost - lineDiscountAmount;
  const totalPacksReceived = quantityPacks + bonusPacks;

  const effectiveCostPerPack = amortizeBonus && totalPacksReceived > 0
    ? totalCost / totalPacksReceived
    : (quantityPacks > 0 ? totalCost / quantityPacks : purchasePricePack);

  return {
    effectiveCostPerPack: Math.round(effectiveCostPerPack),
    totalCost: Math.round(totalCost),
    totalPacksReceived,
  };
};

describe('Unit Tests: Pharmaceutical Pricing & Financial Engine', () => {
  describe('roundTo250 & Iraqi Dinar Currency Enforcement', () => {
    it('should return 0 for zero or negative values', () => {
      expect(roundTo250(0)).toBe(0);
      expect(roundTo250(-500)).toBe(0);
    });

    it('should round small positive values up to minimum IQD currency (250 IQD)', () => {
      expect(roundTo250(100)).toBe(250);
      expect(roundTo250(240)).toBe(250);
      expect(roundTo250(1)).toBe(250);
    });

    it('should round numbers mathematically to nearest 250 IQD multiple', () => {
      expect(roundTo250(1240)).toBe(1250);
      expect(roundTo250(1380)).toBe(1500);
      expect(roundTo250(5000)).toBe(5000);
      expect(roundTo250(5125)).toBe(5250);
      expect(roundTo250(5120)).toBe(5000);
    });
  });

  describe('calculateStripPrice from Pack Price', () => {
    it('should return 0 if pack price or unitsPerPack is 0 or negative', () => {
      expect(calculateStripPrice(0, 2)).toBe(0);
      expect(calculateStripPrice(5000, 0)).toBe(0);
      expect(calculateStripPrice(-1000, 2)).toBe(0);
    });

    it('should accurately calculate strip price for 2 strips per pack', () => {
      // 5,000 / 2 = 2,500
      expect(calculateStripPrice(5000, 2)).toBe(2500);
      // 3,000 / 2 = 1,500
      expect(calculateStripPrice(3000, 2)).toBe(1500);
    });

    it('should round strip price to nearest 250 IQD for odd divisions', () => {
      // 5,000 / 3 = 1,666.67 -> rounds to 1,750
      expect(calculateStripPrice(5000, 3)).toBe(1750);
      // 10,000 / 3 = 3,333.33 -> rounds to 3,250
      expect(calculateStripPrice(10000, 3)).toBe(3250);
      // 7,000 / 4 = 1,750
      expect(calculateStripPrice(7000, 4)).toBe(1750);
    });

    it('should enforce minimum 250 IQD even for very cheap packs', () => {
      // 500 / 10 = 50 -> minimum 250
      expect(calculateStripPrice(500, 10)).toBe(250);
    });
  });

  describe('Minimum Margin Rule (Cost * 1.2 to Prevent Losses)', () => {
    it('should accept prices with at least 20% margin above purchase cost', () => {
      const res = validateMinimumMarginPrice(1500, 1000);
      expect(res.isValid).toBe(true);
      expect(res.minimumAllowedPrice).toBe(1200);
    });

    it('should strictly reject prices below 20% margin', () => {
      const res = validateMinimumMarginPrice(1100, 1000);
      expect(res.isValid).toBe(false);
      expect(res.minimumAllowedPrice).toBe(1200);
    });

    it('should accept price exactly matching 1.2x cost', () => {
      const res = validateMinimumMarginPrice(1200, 1000);
      expect(res.isValid).toBe(true);
      expect(res.minimumAllowedPrice).toBe(1200);
    });
  });

  describe('Bonus Amortization & Purchase Net Calculations', () => {
    it('should amortize bonus packs across total received packs when amortizeBonus is TRUE', () => {
      // Buy 10 packs at 10,000 IQD with 2 bonus packs = 12 total packs for 100,000 IQD cost
      // Net cost per pack = 100,000 / 12 = 8,333 IQD
      const res = calculateBonusAmortization(10, 2, 10000, 0, true);
      expect(res.totalPacksReceived).toBe(12);
      expect(res.totalCost).toBe(100000);
      expect(res.effectiveCostPerPack).toBe(8333);
    });

    it('should preserve undiluted purchase cost when amortizeBonus is FALSE (separate zero-cost bonus batch)', () => {
      // Buy 10 packs at 10,000 with 2 bonus packs, but keep separate batches
      // Main batch stays at 10,000 IQD
      const res = calculateBonusAmortization(10, 2, 10000, 0, false);
      expect(res.totalPacksReceived).toBe(12);
      expect(res.totalCost).toBe(100000);
      expect(res.effectiveCostPerPack).toBe(10000);
    });

    it('should apply purchase discount percent correctly before bonus amortization', () => {
      // Buy 10 packs at 10,000 with 10% discount = 90,000 IQD net.
      // 2 bonus packs -> 12 packs total -> 90,000 / 12 = 7,500 IQD
      const res = calculateBonusAmortization(10, 2, 10000, 10, true);
      expect(res.totalCost).toBe(90000);
      expect(res.effectiveCostPerPack).toBe(7500);
    });
  });
});
