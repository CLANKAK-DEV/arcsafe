/**
 * ArcSafe design tokens.
 *
 * Derived from the Arc mark: a silver-to-white arch on a deep navy radial
 * field. Everything here is a semantic token — components reference
 * `bg-surface` / `text-secondary`, never a raw hex.
 *
 * Contrast (WCAG AA needs 4.5:1 body, 3:1 large text and UI):
 *   primary   #E9F0F8 on #060D18 -> 16.8:1
 *   secondary #9BB0C7 on #060D18 ->  7.9:1
 *   muted     #7C90A8 on #0B1524 ->  5.3:1
 *   accent    #6BA5DC on #0B1524 ->  6.6:1
 *
 * @type {import('tailwindcss').Config}
 */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Surfaces — the deep navy field of the mark, dark to light.
        base: '#060D18',
        surface: '#0C1626',
        'surface-2': '#131F32',
        'surface-3': '#1B2A40',
        hairline: '#243449',
        'hairline-strong': '#33475F',

        // Type — cool silver drawn from the arch, not warm cream.
        primary: '#E9F0F8',
        secondary: '#9BB0C7',
        muted: '#7C90A8',

        // Brand — the arch gradient itself (#FFFFFF → #DCE7F2 → #8FA5BD).
        silver: {
          DEFAULT: '#DCE7F2',
          light: '#FFFFFF',
          dark: '#8FA5BD',
        },
        // Accent — steel blue lifted from the field, not teal.
        accent: {
          DEFAULT: '#6BA5DC',
          strong: '#4A87C4',
          dim: '#12314F',
        },

        // Semantic state — tuned to sit on navy.
        ok: '#4FD1A0',
        warn: '#F0B84B',
        danger: '#F0717A',
      },
      fontFamily: {
        sans: ['Aptos', 'Segoe UI Variable', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['Cascadia Code', 'SFMono-Regular', 'ui-monospace', 'Menlo', 'Consolas', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
      },
      borderRadius: {
        card: '12px',
      },
      boxShadow: {
        card: '0 1px 0 0 rgba(255,255,255,0.04) inset, 0 10px 24px -18px rgba(0,0,0,0.85)',
        lift: '0 1px 0 0 rgba(255,255,255,0.06) inset, 0 22px 56px -28px rgba(0,0,0,0.9)',
        glow: '0 0 0 1px rgba(107,165,220,0.35), 0 0 30px -12px rgba(107,165,220,0.45)',
      },
      transitionDuration: {
        DEFAULT: '180ms',
      },
      keyframes: {
        'fade-up': {
          from: { opacity: '0', transform: 'translate3d(0, 12px, 0)' },
          to: { opacity: '1', transform: 'none' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        // A quorum segment landing. Overshoots slightly, like a switch clicking
        // into place — the motion says "this was counted".
        'segment-in': {
          '0%': { transform: 'scaleX(0)', opacity: '0.4' },
          '100%': { transform: 'scaleX(1)', opacity: '1' },
        },
        // Reached quorum: a single confirming pulse, not a loop.
        'quorum-met': {
          '0%': { boxShadow: '0 0 0 0 rgba(79,209,160,0.5)' },
          '100%': { boxShadow: '0 0 0 10px rgba(79,209,160,0)' },
        },
        'row-in': {
          from: { opacity: '0', transform: 'translate3d(0, 8px, 0)' },
          to: { opacity: '1', transform: 'none' },
        },
      },
      animation: {
        'fade-up': 'fade-up 420ms cubic-bezier(0.22, 1, 0.36, 1) both',
        shimmer: 'shimmer 1.6s infinite',
        // 260ms, ease-out-expo. Was an overshoot curve (0.34, 1.56, …); bounce
        // on a signature counter reads as playful, which is the wrong register
        // for authorising a transfer. Exponential decay settles decisively.
        'segment-in': 'segment-in 260ms cubic-bezier(0.16, 1, 0.3, 1) both',
        'quorum-met': 'quorum-met 620ms ease-out 1',
        'row-in': 'row-in 300ms cubic-bezier(0.22, 1, 0.36, 1) both',
      },
    },
  },
  plugins: [],
};
