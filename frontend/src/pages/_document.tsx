import { Head, Html, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <link rel="icon" href={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}/favicon.svg`} type="image/svg+xml" />
      </Head>
      <body>
        {/* Keyboard users land here first and can jump the navigation. */}
        <a
          href="#main"
          className="skip-link"
        >
          Skip to content
        </a>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
