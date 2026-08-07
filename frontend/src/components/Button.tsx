import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link } from 'react-router-dom';

const base =
  'inline-flex select-none items-center justify-center gap-1.5 font-mono text-sm tracking-[0.04em] transition-colors';

const variants = {
  primary: 'bg-ink text-paper hover:bg-black disabled:cursor-not-allowed disabled:opacity-40',
  outline:
    'border border-hairline-strong text-ink-soft hover:border-ink/40 hover:text-ink disabled:cursor-not-allowed disabled:opacity-40',
  ghost: 'text-faint hover:text-ink disabled:cursor-not-allowed disabled:opacity-40',
};

const sizes = {
  sm: 'h-8 px-3',
  md: 'h-9 px-4',
};

type Variant = keyof typeof variants;
type Size = keyof typeof sizes;

export function buttonStyles(variant: Variant = 'primary', size: Size = 'md') {
  return `${base} ${variants[variant]} ${sizes[size]}`;
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
};

export function Button({ variant = 'primary', size = 'md', className, ...props }: ButtonProps) {
  return <button className={`${buttonStyles(variant, size)} ${className ?? ''}`} {...props} />;
}

type ButtonLinkProps = {
  to: string;
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
};

export function ButtonLink({ to, variant = 'primary', size = 'md', className, children }: ButtonLinkProps) {
  return (
    <Link to={to} className={`${buttonStyles(variant, size)} ${className ?? ''}`}>
      {children}
    </Link>
  );
}
