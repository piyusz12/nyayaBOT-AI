'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { checkBackendHealth, logout } from '@/lib/api';
import {
  Search,
  Bell,
  LogOut,
  ChevronRight,
  Shield,
  User as UserIcon,
} from 'lucide-react';

interface HeaderProps {
  title?: string;
  subtitle?: string;
}

export default function Header({ title }: HeaderProps) {
  const { isAuthenticated, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    // Check backend connectivity on mount and every 30s
    const check = async () => {
      const health = await checkBackendHealth();
      setBackendOnline(!!health);
    };
    check();
    const interval = setInterval(check, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = () => {
    logout();
    signOut();
    router.push('/login');
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/cases?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  // Generate breadcrumb items
  const pathParts = pathname.split('/').filter(Boolean);
  const breadcrumbItems = pathParts.map((part, index) => {
    const url = `/${pathParts.slice(0, index + 1).join('/')}`;
    const label = part.charAt(0).toUpperCase() + part.slice(1).replace(/-/g, ' ');
    return { url, label };
  });

  return (
    <header className="header">
      {/* Left: Breadcrumbs & Title */}
      <div className="header-left">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/" className="breadcrumbs-item">
            PS 30
          </Link>
          {breadcrumbItems.map((item, idx) => (
            <span key={item.url} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <ChevronRight size={14} style={{ opacity: 0.5 }} />
              {idx === breadcrumbItems.length - 1 ? (
                <span className="breadcrumb-active">{item.label}</span>
              ) : (
                <Link href={item.url}>{item.label}</Link>
              )}
            </span>
          ))}
        </nav>
      </div>

      {/* Center: Global Search */}
      <form onSubmit={handleSearch} className="header-search">
        <Search size={15} />
        <input
          type="text"
          placeholder="Search dossiers, merchants, or case #..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </form>

      {/* Right Actions */}
      <div className="header-actions">
        {/* Backend Connectivity Status Indicator */}
        <div
          className="health-pill"
          title={backendOnline ? 'Connected to FastAPI backend' : 'Backend offline or connecting'}
        >
          <span className={`health-dot ${backendOnline ? 'online' : 'offline'}`} />
          <span>{backendOnline === null ? 'Pinging...' : backendOnline ? 'FastAPI Connected' : 'Standalone Mode'}</span>
        </div>

        {/* Notifications Icon */}
        <Link
          href="/approvals"
          className="btn btn-ghost btn-sm"
          title="Pending Approvals & Notifications"
          style={{ position: 'relative', padding: '8px' }}
        >
          <Bell size={17} />
        </Link>

        {/* User Profile / Logout */}
        {isAuthenticated ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Link
              href="/settings"
              className="btn btn-secondary btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <UserIcon size={14} />
              <span>Operator</span>
            </Link>
            <button
              className="btn btn-ghost btn-sm"
              onClick={handleLogout}
              title="Sign Out"
              style={{ color: 'var(--text-muted)' }}
            >
              <LogOut size={16} />
            </button>
          </div>
        ) : (
          <Link href="/login" className="btn btn-primary btn-sm">
            Sign In
          </Link>
        )}
      </div>
    </header>
  );
}
