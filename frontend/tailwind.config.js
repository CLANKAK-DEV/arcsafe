/**
 * NoxSafe design tokens.
 *
 * NoxSafe's independent palette: cool silver and steel blue on a deep navy
 * radial field. Everything here is a semantic token — components reference
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
        base: 'var(--color-paper)',
        surface: 'var(--color-paper-2)',
        'surface-2': 'var(--color-paper-3)',
        'surface-3': 'var(--color-rule)',
        hairline: 'var(--color-rule)',
        'hairline-strong': 'var(--color-rule-strong)',

        // Type — cool silver drawn from the arch, not warm cream.
        primary: 'var(--color-ink)',
        secondary: 'var(--color-ink-2)',
        muted: 'var(--color-muted)',

        // Brand — the arch gradient itself (#FFFFFF → #DCE7F2 → #8FA5BD).
        silver: {
          DEFAULT: 'var(--color-ink-2)',
          light: 'var(--color-ink)',
          dark: 'var(--color-muted)',
        },
        // Accent — steel blue lifted from the field, not teal.
        accent: {
          DEFAULT: 'var(--color-accent)',
          strong: 'var(--color-accent-strong)',
          dim: 'var(--color-paper-3)',
        },

        // Semantic state — tuned to sit on navy.
        ok: 'var(--color-ok)',
        warn: 'var(--color-warn)',
        danger: 'var(--color-danger)',
      },
      fontFamily: {
        sans: ['var(--font-body)'],
        display: ['var(--font-display)'],
        mono: ['var(--font-mono)'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
      },
      borderRadius: {
        card: 'var(--radius-card)',
      },
      maxWidth: {
        copy: 'var(--measure-copy)',
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        lift: 'var(--shadow-lift)',
        glow: 'var(--shadow-glow)',
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
          '0%': { boxShadow: 'var(--shadow-quorum-start)' },
          '100%': { boxShadow: 'var(--shadow-quorum-end)' },
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
