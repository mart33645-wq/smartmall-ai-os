import type { ReactNode } from 'react';

interface ProtectedRouteProps {
  children: ReactNode;
}

export const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  // Login has been removed. Keep this component as a "pass-through"
  // so we don't have to refactor all routes that used it.
  return <>{children}</>;
};
