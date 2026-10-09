import express from 'express';
import userController from './user.controller.js';
import { authenticate } from '../../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

router.get('/profile', userController.getProfile);
router.put('/profile', userController.updateProfile);
router.delete('/account', userController.deleteAccount);

export default router;
