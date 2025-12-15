'use client';

import React, { ReactNode } from 'react';
import clsx from 'clsx';

interface ButtonConfig {
  label: string;
  onClick?: () => void;
  href?: string;
  color?: 'emerald' | 'pink' | 'blue' | 'zinc' | 'red';
}

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  primaryButton?: ButtonConfig;
  secondaryButton?: ButtonConfig;
  videoLink?: string;
  videoImageUrl?: string;
  className?: string;
}

const buttonColors = {
  emerald: 'bg-emerald-600 hover:bg-emerald-700 text-white',
  pink: 'bg-pink-500 hover:bg-pink-600 text-white',
  blue: 'bg-blue-600 hover:bg-blue-700 text-white',
  zinc: 'bg-zinc-700 hover:bg-zinc-600 text-white',
  red: 'bg-red-600 hover:bg-red-700 text-white',
};

export function EmptyState({
  icon,
  title,
  description,
  primaryButton,
  secondaryButton,
  videoLink,
  videoImageUrl,
  className,
}: EmptyStateProps) {
  const renderButton = (config: ButtonConfig, isPrimary: boolean) => {
    const colorClass = isPrimary
      ? buttonColors[config.color || 'emerald']
      : 'border border-zinc-300 bg-transparent text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800';

    const buttonClass = clsx(
      'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors',
      colorClass
    );

    if (config.href) {
      return (
        <a
          href={config.href}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonClass}
          onClick={config.onClick}
        >
          {config.label}
        </a>
      );
    }

    return (
      <button onClick={config.onClick} className={buttonClass}>
        {config.label}
      </button>
    );
  };

  return (
    <div
      className={clsx(
        'flex items-center justify-center py-12 text-center',
        className
      )}
    >
      <div className="max-w-md">
        {icon && (
          <div className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
            {icon}
          </div>
        )}

        <h3 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          {title}
        </h3>

        {videoLink && videoImageUrl && (
          <a
            href={videoLink}
            target="_blank"
            rel="noopener noreferrer"
            className="group mx-auto mb-4 block max-w-[240px] overflow-hidden rounded-xl border border-zinc-200 shadow-lg transition-all hover:shadow-xl hover:border-zinc-300 dark:border-zinc-700 dark:hover:border-zinc-600"
          >
            <img
              src={videoImageUrl}
              alt="Watch tutorial"
              className="w-full transition-transform duration-300 group-hover:scale-105"
            />
          </a>
        )}

        {description && (
          <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
            {description}
          </p>
        )}

        {(primaryButton || secondaryButton) && (
          <div className="flex items-center justify-center gap-3">
            {primaryButton && renderButton(primaryButton, true)}
            {secondaryButton && renderButton(secondaryButton, false)}
          </div>
        )}
      </div>
    </div>
  );
}
