const express = require('express');
const pool = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function toNumbers(row) {
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [key, Number(value)]));
}

async function latestVouchers(whereSql, orderBy, limit) {
  const [rows] = await pool.query(
    `SELECT v.id, v.voucher_number, v.expense_title, v.amount, v.status,
            v.approval_date, v.updated_at, u.name AS employee_name
     FROM vouchers v
     JOIN users u ON u.id = v.employee_id
     WHERE ${whereSql}
     ORDER BY ${orderBy}
     LIMIT ${limit}`
  );
  return rows;
}

router.get(
  '/',
  wrap(async (req, res) => {
    if (req.user.role === 'employee') {
      const [[row]] = await pool.query(
        `SELECT
           COUNT(*) AS total,
           COALESCE(SUM(status = 'draft'), 0) AS drafts,
           COALESCE(SUM(status = 'pending_approval'), 0) AS pending,
           COALESCE(SUM(status = 'approved'), 0) AS approved,
           COALESCE(SUM(status = 'rejected'), 0) AS rejected,
           -- Assumption: "claimed" means submitted, so drafts are not counted
           COALESCE(SUM(CASE WHEN status <> 'draft' THEN amount ELSE 0 END), 0) AS total_amount_claimed
         FROM vouchers
         WHERE employee_id = ?`,
        [req.user.id]
      );
      return res.json({ role: 'employee', stats: toNumbers(row) });
    }

    if (req.user.role === 'director') {
      const [[row]] = await pool.query(
        `SELECT
           COALESCE(SUM(status = 'pending_approval'), 0) AS pending_count,
           COALESCE(SUM(status = 'approved' AND DATE(approval_date) = CURDATE()), 0) AS approved_today,
           -- A rejected voucher is locked, so its updated_at is the moment of rejection
           COALESCE(SUM(status = 'rejected' AND DATE(updated_at) = CURDATE()), 0) AS rejected_today,
           COALESCE(SUM(CASE WHEN status = 'pending_approval' THEN amount ELSE 0 END), 0) AS total_pending_amount
         FROM vouchers
         WHERE status <> 'draft'`
      );
      const recent = await latestVouchers("v.status <> 'draft'", 'v.updated_at DESC, v.id DESC', 8);
      return res.json({ role: 'director', stats: toNumbers(row), recent });
    }

    const [[row]] = await pool.query(
      `SELECT
         COUNT(*) AS total,
         COALESCE(SUM(status = 'pending_approval'), 0) AS pending,
         COALESCE(SUM(status = 'approved'), 0) AS approved,
         COALESCE(SUM(status = 'rejected'), 0) AS rejected,
         COALESCE(SUM(CASE WHEN status = 'approved' THEN amount ELSE 0 END), 0) AS total_approved_amount
       FROM vouchers
       WHERE status <> 'draft'`
    );
    const recent = await latestVouchers("v.status = 'approved'", 'v.approval_date DESC, v.id DESC', 8);
    res.json({ role: 'accounts', stats: toNumbers(row), recent });
  })
);

module.exports = router;