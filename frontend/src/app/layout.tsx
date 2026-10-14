import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/lib/auth-context';
import Sidebar from '@/components/Sidebar';
import React, { Suspense } from 'react';

export const metadata: Metadata = {
  title: 'PS 30 Counter-Agent — Consumer Dispute Resolution Platform',
  description:
    'AI-powered consumer dispute resolution and counter-agent escalation platform. Create dispute dossiers, upload evidence, monitor live multi-agent negotiations, identify dark patterns, and prepare statutory escalations.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <div className="app-layout">
            <Suspense fallback={<div className="sidebar" />}>
              <Sidebar />
            </Suspense>
            <main className="main-content">
              <Suspense fallback={<div className="page-content">Loading...</div>}>
                {children}
              </Suspense>
            </main>
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
