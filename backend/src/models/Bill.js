import mongoose from 'mongoose';

const billSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },

    productName: {
      type: String,
      required: [true, 'Product name is required']
    },
    productModel: { type: String, default: null },
    category: { type: String, default: null },
    quantity: { type: Number, default: 1 },

    purchaseDate: { type: Date, default: null },
    expiryDate: { type: Date, default: null },
    manufacturingDate: { type: Date, default: null },

    warrantyPeriod: { type: String, default: null },
    warrantyEndDate: { type: Date, default: null },
    warrantyStatus: {
      type: String,
      enum: ['Active', 'Expired', 'Expiring Soon', 'Unknown'],
      default: 'Unknown'
    },

    price: { type: Number, default: null },
    tax: { type: Number, default: null },
    totalPrice: { type: Number, default: null },

    vendorName: { type: String, default: null },
    vendorAddress: { type: String, default: null },
    vendorPhone: { type: String, default: null },

    billNumber: { type: String, default: null },
    paymentMethod: { type: String, default: null },

    daysUntilExpiry: { type: Number, default: null },
    daysUntilWarrantyEnds: { type: Number, default: null },
    reminderDate: { type: Date, default: null },

    billImageUrl: { type: String, default: null },
    cloudinaryPublicId: { type: String, default: null }
  },
  { timestamps: true }
);

billSchema.index({ userId: 1, warrantyStatus: 1 });
billSchema.index({ userId: 1, expiryDate: 1 });

const Bill = mongoose.model('Bill', billSchema);

export default Bill;
