import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import billService from './bill.service.js';
import { verifyImageSignature } from '../../utils/signImage.js';
import { successResponse, errorResponse } from '../../utils/responseHandler.js';
import { uploadDir } from '../../config/paths.js';

// Never expose owner IDs or storage internals to clients.
const toClientBill = (bill) => {
  const obj = bill.toObject ? bill.toObject() : { ...bill };
  delete obj.userId;
  delete obj.cloudinaryPublicId;
  return obj;
};

const toClientBills = (bills) => bills.map(toClientBill);

class BillController {
  // Public route, but access requires a valid HMAC signature.
  getLocalBillImage(req, res, next) {
    try {
      const { fileName } = req.params;
      const { e, s } = req.query;

      const safeName = path.basename(fileName);
      if (safeName !== fileName || !verifyImageSignature(safeName, e, s)) {
        return errorResponse(res, 403, 'Forbidden');
      }

      const filePath = path.join(uploadDir, safeName);
      if (!fs.existsSync(filePath)) {
        return errorResponse(res, 404, 'Image not found');
      }

      return res.sendFile(path.resolve(filePath));
    } catch (error) {
      return next(error);
    }
  }

  async scanBill(req, res, next) {
    try {
      if (!req.file) {
        return errorResponse(res, 400, 'Please upload a bill image');
      }

      const userId = req.user._id;
      const tempFilePath = req.file.path;

      const savedBill = await billService.scanAndSaveBill(tempFilePath, userId);
      return successResponse(res, 201, 'Bill scanned and saved successfully', toClientBill(savedBill));
    } catch (error) {
      next(error);
    }
  }

  async getAllBills(req, res, next) {
    try {
      const userId = req.user._id;
      const bills = await billService.getAllBills(userId);
      return successResponse(res, 200, 'Bills retrieved successfully', toClientBills(bills));
    } catch (error) {
      next(error);
    }
  }

  async getExpiringBills(req, res, next) {
    try {
      const userId = req.user._id;
      const expiringBills = await billService.getExpiringBills(userId);
      return successResponse(res, 200, 'Expiring bills retrieved successfully', toClientBills(expiringBills));
    } catch (error) {
      next(error);
    }
  }

  async getBillById(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user._id;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return errorResponse(res, 404, 'Bill not found');
      }

      const bill = await billService.getBillById(id, userId);
      return successResponse(res, 200, 'Bill retrieved successfully', toClientBill(bill));
    } catch (error) {
      next(error);
    }
  }

  async updateBill(req, res, next) {
    try {
      const { id } = req.params;
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return errorResponse(res, 404, 'Bill not found');
      }

      const updated = await billService.updateBill(id, req.user._id, req.body);
      return successResponse(res, 200, 'Bill updated successfully', toClientBill(updated));
    } catch (error) {
      next(error);
    }
  }

  async deleteBill(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user._id;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return errorResponse(res, 404, 'Bill not found');
      }

      await billService.deleteBill(id, userId);
      return successResponse(res, 200, 'Bill deleted successfully');
    } catch (error) {
      next(error);
    }
  }
}

export default new BillController();
