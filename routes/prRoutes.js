import express from 'express';
import PurchaseRequest from '../model/PurchaseRequest.js';
import mongoose from 'mongoose';
import { protect } from '../middleware/auth.js';
import { body, validationResult } from 'express-validator';
import dotenv from 'dotenv';
import ExcelJS from 'exceljs';
import { Parser } from 'json2csv';
import fs from 'fs';
// Location and department codes
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

dotenv.config();

const router = express.Router();

router.get('/test', (req, res) => {
  res.send("Running");
});
router.post(
  '/create',
  [
    body('uprn').not().isEmpty().withMessage('UPRN is required'),
    body('estimatedAmount').isNumeric().withMessage('Estimated Amount must be a number'),
    body('location').not().isEmpty().withMessage('Location is required'),
    body('department').not().isEmpty().withMessage('Department is required'),
    body('requester').not().isEmpty().withMessage('Requester is required'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { uprn, location, department, estimatedAmount, requester } = req.body;

      // Ensure location and department are valid
      const locationCode = locationCodes[location];
      const departmentCode = departmentCodes[department];

      if (!locationCode || !departmentCode) {
        return res.status(400).json({ message: 'Invalid location or department' });
      }

      // Get the next sequence number manually
      const counter = await mongoose.connection.collection('counters').findOneAndUpdate(
        { _id: 'purchase_request_seq' },
        { $inc: { seq: 1 } },
        { upsert: true, returnDocument: 'after' }
      );

      const nextId = counter.value ? counter.value.seq : 1;

      // Generate the code
      const code = `${locationCode}-${departmentCode}-${String(nextId).padStart(4, '0')}`;
      console.log(code);
      // Create the new purchase request
      const newPR = new PurchaseRequest({
        code,
        uprn,
        location,
        department,
        estimatedAmount,
        requester,
      });

      await newPR.save();

      res.status(201).json({
        message: 'Purchase Request created successfully!',
        data: newPR,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Error creating purchase request.', error: err.message });
    }
  }
);// 2. Get all Purchase Requests (PRs)
router.get('/', async (req, res) => {
  try {
    const prList = await PurchaseRequest.find().sort({ createdAt: -1 });
    res.status(200).json(prList);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error fetching purchase requests.' });
  }
});

// 3. Get a single Purchase Request by ID
router.get('/:id', async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ message: 'Invalid ID format.' });
  }

  try {
    const pr = await PurchaseRequest.findById(req.params.id);

    if (!pr) {
      return res.status(404).json({ message: 'Purchase Request not found.' });
    }

    res.status(200).json(pr);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error fetching purchase request.' });
  }
});

// 4. Update a Purchase Request by ID
router.put('/:id', protect, async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ message: 'Invalid ID format.' });
  }

  try {
    const { uprn, location, department, estimatedAmount, requester } = req.body;

    const pr = await PurchaseRequest.findByIdAndUpdate(
      req.params.id,
      {
        uprn,
        location,
        department,
        estimatedAmount,
        requester,
      },
      { new: true, runValidators: true }
    );

    if (!pr) {
      return res.status(404).json({ message: 'Purchase Request not found.' });
    }

    res.status(200).json({
      message: 'Purchase Request updated successfully!',
      data: pr,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error updating purchase request.' });
  }
});

// 5. Delete a Purchase Request by ID
router.delete('/:id', protect, async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ message: 'Invalid ID format.' });
  }

  try {
    const pr = await PurchaseRequest.findByIdAndDelete(req.params.id);

    if (!pr) {
      return res.status(404).json({ message: 'Purchase Request not found.' });
    }

    res.status(200).json({ message: 'Purchase Request deleted successfully!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error deleting purchase request.' });
  }
});

// 📤 EXPORT TO EXCEL (.xlsx)
router.get('/export/excel', async (req, res) => {
  try {
    const prs = await PurchaseRequest.find().lean();

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Purchase Requests');

    worksheet.columns = [
      { header: 'PR ID', key: 'pr_id', width: 10 },
      { header: 'Code', key: 'code', width: 20 },
      { header: 'Location', key: 'location', width: 15 },
      { header: 'Department', key: 'department', width: 15 },
      { header: 'UPRN', key: 'uprn', width: 15 },
      { header: 'Estimated Amount', key: 'estimatedAmount', width: 20 },
      { header: 'Requester', key: 'requester', width: 20 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Date Requested', key: 'dateRequested', width: 25 },
    ];

    prs.forEach((pr) => worksheet.addRow(pr));

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=purchase_requests.xlsx'
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// 📤 EXPORT TO CSV (.csv)
router.get('/export/csv', async (req, res) => {
  try {
    const prs = await PurchaseRequest.find().lean();

    const fields = [
      'pr_id',
      'code',
      'location',
      'department',
      'uprn',
      'estimatedAmount',
      'requester',
      'status',
      'dateRequested',
    ];

    const parser = new Parser({ fields });
    const csv = parser.parse(prs);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=purchase_requests.csv');
    res.status(200).end(csv);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


export default router;