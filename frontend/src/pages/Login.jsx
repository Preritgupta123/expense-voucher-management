import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getErrorMessage } from '../api';
import { ROLE_HOME } from '../utils/roles';

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({}); // per-field messages
  const [serverError, setServerError] = useState(''); // message from the backend
  const [loading, setLoading] = useState(false);

  // Already logged in? No need to see the login page.
  if (user) return <Navigate to={ROLE_HOME[user.role]} replace />;

  function validate() {
    const found = {};
    if (!form.email.trim()) found.email = 'Email is required';
    else if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) found.email = 'Enter a valid email address';
    if (!form.password) found.password = 'Password is required';
    return found;
  }

  // Controlled inputs: the input's value always comes from state
  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setServerError('');

    const found = validate();
    setErrors(found);
    if (Object.keys(found).length) return; // stop: nothing is sent to the server

    setLoading(true);
    try {
      const loggedIn = await login(form.email.trim(), form.password);
      navigate(ROLE_HOME[loggedIn.role], { replace: true });
    } catch (err) {
      setServerError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="center-page">
      <div className="card auth-card">
        <h2>Expense Voucher System</h2>
        <p className="muted">Sign in to continue</p>

        {serverError && <div className="alert alert-error">{serverError}</div>}

        <form onSubmit={handleSubmit} noValidate>
          <div className={`field ${errors.email ? 'has-error' : ''}`}>
            <label htmlFor="email">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              value={form.email}
              onChange={handleChange}
            />
            {errors.email && <span className="error-text">{errors.email}</span>}
          </div>

          <div className={`field ${errors.password ? 'has-error' : ''}`}>
            <label htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={form.password}
              onChange={handleChange}
            />
            {errors.password && <span className="error-text">{errors.password}</span>}
          </div>

          <button className="btn btn-block" type="submit" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
