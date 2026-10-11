import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { getErrorMessage } from '../api';
import StatusBadge from './StatusBadge';
import { STATUS_LABEL, formatAmount, formatDate } from '../utils/format';

const EMPTY_FILTERS = {
  q: '',
  status: '',
  date_from: '',
  date_to: '',
  min_amount: '',
  max_amount: '',
  sort_by: 'id',
  order: 'desc',
};

const SORT_OPTIONS = [
  ['id', 'Created'],
  ['voucher_number', 'Voucher number'],
  ['expense_date', 'Expense date'],
  ['amount', 'Amount'],
  ['status', 'Status'],
  ['employee_name', 'Employee'],
];

export default function VoucherList({ title, basePath, fixedStatus, showEmployee, actions }) {
  const [filters, setFilters] = useState(EMPTY_FILTERS); // what is typed in the form
  const [applied, setApplied] = useState(EMPTY_FILTERS); // what was last searched
  const [vouchers, setVouchers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Runs on first render, and again whenever the applied filters change
  useEffect(() => {
    let cancelled = false; // ignore the answer if the screen changed before it arrived

    async function load() {
      setLoading(true);
      setError('');
      try {
        const params = {};
        for (const [key, value] of Object.entries(applied)) {
          if (value !== '') params[key] = value; // send only the filters that are filled in
        }
        if (fixedStatus) params.status = fixedStatus;
        const { data } = await api.get('/vouchers', { params });
        if (!cancelled) setVouchers(data);
      } catch (err) {
        if (!cancelled) setError(getErrorMessage(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();

    return () => {
      cancelled = true;
    };
  }, [applied, fixedStatus]);

  function handleChange(e) {
    setFilters({ ...filters, [e.target.name]: e.target.value });
  }
  function handleApply(e) {
    e.preventDefault();
    setApplied(filters);
  }
  function handleReset() {
    setFilters(EMPTY_FILTERS);
    setApplied(EMPTY_FILTERS);
  }

  // Director and Accounts never see drafts (backend rule), so don't offer that choice
  const statusOptions = showEmployee
    ? ['pending_approval', 'approved', 'rejected']
    : ['draft', 'pending_approval', 'approved', 'rejected'];

  return (
    <div>
      <div className="page-header">
        <h2>{title}</h2>
        {actions}
      </div>

      <div className="card">
        <form className="filters" onSubmit={handleApply}>
          <div className="field">
            <label htmlFor="q">Search</label>
            <input
              id="q"
              name="q"
              value={filters.q}
              onChange={handleChange}
              placeholder="Number, employee or title"
            />
          </div>

          {!fixedStatus && (
            <div className="field">
              <label htmlFor="status">Status</label>
              <select id="status" name="status" value={filters.status} onChange={handleChange}>
                <option value="">All</option>
                {statusOptions.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="field">
            <label htmlFor="date_from">Expense date from</label>
            <input id="date_from" name="date_from" type="date" value={filters.date_from} onChange={handleChange} />
          </div>
          <div className="field">
            <label htmlFor="date_to">Expense date to</label>
            <input id="date_to" name="date_to" type="date" value={filters.date_to} onChange={handleChange} />
          </div>
          <div className="field">
            <label htmlFor="min_amount">Min amount</label>
            <input id="min_amount" name="min_amount" type="number" min="0" step="0.01" value={filters.min_amount} onChange={handleChange} />
          </div>
          <div className="field">
            <label htmlFor="max_amount">Max amount</label>
            <input id="max_amount" name="max_amount" type="number" min="0" step="0.01" value={filters.max_amount} onChange={handleChange} />
          </div>

          <div className="field">
            <label htmlFor="sort_by">Sort by</label>
            <select id="sort_by" name="sort_by" value={filters.sort_by} onChange={handleChange}>
              {SORT_OPTIONS.filter(([value]) => showEmployee || value !== 'employee_name').map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="order">Order</label>
            <select id="order" name="order" value={filters.order} onChange={handleChange}>
              <option value="desc">Descending</option>
              <option value="asc">Ascending</option>
            </select>
          </div>

          <div className="actions filter-actions">
            <button className="btn" type="submit">
              Apply
            </button>
            <button className="btn btn-outline" type="button" onClick={handleReset}>
              Reset
            </button>
          </div>
        </form>

        {error && <div className="alert alert-error">{error}</div>}

        {/* A data screen always has four states: loading, error, empty, data */}
        {loading ? (
          <p className="muted">Loading...</p>
        ) : vouchers.length === 0 ? (
          !error && <div className="empty">No vouchers found.</div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Voucher No</th>
                  {showEmployee && <th>Employee</th>}
                  <th>Title</th>
                  <th>Department</th>
                  <th>Expense date</th>
                  <th className="num">Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {vouchers.map((v) => (
                  <tr key={v.id}>
                    <td>
                      <Link to={`${basePath}/${v.id}`}>{v.voucher_number}</Link>
                    </td>
                    {showEmployee && <td>{v.employee_name}</td>}
                    <td>{v.expense_title}</td>
                    <td>{v.department}</td>
                    <td>{formatDate(v.expense_date)}</td>
                    <td className="num">{formatAmount(v.amount)}</td>
                    <td>
                      <StatusBadge status={v.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
