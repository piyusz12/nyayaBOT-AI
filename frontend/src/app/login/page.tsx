'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { login, register, setToken } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Bot, Shield, ArrowRight, Lock, Mail, User } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { checkAuth } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isRegister) {
        await register(email, password, fullName || undefined);
      }
      await login(email, password);
      checkAuth();
      router.push('/');
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please verify credentials or try Demo Mode.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setLoading(true);
    setError('');
    // Try to register demo user if not exists or log in
    try {
      try {
        await register('operator@ps30.internal', 'Password123!', 'Lead Dispute Officer');
      } catch {
        // already registered, proceed to login
      }
      await login('operator@ps30.internal', 'Password123!');
      checkAuth();
      router.push('/');
    } catch (err: any) {
      // If backend is offline or fails, grant local demo token
      setToken('demo-operator-token-ps30');
      checkAuth();
      router.push('/');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        marginLeft: 'calc(-1 * var(--sidebar-width))',
        background: 'var(--bg-root)',
        position: 'relative',
        zIndex: 200,
        padding: 20,
      }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: 440,
          padding: 'var(--space-8)',
          boxShadow: 'var(--shadow-lg)',
          border: '1px solid var(--border-default)',
        }}
      >
        {/* Brand Logo & Title */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div
            style={{
              width: 52,
              height: 52,
              background: 'linear-gradient(135deg, #0284c7 0%, #0ea5e9 100%)',
              borderRadius: 'var(--radius-lg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              margin: '0 auto 14px',
              boxShadow: '0 0 24px rgba(14, 165, 233, 0.4)',
            }}
          >
            <Bot size={28} />
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text-primary)', marginBottom: 4 }}>
            PS 30 Counter-Agent
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            Consumer Dispute Resolution & Legal-Tech Operations
          </p>
        </div>

        {/* Demo Fast Access Button */}
        <div style={{ marginBottom: 20 }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleDemoLogin}
            disabled={loading}
            style={{
              width: '100%',
              justifyContent: 'center',
              border: '1px solid var(--border-hover)',
              background: 'rgba(14, 165, 233, 0.08)',
              color: 'var(--brand-primary-light)',
            }}
          >
            <Shield size={15} />
            <span>⚡ One-Click Operator Sign In (Demo Mode)</span>
          </button>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            margin: '16px 0',
            color: 'var(--text-muted)',
            fontSize: 11,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}
        >
          <div style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }} />
          <span>or sign in with credentials</span>
          <div style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }} />
        </div>

        {error && (
          <div
            style={{
              background: 'var(--error-bg)',
              border: '1px solid var(--error-border)',
              borderRadius: 'var(--radius-md)',
              padding: '10px 14px',
              marginBottom: 16,
              fontSize: 12.5,
              color: 'var(--error)',
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {isRegister && (
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <div style={{ position: 'relative' }}>
                <input
                  className="form-input"
                  type="text"
                  placeholder="e.g. Adv. Priya Sharma"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  style={{ paddingLeft: 34 }}
                />
                <User size={15} style={{ position: 'absolute', left: 11, top: 12, color: 'var(--text-muted)' }} />
              </div>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Email Address</label>
            <div style={{ position: 'relative' }}>
              <input
                className="form-input"
                type="email"
                placeholder="operator@ps30.internal"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={{ paddingLeft: 34 }}
              />
              <Mail size={15} style={{ position: 'absolute', left: 11, top: 12, color: 'var(--text-muted)' }} />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <div style={{ position: 'relative' }}>
              <input
                className="form-input"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                style={{ paddingLeft: 34 }}
              />
              <Lock size={15} style={{ position: 'absolute', left: 11, top: 12, color: 'var(--text-muted)' }} />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{ width: '100%', marginTop: 12, justifyContent: 'center' }}
          >
            <span>{loading ? 'Authenticating...' : isRegister ? 'Create Account' : 'Sign In'}</span>
            <ArrowRight size={15} />
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 18, fontSize: 13, color: 'var(--text-secondary)' }}>
          {isRegister ? 'Already registered?' : 'Need an account?'}{' '}
          <button
            type="button"
            onClick={() => {
              setIsRegister(!isRegister);
              setError('');
            }}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--brand-primary-light)',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            {isRegister ? 'Sign In' : 'Register Operator'}
          </button>
        </div>
      </div>
    </div>
  );
}
