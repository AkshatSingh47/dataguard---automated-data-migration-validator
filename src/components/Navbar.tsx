import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { ShieldCheck, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `transition-colors py-1 ${
      isActive ? 'text-white border-b-2 border-indigo-500 font-semibold' : 'text-slate-400 hover:text-white'
    }`;

  return (
    <header className="sticky top-0 z-30 bg-slate-900 border-b border-slate-800 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <NavLink to="/" className="flex items-center gap-3 text-slate-100 group">
            <div className="w-8 h-8 rounded bg-indigo-500 text-white flex items-center justify-center font-bold text-base shadow-sm transition-transform group-hover:scale-105">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold tracking-tight text-lg text-slate-100 uppercase">DataGuard</span>
                <span className="text-[10px] uppercase font-semibold tracking-wider px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                  Validator
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">Automated Data Migration Validator</p>
            </div>
          </NavLink>

          <nav className="flex items-center space-x-2 sm:space-x-5 text-sm font-medium">
            <NavLink to="/" end className={linkClass}>
              Home
            </NavLink>
            <NavLink to="/dashboard" className={linkClass}>
              <span className="flex items-center gap-1.5">
                Dashboard
                <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-indigo-950 text-indigo-300 border border-indigo-900">
                  Live
                </span>
              </span>
            </NavLink>
            <NavLink to="/validate" className={linkClass}>
              Validate
            </NavLink>
            <NavLink to="/history" className={linkClass}>
              History
            </NavLink>
            <NavLink to="/about" className={linkClass}>
              About
            </NavLink>
            {user && (
              <div className="flex items-center gap-2 pl-2">
                <span className="hidden sm:inline text-xs text-slate-400 max-w-[140px] truncate">{user.name}</span>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-300 bg-slate-800 border border-slate-700 rounded-md hover:bg-slate-700"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Sign out
                </button>
              </div>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
};
