import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';

import { useStore } from '../store/useStore';

interface ProtectedRouteProps {
  children: ReactNode;
}

export const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const user = useStore(state => state.user);
  const location = useLocation();

  if (!user || !user.token) {
    // Redirect them to the /login page, but save the current location they were
    // trying to go to after they login.
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};
