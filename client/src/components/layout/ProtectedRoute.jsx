import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

// No token -> that role's login page. Wrong role -> your own home.
export default function ProtectedRoute({ role, children }) {
  const { user, token } = useAuth();
  const location = useLocation();
  if (!token || !user) return <Navigate to={`/login/${role}`} replace state={{ from: location.pathname }} />;
  if (user.role !== role) return <Navigate to={`/${user.role}`} replace />;
  return children;
}
