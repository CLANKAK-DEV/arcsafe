/**
 * Static export — the built site is plain HTML/JS in `out/`, served by nginx
 * on the VPS at http://<host>/arcsafe/.
 *
 * Because it is served from a sub-path rather than the domain root, basePath
 * must match that sub-path or every asset URL 404s. Override with
 * BASE_PATH='' when serving from the root.
 *
 * Hosting targets differ:
 *   - VPS/nginx serves under /arcsafe/ (set locally via frontend/.env.local).
 *   - Vercel serves at the domain root. Vercel sets VERCEL=1 during the build
 *     and does not carry the gitignored .env.local, so root is the default
 *     there with no env var to remember.
 * An explicit BASE_PATH always wins over both.
 *
 * @type {import('next').NextConfig}
 */
const basePath = process.env.BASE_PATH ?? (process.env.VERCEL ? '' : '/arcsafe');

const nextConfig = {
  reactStrictMode: true,
  output: 'export',
  poweredByHeader: false,
  trailingSlash: true,
  basePath,
  assetPrefix: basePath || undefined,
  images: { unoptimized: true },
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
};

module.exports = nextConfig;
