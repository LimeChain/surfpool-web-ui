import * as Headless from '@headlessui/react';
import clsx from 'clsx';
import React, { forwardRef } from 'react';
import { Link, type LinkProps } from './link';

export type ButtonSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'white' | 'yellow';

const sizes: Record<ButtonSize, string> = {
  sm: 'px-4 py-2 text-xs leading-4 tracking-[0.24px] gap-4',
  md: 'px-4 py-3 text-xs leading-[18px] tracking-[0.24px] gap-4',
  lg: 'p-4 text-sm leading-5 tracking-[0.28px] gap-4',
  xl: 'p-5 text-lg leading-[22.7px] tracking-[0.36px] gap-4',
  '2xl': 'p-6 text-[30px] leading-[34.3px] tracking-[0.6px] gap-[21.4px]',
  '3xl': 'p-7 text-[34.3px] leading-[42.9px] tracking-[0.69px] gap-[21.4px]',
};

// Ghost/white variants have custom sizing with different padding
const ghostWhiteSizes: Record<ButtonSize, string> = {
  sm: 'px-4 pt-3.5 pb-2.5 text-sm font-medium tracking-[0.28px] gap-2.5',
  md: 'px-4 pt-4 pb-3.5 text-sm font-medium tracking-[0.28px] gap-2.5',
  lg: 'px-5 pt-[19px] pb-[17px] text-base font-semibold tracking-[0.32px] gap-2.5',
  xl: 'px-[22.7px] pt-[21.6px] pb-[19.3px] text-lg font-semibold tracking-[0.36px] gap-[11.4px]',
  '2xl': 'px-[34.3px] pt-[30px] pb-[21.4px] text-[30px] font-medium tracking-[0.6px] gap-[21.4px]',
  '3xl': 'px-[42.9px] pt-[40.7px] pb-[36.4px] text-[34.3px] font-semibold tracking-[0.69px] gap-[21.4px]',
};

// Color values - Surfpool blue theme
// Primary: dark blue bg with bright cyan text
// Secondary: transparent with grey border and grey text

const variants: Record<ButtonVariant, string> = {
  primary: [
    'bg-[#0a2233] text-[#00D4FF]',
    'border border-[#0a2f3d]',
    'data-hover:bg-[#0d2d42]',
    'data-active:bg-[#103850]',
  ].join(' '),
  secondary: [
    'bg-transparent text-[#9FA3A4]',
    'border border-[#2D3335]',
    'data-hover:bg-[#1A2225]',
    'data-active:bg-[#232a2d]',
  ].join(' '),
  ghost: [
    'bg-[#ffffff] text-[#000000]',
    'border border-[#000000]',
    'data-hover:border-[#00D4FF]',
    'data-active:bg-[#F0FAFF]',
  ].join(' '),
  white: [
    'bg-[#F0FAFF] text-[#000000]',
    'border-none',
    'data-hover:bg-[#E5F5FF]',
    'data-active:bg-[#D9F0FF]',
  ].join(' '),
  yellow: [
    'bg-[#2B2011] text-[#FFB615]',
    'border border-[#3D2E1A]',
    'data-hover:bg-[#362816]',
    'data-active:bg-[#40301A]',
  ].join(' '),
};

const baseStyles = [
  'relative isolate inline-flex items-center justify-center',
  'font-mono font-normal uppercase',
  'rounded',
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00D4FF] focus-visible:ring-offset-2',
  'disabled:opacity-50 disabled:pointer-events-none',
  'data-disabled:opacity-50 data-disabled:pointer-events-none',
  'cursor-pointer',
  'transition-colors duration-150',
  '*:data-[slot=icon]:size-4 *:data-[slot=icon]:shrink-0',
].join(' ');

type BaseButtonProps = {
  size?: ButtonSize;
  variant?: ButtonVariant;
  className?: string;
  children: React.ReactNode;
};

type ButtonAsButtonProps = BaseButtonProps &
  Omit<Headless.ButtonProps, 'as' | 'className' | 'children'> & {
    href?: never;
  };

type ButtonAsLinkProps = BaseButtonProps &
  Omit<LinkProps, 'className' | 'children'> & {
    href: string;
  };

export type ButtonProps = ButtonAsButtonProps | ButtonAsLinkProps;

export const Button = forwardRef(function Button(
  { size = 'md', variant = 'primary', className, children, ...props }: ButtonProps,
  ref: React.ForwardedRef<HTMLElement>
) {
  // Ghost and white variants use custom sizing
  const sizeStyles = variant === 'ghost' || variant === 'white'
    ? ghostWhiteSizes[size]
    : sizes[size];
  const classes = clsx(baseStyles, sizeStyles, variants[variant], className);

  if ('href' in props && props.href !== undefined) {
    const { href, ...linkProps } = props;
    return (
      <Link
        href={href}
        {...linkProps}
        className={classes}
        ref={ref as React.ForwardedRef<HTMLAnchorElement>}
      >
        <TouchTarget>{children}</TouchTarget>
      </Link>
    );
  }

  const { href: _, ...buttonProps } = props as ButtonAsButtonProps;
  return (
    <Headless.Button
      {...buttonProps}
      className={classes}
      ref={ref as React.ForwardedRef<HTMLButtonElement>}
    >
      <TouchTarget>{children}</TouchTarget>
    </Headless.Button>
  );
});

/**
 * Expand the hit area to at least 44×44px on touch devices
 */
export function TouchTarget({ children }: { children: React.ReactNode }) {
  return (
    <>
      <span
        className="absolute top-1/2 left-1/2 size-[max(100%,2.75rem)] -translate-x-1/2 -translate-y-1/2 pointer-fine:hidden"
        aria-hidden="true"
      />
      {children}
    </>
  );
}
