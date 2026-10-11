import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { ROLE_HOME } from './utils/roles';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Placeholder from './pages/Placeholder';
import NotFound from './pages/NotFound';

// "/" sends you to your own home page, or to the login page
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
          <Route path="/employee" element={<Placeholder title="Employee Dashboard" />} />
          <Route path="/employee/vouchers" element={<Placeholder title="My Vouchers" />} />
          <Route path="/employee/vouchers/new" element={<Placeholder title="Create Voucher" />} />
          <Route path="/employee/vouchers/:id" element={<Placeholder title="Voucher Details" />} />
          <Route path="/employee/vouchers/:id/edit" element={<Placeholder title="Edit Draft Voucher" />} />
        </Route>
      </Route>

      {/* Director screens */}
      <Route element={<ProtectedRoute allowedRoles={['director']} />}>
        <Route element={<Layout />}>
          <Route path="/director" element={<Placeholder title="Director Dashboard" />} />
          <Route path="/director/pending" element={<Placeholder title="Pending Approvals" />} />
          <Route path="/director/vouchers" element={<Placeholder title="All Vouchers" />} />
          <Route path="/director/vouchers/:id" element={<Placeholder title="Voucher Details" />} />
        </Route>
      </Route>

      {/* Accounts screens */}
      <Route element={<ProtectedRoute allowedRoles={['accounts']} />}>
        <Route element={<Layout />}>
          <Route path="/accounts" element={<Placeholder title="Accounts Dashboard" />} />
          <Route path="/accounts/vouchers" element={<Placeholder title="All Vouchers" />} />
          <Route path="/accounts/vouchers/:id" element={<Placeholder title="Voucher Details" />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
