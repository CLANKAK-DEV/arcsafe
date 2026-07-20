/**
 * The Arc mark: a silver arch on a deep navy field.
 *
 * Drawn as vector so it stays crisp at every size and can be recoloured by
 * theme — a raster export of the source PNG could do neither. Gradient IDs are
 * suffixed per instance because two inline SVGs sharing an id on one page will
 * both resolve to whichever was parsed first.
 */

import { useId } from 'react';

function useGradientIds() {
  // useId is stable across server render and hydration; a module-level counter
  // is not, and StrictMode's double render would desync it.
  const base = useId();
  return { arch: `arch-${base}`, field: `field-${base}` };
}

export function ArcMark({ size = 32, withField = true }: { size?: number; withField?: boolean }) {
  const id = useGradientIds();

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role="img"
      aria-label="Arc"
      className="shrink-0"
    >
      <defs>
        <linearGradient id={id.arch} x1="20%" y1="0%" x2="80%" y2="100%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="45%" stopColor="#DCE7F2" />
          <stop offset="100%" stopColor="#8FA5BD" />
        </linearGradient>
        <radialGradient id={id.field} cx="50%" cy="18%" r="92%">
          <stop offset="0%" stopColor="#1B3E63" />
          <stop offset="100%" stopColor="#071626" />
        </radialGradient>
      </defs>

      {withField && <rect width="100" height="100" rx="22" fill={`url(#${id.field})`} />}

      {/* The arch: two legs rising into a single sweep, with the right leg
          cut back at an angle the way the Arc mark resolves it. */}
      <path
        d="M13 88 C13 38 29 10 50 10 C71 10 87 38 87 88 L66 88 C66 47 59 27 50 27 C41 27 34 47 34 88 Z"
        fill={`url(#${id.arch})`}
      />
      <path d="M66 70 L87 70 L87 88 L62 88 Z" fill={`url(#${id.arch})`} />
    </svg>
  );
}

export function ArcSafeLogo({ size = 32 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <ArcMark size={size} />
      <span className="text-[1.0625rem] font-semibold tracking-tight text-primary">
        Arc<span className="text-secondary">Safe</span>
      </span>
    </span>
  );
}
