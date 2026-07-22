import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';
import { useId, useState } from 'react';
import { CheckIcon, CopyIcon, ExternalIcon, SpinnerIcon } from './Icons';

/* ── Button ─────────────────────────────────────────────────────────
   Touch targets are >=44px tall at default size. `loading` disables the
   button as well as showing a spinner, so a slow chain cannot be
   double-submitted by an impatient second click. */

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
  loading?: boolean;
  icon?: ReactNode;
};

const BUTTON_VARIANTS: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary:
    'bg-gradient-to-b from-accent to-accent-strong text-base hover:from-accent hover:to-accent shadow-card',
  secondary: 'bg-surface-2 text-primary border border-hairline-strong hover:bg-surface-3',
  ghost: 'text-secondary hover:text-primary hover:bg-surface-2',
  danger: 'bg-danger/12 text-danger border border-danger/35 hover:bg-danger/20',
};

const BUTTON_BASE =
  'inline-flex select-none items-center justify-center whitespace-nowrap rounded-lg font-semibold transition duration-200 active:scale-[0.98]';

function sizeClasses(size: NonNullable<ButtonProps['size']>) {
  return size === 'sm' ? 'min-h-11 px-3.5 text-sm gap-1.5' : 'min-h-11 px-5 text-sm gap-2';
}

export function Button({
  variant = 'secondary',
  size = 'md',
  loading = false,
  icon,
  disabled,
  children,
  className = '',
  ...rest
}: ButtonProps) {
  const sizing = sizeClasses(size);

  return (
    <button
      // aria-busy tells assistive tech the control is working, not broken.
      aria-busy={loading || undefined}
      disabled={disabled || loading}
      className={`${BUTTON_BASE} disabled:pointer-events-none disabled:opacity-45
        ${sizing} ${BUTTON_VARIANTS[variant]} ${className}`}
      {...rest}
    >
      {loading ? <SpinnerIcon size={16} /> : icon}
      {children}
    </button>
  );
}

/**
 * Button styling for elements that are semantically links.
 *
 * Navigation must be an <a>, never a <button> wrapped in one: interactive
 * content inside an anchor is invalid HTML and browsers do not render it
 * reliably. It also breaks the contract users rely on — a link should announce
 * as a link, and open in a new tab on middle click.
 *
 * Apply to next/link (which renders its own <a> in v13+) so client-side
 * routing and basePath still work:
 *   <Link href="/app/" className={linkButtonClass('primary')}>Open app</Link>
 */
export function linkButtonClass(
  variant: NonNullable<ButtonProps['variant']> = 'secondary',
  size: NonNullable<ButtonProps['size']> = 'md',
) {
  return `${BUTTON_BASE} ${sizeClasses(size)} ${BUTTON_VARIANTS[variant]}`;
}

/* ── Card ───────────────────────────────────────────────────────── */

export function Card({
  title,
  action,
  children,
  className = '',
}: {
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`card p-5 sm:p-6 ${className}`}>
      {(title || action) && (
        <header className="mb-4 flex items-center justify-between gap-3">
          {typeof title === 'string' ? (
            <h2 className="text-[0.9375rem] font-semibold text-primary">{title}</h2>
          ) : (
            title
          )}
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

/* ── Badge ──────────────────────────────────────────────────────── */

type Tone = 'neutral' | 'ok' | 'warn' | 'danger' | 'accent';

const TONES: Record<Tone, string> = {
  neutral: 'bg-surface-3 text-secondary border-hairline-strong',
  ok: 'bg-ok/12 text-ok border-ok/30',
  warn: 'bg-warn/12 text-warn border-warn/30',
  danger: 'bg-danger/12 text-danger border-danger/30',
  accent: 'bg-accent/12 text-accent border-accent/30',
};

export function Badge({ tone = 'neutral', icon, children }: { tone?: Tone; icon?: ReactNode; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${TONES[tone]}`}
    >
      {icon}
      {children}
    </span>
  );
}

/* ── Address ────────────────────────────────────────────────────────
   Colour alone never carries meaning here: the copy control changes its
   icon and its accessible label, not just its tint. */

export function AddressChip({
  address,
  short,
  explorerHref,
  label,
}: {
  address: string;
  short: string;
  explorerHref?: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked (insecure origin) — the full address is in the title */
    }
  }

  return (
    <span className="inline-flex items-center gap-1">
      <code className="text-sm text-secondary" title={address}>
        {short}
      </code>
      <button
        type="button"
        onClick={copy}
        aria-label={copied ? `${label ?? 'Address'} copied` : `Copy ${label ?? 'address'} ${address}`}
        className="grid h-11 w-11 place-items-center rounded-lg text-muted transition hover:bg-surface-2 hover:text-primary active:scale-95"
      >
        {copied ? <CheckIcon size={15} className="text-ok" /> : <CopyIcon size={15} />}
      </button>
      {explorerHref && (
        <a
          href={explorerHref}
          target="_blank"
          rel="noreferrer noopener"
          aria-label={`View ${label ?? 'address'} on the block explorer`}
          className="grid h-11 w-11 place-items-center rounded-lg text-muted transition hover:bg-surface-2 hover:text-primary active:scale-95"
        >
          <ExternalIcon size={15} />
        </a>
      )}
    </span>
  );
}

/* ── Field ──────────────────────────────────────────────────────────
   Every input gets a real <label>. Placeholder-only labelling disappears
   the moment someone types, and is not reliably announced. */

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
  error?: string;
  mono?: boolean;
};

export function Field({ label, hint, error, mono, className = '', ...rest }: FieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errId = `${id}-err`;

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-xs font-medium text-secondary">
        {label}
        {rest.required && (
          <span className="ml-1 text-danger" aria-hidden="true">
            *
          </span>
        )}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errId : hint ? hintId : undefined}
        className={`h-11 w-full rounded-lg border bg-surface-2 px-3 text-sm text-primary
          placeholder:text-muted/70 transition
          ${error ? 'border-danger/60' : 'border-hairline focus:border-accent/60'}
          ${mono ? 'font-mono' : ''} ${className}`}
        {...rest}
      />
      {error ? (
        // role=alert so the message is announced when it appears.
        <p id={errId} role="alert" className="flex items-start gap-1 text-xs text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-xs text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/* ── Stat ───────────────────────────────────────────────────────── */

export function Stat({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: Tone }) {
  const colour = tone === 'ok' ? 'text-ok' : tone === 'warn' ? 'text-warn' : 'text-primary';
  return (
    <div className="rounded-lg border border-hairline bg-surface-2/60 p-4">
      <div className="text-2xs uppercase tracking-wider text-muted">{label}</div>
      <div className={`mt-1.5 text-2xl font-semibold tabular ${colour}`}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted">{sub}</div>}
    </div>
  );
}

/* ── Empty & error states ───────────────────────────────────────── */

export function EmptyState({ icon, title, body, action }: { icon?: ReactNode; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-hairline px-6 py-12 text-center">
      {icon && <div className="text-muted">{icon}</div>}
      <div>
        <p className="text-sm font-medium text-primary">{title}</p>
        {body && <p className="mx-auto mt-1 max-w-sm text-sm text-muted">{body}</p>}
      </div>
      {action}
    </div>
  );
}

export function Callout({ tone = 'warn', title, children }: { tone?: Tone; title: string; children?: ReactNode }) {
  const ring =
    tone === 'danger' ? 'border-danger/35 bg-danger/8' : tone === 'ok' ? 'border-ok/35 bg-ok/8' : 'border-warn/35 bg-warn/8';
  const text = tone === 'danger' ? 'text-danger' : tone === 'ok' ? 'text-ok' : 'text-warn';

  return (
    <div className={`rounded-lg border p-4 ${ring}`}>
      <p className={`text-sm font-semibold ${text}`}>{title}</p>
      {children && <div className="mt-1.5 text-sm leading-relaxed text-secondary">{children}</div>}
    </div>
  );
}
