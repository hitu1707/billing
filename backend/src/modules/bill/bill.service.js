import fs from 'fs';
import billRepository from './bill.repository.js';
import { extractBillData } from '../../utils/aiExtractor.js';
import { uploadToCloudinary, deleteFromCloudinary } from '../../utils/imageProcessor.js';
import logger from '../../config/logger.js';
import { billScanCounter } from '../../middleware/metrics.js';

// Client-writable fields only; ownership and storage internals are never accepted.
const UPDATABLE_FIELDS = [
  'productName',
  'productModel',
  'category',
  'quantity',
  'price',
  'tax',
  'totalPrice',
  'vendorName',
  'vendorAddress',
  'vendorPhone',
  'billNumber',
  'paymentMethod',
  'warrantyPeriod',
  'purchaseDate',
  'manufacturingDate',
  'expiryDate',
  'warrantyEndDate'
];

const UPDATE_DATE_FIELDS = new Set(['purchaseDate', 'manufacturingDate', 'expiryDate', 'warrantyEndDate']);
const UPDATE_NUMBER_FIELDS = new Set(['quantity', 'price', 'tax', 'totalPrice']);

// Strip line breaks so attacker-influenced values cannot forge log entries.
const logSafe = (val) => String(val).replace(/[\r\n]+/g, ' ');

const sanitizeString = (val) => {
  if (val === undefined || val === null) return null;
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (['null', 'none', 'n/a', 'na', 'nil', 'undefined', ''].includes(trimmed.toLowerCase())) {
      return null;
    }
    return trimmed;
  }
  return String(val);
};

const sanitizeDate = (val) => {
  const clean = sanitizeString(val);
  if (!clean) return null;
  const parsed = new Date(clean);
  return isNaN(parsed.getTime()) ? null : parsed;
};

const sanitizeNumber = (val, defaultVal = null) => {
  const clean = sanitizeString(val);
  if (clean === null) return defaultVal;
  if (typeof clean === 'number') return isNaN(clean) ? defaultVal : clean;
  const numericStr = String(clean).replace(/[^0-9.-]+/g, '');
  const parsed = parseFloat(numericStr);
  return isNaN(parsed) ? defaultVal : parsed;
};

class BillService {
  async scanAndSaveBill(tempImagePath, userId) {
    try {
      logger.info(`Bill scan initiated for user: ${userId}`);

      const rawExtractedData = await extractBillData(tempImagePath);
      const cloudinaryData = await uploadToCloudinary(tempImagePath);
      const sanitizedData = this.sanitizeAndEnrichData(rawExtractedData);

      const finalBillData = {
        ...sanitizedData,
        userId,
        billImageUrl: cloudinaryData.imageUrl,
        cloudinaryPublicId: cloudinaryData.publicId
      };

      const savedBill = await billRepository.create(finalBillData);
      await billRepository.incrementUserBillCount(userId);

      billScanCounter.inc({ status: 'success' });

      logger.info(`Bill saved successfully: "${logSafe(savedBill.productName)}"`);
      return savedBill;
    } catch (error) {
      billScanCounter.inc({ status: 'failed' });

      if (tempImagePath && fs.existsSync(tempImagePath)) {
        fs.unlinkSync(tempImagePath);
      }

      logger.error(`Bill processing workflow failed: ${error.message}`);
      throw error;
    }
  }

  sanitizeAndEnrichData(raw) {
    const today = new Date();

    const productName = sanitizeString(raw.productName) || 'Scanned Product';
    const productModel = sanitizeString(raw.productModel);
    const category = sanitizeString(raw.category);
    const quantity = sanitizeNumber(raw.quantity, 1);

    const price = sanitizeNumber(raw.price);
    const tax = sanitizeNumber(raw.tax);
    const totalPrice = sanitizeNumber(raw.totalPrice) || price;

    const vendorName = sanitizeString(raw.vendorName);
    const vendorAddress = sanitizeString(raw.vendorAddress);
    const vendorPhone = sanitizeString(raw.vendorPhone);
    const billNumber = sanitizeString(raw.billNumber);
    const paymentMethod = sanitizeString(raw.paymentMethod);
    const warrantyPeriod = sanitizeString(raw.warrantyPeriod);

    const purchaseDate = sanitizeDate(raw.purchaseDate);
    const manufacturingDate = sanitizeDate(raw.manufacturingDate);
    const expiryDate = sanitizeDate(raw.expiryDate);
    let warrantyEndDate = sanitizeDate(raw.warrantyEndDate);

    if (!warrantyEndDate && purchaseDate && warrantyPeriod) {
      warrantyEndDate = this.computeEndDate(purchaseDate, warrantyPeriod);
    }

    let daysUntilWarrantyEnds = null;
    let warrantyStatus = 'Unknown';
    let reminderDate = null;

    if (warrantyEndDate) {
      const diffTime = warrantyEndDate.getTime() - today.getTime();
      daysUntilWarrantyEnds = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (daysUntilWarrantyEnds < 0) {
        warrantyStatus = 'Expired';
      } else if (daysUntilWarrantyEnds <= 30) {
        warrantyStatus = 'Expiring Soon';
      } else {
        warrantyStatus = 'Active';
      }

      reminderDate = new Date(warrantyEndDate);
      reminderDate.setDate(reminderDate.getDate() - 30);
    }

    let daysUntilExpiry = null;
    if (expiryDate) {
      const diffTime = expiryDate.getTime() - today.getTime();
      daysUntilExpiry = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    return {
      productName,
      productModel,
      category,
      quantity,
      price,
      tax,
      totalPrice,
      vendorName,
      vendorAddress,
      vendorPhone,
      billNumber,
      paymentMethod,
      warrantyPeriod,
      purchaseDate,
      manufacturingDate,
      expiryDate,
      warrantyEndDate,
      daysUntilWarrantyEnds,
      warrantyStatus,
      reminderDate,
      daysUntilExpiry
    };
  }

  computeEndDate(purchaseDate, warrantyPeriodStr) {
    const date = new Date(purchaseDate);
    const text = warrantyPeriodStr.toLowerCase();

    const yearMatch = text.match(/(\d+)\s*(year|yr)/);
    const monthMatch = text.match(/(\d+)\s*(month|mo)/);

    if (yearMatch) {
      date.setFullYear(date.getFullYear() + parseInt(yearMatch[1], 10));
    } else if (monthMatch) {
      date.setMonth(date.getMonth() + parseInt(monthMatch[1], 10));
    } else {
      return null;
    }

    return isNaN(date.getTime()) ? null : date;
  }

  async getAllBills(userId) {
    return await billRepository.findAllByUserId(userId);
  }

  async getBillById(billId, userId) {
    const bill = await billRepository.findByIdAndUserId(billId, userId);
    if (!bill) {
      const error = new Error('Bill not found');
      error.statusCode = 404;
      throw error;
    }
    return bill;
  }

  async getExpiringBills(userId) {
    return await billRepository.findExpiringSoonByUserId(userId);
  }

  async updateBill(billId, userId, updateData) {
    // Mass-assignment protection: only whitelisted fields are applied.
    const safeUpdates = {};
    for (const field of UPDATABLE_FIELDS) {
      if (updateData[field] === undefined) continue;
      if (UPDATE_DATE_FIELDS.has(field)) {
        safeUpdates[field] = sanitizeDate(updateData[field]);
      } else if (UPDATE_NUMBER_FIELDS.has(field)) {
        safeUpdates[field] = sanitizeNumber(updateData[field]);
      } else {
        safeUpdates[field] = sanitizeString(updateData[field]);
      }
    }

    if (Object.keys(safeUpdates).length === 0) {
      const error = new Error('No valid fields provided for update');
      error.statusCode = 400;
      throw error;
    }

    // Only recompute derived tracking when a date/warranty field actually changed,
    // so unrelated edits don't wipe them.
    const touchesTracking = ['purchaseDate', 'warrantyPeriod', 'warrantyEndDate', 'expiryDate'].some(
      (field) => safeUpdates[field] !== undefined
    );

    if (touchesTracking) {
      const enrichment = this.sanitizeAndEnrichData(safeUpdates);
      safeUpdates.warrantyStatus = enrichment.warrantyStatus;
      safeUpdates.daysUntilWarrantyEnds = enrichment.daysUntilWarrantyEnds;
      safeUpdates.reminderDate = enrichment.reminderDate;
      safeUpdates.daysUntilExpiry = enrichment.daysUntilExpiry;
      if (safeUpdates.warrantyEndDate === undefined) {
        safeUpdates.warrantyEndDate = enrichment.warrantyEndDate;
      }
    }

    const updated = await billRepository.updateByIdAndUserId(billId, userId, safeUpdates);
    if (!updated) {
      const error = new Error('Bill not found');
      error.statusCode = 404;
      throw error;
    }
    return updated;
  }

  async deleteBill(billId, userId) {
    const bill = await billRepository.deleteByIdAndUserId(billId, userId);
    if (!bill) {
      const error = new Error('Bill not found');
      error.statusCode = 404;
      throw error;
    }

    if (bill.cloudinaryPublicId) {
      await deleteFromCloudinary(bill.cloudinaryPublicId);
    }

    return bill;
  }
}

export default new BillService();
