import { Head, Html, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="icon" href={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}/favicon.svg`} type="image/svg+xml" />
      </Head>
      <body>
        {/* Keyboard users land here first and can jump the navigation. */}
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50
            focus:rounded-lg focus:bg-surface-3 focus:px-4 focus:py-2 focus:text-sm focus:text-primary"
        >
          Skip to content
        </a>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
