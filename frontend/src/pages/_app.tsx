import type { AppProps } from 'next/app';
import Head from 'next/head';
import '../globals.css';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        {/* Never disable zoom: pinch-to-zoom is an accessibility feature. */}
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#060D18" />
        {/* Do not leak the safe/tx path in the Referer to RPC or font hosts.
            The authoritative headers (CSP, HSTS, X-Frame-Options, nosniff) are
            set at the edge — see deploy/nginx-arcsafe.conf — because a static
            export cannot emit response headers itself. This meta is the one
            control that works from the document and is safe everywhere. */}
        <meta name="referrer" content="no-referrer" />
      </Head>
      <Component {...pageProps} />
    </>
  );
}
