import { describe, it, expect } from '@jest/globals';

export interface StockItemRecord {
  inventoryItemId: string;
  tradeName: string;
  unitsPerPack: number;
  systemUnits: number;
  purchasePricePack: number;
  sellingPricePack: number;
  countedPacks: number;
  countedLoose: number;
}

export interface VarianceCalculation {
  countedTotalUnits: number;
  varianceUnits: number; // counted - system
  variancePacks: number;
  varianceCost: number;
  varianceRetail: number;
  status: 'MATCHED' | 'SHORTAGE' | 'SURPLUS';
}

export const evaluateStocktakeItem = (item: StockItemRecord): VarianceCalculation => {
  const unitsPerPack = Math.max(1, item.unitsPerPack);
  const countedTotalUnits = item.countedPacks * unitsPerPack + item.countedLoose;
  const varianceUnits = countedTotalUnits - item.systemUnits;
  const variancePacks = Math.round((varianceUnits / unitsPerPack) * 100) / 100;

  const costPerUnit = item.purchasePricePack / unitsPerPack;
  const retailPerUnit = item.sellingPricePack / unitsPerPack;

  const varianceCost = Math.round(varianceUnits * costPerUnit);
  const varianceRetail = Math.round(varianceUnits * retailPerUnit);

  let status: 'MATCHED' | 'SHORTAGE' | 'SURPLUS' = 'MATCHED';
  if (varianceUnits < 0) status = 'SHORTAGE';
  else if (varianceUnits > 0) status = 'SURPLUS';

  return {
    countedTotalUnits,
    varianceUnits,
    variancePacks,
    varianceCost,
    varianceRetail,
    status,
  };
};

export const summarizeStocktakeSession = (items: VarianceCalculation[]) => {
  let totalSystemItems = items.length;
  let totalCountedItems = 0;
  let totalVarianceUnits = 0;
  let totalDeficitCost = 0;
  let totalSurplusCost = 0;

  for (const item of items) {
    totalCountedItems++;
    totalVarianceUnits += item.varianceUnits;
    if (item.varianceCost < 0) {
      totalDeficitCost += Math.abs(item.varianceCost);
    } else if (item.varianceCost > 0) {
      totalSurplusCost += item.varianceCost;
    }
  }

  const netVarianceCost = totalSurplusCost - totalDeficitCost;

  return {
    totalSystemItems,
    totalCountedItems,
    totalVarianceUnits,
    totalDeficitCost,
    totalSurplusCost,
    netVarianceCost,
  };
};

describe('Unit Tests: Stocktake Auditing & Reconciliation Engine', () => {
  it('should detect exact match when counted units equal system units', () => {
    const res = evaluateStocktakeItem({
      inventoryItemId: 'inv-1',
      tradeName: 'Panadol Extra',
      unitsPerPack: 2,
      systemUnits: 20, // 10 packs
      purchasePricePack: 4000,
      sellingPricePack: 5000,
      countedPacks: 10,
      countedLoose: 0,
    });

    expect(res.countedTotalUnits).toBe(20);
    expect(res.varianceUnits).toBe(0);
    expect(res.variancePacks).toBe(0);
    expect(res.varianceCost).toBe(0);
    expect(res.status).toBe('MATCHED');
  });

  it('should detect inventory shortage (deficit) accurately with cost and retail impact', () => {
    const res = evaluateStocktakeItem({
      inventoryItemId: 'inv-2',
      tradeName: 'Amoxicillin 500mg',
      unitsPerPack: 2, // 2 strips per pack
      systemUnits: 10, // 5 packs expected
      purchasePricePack: 2000, // 1,000 per strip
      sellingPricePack: 3000, // 1,500 per strip
      countedPacks: 3,
      countedLoose: 1, // Counted: 3*2 + 1 = 7 strips
    });

    expect(res.countedTotalUnits).toBe(7);
    expect(res.varianceUnits).toBe(-3); // Deficit of 3 strips
    expect(res.variancePacks).toBe(-1.5);
    expect(res.varianceCost).toBe(-3000); // 3 * 1000 cost deficit
    expect(res.varianceRetail).toBe(-4500); // 3 * 1500 retail deficit
    expect(res.status).toBe('SHORTAGE');
  });

  it('should detect inventory surplus accurately with positive variance', () => {
    const res = evaluateStocktakeItem({
      inventoryItemId: 'inv-3',
      tradeName: 'Cataflam 50mg',
      unitsPerPack: 1,
      systemUnits: 5,
      purchasePricePack: 1500,
      sellingPricePack: 2500,
      countedPacks: 8,
      countedLoose: 0,
    });

    expect(res.countedTotalUnits).toBe(8);
    expect(res.varianceUnits).toBe(3);
    expect(res.variancePacks).toBe(3);
    expect(res.varianceCost).toBe(4500);
    expect(res.varianceRetail).toBe(7500);
    expect(res.status).toBe('SURPLUS');
  });

  it('should summarize an entire stocktake audit session correctly', () => {
    const item1 = evaluateStocktakeItem({
      inventoryItemId: 'i1',
      tradeName: 'Med A',
      unitsPerPack: 1,
      systemUnits: 10,
      purchasePricePack: 1000,
      sellingPricePack: 1500,
      countedPacks: 8, // -2 deficit (-2,000 cost)
      countedLoose: 0,
    });

    const item2 = evaluateStocktakeItem({
      inventoryItemId: 'i2',
      tradeName: 'Med B',
      unitsPerPack: 1,
      systemUnits: 5,
      purchasePricePack: 2000,
      sellingPricePack: 3000,
      countedPacks: 8, // +3 surplus (+6,000 cost)
      countedLoose: 0,
    });

    const summary = summarizeStocktakeSession([item1, item2]);
    expect(summary.totalSystemItems).toBe(2);
    expect(summary.totalCountedItems).toBe(2);
    expect(summary.totalVarianceUnits).toBe(1); // -2 + 3 = +1
    expect(summary.totalDeficitCost).toBe(2000);
    expect(summary.totalSurplusCost).toBe(6000);
    expect(summary.netVarianceCost).toBe(4000); // 6,000 - 2,000 = +4,000
  });
});
