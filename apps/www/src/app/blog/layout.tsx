'use client';

import { Button, SurfpoolIcon, SurfpoolTypo } from '@surfpool/ui';
import { Star } from 'lucide-react';
import Image from 'next/image';
import { useEffect, useState } from 'react';

function GitHubStars() {
  const [stars, setStars] = useState<number | null>(null);

  useEffect(() => {
    fetch('https://api.github.com/repos/txtx/surfpool')
      .then((res) => res.json())
      .then((data) => setStars(data.stargazers_count))
      .catch(() => setStars(null));
  }, []);

  return (
    <Button variant="yellow" size="sm" href="https://github.com/txtx/surfpool" className="!gap-1">
      <Star className="h-3 w-3 fill-current" />
      {stars !== null ? stars.toLocaleString() : '—'}
    </Button>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-zinc-900 bg-black/80 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <a href="/" aria-label="Surfpool Home" className="flex items-center gap-3">
          <Image src="/surfpool-icon.svg" alt="Surfpool" width={32} height={32} className="h-8 w-8" />
          <SurfpoolTypo className="h-5 hidden sm:block" variant="dark" />
        </a>
        <nav className="hidden items-center gap-6 md:flex" aria-label="Main navigation">
          <a href="https://docs.surfpool.run" className="text-sm text-zinc-400 transition-colors hover:text-white">
            Docs
          </a>
          <a href="/blog" className="text-sm text-zinc-400 transition-colors hover:text-white">
            Blog
          </a>
          <Button variant="primary" size="sm" href="https://docs.surfpool.run/getting-started">
            Get Started
          </Button>
          <GitHubStars />
        </nav>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="mt-24 border-t border-zinc-900">
      <div className="mx-auto max-w-7xl px-6 py-12">
        <div className="mb-2 flex flex-col items-center justify-between gap-6 md:flex-row">
          <div className="flex items-end gap-4">
            <SurfpoolIcon className="h-24 w-24" />
            <a href="https://money.mq" aria-label="MoneyMQ" className="mb-1 transition-opacity hover:opacity-80">
              <Image src="/moneymq-icon.svg" alt="MoneyMQ" width={48} height={48} className="h-12 w-12" />
            </a>
            <a href="https://barrel.rs" aria-label="Barrel" className="mb-1 transition-opacity hover:opacity-80">
              <Image src="/barrel-icon.svg" alt="Barrel" width={48} height={48} className="h-12 w-12" />
            </a>
          </div>

          <div className="flex items-center gap-8">
            <a
              href="https://github.com/txtx/surfpool"
              className="text-sm text-zinc-500 transition-colors hover:text-white"
            >
              GitHub
            </a>
            <a href="https://docs.surfpool.run" className="text-sm text-zinc-500 transition-colors hover:text-white">
              Docs
            </a>
            <a
              href="https://discord.gg/rqXmWsn2ja"
              className="text-sm text-zinc-500 transition-colors hover:text-white"
            >
              Discord
            </a>
            <a href="/llms.txt" className="font-mono text-xs text-zinc-600 transition-colors hover:text-zinc-400">
              llms.txt
            </a>
          </div>
        </div>

        <div className="pt-4 text-left">
          <p className="text-sm text-zinc-600">© {new Date().getFullYear()} Txtx, Inc. — Open source, built in public</p>
        </div>
      </div>
    </footer>
  );
}

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <main className="min-h-screen">{children}</main>
      <Footer />
    </>
  );
}
