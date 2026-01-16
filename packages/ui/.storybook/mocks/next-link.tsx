import React, { forwardRef } from 'react';

export type LinkProps = {
  href: string;
  as?: string;
  replace?: boolean;
  scroll?: boolean;
  shallow?: boolean;
  passHref?: boolean;
  prefetch?: boolean;
  locale?: string | false;
  legacyBehavior?: boolean;
};

const Link = forwardRef<HTMLAnchorElement, LinkProps & React.AnchorHTMLAttributes<HTMLAnchorElement>>(
  function Link({ href, children, ...props }, ref) {
    return (
      <a ref={ref} href={typeof href === 'string' ? href : '#'} {...props}>
        {children}
      </a>
    );
  }
);

export default Link;
