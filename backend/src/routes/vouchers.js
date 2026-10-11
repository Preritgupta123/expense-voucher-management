const express = require('express');
const fs = require('fs');
const path = require('path');
const pool = require('../db');
const { authenticate, authorize } = require('../middleware/auth');
const { uploadSignature } = require('../middleware/upload');
const { buildVoucherQuery } = require('../utils/voucherQuery');

const router = express.Router();


router.use(authenticate);


router.param('id', (req, res, next, id) => {
  if (!/^\d+$/.test(id)) return res.status(400).json({ message: 'Invalid voucher id' });
  next();
});

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const text = (v) => (v === undefined || v === null ? '' : String(v).trim());

function validateVoucherInput(body) {
  const errors = {};
  if (!text(body.department)) errors.department = 'Department is required';
  if (!text(body.expense_title)) errors.expense_title = 'Expense title is required';

  const date = text(body.expense_date);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) {
    errors.expense_date = 'A valid expense date (YYYY-MM-DD) is required';
  }

  const amount = Number(body.amount);
  if (text(body.amount) === '' || !Number.isFinite(amount) || amount <= 0) {
    errors.amount = 'Amount must be greater than 0';
  } else if (amount > 9999999999) {
    errors.amount = 'Amount is too large';
  }

  const limits = { department: 100, expense_title: 200, expense_category: 50 };
  for (const [field, max] of Object.entries(limits)) {
    if (text(body[field]).length > max) errors[field] = `Must be ${max} characters or fewer`;
  }
  return errors;
}

function cleanInput(body) {
  return {
    expense_date: text(body.expense_date),
    department: text(body.department),
    expense_title: text(body.expense_title),
    expense_category: text(body.expense_category) || null,
    expense_description: text(body.expense_description) || null,
    amount: Number(body.amount),
  };
}

function deleteStoredFile(storedPath) {
  if (!storedPath) return;
  fs.unlink(path.join(__dirname, '..', '..', storedPath), () => {});
}

async function findOwnVoucher(id, userId) {
  const [rows] = await pool.query('SELECT * FROM vouchers WHERE id = ? AND employee_id = ?', [
    id,
    userId,
  ]);
  return rows[0];
}

async function loadEditableVoucher(req, res) {
  const voucher = await findOwnVoucher(req.params.id, req.user.id);
  if (!voucher) {
    res.status(404).json({ message: 'Voucher not found' });
    return null;
  }
  if (voucher.status !== 'draft') {
    res.status(409).json({ message: 'Only draft vouchers can be changed' });
    return null;
  }
  return voucher;
}

router.post(
  '/',
  authorize('employee'),
  wrap(async (req, res) => {
    const errors = validateVoucherInput(req.body);
    if (Object.keys(errors).length) {
      return res.status(400).json({ message: 'Validation failed', errors });
    }
    const d = cleanInput(req.body);

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [result] = await conn.query(
        `INSERT INTO vouchers
           (employee_id, expense_date, department, expense_title,
            expense_category, expense_description, amount)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          req.user.id,
          d.expense_date,
          d.department,
          d.expense_title,
          d.expense_category,
          d.expense_description,
          d.amount,
        ]
      );
      const voucherNumber = `VCH-${new Date().getFullYear()}-${String(result.insertId).padStart(4, '0')}`;
      await conn.query('UPDATE vouchers SET voucher_number = ? WHERE id = ?', [
        voucherNumber,
        result.insertId,
      ]);
      await conn.commit();
      res.status(201).json({ id: result.insertId, voucher_number: voucherNumber, status: 'draft' });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  })
);

router.get(
  '/',
  wrap(async (req, res) => {
    const { whereSql, params, orderBy, errors } = buildVoucherQuery(req.query, req.user);
    if (Object.keys(errors).length) {
      return res.status(400).json({ message: 'Invalid search or filter', errors });
    }
    const [rows] = await pool.query(
      `SELECT v.id, v.voucher_number, v.voucher_date, v.expense_date, v.department,
              v.expense_title, v.expense_category, v.amount, v.status,
              v.created_at, v.updated_at, u.name AS employee_name
       FROM vouchers v
       JOIN users u ON u.id = v.employee_id
       ${whereSql}
       ORDER BY ${orderBy}`,
      params
    );
    res.json(rows);
  })
);

router.get(
  '/:id',
  wrap(async (req, res) => {
    const params = [req.params.id];
    let scope = '';
    if (req.user.role === 'employee') {
      scope = 'AND v.employee_id = ?';
      params.push(req.user.id);
    } else {
      scope = "AND v.status <> 'draft'"; // same rule as the list: no one else's drafts
    }
    const [rows] = await pool.query(
      `SELECT v.*, e.name AS employee_name, e.employee_code, d.name AS director_name
       FROM vouchers v
       JOIN users e ON e.id = v.employee_id
       LEFT JOIN users d ON d.id = v.director_id
       WHERE v.id = ? ${scope}`,
      params
    );
   
    if (!rows[0]) return res.status(404).json({ message: 'Voucher not found' });
    res.json(rows[0]);
  })
);

router.put(
  '/:id',
  authorize('employee'),
  wrap(async (req, res) => {
    const voucher = await loadEditableVoucher(req, res);
    if (!voucher) return;

    const errors = validateVoucherInput(req.body);
    if (Object.keys(errors).length) {
      return res.status(400).json({ message: 'Validation failed', errors });
    }
    const d = cleanInput(req.body);
    await pool.query(
      `UPDATE vouchers
       SET expense_date = ?, department = ?, expense_title = ?,
           expense_category = ?, expense_description = ?, amount = ?
       WHERE id = ?`,
      [d.expense_date, d.department, d.expense_title, d.expense_category, d.expense_description, d.amount, voucher.id]
    );
    res.json({ message: 'Draft updated' });
  })
);

router.delete(
  '/:id',
  authorize('employee'),
  wrap(async (req, res) => {
    const voucher = await loadEditableVoucher(req, res);
    if (!voucher) return;

    await pool.query('DELETE FROM vouchers WHERE id = ?', [voucher.id]);
    deleteStoredFile(voucher.employee_signature_path);
    res.json({ message: 'Draft deleted' });
  })
);

router.post(
  '/:id/signature',
  authorize('employee'),
  uploadSignature,
  wrap(async (req, res) => {
    const voucher = await loadEditableVoucher(req, res);
    if (!voucher) {

      fs.unlink(req.file.path, () => {});
      return;
    }
    const storedPath = `/uploads/signatures/${req.file.filename}`;
    await pool.query('UPDATE vouchers SET employee_signature_path = ? WHERE id = ?', [
      storedPath,
      voucher.id,
    ]);
    deleteStoredFile(voucher.employee_signature_path); // remove the old image
    res.json({ employee_signature_path: storedPath });
  })
);

router.post(
  '/:id/submit',
  authorize('employee'),
  wrap(async (req, res) => {
    const voucher = await loadEditableVoucher(req, res);
    if (!voucher) return;

    if (!voucher.employee_signature_path) {
      return res.status(400).json({ message: 'Employee signature is required before submitting' });
    }
    // "AND status = 'draft'" protects against a double click / two requests at once
    await pool.query("UPDATE vouchers SET status = 'pending_approval' WHERE id = ? AND status = 'draft'", [
      voucher.id,
    ]);
    res.json({ message: 'Voucher submitted for approval', status: 'pending_approval' });
  })
);

router.post(
  '/:id/approve',
  authorize('director'),
  uploadSignature,
  wrap(async (req, res) => {
    const discardFile = () => fs.unlink(req.file.path, () => {});

    const [rows] = await pool.query('SELECT id, status FROM vouchers WHERE id = ?', [req.params.id]);
    const voucher = rows[0];
    if (!voucher || voucher.status === 'draft') {
      discardFile();
      return res.status(404).json({ message: 'Voucher not found' });
    }
    if (voucher.status !== 'pending_approval') {
      discardFile();
      return res.status(409).json({ message: `Voucher is already ${voucher.status}` });
    }

    const storedPath = `/uploads/signatures/${req.file.filename}`;

    const [result] = await pool.query(
      `UPDATE vouchers
       SET status = 'approved', director_id = ?, director_signature_path = ?, approval_date = NOW()
       WHERE id = ? AND status = 'pending_approval'`,
      [req.user.id, storedPath, voucher.id]
    );
    if (result.affectedRows === 0) {
      discardFile();
      return res.status(409).json({ message: 'Voucher was already reviewed' });
    }
    res.json({ message: 'Voucher approved', status: 'approved', director_signature_path: storedPath });
  })
);

router.post(
  '/:id/reject',
  authorize('director'),
  wrap(async (req, res) => {
    const reason = text(req.body?.reason);
    if (!reason) {
      return res
        .status(400)
        .json({ message: 'Validation failed', errors: { reason: 'Rejection reason is required' } });
    }
    if (reason.length > 1000) {
      return res
        .status(400)
        .json({ message: 'Validation failed', errors: { reason: 'Reason must be 1000 characters or fewer' } });
    }

    const [rows] = await pool.query('SELECT id, status FROM vouchers WHERE id = ?', [req.params.id]);
    const voucher = rows[0];
    if (!voucher || voucher.status === 'draft') {
      return res.status(404).json({ message: 'Voucher not found' });
    }
    if (voucher.status !== 'pending_approval') {
      return res.status(409).json({ message: `Voucher is already ${voucher.status}` });
    }

    const [result] = await pool.query(
      `UPDATE vouchers
       SET status = 'rejected', director_id = ?, rejection_reason = ?
       WHERE id = ? AND status = 'pending_approval'`,
      [req.user.id, reason, voucher.id]
    );
    if (result.affectedRows === 0) {
      return res.status(409).json({ message: 'Voucher was already reviewed' });
    }
    res.json({ message: 'Voucher rejected', status: 'rejected' });
  })
);

module.exports = router;