import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/lib/auth-context';
import Sidebar from '@/components/Sidebar';
import React, { Suspense } from 'react';

export const metadata: Metadata = {
  title: 'NyayaBot — AI Consumer Dispute Resolution Platform',
  description:
    'NyayaBot: Autonomous legal counter-agent fighting unfair merchant practices, dark patterns, and unauthorized charges under CPA 2019 and CCPA guidelines.',
  icons: {
    icon: '/nyayabot-icon-dark.png',
    apple: '/nyayabot-icon-dark.png',
  },
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
