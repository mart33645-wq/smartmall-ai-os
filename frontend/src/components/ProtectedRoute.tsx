import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';

import { useStore } from '../store/useStore';

interface ProtectedRouteProps {
  children: ReactNode;
}

export const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const user = useStore((state) => state.user);
  const location = useLocation();

  if (!user?.token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};
