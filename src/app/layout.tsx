'use client';

import { WorkspaceProvider } from '@/contexts/workspace-context';
import { nhost } from '@/lib/nhost';
import '@/styles/tailwind.css';
import type React from 'react';
import { Dashboard } from './dashboard';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className="text-zinc-950 antialiased lg:bg-zinc-100 dark:bg-zinc-900 dark:text-white dark:lg:bg-zinc-950"
    >
      <head>
        <title>Surfpool Studio</title>
        <link rel="preconnect" href="https://rsms.me/" />
        <link rel="stylesheet" href="https://rsms.me/inter/inter.css" />
      </head>
      <body>
        <Dashboard>{children}</Dashboard>
      </body>
    </html>
  );
}
