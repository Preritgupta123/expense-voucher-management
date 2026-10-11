import { useEffect, useState } from 'react';
import api, { getErrorMessage } from '../api';

export default function ReviewPanel({ voucherId, onDone }) {
  const [file, setFile] = useState(null); // the Director's signature
  const [preview, setPreview] = useState('');
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!file) {
      setPreview('');
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function handleFile(e) {
    const chosen = e.target.files[0];
    let message = '';
    if (chosen && !['image/png', 'image/jpeg'].includes(chosen.type)) {
      message = 'Only PNG or JPG images are allowed';
    } else if (chosen && chosen.size > 2 * 1024 * 1024) {
      message = 'Image must be 2 MB or smaller';
    }
    setErrors((prev) => ({ ...prev, signature: message }));
    setFile(message ? null : chosen || null);
  }

  async function approve() {
    setServerError('');
    if (!file) {
      setErrors((prev) => ({ ...prev, signature: 'Your signature is required to approve' }));
      return;
    }
    if (!window.confirm('Approve this voucher? This cannot be undone.')) return;

    setBusy(true);
    try {
      const body = new FormData(); // a file upload, so FormData instead of JSON
      body.append('signature', file);
      await api.post(`/vouchers/${voucherId}/approve`, body);
      onDone();
    } catch (err) {
      setServerError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function reject() {
    setServerError('');
    const text = reason.trim();
    if (!text) {
      setErrors((prev) => ({ ...prev, reason: 'A rejection reason is required' }));
      return;
    }
    if (!window.confirm('Reject this voucher? This cannot be undone.')) return;

    setBusy(true);
    try {
      await api.post(`/vouchers/${voucherId}/reject`, { reason: text });
      onDone();
    } catch (err) {
      setServerError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="review-panel no-print">
      <h3>Review this voucher</h3>

      {serverError && <div className="alert alert-error">{serverError}</div>}

      <div className="review-grid">
        <div className="review-box">
          <h4>Approve</h4>
          <div className={`field ${errors.signature ? 'has-error' : ''}`}>
            <label htmlFor="director-signature">Your signature (PNG or JPG, max 2 MB) *</label>
            <input id="director-signature" type="file" accept="image/png,image/jpeg" onChange={handleFile} />
            {errors.signature && <span className="error-text">{errors.signature}</span>}
            {preview && <img className="sig-preview" src={preview} alt="Your signature preview" />}
          </div>
          <button className="btn" type="button" onClick={approve} disabled={busy}>
            {busy ? 'Please wait...' : 'Approve'}
          </button>
        </div>

        <div className="review-box">
          <h4>Reject</h4>
          <div className={`field ${errors.reason ? 'has-error' : ''}`}>
            <label htmlFor="reason">Reason for rejection *</label>
            <textarea
              id="reason"
              rows={4}
              maxLength={1000}
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                setErrors((prev) => ({ ...prev, reason: '' }));
              }}
            />
            {errors.reason && <span className="error-text">{errors.reason}</span>}
          </div>
          <button className="btn btn-danger" type="button" onClick={reject} disabled={busy}>
            {busy ? 'Please wait...' : 'Reject'}
          </button>
        </div>
      </div>
    </section>
  );
}
