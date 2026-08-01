/**
 * NoxSafe's own mark. It deliberately does not reuse, redraw, or modify the
 * Arc logo: NoxSafe is the product and Arc Network is its infrastructure.
 */

import { useId } from 'react';

export function NoxMark({ size = 32 }: { size?: number }) {
  const gradientId = `nox-${useId()}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role="img"
      aria-label="NoxSafe"
      className="shrink-0"
    >
      <defs>
        <linearGradient id={gradientId} x1="18%" y1="12%" x2="82%" y2="88%">
          <stop offset="0%" stopColor="#8BC5F2" />
          <stop offset="100%" stopColor="#4A87C4" />
        </linearGradient>
      </defs>
      <rect width="100" height="100" rx="24" fill="#0B1524" />
      <path
        d="M50 14 80 26v22c0 19-11.8 33.8-30 39-18.2-5.2-30-20-30-39V26z"
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth="7"
        strokeLinejoin="round"
      />
      <path
        d="M34 65V36l32 29V36"
        fill="none"
        stroke="#E9F0F8"
        strokeWidth="8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function NoxSafeLogo({ size = 32 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <NoxMark size={size} />
      <span className="text-[1.0625rem] font-semibold tracking-tight text-primary">
        Nox<span className="text-secondary">Safe</span>
      </span>
    </span>
  );
}
