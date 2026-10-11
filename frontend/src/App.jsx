import { Link, Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { ROLE_HOME } from './utils/roles';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import VoucherList from './components/VoucherList';
import VoucherForm from './components/VoucherForm';
import VoucherDetails from './components/VoucherDetails';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import NotFound from './pages/NotFound';

function HomeRedirect() {
  const { user } = useAuth();
  return <Navigate to={user ? ROLE_HOME[user.role] : '/login'} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomeRedirect />} />
      <Route path="/login" element={<Login />} />

      {/* Employee screens */}
      <Route element={<ProtectedRoute allowedRoles={['employee']} />}>
        <Route element={<Layout />}>
          <Route path="/employee" element={<Dashboard />} />
          <Route
            path="/employee/vouchers"
            element={
              <VoucherList
                title="My Vouchers"
                basePath="/employee/vouchers"
                actions={
                  <Link className="btn" to="/employee/vouchers/new">
                    + Create Voucher
                  </Link>
                }
              />
            }
          />
          <Route path="/employee/vouchers/new" element={<VoucherForm />} />
          <Route path="/employee/vouchers/:id" element={<VoucherDetails />} />
          <Route path="/employee/vouchers/:id/edit" element={<VoucherForm />} />
        </Route>
      </Route>

      {/* Director screens */}
      <Route element={<ProtectedRoute allowedRoles={['director']} />}>
        <Route element={<Layout />}>
          <Route path="/director" element={<Dashboard />} />
          <Route
            path="/director/pending"
            element={
              <VoucherList
                title="Pending Approvals"
                basePath="/director/vouchers"
                fixedStatus="pending_approval"
                showEmployee
              />
            }
          />
          <Route
            path="/director/vouchers"
            element={<VoucherList title="All Vouchers" basePath="/director/vouchers" showEmployee />}
          />
          <Route path="/director/vouchers/:id" element={<VoucherDetails />} />
        </Route>
      </Route>

      {/* Accounts screens */}
      <Route element={<ProtectedRoute allowedRoles={['accounts']} />}>
        <Route element={<Layout />}>
          <Route path="/accounts" element={<Dashboard />} />
          <Route
            path="/accounts/vouchers"
            element={<VoucherList title="All Vouchers" basePath="/accounts/vouchers" showEmployee />}
          />
          <Route path="/accounts/vouchers/:id" element={<VoucherDetails />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
