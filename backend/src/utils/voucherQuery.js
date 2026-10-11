const STATUSES = ['draft', 'pending_approval', 'approved', 'rejected'];

const SORT_COLUMNS = {
  id: 'v.id',
  voucher_number: 'v.voucher_number',
  voucher_date: 'v.voucher_date',
  expense_date: 'v.expense_date',
  amount: 'v.amount',
  status: 'v.status',
  employee_name: 'u.name',
};

const str = (v) => (typeof v === 'string' ? v.trim() : '');
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));

function buildVoucherQuery(query, user) {
  const where = [];
  const params = [];
  const errors = {};

  if (user.role === 'employee') {
    where.push('v.employee_id = ?');
    params.push(user.id);
  } else {

    where.push("v.status <> 'draft'");
  }

  const q = str(query.q);
  if (q) {
    where.push('(v.voucher_number LIKE ? OR u.name LIKE ? OR v.expense_title LIKE ?)');
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }

  const textFilters = [
    ['voucher_number', 'v.voucher_number'],
    ['employee_name', 'u.name'],
    ['department', 'v.department'],
    ['category', 'v.expense_category'],
  ];
  for (const [key, column] of textFilters) {
    const value = str(query[key]);
    if (value) {
      where.push(`${column} LIKE ?`);
      params.push(`%${value}%`);
    }
  }

  const status = str(query.status);
  if (status) {
    if (!STATUSES.includes(status)) {
      errors.status = `Status must be one of: ${STATUSES.join(', ')}`;
    } else {
      where.push('v.status = ?');
      params.push(status);
    }
  }

  for (const [key, op] of [['date_from', '>='], ['date_to', '<=']]) {
    const value = str(query[key]);
    if (!value) continue;
    if (!isDate(value)) {
      errors[key] = 'Use the format YYYY-MM-DD';
    } else {
      where.push(`v.expense_date ${op} ?`);
      params.push(value);
    }
  }

  for (const [key, op] of [['min_amount', '>='], ['max_amount', '<=']]) {
    const raw = str(query[key]);
    if (raw === '') continue;
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) {
      errors[key] = 'Must be a number, 0 or more';
    } else {
      where.push(`v.amount ${op} ?`);
      params.push(n);
    }
  }

  const sortBy = str(query.sort_by) || 'id';
  if (!Object.hasOwn(SORT_COLUMNS, sortBy)) {
    errors.sort_by = `Sort by one of: ${Object.keys(SORT_COLUMNS).join(', ')}`;
  }
  const orderRaw = str(query.order).toLowerCase();
  if (orderRaw && !['asc', 'desc'].includes(orderRaw)) {
    errors.order = 'Order must be asc or desc';
  }
  const direction = orderRaw === 'asc' ? 'ASC' : 'DESC';
  const column = Object.hasOwn(SORT_COLUMNS, sortBy) ? SORT_COLUMNS[sortBy] : 'v.id';

  return {
    whereSql: `WHERE ${where.join(' AND ')}`,
    params,
    orderBy: `${column} ${direction}, v.id DESC`,
    errors,
  };
}

module.exports = { buildVoucherQuery };