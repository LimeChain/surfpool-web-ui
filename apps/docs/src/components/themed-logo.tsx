'use client';

import { SurfpoolTypo, SurfpoolIcon } from '@surfpool/ui';

export function ThemedLogo({ className }: { className?: string }) {
  return (
    <>
      {/* Dark variant: hidden in light mode, visible in dark mode */}
      <SurfpoolTypo className={`${className} hidden dark:block`} variant="dark" />
      {/* Light variant: visible in light mode, hidden in dark mode */}
      <SurfpoolTypo className={`${className} block dark:hidden`} variant="light" />
    </>
  );
}

export function SidebarLogo() {
  return (
    <div className="flex flex-col items-start gap-3 py-4">
      <SurfpoolIcon className="h-[72px] w-[72px]" />
      <div className="flex flex-col items-start">
        {/* Dark variant */}
        <SurfpoolTypo className="h-5 hidden dark:block" variant="dark" />
        {/* Light variant */}
        <SurfpoolTypo className="h-5 block dark:hidden" variant="light" />
      </div>
    </div>
  );
}
