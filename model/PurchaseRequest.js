import mongoose from 'mongoose';
import { getNextSequence } from './counter.js';

// Define code mappings
const locationCodes = {
  'Raqqa': 'RAQ',
  'Hassaka': 'HSK',
  'Deir Ezole': 'DRZ',
};

const departmentCodes = {
  'Health': 'HEA',
  'Education': 'EDU',
  'WASH': 'WSH',
};

const purchaseRequestSchema = new mongoose.Schema(
  {
    pr_id: Number,
    code: { type: String, unique: true },
    location: { type: String, enum: Object.keys(locationCodes), required: true },
    department: { type: String, enum: Object.keys(departmentCodes), required: true },
    uprn: { type: String, required: true },
    estimatedAmount: { type: Number, required: true, min: 0 },
    requester: { type: String, required: true, trim: true },
    dateRequested: { type: Date, default: Date.now },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  },
  { timestamps: true }
);

// Pre-save hook to assign pr_id and code
purchaseRequestSchema.pre('save', async function (next) {
  if (this.isNew) {
    const seq = await getNextSequence('PurchaseRequest');
    this.pr_id = seq;

    const locationCode = locationCodes[this.location];
    const departmentCode = departmentCodes[this.department];
    this.code = `${locationCode}-${departmentCode}-${String(seq).padStart(4, '0')}`;
  }
  next();
});

const PurchaseRequest = mongoose.model('PurchaseRequest', purchaseRequestSchema);

export default PurchaseRequest;
