'use client';

import { MagnifyingGlassIcon } from '@heroicons/react/24/solid';
import { useEffect, useRef, useState } from 'react';

interface CollapsibleSearchProps {
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  variant?: 'light' | 'dark';
}

export default function CollapsibleSearch({ placeholder, value, onChange, variant = 'light' }: CollapsibleSearchProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when expanded
  useEffect(() => {
    if (isExpanded && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isExpanded]);

  // Collapse when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (inputRef.current && !inputRef.current.parentElement?.contains(event.target as Node)) {
        if (value === '') {
          setIsExpanded(false);
        }
      }
    };

    if (isExpanded) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isExpanded, value]);

  const handleExpand = () => {
    setIsExpanded(true);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };

  const isDark = variant === 'dark';

  return (
    <div className="flex justify-end">
      <div
        className={`relative h-12 transition-all duration-300 ease-out ${
          isExpanded ? 'w-[400px]' : 'w-12'
        }`}
      >
        {!isExpanded ? (
          <button
            onClick={handleExpand}
            className={`flex h-12 w-12 items-center justify-center rounded-full border transition-all shadow-lg ml-auto ${
              isDark
                ? 'border-zinc-700/50 bg-zinc-900/40 backdrop-blur-2xl hover:bg-zinc-800/60'
                : 'border-zinc-200/40 bg-white hover:bg-zinc-50 dark:border-zinc-700/30 dark:bg-zinc-900 dark:hover:bg-zinc-800'
            }`}
            aria-label="Expand search"
          >
            <MagnifyingGlassIcon className={`h-6 w-6 ${isDark ? 'text-zinc-400' : 'text-zinc-400'}`} />
          </button>
        ) : (
          <>
            <div className="pointer-events-none absolute inset-y-0 left-0 z-10 flex items-center pl-5">
              <MagnifyingGlassIcon className={`h-6 w-6 ${isDark ? 'text-zinc-400' : 'text-zinc-400'}`} aria-hidden="true" />
            </div>
            <input
              ref={inputRef}
              type="text"
              placeholder={placeholder}
              value={value}
              onChange={handleChange}
              className={`block h-12 w-full rounded-full border pl-14 pr-5 text-base transition-all focus:outline-none shadow-lg ${
                isDark
                  ? 'border-zinc-700/50 bg-zinc-900/40 text-zinc-100 placeholder:text-zinc-500 backdrop-blur-2xl focus:border-zinc-500 focus:ring-2 focus:ring-zinc-500'
                  : 'border-zinc-200/40 bg-white text-zinc-950 placeholder:text-zinc-400 focus:border-zinc-400 focus:ring-zinc-400 dark:border-zinc-700/30 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:border-zinc-500 dark:focus:ring-zinc-500'
              }`}
            />
          </>
        )}
      </div>
    </div>
  );
}
