import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ROLE_LABEL } from '../utils/roles';

// Menu links for each role (from the "Suggested Screens" section of the assignment)
const NAV = {
  employee: [
    { to: '/employee', label: 'Dashboard', end: true },
    { to: '/employee/vouchers/new', label: 'Create Voucher' },
    { to: '/employee/vouchers', label: 'My Vouchers', end: true },
  ],
  director: [
    { to: '/director', label: 'Dashboard', end: true },
    { to: '/director/pending', label: 'Pending Approvals' },
    { to: '/director/vouchers', label: 'All Vouchers' },
  ],
  accounts: [
    { to: '/accounts', label: 'Dashboard', end: true },
    { to: '/accounts/vouchers', label: 'All Vouchers' },
  ],
};

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <div>
      <header className="navbar">
        <div className="brand">Expense Vouchers</div>
        <nav className="nav-links">
          {NAV[user.role].map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => (isActive ? 'active' : '')}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="nav-user">
          <span>
            {user.name} <small className="muted">({ROLE_LABEL[user.role]})</small>
          </span>
          <button className="btn btn-outline" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>
      <main className="container">
        {/* The current page is drawn here */}
        <Outlet />
      </main>
    </div>
  );
}
