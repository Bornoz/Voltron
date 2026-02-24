import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

export function AuthLayout() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
