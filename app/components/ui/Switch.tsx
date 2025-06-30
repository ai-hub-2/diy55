import { memo } from 'react';
import * as SwitchPrimitive from '@radix-ui/react-switch';
import { classNames } from '~/utils/classNames';

interface SwitchProps {
  className?: string;
  checked?: boolean;
  onCheckedChange?: (event: boolean) => void;
}

export const Switch = memo(({ className, onCheckedChange, checked }: SwitchProps) => {
  return (
    <SwitchPrimitive.Root
      className={classNames(
        // Original: h-6 (24px) w-11 (44px). Scaled: h-[1.5rem] (18px) w-[2.75rem] (33px)
        'relative h-[1.5rem] w-[2.75rem] cursor-pointer rounded-full bg-bolt-elements-button-primary-background',
        'transition-colors duration-200 ease-in-out',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'data-[state=checked]:bg-bolt-elements-item-contentAccent',
        className,
      )}
      checked={checked}
      onCheckedChange={(e) => onCheckedChange?.(e)}
    >
      <SwitchPrimitive.Thumb
        className={classNames(
          // Original: h-5 w-5 (20px). Scaled: h-[1.25rem] w-[1.25rem] (15px)
          'block h-[1.25rem] w-[1.25rem] rounded-full bg-white',
          'shadow-lg shadow-black/20',
          'transition-transform duration-200 ease-in-out',
          // Original: translate-x-0.5 (2px). Scaled: translate-x-[0.167rem] (approx 2px at 12px root)
          'translate-x-[0.167rem]',
          // data-[state=checked]:translate-x-[1.375rem] is already rem and will scale correctly (22px -> 16.5px)
          'data-[state=checked]:translate-x-[1.375rem]',
          'will-change-transform',
        )}
      />
    </SwitchPrimitive.Root>
  );
});
