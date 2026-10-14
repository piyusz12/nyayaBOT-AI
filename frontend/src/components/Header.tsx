'use client';

import { useAuth } from '@/lib/auth-context';
import { logout } from '@/lib/api';

export default function Header({ title }: { title?: string }) {
  const { isAuthenticated, signOut } = useAuth();

  const handleLogout = () => {
    logout();
    signOut();
    window.location.href = '/login';
  };

  return (
    <header className="header">
      <h1 className="header-title">{title || 'Dashboard'}</h1>
      <div className="header-actions">
        {isAuthenticated && (
          <button className="btn btn-ghost btn-sm" onClick={handleLogout}>
            🚪 Sign Out
          </button>
        )}
      </div>
    </header>
  );
}
