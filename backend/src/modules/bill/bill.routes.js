import express from 'express';
import billController from './bill.controller.js';
import { authenticate } from '../../middleware/auth.js';
import upload, { validateImageContent } from '../../middleware/upload.js';
import { scanLimiter } from '../../middleware/rateLimiter.js';

const router = express.Router();

// Must stay above authenticate: signed-URL images are served to <img> tags
// without a session cookie.
router.get('/image/:fileName', billController.getLocalBillImage);

router.use(authenticate);

// Rate limit runs before multer writes the file to disk.
router.post('/', scanLimiter, upload.single('billImage'), validateImageContent, billController.scanBill);
router.post('/scan', scanLimiter, upload.single('billImage'), validateImageContent, billController.scanBill);

router.get('/', billController.getAllBills);
router.get('/expiring-soon', billController.getExpiringBills);

// Dynamic :id routes must be declared last.
router.get('/:id', billController.getBillById);
router.put('/:id', billController.updateBill);
router.delete('/:id', billController.deleteBill);

export default router;
