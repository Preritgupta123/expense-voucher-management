const express = require('express');
const fs = require('fs');
const path = require('path');
const pool = require('../db');
const { authenticate, authorize } = require('../middleware/auth');
const { uploadSignature } = require('../middleware/upload');

const router = express.Router();

// Every voucher route needs a logged-in user
router.use(authenticate);

// Reject ids like "abc" or "12abc" before they reach the database
router.param('id', (req, res, next, id) => {
  if (!/^\d+$/.test(id)) return res.status(400).json({ message: 'Invalid voucher id' });
  next();
});

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------

// Lets async handlers send their errors to the central error handler
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const text = (v) => (v === undefined || v === null ? '' : String(v).trim());

// Validation rules from the assignment (section 9)
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

  // Column sizes from the schema
  const limits = { department: 100, expense_title: 200, expense_category: 50 };
  for (const [field, max] of Object.entries(limits)) {
    if (text(body[field]).length > max) errors[field] = `Must be ${max} characters or fewer`;
  }
  return errors;
}

// Keep only the fields an employee may set, trimmed
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

// The employee's OWN voucher only (ownership check)
async function findOwnVoucher(id, userId) {
  const [rows] = await pool.query('SELECT * FROM vouchers WHERE id = ? AND employee_id = ?', [
    id,
    userId,
  ]);
  return rows[0];
}

// Shared guard for edit / delete / signature / submit:
// the voucher must exist, belong to this employee, and still be a draft.
// On failure it sends the response itself and returns null.
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

// ---------------------------------------------------------------
// POST /api/vouchers  -> create a draft (employee)
// ---------------------------------------------------------------
router.post(
  '/',
  authorize('employee'),
  wrap(async (req, res) => {
    const errors = validateVoucherInput(req.body);
    if (Object.keys(errors).length) {
      return res.status(400).json({ message: 'Validation failed', errors });
    }
    const d = cleanInput(req.body);

    // A transaction: either BOTH steps happen or neither does,
    // so a voucher can never exist without its number.
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

// ---------------------------------------------------------------
// GET /api/vouchers  -> list (employee: own only, director/accounts: all)
// ---------------------------------------------------------------
router.get(
  '/',
  wrap(async (req, res) => {
    const isEmployee = req.user.role === 'employee';
    const [rows] = await pool.query(
      `SELECT v.id, v.voucher_number, v.voucher_date, v.expense_date, v.department,
              v.expense_title, v.expense_category, v.amount, v.status,
              v.created_at, v.updated_at, u.name AS employee_name
       FROM vouchers v
       JOIN users u ON u.id = v.employee_id
       ${isEmployee ? 'WHERE v.employee_id = ?' : ''}
       ORDER BY v.id DESC`,
      isEmployee ? [req.user.id] : []
    );
    res.json(rows);
  })
);

// ---------------------------------------------------------------
// GET /api/vouchers/:id  -> full details
// ---------------------------------------------------------------
router.get(
  '/:id',
  wrap(async (req, res) => {
    const params = [req.params.id];
    let scope = '';
    if (req.user.role === 'employee') {
      scope = 'AND v.employee_id = ?';
      params.push(req.user.id);
    }
    const [rows] = await pool.query(
      `SELECT v.*, e.name AS employee_name, e.employee_code, d.name AS director_name
       FROM vouchers v
       JOIN users e ON e.id = v.employee_id
       LEFT JOIN users d ON d.id = v.director_id
       WHERE v.id = ? ${scope}`,
      params
    );
    // 404 (not 403) for someone else's voucher: we don't even reveal it exists
    if (!rows[0]) return res.status(404).json({ message: 'Voucher not found' });
    res.json(rows[0]);
  })
);

// ---------------------------------------------------------------
// PUT /api/vouchers/:id  -> edit a draft (employee)
// ---------------------------------------------------------------
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

// ---------------------------------------------------------------
// DELETE /api/vouchers/:id  -> delete a draft (employee)
// ---------------------------------------------------------------
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

// ---------------------------------------------------------------
// POST /api/vouchers/:id/signature  -> upload employee signature
// Order matters: login -> role -> file upload -> checks on the voucher
// ---------------------------------------------------------------
router.post(
  '/:id/signature',
  authorize('employee'),
  uploadSignature,
  wrap(async (req, res) => {
    const voucher = await loadEditableVoucher(req, res);
    if (!voucher) {
      // The file is already saved by multer, so remove it again
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

// ---------------------------------------------------------------
// POST /api/vouchers/:id/submit  -> draft becomes pending_approval
// ---------------------------------------------------------------
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

module.exports = router;