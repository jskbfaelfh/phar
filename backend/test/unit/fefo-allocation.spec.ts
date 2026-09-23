import { describe, it, expect } from '@jest/globals';

export interface BatchItem {
  id: string;
  batchNumber: string;
  expiryDate: string; // YYYY-MM-DD
  quantityUnitsRemaining: number;
  sellingPricePack: number;
  purchasePricePack: number;
  isRecalled?: boolean;
}

export interface AllocationResult {
  batchId: string;
  batchNumber: string;
  unitsAllocated: number;
  costPricePack: number;
}

/**
 * Pure FEFO (First-Expired, First-Out) Allocation Engine
 */
export const allocateBatchesFEFO = (
  batches: BatchItem[],
  unitsRequested: number,
  todayStr: string = new Date().toISOString().split('T')[0],
): { allocations: AllocationResult[]; unallocatedUnits: number } => {
  // 1. Filter out recalled and expired batches
  const validBatches = batches.filter((b) => {
    if (b.isRecalled === true) return false;
    if (b.expiryDate < todayStr) return false;
    if (b.quantityUnitsRemaining <= 0) return false;
    return true;
  });

  // 2. Sort strictly by expiry_date ASC, then id ASC
  validBatches.sort((a, b) => {
    const expDiff = new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime();
    if (expDiff !== 0) return expDiff;
    return a.id.localeCompare(b.id);
  });

  let unitsLeft = unitsRequested;
  const allocations: AllocationResult[] = [];

  for (const batch of validBatches) {
    if (unitsLeft <= 0) break;
    const canTake = Math.min(unitsLeft, batch.quantityUnitsRemaining);
    allocations.push({
      batchId: batch.id,
      batchNumber: batch.batchNumber,
      unitsAllocated: canTake,
      costPricePack: batch.purchasePricePack,
    });
    unitsLeft -= canTake;
  }

  return {
    allocations,
    unallocatedUnits: unitsLeft,
  };
};

describe('Unit Tests: FEFO (First-Expired First-Out) Inventory Allocation Engine', () => {
  const today = '2026-09-23';

  it('should allocate stock from the earliest expiring batch first', () => {
    const batches: BatchItem[] = [
      { id: 'b2', batchNumber: 'LATE-2027', expiryDate: '2027-06-01', quantityUnitsRemaining: 10, sellingPricePack: 5000, purchasePricePack: 3500 },
      { id: 'b1', batchNumber: 'EARLY-2026', expiryDate: '2026-11-01', quantityUnitsRemaining: 5, sellingPricePack: 5000, purchasePricePack: 3500 },
    ];

    const result = allocateBatchesFEFO(batches, 4, today);
    expect(result.unallocatedUnits).toBe(0);
    expect(result.allocations.length).toBe(1);
    expect(result.allocations[0].batchNumber).toBe('EARLY-2026');
    expect(result.allocations[0].unitsAllocated).toBe(4);
  });

  it('should spill over across multiple batches when requested quantity exceeds first batch', () => {
    const batches: BatchItem[] = [
      { id: 'b1', batchNumber: 'BATCH-A', expiryDate: '2026-10-01', quantityUnitsRemaining: 3, sellingPricePack: 5000, purchasePricePack: 3000 },
      { id: 'b2', batchNumber: 'BATCH-B', expiryDate: '2026-12-01', quantityUnitsRemaining: 10, sellingPricePack: 5000, purchasePricePack: 3200 },
    ];

    const result = allocateBatchesFEFO(batches, 7, today);
    expect(result.unallocatedUnits).toBe(0);
    expect(result.allocations.length).toBe(2);
    // Takes 3 from BATCH-A
    expect(result.allocations[0].batchNumber).toBe('BATCH-A');
    expect(result.allocations[0].unitsAllocated).toBe(3);
    // Takes 4 from BATCH-B
    expect(result.allocations[1].batchNumber).toBe('BATCH-B');
    expect(result.allocations[1].unitsAllocated).toBe(4);
  });

  it('should strictly exclude expired batches from allocation', () => {
    const batches: BatchItem[] = [
      { id: 'b-expired', batchNumber: 'EXPIRED-BATCH', expiryDate: '2026-08-01', quantityUnitsRemaining: 20, sellingPricePack: 5000, purchasePricePack: 3000 },
      { id: 'b-valid', batchNumber: 'VALID-BATCH', expiryDate: '2027-01-01', quantityUnitsRemaining: 5, sellingPricePack: 5000, purchasePricePack: 3000 },
    ];

    const result = allocateBatchesFEFO(batches, 8, today);
    // Expired batch ignored completely. Only 5 units taken from valid batch, leaving 3 unallocated
    expect(result.allocations.length).toBe(1);
    expect(result.allocations[0].batchNumber).toBe('VALID-BATCH');
    expect(result.allocations[0].unitsAllocated).toBe(5);
    expect(result.unallocatedUnits).toBe(3);
  });

  it('should strictly exclude recalled batches from allocation', () => {
    const batches: BatchItem[] = [
      { id: 'b-recalled', batchNumber: 'RECALLED-123', expiryDate: '2026-10-01', quantityUnitsRemaining: 10, sellingPricePack: 5000, purchasePricePack: 3000, isRecalled: true },
      { id: 'b-safe', batchNumber: 'SAFE-456', expiryDate: '2027-01-01', quantityUnitsRemaining: 10, sellingPricePack: 5000, purchasePricePack: 3000, isRecalled: false },
    ];

    const result = allocateBatchesFEFO(batches, 5, today);
    expect(result.allocations.length).toBe(1);
    expect(result.allocations[0].batchNumber).toBe('SAFE-456');
    expect(result.allocations[0].unitsAllocated).toBe(5);
    expect(result.unallocatedUnits).toBe(0);
  });

  it('should report remaining unallocated units when total inventory is depleted', () => {
    const batches: BatchItem[] = [
      { id: 'b1', batchNumber: 'LAST-BATCH', expiryDate: '2026-11-01', quantityUnitsRemaining: 2, sellingPricePack: 5000, purchasePricePack: 3000 },
    ];

    const result = allocateBatchesFEFO(batches, 5, today);
    expect(result.allocations.length).toBe(1);
    expect(result.allocations[0].unitsAllocated).toBe(2);
    expect(result.unallocatedUnits).toBe(3);
  });
});
