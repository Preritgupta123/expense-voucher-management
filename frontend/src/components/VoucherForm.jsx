import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api, { API_URL, getErrorMessage } from '../api';

const CATEGORIES = ['Travel', 'Meals', 'Accommodation', 'Office Supplies', 'Equipment', 'Fuel', 'Training', 'Other'];

const EMPTY_FORM = {
  expense_date: '',
  department: '',
  expense_title: '',
  expense_category: '',
  expense_description: '',
  amount: '',
};

// Used for BOTH "Create Voucher" and "Edit Draft Voucher".
// If the URL has an :id we are editing, otherwise we are creating.
export default function VoucherForm() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [form, setForm] = useState(EMPTY_FORM);
  const [file, setFile] = useState(null); // signature chosen just now
  const [signaturePath, setSignaturePath] = useState(null); // signature already saved on the server
  const [preview, setPreview] = useState('');
  const [savedId, setSavedId] = useState(id || null); // becomes set after the first successful save
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [loading, setLoading] = useState(Boolean(id));
  const [busy, setBusy] = useState(false);

  // Edit mode: load the existing draft into the form
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    api
      .get(`/vouchers/${id}`)
      .then(({ data }) => {
        if (cancelled) return;
        if (data.status !== 'draft') {
          // Only drafts may be edited, so go to the read-only page instead
          navigate(`/employee/vouchers/${id}`, { replace: true });
          return;
        }
        setForm({
          expense_date: String(data.expense_date || '').slice(0, 10),
          department: data.department || '',
          expense_title: data.expense_title || '',
          expense_category: data.expense_category || '',
          expense_description: data.expense_description || '',
          amount: String(data.amount),
        });
        setSignaturePath(data.employee_signature_path);
      })
      .catch((err) => {
        if (!cancelled) setServerError(getErrorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, navigate]);

  // Show a preview of the chosen image, and free the memory when it changes
  useEffect(() => {
    if (!file) {
      setPreview('');
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  function handleFile(e) {
    const chosen = e.target.files[0];
    const next = { ...errors };
    delete next.signature;
    if (chosen && !['image/png', 'image/jpeg'].includes(chosen.type)) {
      next.signature = 'Only PNG or JPG images are allowed';
    } else if (chosen && chosen.size > 2 * 1024 * 1024) {
      next.signature = 'Image must be 2 MB or smaller';
    } else {
      setFile(chosen || null);
    }
    setErrors(next);
  }

  // Same rules as the backend (assignment section 9). The backend checks again.
  function validate(forSubmit) {
    const found = {};
    if (!form.department.trim()) found.department = 'Department is required';
    if (!form.expense_title.trim()) found.expense_title = 'Expense title is required';
    if (!form.expense_date) found.expense_date = 'Expense date is required';
    const amount = Number(form.amount);
    if (form.amount === '' || !Number.isFinite(amount) || amount <= 0) {
      found.amount = 'Amount must be greater than 0';
    }
    if (forSubmit && !file && !signaturePath) {
      found.signature = 'Your signature is required before submitting';
    }
    return found;
  }

  // Saving is several requests in a row: save the data, upload the signature,
  // and (for "Submit") change the status. If a later step fails, the draft
  // already exists, so we remember its id and a retry updates it instead of
  // creating a duplicate.
  async function save(andSubmit) {
    setServerError('');
    const found = validate(andSubmit);
    setErrors(found);
    if (Object.keys(found).length) return;

    setBusy(true);
    try {
      const payload = { ...form, amount: Number(form.amount) };
      let voucherId = savedId;
      if (voucherId) {
        await api.put(`/vouchers/${voucherId}`, payload);
      } else {
        const { data } = await api.post('/vouchers', payload);
        voucherId = data.id;
        setSavedId(voucherId);
      }

      if (file) {
        const body = new FormData(); // file uploads use FormData, not JSON
        body.append('signature', file); // the field name the backend expects
        const { data } = await api.post(`/vouchers/${voucherId}/signature`, body);
        setSignaturePath(data.employee_signature_path);
        setFile(null);
      }

      if (andSubmit) await api.post(`/vouchers/${voucherId}/submit`);
      navigate(`/employee/vouchers/${voucherId}`, { replace: true });
    } catch (err) {
      setServerError(getErrorMessage(err));
      if (err.response?.data?.errors) setErrors(err.response.data.errors);
    } finally {
      setBusy(false);
    }
  }

  function handleSubmitClick() {
    if (window.confirm('Submit for approval? You cannot edit this voucher afterwards.')) {
      save(true);
    }
  }

  if (loading) return <p className="muted">Loading...</p>;

  const fieldClass = (name, extra = '') => `field ${extra} ${errors[name] ? 'has-error' : ''}`;

  return (
    <div className="card">
      <div className="page-header">
        <h2>{id ? 'Edit Draft Voucher' : 'Create Voucher'}</h2>
      </div>

      {serverError && <div className="alert alert-error">{serverError}</div>}

      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          save(false); // pressing Enter saves as a draft
        }}
      >
        <div className="form-grid">
          <div className={fieldClass('expense_date')}>
            <label htmlFor="expense_date">Expense date *</label>
            <input id="expense_date" name="expense_date" type="date" value={form.expense_date} onChange={handleChange} />
            {errors.expense_date && <span className="error-text">{errors.expense_date}</span>}
          </div>

          <div className={fieldClass('department')}>
            <label htmlFor="department">Department *</label>
            <input id="department" name="department" maxLength={100} value={form.department} onChange={handleChange} />
            {errors.department && <span className="error-text">{errors.department}</span>}
          </div>

          <div className={fieldClass('expense_title')}>
            <label htmlFor="expense_title">Expense title *</label>
            <input id="expense_title" name="expense_title" maxLength={200} value={form.expense_title} onChange={handleChange} />
            {errors.expense_title && <span className="error-text">{errors.expense_title}</span>}
          </div>

          <div className={fieldClass('expense_category')}>
            <label htmlFor="expense_category">Expense category</label>
            <select id="expense_category" name="expense_category" value={form.expense_category} onChange={handleChange}>
              <option value="">Select a category</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className={fieldClass('amount')}>
            <label htmlFor="amount">Amount (INR) *</label>
            <input id="amount" name="amount" type="number" min="0.01" step="0.01" value={form.amount} onChange={handleChange} />
            {errors.amount && <span className="error-text">{errors.amount}</span>}
          </div>

          <div className={fieldClass('expense_description', 'field-wide')}>
            <label htmlFor="expense_description">Description</label>
            <textarea id="expense_description" name="expense_description" rows={3} value={form.expense_description} onChange={handleChange} />
          </div>

          <div className={fieldClass('signature', 'field-wide')}>
            <label htmlFor="signature">Your signature (PNG or JPG, max 2 MB)</label>
            <input id="signature" type="file" accept="image/png,image/jpeg" onChange={handleFile} />
            {errors.signature && <span className="error-text">{errors.signature}</span>}
            {(preview || signaturePath) && (
              <img className="sig-preview" src={preview || `${API_URL}${signaturePath}`} alt="Signature preview" />
            )}
            {!preview && signaturePath && <span className="hint">Current signature. Choose a file to replace it.</span>}
          </div>
        </div>

        <div className="actions">
          <button className="btn btn-outline" type="submit" disabled={busy}>
            {busy ? 'Saving...' : 'Save as Draft'}
          </button>
          <button className="btn" type="button" disabled={busy} onClick={handleSubmitClick}>
            Submit for approval
          </button>
          <Link className="btn btn-outline" to="/employee/vouchers">
            Cancel
          </Link>
        </div>
        <span className="hint">A signature is only required when you submit.</span>
      </form>
    </div>
  );
}
