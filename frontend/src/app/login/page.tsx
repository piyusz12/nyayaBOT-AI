'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { login, register } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

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
      setError(err.message || 'Something went wrong');
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
        position: 'relative',
        zIndex: 200,
        background: 'var(--bg-root)',
      }}
    >
      {/* Ambient glow */}
      <div
        style={{
          position: 'absolute',
          top: '10%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: 600,
          height: 400,
          background:
            'radial-gradient(ellipse, rgba(99, 102, 241, 0.12) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: 420,
          padding: 'var(--space-8)',
          position: 'relative',
        }}
      >
        {/* Logo */}
        <div
          style={{
            textAlign: 'center',
            marginBottom: 'var(--space-8)',
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              background: 'var(--gradient-primary)',
              borderRadius: 'var(--radius-lg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 24,
              fontWeight: 800,
              color: 'white',
              margin: '0 auto var(--space-4)',
              boxShadow: '0 0 32px rgba(99, 102, 241, 0.3)',
            }}
          >
            G
          </div>
          <h1
            style={{
              fontSize: 24,
              fontWeight: 700,
              letterSpacing: '-0.03em',
              marginBottom: 4,
            }}
          >
            {isRegister ? 'Create Account' : 'Welcome Back'}
          </h1>
          <p
            style={{
              fontSize: 14,
              color: 'var(--text-secondary)',
            }}
          >
            {isRegister
              ? 'Join Garuda AI to resolve your disputes'
              : 'Sign in to your dispute platform'}
          </p>
        </div>

        {/* Error */}
        {error && (
          <div
            style={{
              background: 'var(--error-bg)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-3) var(--space-4)',
              marginBottom: 'var(--space-5)',
              fontSize: 13,
              color: 'var(--error)',
            }}
          >
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit}>
          {isRegister && (
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input
                className="form-input"
                type="text"
                placeholder="Enter your full name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Email</label>
            <input
              className="form-input"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              className="form-input"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-lg"
            disabled={loading}
            style={{ width: '100%', marginTop: 'var(--space-4)' }}
          >
            {loading
              ? '⏳ Please wait...'
              : isRegister
              ? '🚀 Create Account'
              : '🔐 Sign In'}
          </button>
        </form>

        {/* Toggle */}
        <div
          style={{
            textAlign: 'center',
            marginTop: 'var(--space-6)',
            fontSize: 13,
            color: 'var(--text-secondary)',
          }}
        >
          {isRegister ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button
            onClick={() => {
              setIsRegister(!isRegister);
              setError('');
            }}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-accent)',
              cursor: 'pointer',
              fontWeight: 600,
              fontFamily: 'var(--font-sans)',
              fontSize: 13,
            }}
          >
            {isRegister ? 'Sign In' : 'Register'}
          </button>
        </div>
      </div>
    </div>
  );
}
