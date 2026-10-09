import User from '../../models/User.js';
import { hashPassword } from '../../utils/password.js';
import logger from '../../config/logger.js';

class AuthService {
  async register({ name, email, password, phone }) {
    const normalizedEmail = email.toLowerCase().trim();

    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      // Caller responds identically to a fresh signup so account existence is
      // not revealed.
      return { user: existingUser, alreadyExists: true };
    }

    const hashedPassword = await hashPassword(password);

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      phone: phone || null,
      authProvider: 'local'
    });

    logger.info('New user registered: [REDACTED]');

    return { user, alreadyExists: false };
  }
}

export default new AuthService();
