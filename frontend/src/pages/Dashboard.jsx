import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { getErrorMessage } from '../api';
import { useAuth } from '../context/AuthContext';
import StatCard from '../components/StatCard';
import StatusBadge from '../components/StatusBadge';
import { formatAmount, formatDateTime } from '../utils/format';

const CONFIG = {
  employee: {
    title: 'My Dashboard',
    cards: [
      { key: 'total', label: 'Total Vouchers' },
      { key: 'drafts', label: 'Draft Vouchers', tone: 'draft' },
      { key: 'pending', label: 'Pending Approval', tone: 'pending' },
      { key: 'approved', label: 'Approved Vouchers', tone: 'approved' },
      { key: 'rejected', label: 'Rejected Vouchers', tone: 'rejected' },
      { key: 'total_amount_claimed', label: 'Total Amount Claimed', money: true },
    ],
  },
  director: {
    title: 'Director Dashboard',
    cards: [
      { key: 'pending_count', label: 'Pending Approval', tone: 'pending', to: '/director/pending' },
      { key: 'approved_today', label: 'Approved Today', tone: 'approved' },
      { key: 'rejected_today', label: 'Rejected Today', tone: 'rejected' },
      { key: 'total_pending_amount', label: 'Total Pending Amount', money: true },
    ],
    recentTitle: 'Recent Voucher Activity',
  },
  accounts: {
    title: 'Accounts Dashboard',
    cards: [
      { key: 'total', label: 'Total Vouchers' },
      { key: 'pending', label: 'Pending Approval', tone: 'pending' },
      { key: 'approved', label: 'Approved Vouchers', tone: 'approved' },
      { key: 'rejected', label: 'Rejected Vouchers', tone: 'rejected' },
      { key: 'total_approved_amount', label: 'Total Approved Expense Amount', money: true },
    ],
    recentTitle: 'Recent Approved Vouchers',
  },
};

export default function Dashboard() {
  const { user } = useAuth();
  const config = CONFIG[user.role];

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    api
      .get('/dashboard')
      .then(({ data: result }) => {
        if (!cancelled) setData(result);
      })
      .catch((err) => {
        if (!cancelled) setError(getErrorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <p className="muted">Loading...</p>;
  if (error) return <div className="alert alert-error">{error}</div>;

  return (
    <div>
      <div className="page-header">
        <h2>{config.title}</h2>
      </div>

      <div className="stat-grid">
        {config.cards.map((card) => (
          <StatCard
            key={card.key}
            label={card.label}
            tone={card.tone}
            to={card.to}
            value={card.money ? formatAmount(data.stats[card.key]) : data.stats[card.key]}
          />
        ))}
      </div>

      {config.recentTitle && (
        <div className="card">
          <h3>{config.recentTitle}</h3>
          {data.recent.length === 0 ? (
            <div className="empty">Nothing here yet.</div>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Voucher No</th>
                    <th>Employee</th>
                    <th>Title</th>
                    <th className="num">Amount</th>
                    <th>Status</th>
                    <th>Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recent.map((v) => (
                    <tr key={v.id}>
                      <td>
                        <Link to={`/${user.role}/vouchers/${v.id}`}>{v.voucher_number}</Link>
                      </td>
                      <td>{v.employee_name}</td>
                      <td>{v.expense_title}</td>
                      <td className="num">{formatAmount(v.amount)}</td>
                      <td>
                        <StatusBadge status={v.status} />
                      </td>
                      <td>{formatDateTime(v.updated_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
