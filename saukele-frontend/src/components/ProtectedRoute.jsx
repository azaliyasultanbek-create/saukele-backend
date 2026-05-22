import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children, requireCouple = false, requireGuest = false, requireAdmin = false }) {
  const { isAuthenticated, isCouple, isGuest, isAdmin, loading } = useAuth();

  if (loading) {
    return <div className="loading">Загрузка...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requireCouple && !isCouple) {
    return <Navigate to="/" replace />;
  }

  if (requireGuest && !isGuest) {
    return <Navigate to="/" replace />;
  }

  if (requireAdmin && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  return children;
}
