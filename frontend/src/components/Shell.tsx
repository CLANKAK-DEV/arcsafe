import Link from 'next/link';
import { useRouter } from 'next/router';
import type { ReactNode } from 'react';
import { NoxSafeLogo } from './Logo';

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
    <header className="sticky top-0 z-40 border-b border-hairline bg-base">
      <div className="mx-auto flex h-[4.5rem] max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="rounded-lg" aria-label="NoxSafe home">
          <NoxSafeLogo size={30} />
        </Link>

        <div className="flex items-center gap-2">
          {!onApp && (
            <details className="group relative max-[350px]:hidden">
              <summary className="flex min-h-11 cursor-pointer list-none items-center rounded-lg border border-hairline px-3 text-sm font-medium text-secondary marker:content-none hover:bg-surface">
                Explore
              </summary>
              <nav aria-label="Explore NoxSafe" className="absolute right-0 top-12 z-50 w-52 overflow-hidden rounded-card border border-hairline bg-surface p-2 shadow-lift">
                {NAV.map((item) => (
                  <Link key={item.href} href={item.href} className="block min-h-11 whitespace-nowrap rounded-lg px-3 py-3 text-sm text-secondary hover:bg-surface-2 hover:text-primary">
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
    <footer className="mt-24 border-t border-hairline">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <p className="max-w-2xl font-display text-3xl font-bold tracking-tight text-primary sm:text-5xl">
          Every transfer waits for the quorum.
        </p>
        <div className="mt-10 flex flex-col gap-4 border-t border-hairline pt-5 sm:flex-row sm:items-center sm:justify-between">
          <NoxSafeLogo size={26} />
          <div className="text-xs text-muted sm:text-right">
            <p>Testnet software. Not audited. Do not custody assets of real value.</p>
            <p className="mt-1">© {new Date().getFullYear()} SoftNox / NoxSafe / MIT</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
