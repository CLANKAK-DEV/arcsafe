import { BrowserProvider, Contract, JsonRpcProvider, isAddress } from 'ethers';
import { useCallback, useEffect, useState } from 'react';
import { ARCSAFE_ABI, ARC_TESTNET } from './config';
import { humanizeError } from './format';

export type BatchCall = { to: string; value: bigint; data: string };

export type SafeTx = {
  id: number;
  to: string;
  value: bigint;
  data: string;
  expiresAt: number;
  approvals: number;
  executed: boolean;
  cancelled: boolean;
  stale: boolean;
  proposer: string;
  youApproved: boolean;
  isBatch: boolean;
  callCount: number;
  calls: BatchCall[];
};

export type SafeState = {
  owners: string[];
  threshold: number;
  balance: bigint;
  txCount: number;
  transactions: SafeTx[];
  youAreOwner: boolean;
};

type Status =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ready'; data: SafeState }
  /** The address holds no bytecode — the exact failure the old build shipped. */
  | { kind: 'not-deployed' }
  | { kind: 'not-a-safe'; detail: string }
  | { kind: 'error'; detail: string };

const PAGE = 25;
const RPC_TIMEOUT_MS = 15_000;

/** A request that never settles would leave the UI in its skeleton forever. */
function withTimeout<T>(work: Promise<T>, label: string): Promise<T> {
  return Promise.race([
    work,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${RPC_TIMEOUT_MS / 1000}s.`)), RPC_TIMEOUT_MS),
    ),
  ]);
}

/**
 * All reads go through the Arc RPC directly, never through the injected wallet.
 *
 * Two reasons. It works before a wallet is connected at all; and if the wallet
 * happens to be pointed at another network, routing reads through it would
 * query the wrong chain and report a perfectly good safe as "no contract".
 * The wallet is needed only to sign writes — see safeWriter below.
 *
 * Module scope, so the identity is stable for the lifetime of the page.
 */
const reader = new JsonRpcProvider(ARC_TESTNET.rpcUrls[0], ARC_TESTNET.chainId, {
  staticNetwork: true,
  // Arc's RPC does not answer JSON-RPC batch requests correctly: ethers groups
  // concurrent calls into one batched payload by default, and every eth_call in
  // that batch comes back without data, surfacing as "missing revert data".
  // Verified 2026-07-19 — the same Promise.all succeeds with batching off and
  // fails with it on. One request per call.
  batchMaxCount: 1,
});

export function useSafe(address: string, account: string | null) {
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [refreshToken, setRefreshToken] = useState(0);

  const refresh = useCallback(() => setRefreshToken((n) => n + 1), []);

  useEffect(() => {
    if (!address || !isAddress(address)) {
      setStatus({ kind: 'idle' });
      return;
    }

    let cancelled = false;
    setStatus({ kind: 'loading' });

    (async () => {
      try {
        // Guard rail: an address with no code answers every eth_call with "0x",
        // which ethers decodes as empty rather than throwing. Without this check
        // the UI renders a safe with zero owners and no error — which is exactly
        // how a reverted deployment went unnoticed for weeks.
        const code = await withTimeout(reader.getCode(address), 'Reading the contract');
        if (cancelled) return;
        if (code === '0x' || code === '0x0') {
          setStatus({ kind: 'not-deployed' });
          return;
        }

        const safe = new Contract(address, ARCSAFE_ABI, reader);

        const [owners, thresholdRaw, txCountRaw, balance] = await withTimeout(
          Promise.all([
            safe.getOwners() as Promise<string[]>,
            safe.threshold() as Promise<bigint>,
            safe.txCount() as Promise<bigint>,
            reader.getBalance(address),
          ]),
          'Loading the safe',
        );
        if (cancelled) return;

        if (!owners.length) {
          setStatus({ kind: 'not-a-safe', detail: 'This contract reports no owners.' });
          return;
        }

        const txCount = Number(txCountRaw);
        const from = Math.max(0, txCount - PAGE);
        const ids = Array.from({ length: txCount - from }, (_, i) => from + i);

        // Fetched in parallel. The previous build awaited each call in a loop,
        // so a 20-transaction safe cost 20 sequential round trips.
        const raw = await Promise.all(
          ids.map(async (id) => {
            const t = await safe.getTransaction(id);
            const youApproved = account ? ((await safe.hasApproved(id, account)) as boolean) : false;
            // Fetch the legs so an approver can see exactly what they are
            // agreeing to, rather than just "batch of 3".
            const calls: BatchCall[] = t.isBatch
              ? ((await safe.getBatchCalls(id)) as Array<{ to: string; value: bigint; data: string }>).map((c) => ({
                  to: c.to,
                  value: c.value,
                  data: c.data,
                }))
              : [];
            return { id, t, youApproved, calls };
          }),
        );
        if (cancelled) return;

        const transactions: SafeTx[] = raw
          .map(({ id, t, youApproved, calls }) => ({
            id,
            to: t.to as string,
            value: t.value as bigint,
            data: t.data as string,
            expiresAt: Number(t.expiresAt),
            approvals: Number(t.approvals),
            executed: t.executed as boolean,
            cancelled: t.cancelled as boolean,
            stale: t.stale as boolean,
            proposer: t.proposer as string,
            youApproved,
            isBatch: t.isBatch as boolean,
            callCount: Number(t.callCount),
            calls,
          }))
          .reverse();

        setStatus({
          kind: 'ready',
          data: {
            owners,
            threshold: Number(thresholdRaw),
            balance,
            txCount,
            transactions,
            youAreOwner: !!account && owners.some((o) => o.toLowerCase() === account.toLowerCase()),
          },
        });
      } catch (e) {
        if (cancelled) return;
        // A contract that exists but lacks these functions is not an ArcSafe.
        const msg = humanizeError(e);
        setStatus(
          /could not decode|BAD_DATA|no matching/i.test(msg)
            ? { kind: 'not-a-safe', detail: 'This address holds a contract, but it is not an ArcSafe.' }
            : { kind: 'error', detail: msg },
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [address, account, refreshToken]);

  return { status, refresh };
}

/** Write path — needs a signer, so it always comes from the injected wallet. */
export async function safeWriter(wallet: BrowserProvider, address: string) {
  const signer = await wallet.getSigner();
  return new Contract(address, ARCSAFE_ABI, signer);
}
