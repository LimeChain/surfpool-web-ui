'use client';

import { ConfigProvider } from '@/contexts/config-context';
import '@/styles/tailwind.css';
import type React from 'react';
import { Toaster } from 'sonner';
import { Dashboard } from './dashboard';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className="dark text-zinc-950 antialiased lg:bg-zinc-100 dark:bg-zinc-900 dark:text-white dark:lg:bg-zinc-950"
    >
      <head>
        <title>Surfpool Studio</title>
        <link rel="icon" type="image/png" sizes="196x196" href="/favicon-196x196.png" />
        <link rel="icon" type="image/png" sizes="128x128" href="/favicon-128x128.png" />
        <link rel="icon" type="image/png" sizes="96x96" href="/favicon-96x96.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="preconnect" href="https://rsms.me/" />
        <link rel="stylesheet" href="https://rsms.me/inter/inter.css" />
      </head>
      <body>
        <ConfigProvider>
          <Dashboard>{children}</Dashboard>
        </ConfigProvider>
        <Toaster theme="dark" richColors closeButton position="bottom-right" />
      </body>
    </html>
  );
}
