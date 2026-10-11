import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api, { API_URL, getErrorMessage } from '../api';
import { useAuth } from '../context/AuthContext';
import StatusBadge from './StatusBadge';
import ReviewPanel from './ReviewPanel';
import { formatAmount, formatDate, formatDateTime } from '../utils/format';

function Item({ label, wide, children }) {
  return (
    <div className={`detail-item ${wide ? 'field-wide' : ''}`}>
      <dt>{label}</dt>
      <dd>{children || '-'}</dd>
    </div>
  );
}

function Signature({ path, label }) {
  if (!path) return <span className="muted">Not provided</span>;
  return <img className="sig-preview" src={`${API_URL}${path}`} alt={label} />;
}

// One details screen for all roles. What you can DO depends on your role and
// the voucher's status: the employee edits drafts, the Director reviews pending ones.
export default function VoucherDetails() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const listPath = `/${user.role}/vouchers`;

  const [voucher, setVoucher] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [busy, setBusy] = useState(false);
  const [reloadKey, setReloadKey] = useState(0); // change it to fetch the voucher again

  useEffect(() => {
    let cancelled = false;
    api
      .get(`/vouchers/${id}`)
      .then(({ data }) => {
        if (cancelled) return;
        setVoucher(data);
        setError('');
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
  }, [id, reloadKey]);

  async function submitVoucher() {
    if (!window.confirm('Submit for approval? You cannot edit this voucher afterwards.')) return;
    setBusy(true);
    setActionError('');
    try {
      await api.post(`/vouchers/${id}/submit`);
      setReloadKey((k) => k + 1);
    } catch (err) {
      setActionError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function deleteVoucher() {
    if (!window.confirm('Delete this draft? This cannot be undone.')) return;
    setBusy(true);
    setActionError('');
    try {
      await api.delete(`/vouchers/${id}`);
      navigate(listPath, { replace: true });
    } catch (err) {
      setActionError(getErrorMessage(err));
      setBusy(false);
    }
  }

  if (loading) return <p className="muted">Loading...</p>;
  if (error) {
    return (
      <div className="card">
        <div className="alert alert-error">{error}</div>
        <Link to={listPath}>Back to vouchers</Link>
      </div>
    );
  }

  const v = voucher;
  const isOwnerDraft = user.role === 'employee' && v.status === 'draft';

  return (
    <div className="card">
      <div className="page-header">
        <div>
          <h2>{v.voucher_number}</h2>
          <StatusBadge status={v.status} />
        </div>
        <div className="actions no-print">
          <Link className="btn btn-outline" to={listPath}>
            Back
          </Link>
          <button className="btn btn-outline" onClick={() => window.print()}>
            Print
          </button>
        </div>
      </div>

      {actionError && <div className="alert alert-error">{actionError}</div>}

      {v.status === 'rejected' && (
        <div className="alert alert-error">
          <strong>Rejected.</strong> Reason: {v.rejection_reason}
        </div>
      )}

      {isOwnerDraft && !v.employee_signature_path && (
        <div className="alert alert-info no-print">
          This draft has no signature yet. Edit it and upload your signature before submitting.
        </div>
      )}

      <section className="detail-section">
        <h3>Basic information</h3>
        <dl className="detail-grid">
          <Item label="Voucher number">{v.voucher_number}</Item>
          <Item label="Voucher date">{formatDate(v.voucher_date)}</Item>
          <Item label="Expense date">{formatDate(v.expense_date)}</Item>
          <Item label="Department">{v.department}</Item>
          <Item label="Expense title">{v.expense_title}</Item>
          <Item label="Category">{v.expense_category}</Item>
          <Item label="Amount">{formatAmount(v.amount)}</Item>
          <Item label="Description" wide>
            {v.expense_description}
          </Item>
        </dl>
      </section>

      <section className="detail-section">
        <h3>Employee information</h3>
        <dl className="detail-grid">
          <Item label="Employee name">{v.employee_name}</Item>
          <Item label="Employee ID">{v.employee_code}</Item>
          <Item label="Employee signature">
            <Signature path={v.employee_signature_path} label="Employee signature" />
          </Item>
        </dl>
      </section>

      <section className="detail-section">
        <h3>Approval information</h3>
        <dl className="detail-grid">
          <Item label="Current status">
            <StatusBadge status={v.status} />
          </Item>
          <Item label="Reviewed by">{v.director_name}</Item>
          <Item label="Approval date">{formatDateTime(v.approval_date)}</Item>
          <Item label="Director signature">
            <Signature path={v.director_signature_path} label="Director signature" />
          </Item>
          {v.status === 'rejected' && <Item label="Rejection reason">{v.rejection_reason}</Item>}
        </dl>
      </section>

      <section className="detail-section">
        <h3>Audit information</h3>
        <dl className="detail-grid">
          <Item label="Created">{formatDateTime(v.created_at)}</Item>
          <Item label="Last updated">{formatDateTime(v.updated_at)}</Item>
        </dl>
      </section>

      {/* Only the Director, and only while the voucher is waiting for a decision */}
      {user.role === 'director' && v.status === 'pending_approval' && (
        <ReviewPanel voucherId={v.id} onDone={() => setReloadKey((k) => k + 1)} />
      )}

      {isOwnerDraft && (
        <div className="actions no-print">
          <Link className="btn btn-outline" to={`/employee/vouchers/${v.id}/edit`}>
            Edit
          </Link>
          <button className="btn" onClick={submitVoucher} disabled={busy || !v.employee_signature_path}>
            Submit for approval
          </button>
          <button className="btn btn-danger" onClick={deleteVoucher} disabled={busy}>
            Delete
          </button>
        </div>
      )}
    </div>
  );
}
