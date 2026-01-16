import type { FC, SVGProps } from 'react';

import IconSvg from './logo/surfpool-square.svg';
import TypoDarkSvg from './logo/surfpool-dark-typo.svg';
import TypoLightSvg from './logo/surfpool-light-typo.svg';

type LogoProps = SVGProps<SVGSVGElement> & {
  /** Use 'dark' for dark backgrounds (white text), 'light' for light backgrounds (dark text) */
  variant?: 'dark' | 'light';
};

// Square icon logo (for favicons, small spaces) - always uses the same icon
export const SurfpoolIcon: FC<SVGProps<SVGSVGElement>> = IconSvg;

// Typography only with variant support
export const SurfpoolTypo: FC<LogoProps> = ({ variant = 'dark', ...props }) => {
  const Component = variant === 'light' ? TypoLightSvg : TypoDarkSvg;
  return <Component {...props} />;
};

// Aliases for backwards compatibility
export const SurfpoolSquareLogo = SurfpoolIcon;
