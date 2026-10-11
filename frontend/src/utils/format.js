export const STATUS_LABEL = {
  draft: 'Draft',
  pending_approval: 'Pending Approval',
  approved: 'Approved',
  rejected: 'Rejected',
};

// Assumption: amounts are in Indian Rupees
export function formatAmount(value) {
  return Number(value).toLocaleString('en-IN', { style: 'currency', currency: 'INR' });
}

// The backend sends dates as plain text like "2026-10-05" (dateStrings: true),
// so we reshape the text instead of using Date objects. That avoids timezone shifts.
export function formatDate(value) {
  if (!value) return '';
  const [y, m, d] = String(value).slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

export function formatDateTime(value) {
  if (!value) return '';
  return `${formatDate(value)} ${String(value).slice(11, 16)}`;
}
