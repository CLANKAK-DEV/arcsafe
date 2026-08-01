import {
  ArrowRight,
  ArrowSquareOut,
  Check,
  CircleNotch,
  Clock,
  Copy,
  FileLock,
  Key,
  LockKey,
  PaperPlaneTilt,
  Shield,
  ShieldCheck,
  Stack,
  UsersThree,
  Wallet,
  Warning,
  X,
  type IconProps as PhosphorIconProps,
} from '@phosphor-icons/react';
import type { ComponentType } from 'react';

type IconProps = Omit<PhosphorIconProps, 'ref'> & { size?: number };

function systemIcon(Icon: ComponentType<PhosphorIconProps>) {
  return function SystemIcon({ size = 20, weight = 'regular', ...props }: IconProps) {
    return <Icon size={size} weight={weight} aria-hidden="true" focusable="false" {...props} />;
  };
}

export const ShieldIcon = systemIcon(Shield);
export const ShieldCheckIcon = systemIcon(ShieldCheck);
export const UsersIcon = systemIcon(UsersThree);
export const CheckIcon = systemIcon(Check);
export const XIcon = systemIcon(X);
export const ClockIcon = systemIcon(Clock);
export const ArrowRightIcon = systemIcon(ArrowRight);
export const WalletIcon = systemIcon(Wallet);
export const CopyIcon = systemIcon(Copy);
export const ExternalIcon = systemIcon(ArrowSquareOut);
export const AlertIcon = systemIcon(Warning);
export const SendIcon = systemIcon(PaperPlaneTilt);
export const LayersIcon = systemIcon(Stack);
export const KeyIcon = systemIcon(Key);
export const LockIcon = systemIcon(LockKey);
export const FileCheckIcon = systemIcon(FileLock);

export function SpinnerIcon({ size = 20, className = '', ...props }: IconProps) {
  return (
    <CircleNotch
      size={size}
      weight="bold"
      className={`animate-spin ${className}`}
      aria-hidden="true"
      focusable="false"
      {...props}
    />
  );
}
