import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { classNames } from '~/utils/classNames';

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-bolt-elements-borderColor disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-[var(--bolt-elements-button-primary-background)] text-[var(--bolt-elements-button-primary-text)] hover:bg-[var(--bolt-elements-button-primary-backgroundHover)]',
        destructive:
          'bg-[var(--m3-sys-color-error)] text-[var(--m3-sys-color-on-error)] hover:bg-[var(--m3-sys-color-error-container)] hover:text-[var(--m3-sys-color-on-error-container)]',
        outline:
          'border border-[var(--bolt-elements-borderColor)] bg-transparent hover:bg-[var(--bolt-elements-background-depth-2)] hover:text-[var(--bolt-elements-textPrimary)] text-[var(--bolt-elements-textPrimary)]',
        // Note: The dark:border-bolt-elements-borderColorActive was removed.
        // --bolt-elements-borderColor is now var(--m3-sys-color-outline-variant)
        // --bolt-elements-borderColorActive is var(--m3-sys-color-primary)
        // M3 outlines should provide correct contrast on light/dark. If specific primary border on dark is needed, it would be:
        // 'border border-[var(--m3-sys-color-outline-variant)] dark:border-[var(--m3-sys-color-primary)] ...'
        // For now, relying on the single M3 outline variable.
        secondary:
          'bg-[var(--bolt-elements-button-secondary-background)] text-[var(--bolt-elements-button-secondary-text)] hover:bg-[var(--bolt-elements-button-secondary-backgroundHover)]',
        ghost: 'hover:bg-[var(--bolt-elements-background-depth-1)] hover:text-[var(--bolt-elements-textPrimary)] text-[var(--bolt-elements-textPrimary)]',
        link: 'text-[var(--bolt-elements-textPrimary)] underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 rounded-md px-3 text-xs',
        lg: 'h-10 rounded-md px-8',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  _asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, _asChild = false, ...props }, ref) => {
    return <button className={classNames(buttonVariants({ variant, size }), className)} ref={ref} {...props} />;
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
