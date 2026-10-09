import fs from 'fs';
import path from 'path';
import userRepository from './user.repository.js';
import billRepository from '../bill/bill.repository.js';
import User from '../../models/User.js';
import { deleteFromCloudinary } from '../../utils/imageProcessor.js';
import { uploadDir } from '../../config/paths.js';
import logger from '../../config/logger.js';

class UserService {
  async getProfile(userId) {
    const user = await userRepository.findById(userId);

    if (!user) {
      const error = new Error('User profile not found');
      error.statusCode = 404;
      throw error;
    }

    return user;
  }

  async updateProfile(userId, updateFields) {
    const allowedUpdates = ['name', 'phone', 'avatar'];
    const sanitizedData = {};

    allowedUpdates.forEach((field) => {
      if (updateFields[field] !== undefined) {
        sanitizedData[field] = updateFields[field];
      }
    });

    if (Object.keys(sanitizedData).length === 0) {
      const error = new Error('No valid fields provided for update');
      error.statusCode = 400;
      throw error;
    }

    const updatedUser = await userRepository.updateById(userId, sanitizedData);

    if (!updatedUser) {
      const error = new Error('User not found');
      error.statusCode = 404;
      throw error;
    }

    logger.info('Profile updated for user: [REDACTED]');
    return updatedUser;
  }

  async deleteAccount(userId) {
    const bills = await billRepository.findAllByUserId(userId);

    for (const bill of bills) {
      if (bill.cloudinaryPublicId) {
        await deleteFromCloudinary(bill.cloudinaryPublicId);
      }

      let localFileName = null;
      if (bill.billImageUrl && bill.billImageUrl.includes('/api/bills/image/')) {
        localFileName = path.basename(bill.billImageUrl.split('/api/bills/image/')[1].split('?')[0]);
      } else if (bill.billImageUrl && bill.billImageUrl.includes('/uploads/')) {
        localFileName = path.basename(bill.billImageUrl.split('/uploads/')[1].split('?')[0]);
      }

      if (localFileName) {
        const filePath = path.join(uploadDir, localFileName);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
    }

    const deletedBills = await billRepository.deleteManyByUserId(userId);

    await User.findByIdAndDelete(userId);

    logger.info(`Account deletion completed: ${deletedBills} bills removed, user record purged`);
    return { deletedBills };
  }
}

export default new UserService();
