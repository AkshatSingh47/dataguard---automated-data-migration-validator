import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Loader2 } from 'lucide-react';

export const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="max-w-xl mx-auto px-4 py-24 text-center">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mx-auto mb-3" />
        <p className="text-sm text-slate-400">Checking your session…</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` || '/validate?custom=true' }} />;
  }

  return <>{children}</>;
};
