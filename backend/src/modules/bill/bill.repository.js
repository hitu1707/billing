import Bill from '../../models/Bill.js';
import User from '../../models/User.js';

// Every query is scoped by userId so a user can only ever touch their own bills.
class BillRepository {
  async create(billData) {
    return await Bill.create(billData);
  }

  async findAllByUserId(userId) {
    return await Bill.find({ userId }).sort({ createdAt: -1 });
  }

  async updateByIdAndUserId(billId, userId, updateData) {
    return await Bill.findOneAndUpdate(
      { _id: billId, userId },
      { $set: updateData },
      { new: true, runValidators: true }
    );
  }

  async findByIdAndUserId(billId, userId) {
    return await Bill.findOne({ _id: billId, userId });
  }

  async findExpiringSoonByUserId(userId) {
    return await Bill.find({
      userId,
      warrantyStatus: 'Expiring Soon'
    }).sort({ warrantyEndDate: 1 });
  }

  async findExpiredByUserId(userId) {
    return await Bill.find({
      userId,
      warrantyStatus: 'Expired'
    }).sort({ warrantyEndDate: -1 });
  }

  async deleteByIdAndUserId(billId, userId) {
    return await Bill.findOneAndDelete({ _id: billId, userId });
  }

  async deleteManyByUserId(userId) {
    const result = await Bill.deleteMany({ userId });
    return result.deletedCount || 0;
  }

  async incrementUserBillCount(userId) {
    await User.findByIdAndUpdate(userId, { $inc: { totalBillsScanned: 1 } });
  }
}

export default new BillRepository();
