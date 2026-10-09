import User from '../../models/User.js';

// Projections always strip credentials (password + OTP) from read results.
class UserRepository {
  async findById(userId) {
    return await User.findById(userId).select('-password -otpCode -otpExpiresAt');
  }

  async updateById(userId, updateData) {
    return await User.findByIdAndUpdate(
      userId,
      { $set: updateData },
      { new: true, runValidators: true }
    ).select('-password -otpCode -otpExpiresAt');
  }

  async deleteById(userId) {
    return await User.findByIdAndDelete(userId);
  }
}

export default new UserRepository();
