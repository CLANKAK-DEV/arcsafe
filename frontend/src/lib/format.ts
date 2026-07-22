import { formatEther, getAddress, isAddress } from 'ethers';

/** 0x1234…9C00 — enough leading and trailing characters to be verifiable by eye. */
export function shortAddress(addr: string, lead = 6, tail = 4): string {
  if (!addr) return '';
  const a = isAddress(addr) ? getAddress(addr) : addr;
  if (a.length <= lead + tail + 2) return a;
  return `${a.slice(0, 2 + lead)}…${a.slice(-tail)}`;
}

/**
 * Format a native Arc balance.
 *
 * Arc's gas token is USDC. The native balance is 18 decimals (the same balance
 * is separately exposed through a 6-decimal ERC-20 interface, which we do not
 * touch), so formatEther is the right conversion.
 *
 * Trims trailing zeros but never uses exponent notation, and never rounds a
 * non-zero balance down to "0" — a wallet that displays 0 for 0.0000004 USDC
 * has lied to the user.
 */
export function formatUsdc(wei: bigint, maxDecimals = 4): string {
  const full = formatEther(wei);
  const [whole, frac = ''] = full.split('.');
  if (!frac) return whole;

  const trimmed = frac.slice(0, maxDecimals).replace(/0+$/, '');
  if (trimmed) return `${whole}.${trimmed}`;
  if (wei === 0n) return '0';
  // Non-zero but smaller than the display precision.
  return whole === '0' ? `<0.${'0'.repeat(maxDecimals - 1)}1` : whole;
}

export function formatRelativeTime(unixSeconds: number, now = Date.now()): string {
  const deltaSec = Math.round(unixSeconds - now / 1000);

  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['second', 60],
    ['minute', 60],
    ['hour', 24],
    ['day', 7],
    ['week', 4.348],
    ['month', 12],
    ['year', Infinity],
  ];

  let value = deltaSec;
  for (const [unit, step] of units) {
    if (Math.abs(value) < step) {
      return new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' }).format(Math.round(value), unit);
    }
    value /= step;
  }
  return new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' }).format(Math.round(value), 'year');
}

/**
 * Turns an ethers/MetaMask error into something a person can act on.
 * Custom errors from ArcSafe arrive as `error.revert.name`.
 */
export function humanizeError(err: unknown): string {
  const e = err as {
    code?: string | number;
    reason?: string;
    shortMessage?: string;
    message?: string;
    revert?: { name?: string };
    info?: { error?: { message?: string } };
  };

  if (e?.code === 'ACTION_REJECTED' || e?.code === 4001) return 'You rejected the request in your wallet.';

  const named = e?.revert?.name;
  if (named) {
    const map: Record<string, string> = {
      NotOwner: 'That account is not an owner of this safe.',
      OnlySafe: 'This action can only be taken by the safe itself. It must be approved as a transaction.',
      BelowThreshold: 'Not enough approvals yet.',
      AlreadyApproved: 'You have already approved this transaction.',
      NotApproved: 'You have not approved this transaction.',
      TxAlreadyExecuted: 'This transaction has already been executed.',
      TxCancelled: 'This transaction was cancelled.',
      TxExpired: 'This transaction has expired.',
      TxStale: 'The owners or threshold changed after this was proposed, so it can no longer execute. Propose it again.',
      TxNotFound: 'No such transaction.',
      InvalidThreshold: 'That threshold is out of range.',
      DuplicateOwner: 'That address is already an owner.',
      InvalidOwner: 'That address cannot be an owner.',
      SafeAlreadyExists:
        'A safe with these exact owners and threshold already exists at this address. Change the owners or threshold, or try again to get a fresh address.',
      NoOwners: 'A safe needs at least one owner.',
      ZeroTarget: 'Enter a destination address.',
      // On Arc a plain value transfer can revert even when the balance covers
      // it: USDC is the native token, and transfers to the zero address, burn
      // addresses, or Circle-blocklisted addresses are rejected by the chain.
      ExecutionFailed:
        'The safe made the call, but it reverted. If this was a plain transfer, check that the destination is not blocklisted. On Arc, a USDC transfer can revert even with sufficient balance.',
      Reentrancy: 'Reentrant call blocked.',
    };
    return map[named] ?? `Rejected by the contract: ${named}`;
  }

  if (e?.code === 'INSUFFICIENT_FUNDS') return 'Not enough USDC to cover gas.';
  return e?.shortMessage || e?.reason || e?.info?.error?.message || e?.message || 'Something went wrong.';
}
