import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/lib/auth-context';
import Sidebar from '@/components/Sidebar';

export const metadata: Metadata = {
  title: 'Garuda AI — Consumer Dispute Platform',
  description:
    'AI-powered consumer dispute resolution platform. File disputes, track cases, collect evidence, and escalate to resolution.',
};

import React, { Suspense } from 'react';

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
              <Suspense fallback={<div className="p-8">Loading...</div>}>
                {children}
              </Suspense>
            </main>
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
