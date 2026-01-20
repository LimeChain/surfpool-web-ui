'use client';

import { Button } from '@surfpool/ui';
import { X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

const InstallPanelContext = createContext<{
  isOpen: boolean;
  open: () => void;
  close: () => void;
}>({ isOpen: false, open: () => {}, close: () => {} });

export function useInstallPanel() {
  return useContext(InstallPanelContext);
}

export function InstallPanelProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <InstallPanelContext.Provider
      value={{
        isOpen,
        open: () => setIsOpen(true),
        close: () => setIsOpen(false),
      }}
    >
      {children}
      <InstallPanel />
    </InstallPanelContext.Provider>
  );
}

function InstallPanel() {
  const { isOpen, close } = useContext(InstallPanelContext);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={close}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          />

          {/* Panel */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed inset-x-0 bottom-0 z-50 border-t border-zinc-800 bg-black/95 backdrop-blur-md"
          >
            <div className="mx-auto max-w-4xl px-6 py-12">
              {/* Close button */}
              <button
                onClick={close}
                className="absolute right-6 top-6 rounded-full p-2 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="mb-8">
                <h2 className="mb-2 text-2xl font-bold">Get Started with Surfpool</h2>
                <p className="text-zinc-400">Install the CLI and start building in seconds.</p>
              </div>

              {/* Terminal */}
              <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950">
                <div className="flex items-center gap-2 border-b border-zinc-800 bg-zinc-900/50 px-4 py-3">
                  <div className="flex gap-1.5">
                    <div className="h-3 w-3 rounded-full bg-zinc-700" />
                    <div className="h-3 w-3 rounded-full bg-zinc-700" />
                    <div className="h-3 w-3 rounded-full bg-zinc-700" />
                  </div>
                  <span className="ml-2 text-sm text-zinc-500">terminal</span>
                </div>
                <div className="space-y-4 p-6 font-mono text-sm">
                  <div>
                    <div className="mb-1 text-zinc-500"># Install Surfpool CLI</div>
                    <div className="text-cyan-400">$ curl -sL https://run.surfpool.run/ | bash</div>
                  </div>
                  <div>
                    <div className="mb-1 text-zinc-500"># Start local Solana network</div>
                    <div className="text-cyan-400">$ surfpool</div>
                  </div>
                  <div className="border-t border-zinc-800 pt-4">
                    <div className="text-zinc-500">Dashboard ready at http://localhost:8488</div>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex items-center gap-4">
                <Button variant="primary" size="lg" href="https://docs.surfpool.run">
                  Read the Docs
                </Button>
                <Button variant="secondary" size="lg" href="https://github.com/txtx/surfpool">
                  View on GitHub
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
