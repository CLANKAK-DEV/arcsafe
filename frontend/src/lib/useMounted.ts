import { useEffect, useState } from 'react';

/**
 * True only after the first client-side effect has run.
 *
 * The wallet pages render entirely from state that exists only in the browser:
 * whether an injected provider is present, which account is connected, which
 * chain it is on. `output: 'export'` prerenders these pages at build time in
 * Node, where none of that exists, so the server HTML and the first client
 * render can disagree — and a hydration mismatch makes React throw away the
 * tree, leaving markup on screen with no event handlers attached. The page
 * looks fine and does nothing.
 *
 * Gating on mount makes the first client render identical to the server one by
 * construction, so hydration always succeeds; the real UI renders immediately
 * afterwards.
 */
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}
