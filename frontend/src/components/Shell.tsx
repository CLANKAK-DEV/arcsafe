import Link from 'next/link';
import { useRouter } from 'next/router';
import type { ReactNode } from 'react';
import { ARC_TESTNET } from '../lib/config';
import { ArcSafeLogo } from './Logo';

const NAV = [
  { href: '/#how', label: 'How it works' },
  { href: '/#security', label: 'Security' },
  { href: '/#specs', label: 'Specs' },
  { href: '/#roadmap', label: 'Roadmap' },
];

export function SiteHeader({ right }: { right?: ReactNode }) {
  const { pathname } = useRouter();
  const onApp = pathname.startsWith('/app');

  return (
    <header className="sticky top-0 z-40 border-b border-hairline/70 bg-base/90 backdrop-blur-xl">
      <div className="mx-auto flex h-[4.5rem] max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="rounded-lg" aria-label="ArcSafe home">
          <ArcSafeLogo size={30} />
        </Link>

        {!onApp && (
          <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
            {/* next/link, not a bare <a>: these hrefs are root-relative and the
                site is served from /arcsafe/, so an unprefixed href would 404. */}
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-lg px-3 py-2 text-sm text-secondary transition hover:bg-surface-2 hover:text-primary"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        )}

        <div className="flex items-center gap-2">
          {!onApp && (
            <details className="group relative md:hidden">
              <summary className="flex min-h-11 cursor-pointer list-none items-center rounded-lg border border-hairline px-3 text-sm font-medium text-secondary marker:content-none">
                Menu
              </summary>
              <nav aria-label="Mobile" className="absolute right-0 top-12 w-52 overflow-hidden rounded-card border border-hairline bg-surface p-2 shadow-lift">
                {NAV.map((item) => (
                  <Link key={item.href} href={item.href} className="block rounded-lg px-3 py-3 text-sm text-secondary transition hover:bg-surface-2 hover:text-primary">
                    {item.label}
                  </Link>
                ))}
              </nav>
            </details>
          )}
          {right}
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-hairline/70">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-12 sm:px-6 md:flex-row md:items-start md:justify-between lg:px-8">
        <div className="max-w-sm space-y-3">
          <ArcSafeLogo size={28} />
          <p className="text-sm leading-relaxed text-muted">
            An N-of-M multi-signature wallet for Arc. Open source, unaudited, and running on testnet only.
          </p>
        </div>

        <dl className="grid grid-cols-2 gap-x-10 gap-y-2 text-sm sm:grid-cols-3">
          <dt className="text-muted">Network</dt>
          <dd className="col-span-1 text-secondary sm:col-span-2">{ARC_TESTNET.name}</dd>
          <dt className="text-muted">Chain ID</dt>
          <dd className="col-span-1 tabular text-secondary sm:col-span-2">{ARC_TESTNET.chainId}</dd>
          <dt className="text-muted">Gas token</dt>
          <dd className="col-span-1 text-secondary sm:col-span-2">{ARC_TESTNET.currency.symbol}</dd>
          <dt className="text-muted">Licence</dt>
          <dd className="col-span-1 text-secondary sm:col-span-2">MIT</dd>
        </dl>
      </div>

      <div className="border-t border-hairline/70">
        <div className="mx-auto flex max-w-7xl flex-col gap-1.5 px-4 py-5 text-xs text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>Testnet software. Not audited. Do not custody assets of real value.</p>
          <p>© {new Date().getFullYear()} SoftNox · ArcSafe</p>
        </div>
      </div>
    </footer>
  );
}
