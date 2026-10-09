import { describe, it, expect } from 'vitest';
import billService from '../../src/modules/bill/bill.service.js';

describe('Bill Service - Warranty & Date Calculation Logic', () => {
  it('should compute warranty end date from "2 years"', () => {
    const purchaseDate = new Date('2024-01-01');
    const endDate = billService.computeEndDate(purchaseDate, '2 years');

    expect(endDate).toBeInstanceOf(Date);
    expect(endDate.getFullYear()).toBe(2026);
    expect(endDate.getMonth()).toBe(0); // January
  });

  it('should compute warranty end date from "6 months"', () => {
    const purchaseDate = new Date('2024-01-15');
    const endDate = billService.computeEndDate(purchaseDate, '6 months');

    expect(endDate).toBeInstanceOf(Date);
    expect(endDate.getMonth()).toBe(6); // July
  });

  it('should mark status as "Active" when warranty end date is far in future', () => {
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 2); // 2 years from now

    const inputData = {
      productName: 'Sony Bravia TV',
      warrantyEndDate: futureDate.toISOString()
    };

    const enriched = billService.sanitizeAndEnrichData(inputData);

    expect(enriched.warrantyStatus).toBe('Active');
    expect(enriched.daysUntilWarrantyEnds).toBeGreaterThan(30);
    expect(enriched.reminderDate).toBeInstanceOf(Date);
  });

  it('should mark status as "Expiring Soon" when warranty ends within 30 days', () => {
    const nearDate = new Date();
    nearDate.setDate(nearDate.getDate() + 15); // 15 days from now

    const inputData = {
      productName: 'Blender',
      warrantyEndDate: nearDate.toISOString()
    };

    const enriched = billService.sanitizeAndEnrichData(inputData);

    expect(enriched.warrantyStatus).toBe('Expiring Soon');
    expect(enriched.daysUntilWarrantyEnds).toBeLessThanOrEqual(30);
    expect(enriched.daysUntilWarrantyEnds).toBeGreaterThan(0);
  });

  it('should mark status as "Expired" when warranty end date is in the past', () => {
    const pastDate = new Date('2020-01-01');

    const inputData = {
      productName: 'Old Microwave',
      warrantyEndDate: pastDate.toISOString()
    };

    const enriched = billService.sanitizeAndEnrichData(inputData);

    expect(enriched.warrantyStatus).toBe('Expired');
    expect(enriched.daysUntilWarrantyEnds).toBeLessThan(0);
  });

  it('should sanitize currency strings into pure numbers', () => {
    const inputData = {
      productName: 'Keyboard',
      price: '₹ 1,499.50',
      totalPrice: '$ 1,499.50'
    };

    const enriched = billService.sanitizeAndEnrichData(inputData);

    expect(enriched.price).toBe(1499.5);
    expect(enriched.totalPrice).toBe(1499.5);
  });
});