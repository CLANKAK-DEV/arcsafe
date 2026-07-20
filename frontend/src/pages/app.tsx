import { isAddress, parseEther, ZeroAddress } from 'ethers';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertIcon,
  CheckIcon,
  ClockIcon,
  ExternalIcon,
  LayersIcon,
  SendIcon,
  ShieldCheckIcon,
  WalletIcon,
  XIcon,
} from '../components/Icons';
import { SiteFooter, SiteHeader } from '../components/Shell';
import { OperationsMap } from '../components/Visuals';
import { AddressChip, Badge, Button, Callout, Card, EmptyState, Field, Stat, linkButtonClass } from '../components/ui';
import { ARC_TESTNET, SAFE_ADDRESS, explorerAddress } from '../lib/config';
import { formatUsdc, formatRelativeTime, humanizeError, shortAddress } from '../lib/format';
import { useMySafes } from '../lib/useFactory';
import { simulateExecute, type Simulation } from '../lib/simulate';
import { useMounted } from '../lib/useMounted';
import { safeWriter, useSafe, type SafeTx } from '../lib/useSafe';
import { useWallet } from '../lib/wallet';

type Toast = { tone: 'ok' | 'danger'; message: string } | null;

export default function AppPage() {
  const mounted = useMounted();
  const wallet = useWallet();
  const router = useRouter();
  const [input, setInput] = useState(SAFE_ADDRESS);
  const [loaded, setLoaded] = useState(SAFE_ADDRESS);
  const [toast, setToast] = useState<Toast>(null);
  const { safes: mySafes } = useMySafes(wallet.account);

  // Deep link: /app/?safe=0x… so a safe can be shared by URL, which is how
  // co-owners will actually pass one around.
  useEffect(() => {
    if (!router.isReady) return;
    const q = router.query.safe;
    const value = Array.isArray(q) ? q[0] : q;
    if (value && isAddress(value)) {
      setInput(value);
      setLoaded(value);
    }
  }, [router.isReady, router.query.safe]);

  const { status, refresh } = useSafe(loaded, wallet.account);

  const notify = useCallback((t: Toast) => {
    setToast(t);
    if (t) setTimeout(() => setToast(null), 5000);
  }, []);

  const inputError = input && !isAddress(input) ? 'That is not a valid address.' : undefined;

  return (
    <>
      <Head>
        <title>Dashboard — ArcSafe</title>
        <meta name="robots" content="noindex" />
      </Head>

      <SiteHeader right={mounted ? <WalletButton wallet={wallet} /> : null} />

      <main id="main" className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {/* The visible page title varies by state; this anchors the heading
            hierarchy so the document never starts at h2. */}
        <h1 className="sr-only">ArcSafe dashboard</h1>

        {!mounted ? (
          <div className="space-y-6" aria-busy="true" aria-label="Loading">
            <div className="skeleton h-40" />
            <div className="skeleton h-64" />
          </div>
        ) : (
          <>
        {!wallet.onArc && wallet.account && (
          <div className="mb-6">
            <Callout title={`Wrong network`}>
              <p>
                Your wallet is on chain {wallet.chainId}. ArcSafe runs on {ARC_TESTNET.name} (
                {ARC_TESTNET.chainId}).
              </p>
              <Button variant="secondary" size="sm" className="mt-3" onClick={wallet.switchToArc}>
                Switch to {ARC_TESTNET.name}
              </Button>
            </Callout>
          </div>
        )}

        {/* Discovery first: pasting a 42-character address should be the
            fallback, not the only way in. */}
        {mySafes && mySafes.length > 0 && (
          <Card title={`Your safes (${mySafes.length})`} className="mb-6">
            <ul className="divide-y divide-hairline">
              {mySafes.map((safe) => (
                <li key={safe} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                  <code className="text-sm text-secondary">{shortAddress(safe, 12, 8)}</code>
                  <Button
                    size="sm"
                    variant={loaded.toLowerCase() === safe.toLowerCase() ? 'ghost' : 'secondary'}
                    disabled={loaded.toLowerCase() === safe.toLowerCase()}
                    onClick={() => {
                      setInput(safe);
                      setLoaded(safe);
                    }}
                  >
                    {loaded.toLowerCase() === safe.toLowerCase() ? 'Open' : 'Load'}
                  </Button>
                </li>
              ))}
            </ul>
          </Card>
        )}

        <Card
          title="Load a safe"
          action={
            <Link href="/create/" className={linkButtonClass('secondary', 'sm')}>
              Create a new safe
            </Link>
          }
          className="mb-6"
        >
          <form
            className="flex flex-col gap-3 sm:flex-row sm:items-start"
            onSubmit={(e) => {
              e.preventDefault();
              if (!inputError) setLoaded(input.trim());
            }}
          >
            <div className="flex-1">
              <Field
                label="Safe address"
                mono
                placeholder="0x…"
                value={input}
                error={inputError}
                hint="Paste any ArcSafe address on Arc Testnet."
                onChange={(e) => setInput(e.target.value.trim())}
                spellCheck={false}
                autoComplete="off"
              />
            </div>
            <Button type="submit" variant="primary" disabled={!input || !!inputError} className="sm:mt-[26px]">
              Load
            </Button>
          </form>
        </Card>

        <SafeView
          status={status}
          address={loaded}
          wallet={wallet}
          refresh={refresh}
          notify={notify}
        />
          </>
        )}
      </main>

      {toast && (
        // polite so it is announced without stealing focus mid-task
        <div
          role="status"
          aria-live="polite"
          className={`fixed inset-x-4 bottom-4 z-50 mx-auto max-w-md rounded-lg border px-4 py-3 text-sm shadow-lift sm:left-auto sm:right-6 ${
            toast.tone === 'ok' ? 'border-ok/35 bg-surface text-ok' : 'border-danger/35 bg-surface text-danger'
          }`}
        >
          {toast.message}
        </div>
      )}

      <SiteFooter />
    </>
  );
}

/* ── Wallet button ──────────────────────────────────────────────── */

function WalletButton({ wallet }: { wallet: ReturnType<typeof useWallet> }) {
  if (!wallet.hasWallet) {
    return (
      <a
        href="https://metamask.io/download/"
        target="_blank"
        rel="noreferrer noopener"
        className={linkButtonClass('secondary', 'sm')}
      >
        <ExternalIcon size={15} />
        Install MetaMask
      </a>
    );
  }

  if (!wallet.account) {
    return (
      <Button
        variant="primary"
        size="sm"
        loading={wallet.connecting}
        onClick={wallet.connect}
        icon={<WalletIcon size={15} />}
      >
        Connect wallet
      </Button>
    );
  }

  return (
    <span className="inline-flex items-center gap-2 rounded-lg border border-hairline bg-surface-2 px-3 py-2">
      <span
        className={`h-2 w-2 rounded-full ${wallet.onArc ? 'bg-ok' : 'bg-warn'}`}
        aria-hidden="true"
      />
      <code className="text-xs text-secondary">{shortAddress(wallet.account, 4, 4)}</code>
      <span className="sr-only">
        {wallet.onArc ? `Connected to ${ARC_TESTNET.name}` : 'Connected to the wrong network'}
      </span>
    </span>
  );
}

/* ── Safe view: every status has a designed state ───────────────── */

function SafeView({
  status,
  address,
  wallet,
  refresh,
  notify,
}: {
  status: ReturnType<typeof useSafe>['status'];
  address: string;
  wallet: ReturnType<typeof useWallet>;
  refresh: () => void;
  notify: (t: Toast) => void;
}) {
  if (status.kind === 'idle') {
    return (
      <EmptyState
        icon={<LayersIcon size={28} />}
        title="No safe loaded"
        body="Paste an address above to inspect an existing safe, or deploy a new one with your own owners."
        action={
          <Link href="/create/" className={linkButtonClass('primary')}>
            Create a safe
          </Link>
        }
      />
    );
  }

  if (status.kind === 'loading') return <SafeSkeleton />;

  if (status.kind === 'not-deployed') {
    return (
      <Callout tone="danger" title="No contract at this address">
        <p>
          <code className="text-primary">{address}</code> holds no bytecode on{' '}
          {ARC_TESTNET.name}. Either nothing was ever deployed here, or the deployment transaction
          reverted.
        </p>
        <p className="mt-2">
          A reverted deployment still produces a <code className="text-primary">contractAddress</code>{' '}
          in its receipt, which is why an address can look valid while being empty. Verify with{' '}
          <code className="text-primary">eth_getCode</code> before trusting any address.
        </p>
        <a
          href={explorerAddress(address)}
          target="_blank"
          rel="noreferrer noopener"
          className={`mt-3 ${linkButtonClass('secondary', 'sm')}`}
        >
          <ExternalIcon size={15} />
          Check on the explorer
        </a>
      </Callout>
    );
  }

  if (status.kind === 'not-a-safe') {
    return <Callout tone="danger" title="Not an ArcSafe">{status.detail}</Callout>;
  }

  if (status.kind === 'error') {
    return (
      <Callout tone="danger" title="Could not read this safe">
        <p>{status.detail}</p>
        <Button variant="secondary" size="sm" className="mt-3" onClick={refresh}>
          Try again
        </Button>
      </Callout>
    );
  }

  return <SafeDashboard data={status.data} address={address} wallet={wallet} refresh={refresh} notify={notify} />;
}

function SafeSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading safe">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton h-[92px]" />
        ))}
      </div>
      <div className="skeleton h-48" />
      <div className="skeleton h-64" />
    </div>
  );
}

/* ── Dashboard ──────────────────────────────────────────────────── */

function SafeDashboard({
  data,
  address,
  wallet,
  refresh,
  notify,
}: {
  data: NonNullable<Extract<ReturnType<typeof useSafe>['status'], { kind: 'ready' }>>['data'];
  address: string;
  wallet: ReturnType<typeof useWallet>;
  refresh: () => void;
  notify: (t: Toast) => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);

  const canWrite = data.youAreOwner && wallet.onArc && !!wallet.provider;

  const run = useCallback(
    async (key: string, fn: (c: Awaited<ReturnType<typeof safeWriter>>) => Promise<any>, okMessage: string) => {
      if (!wallet.provider) return;
      setBusy(key);
      try {
        const contract = await safeWriter(wallet.provider, address);
        const tx = await fn(contract);
        await tx.wait();
        notify({ tone: 'ok', message: okMessage });
        refresh();
      } catch (e) {
        notify({ tone: 'danger', message: humanizeError(e) });
      } finally {
        setBusy(null);
      }
    },
    [wallet.provider, address, notify, refresh],
  );

  const pending = data.transactions.filter((t) => !t.executed && !t.cancelled && !t.stale);
  const readyPending = pending.filter((t) => t.approvals >= data.threshold).length;

  return (
    <div className="space-y-6">
      {/* Identity */}
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-primary">Safe</h2>
              <Badge tone={data.youAreOwner ? 'ok' : 'neutral'}>
                {data.youAreOwner ? 'You are an owner' : 'Read only'}
              </Badge>
            </div>
            <div className="mt-2">
              <AddressChip
                address={address}
                short={shortAddress(address, 10, 8)}
                explorerHref={explorerAddress(address)}
                label="safe address"
              />
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={refresh}>
            Refresh
          </Button>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_1.2fr]">
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Balance" value={formatUsdc(data.balance)} sub="USDC" />
            <Stat label="Pending" value={pending.length} tone={pending.length ? 'warn' : undefined} />
            <Stat label="Owners" value={data.owners.length} />
            <Stat label="Threshold" value={`${data.threshold} of ${data.owners.length}`} tone="ok" />
          </div>
          <OperationsMap
            owners={data.owners.length}
            threshold={data.threshold}
            pending={pending.length}
            ready={readyPending}
          />
        </div>
      </Card>

      {!data.youAreOwner && wallet.account && (
        <Callout title="You are not an owner of this safe">
          You can read everything here, but proposing, approving and executing are restricted to the{' '}
          {data.owners.length} owner accounts below.
        </Callout>
      )}

      {/* Owners */}
      <Card title={`Owners (${data.owners.length})`}>
        <ul className="divide-y divide-hairline">
          {data.owners.map((owner, i) => {
            const isYou = wallet.account?.toLowerCase() === owner.toLowerCase();
            return (
              <li key={owner} className="flex items-center gap-3 py-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-hairline bg-surface-2 text-xs tabular text-muted">
                  {i + 1}
                </span>
                <AddressChip
                  address={owner}
                  short={shortAddress(owner, 12, 8)}
                  explorerHref={explorerAddress(owner)}
                  label={`owner ${i + 1}`}
                />
                {isYou && <Badge tone="accent">You</Badge>}
              </li>
            );
          })}
        </ul>
        <p className="mt-4 text-xs leading-relaxed text-muted">
          Owners and the threshold can only be changed by a transaction the safe approves and
          executes on itself — no single owner can alter this list.
        </p>
      </Card>

      {/* Deposit */}
      <DepositCard
        safeAddress={address}
        wallet={wallet}
        busy={busy === 'deposit'}
        onDeposit={async (value) => {
          if (!wallet.provider) return;
          setBusy('deposit');
          try {
            const signer = await wallet.provider.getSigner();
            // The destination comes from the loaded safe, never from typing.
            const tx = await signer.sendTransaction({ to: address, value });
            await tx.wait();
            notify({ tone: 'ok', message: `Deposited ${formatUsdc(value)} USDC.` });
            refresh();
          } catch (e) {
            notify({ tone: 'danger', message: humanizeError(e) });
          } finally {
            setBusy(null);
          }
        }}
      />

      {/* Propose */}
      <ProposeCard
        disabled={!canWrite}
        busy={busy === 'submit'}
        onSubmit={(args) =>
          run(
            'submit',
            (c) =>
              args.calls.length > 1
                ? // Tuple order must match the contract's Call struct.
                  c.submitBatch(
                    args.calls.map((call) => [call.to, call.value, call.data]),
                    args.expiresAt,
                  )
                : c.submit(args.calls[0].to, args.calls[0].value, args.calls[0].data, args.expiresAt),
            args.calls.length > 1
              ? `Batch of ${args.calls.length} proposed.`
              : 'Transaction proposed.',
          )
        }
      />

      {/* Queue */}
      <Card title={`Transactions (${data.txCount})`}>
        {data.transactions.length === 0 ? (
          <EmptyState
            icon={<SendIcon size={26} />}
            title="Nothing proposed yet"
            body="Once an owner proposes a transaction it will appear here for approval."
          />
        ) : (
          <ul className="space-y-3">
            {data.transactions.map((tx, i) => (
              <TxRow
                index={i}
                key={tx.id}
                tx={tx}
                threshold={data.threshold}
                canWrite={canWrite}
                busy={busy}
                safeAddress={address}
                account={wallet.account}
                onApprove={() => run(`approve-${tx.id}`, (c) => c.approve(tx.id), `Approved transaction #${tx.id}.`)}
                onRevoke={() => run(`revoke-${tx.id}`, (c) => c.revoke(tx.id), `Revoked approval for #${tx.id}.`)}
                onExecute={(value) => run(`execute-${tx.id}`, (c) => c.execute(tx.id, value ? { value } : {}), `Executed transaction #${tx.id}.`)}
              />
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

/* ── Deposit ────────────────────────────────────────────────────────
   Funding a safe is an ordinary transfer — no contract can pull funds from a
   wallet without a signature, on any EVM chain. What this removes is the
   dangerous part: the destination is taken from the safe already loaded and
   verified on-chain, so there is no address to copy, retype, or have swapped
   by a clipboard hijacker. */

function DepositCard({
  safeAddress,
  wallet,
  busy,
  onDeposit,
}: {
  safeAddress: string;
  wallet: ReturnType<typeof useWallet>;
  busy: boolean;
  onDeposit: (value: bigint) => void;
}) {
  const [amount, setAmount] = useState('');
  const [walletBalance, setWalletBalance] = useState<bigint | null>(null);

  useEffect(() => {
    if (!wallet.provider || !wallet.account) return;
    let cancelled = false;
    wallet.provider
      .getBalance(wallet.account)
      .then((b) => !cancelled && setWalletBalance(b))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [wallet.provider, wallet.account, busy]);

  let parsed: bigint | null = null;
  let error: string | undefined;
  if (amount) {
    try {
      parsed = parseEther(amount);
      if (parsed <= 0n) error = 'Enter an amount greater than zero.';
      else if (walletBalance !== null && parsed >= walletBalance) {
        // Strictly greater-than would leave nothing for gas.
        error = `Your wallet holds ${formatUsdc(walletBalance)} USDC. Leave some for gas.`;
      }
    } catch {
      error = 'Enter a number, for example 5';
    }
  }

  const ready = !!parsed && !error && wallet.onArc && !!wallet.provider;

  return (
    <Card title="Add funds">
      <p className="text-sm leading-relaxed text-secondary">
        Sends USDC from your connected wallet into this safe. The destination is
        filled in from the safe you have loaded — you never copy an address.
      </p>

      <div className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-hairline bg-surface-2/60 px-3 py-2.5 text-sm">
        <span className="text-muted">To</span>
        <code className="truncate text-secondary" title={safeAddress}>
          {shortAddress(safeAddress, 12, 8)}
        </code>
      </div>

      <form
        className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-start"
        onSubmit={(e) => {
          e.preventDefault();
          if (ready && parsed) {
            onDeposit(parsed);
            setAmount('');
          }
        }}
      >
        <div className="flex-1">
          <Field
            label="Amount (USDC)"
            inputMode="decimal"
            placeholder="5"
            value={amount}
            error={error}
            hint={
              walletBalance !== null
                ? `Your wallet: ${formatUsdc(walletBalance)} USDC`
                : 'Connect a wallet to deposit.'
            }
            onChange={(e) => setAmount(e.target.value.trim())}
            disabled={!wallet.provider || !wallet.onArc}
          />
        </div>
        <Button
          type="submit"
          variant="primary"
          disabled={!ready}
          loading={busy}
          className="sm:mt-[26px]"
          icon={<WalletIcon size={16} />}
        >
          Deposit
        </Button>
      </form>
    </Card>
  );
}

/* ── Propose form ───────────────────────────────────────────────── */

type Leg = { to: string; amount: string; data: string };
type ProposeArgs = { calls: Array<{ to: string; value: bigint; data: string }>; expiresAt: number };

function ProposeCard({
  disabled,
  busy,
  onSubmit,
}: {
  disabled: boolean;
  busy: boolean;
  onSubmit: (args: ProposeArgs) => void;
}) {
  // One list of legs, always. A single leg is proposed with submit(); two or
  // more become an atomic batch via submitBatch(). Keeping one code path means
  // there is no mode toggle to get wrong, and no second form to keep in sync.
  const [legs, setLegs] = useState<Leg[]>([{ to: '', amount: '', data: '' }]);
  const [expiryHours, setExpiryHours] = useState('');

  const MAX_LEGS = 32; // matches BatchTooLarge in the contract

  const legErrors = useMemo(
    () =>
      legs.map((leg) => {
        const e: Record<string, string | undefined> = {};
        if (leg.to && !isAddress(leg.to)) e.to = 'That is not a valid address.';
        else if (leg.to && leg.to.toLowerCase() === ZeroAddress.toLowerCase()) {
          e.to = 'The zero address is rejected by Arc.';
        }
        if (leg.amount) {
          try {
            if (parseEther(leg.amount) < 0n) e.amount = 'Amount cannot be negative.';
          } catch {
            e.amount = 'Enter a number, for example 1.5';
          }
        }
        if (leg.data && !/^0x[0-9a-fA-F]*$/.test(leg.data)) {
          e.data = 'Calldata must be hex starting with 0x.';
        }
        return e;
      }),
    [legs],
  );

  const expiryError =
    expiryHours && (!/^\d+$/.test(expiryHours) || Number(expiryHours) === 0)
      ? 'Whole number of hours, or leave blank for no expiry.'
      : undefined;

  const allFilled = legs.every((l) => l.to.trim());
  const valid =
    allFilled && !expiryError && !legErrors.some((e) => Object.values(e).some(Boolean));

  const isBatch = legs.length > 1;
  const totalValue = legs.reduce((sum, l) => {
    try {
      return sum + (l.amount ? parseEther(l.amount) : 0n);
    } catch {
      return sum;
    }
  }, 0n);

  function updateLeg(i: number, patch: Partial<Leg>) {
    setLegs((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    onSubmit({
      calls: legs.map((l) => ({
        to: l.to.trim(),
        value: l.amount ? parseEther(l.amount) : 0n,
        data: l.data.trim() || '0x',
      })),
      expiresAt: expiryHours ? Math.floor(Date.now() / 1000) + Number(expiryHours) * 3600 : 0,
    });
    setLegs([{ to: '', amount: '', data: '' }]);
    setExpiryHours('');
  }

  return (
    <Card
      title={isBatch ? `Propose a batch (${legs.length} calls)` : 'Propose a transaction'}
      action={
        isBatch ? (
          <Badge tone="accent" icon={<LayersIcon size={13} />}>
            Atomic
          </Badge>
        ) : undefined
      }
    >
      {disabled && (
        <p className="mb-4 rounded-lg border border-hairline bg-surface-2 px-3 py-2.5 text-xs text-muted">
          Connect an owner account on {ARC_TESTNET.name} to propose.
        </p>
      )}

      <form onSubmit={submit} className="space-y-5">
        {legs.map((leg, i) => (
          <fieldset key={i} className={isBatch ? 'rounded-lg border border-hairline p-4' : ''}>
            {isBatch && (
              <legend className="flex items-center gap-2 px-1.5 text-xs font-medium text-muted">
                Call {i + 1}
                <button
                  type="button"
                  onClick={() => setLegs((prev) => prev.filter((_, idx) => idx !== i))}
                  aria-label={`Remove call ${i + 1}`}
                  className="rounded p-0.5 text-muted transition hover:text-danger"
                >
                  <XIcon size={13} />
                </button>
              </legend>
            )}

            <div className="space-y-4">
              <Field
                label="Destination"
                required
                mono
                placeholder="0x…"
                value={leg.to}
                error={legErrors[i]?.to}
                onChange={(e) => updateLeg(i, { to: e.target.value.trim() })}
                disabled={disabled}
                spellCheck={false}
                autoComplete="off"
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Amount (USDC)"
                  inputMode="decimal"
                  placeholder="0.0"
                  value={leg.amount}
                  error={legErrors[i]?.amount}
                  hint="Blank for a zero-value call."
                  onChange={(e) => updateLeg(i, { amount: e.target.value.trim() })}
                  disabled={disabled}
                />
                <Field
                  label="Calldata (optional)"
                  mono
                  placeholder="0x"
                  value={leg.data}
                  error={legErrors[i]?.data}
                  hint="Encoded call for contract interactions."
                  onChange={(e) => updateLeg(i, { data: e.target.value.trim() })}
                  disabled={disabled}
                />
              </div>
            </div>
          </fieldset>
        ))}

        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={disabled || legs.length >= MAX_LEGS}
            onClick={() => setLegs((prev) => [...prev, { to: '', amount: '', data: '' }])}
            icon={<LayersIcon size={15} />}
          >
            Add another call
          </Button>
          {legs.length >= MAX_LEGS && (
            <span className="text-xs text-muted">Maximum {MAX_LEGS} calls per batch.</span>
          )}
          {isBatch && (
            <span className="text-xs text-muted">
              Total <span className="tabular text-secondary">{formatUsdc(totalValue)} USDC</span> ·
              all calls succeed or none do
            </span>
          )}
        </div>

        <Field
          label="Expires in (hours)"
          inputMode="numeric"
          placeholder="No expiry"
          value={expiryHours}
          error={expiryError}
          hint="After this, the proposal can no longer execute."
          onChange={(e) => setExpiryHours(e.target.value.trim())}
          disabled={disabled}
          className="sm:max-w-xs"
        />

        <Button type="submit" variant="primary" disabled={disabled || !valid} loading={busy} icon={<SendIcon size={16} />}>
          {isBatch ? `Propose batch of ${legs.length}` : 'Propose'}
        </Button>
      </form>
    </Card>
  );
}

/* ── Quorum meter ───────────────────────────────────────────────────
   One segment per required signature, rather than a single continuous bar.
   A 1-of-3 and a 2-of-6 look identical on a percentage bar; here you can count
   the signatures at a glance, which is the thing that actually matters.

   Motion carries meaning, not decoration: a segment animates in only when it
   is newly filled, and the meter pulses once — never in a loop — at the moment
   quorum is reached. The numeric label is authoritative; the animation only
   reinforces it, so nothing is lost under prefers-reduced-motion. */

function QuorumMeter({
  approvals,
  threshold,
  settled,
}: {
  approvals: number;
  threshold: number;
  settled: boolean;
}) {
  const filled = Math.min(approvals, threshold);
  const met = filled >= threshold;
  const previous = useRef(filled);
  const justMet = met && previous.current < threshold && !settled;

  useEffect(() => {
    previous.current = filled;
  }, [filled]);

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted">Approvals</span>
        <span className={`tabular transition-colors ${met ? 'text-ok' : 'text-secondary'}`}>
          {approvals} of {threshold} required
        </span>
      </div>

      <div
        className={`mt-1.5 flex gap-1 rounded-full ${justMet ? 'animate-quorum-met' : ''}`}
        role="progressbar"
        aria-valuenow={approvals}
        aria-valuemin={0}
        aria-valuemax={threshold}
        aria-label={`${approvals} of ${threshold} approvals collected`}
      >
        {Array.from({ length: threshold }, (_, i) => {
          const isFilled = i < filled;
          return (
            <span
              key={i}
              className={`h-1.5 flex-1 origin-left rounded-full ${
                isFilled
                  ? `${met ? 'bg-ok' : 'bg-accent'} animate-segment-in`
                  : 'bg-surface-3'
              }`}
              // Stagger so signatures read as arriving in sequence, ~40ms apart
              // (the skill's 30–50ms band), not all at once.
              style={isFilled ? { animationDelay: `${i * 40}ms` } : undefined}
            />
          );
        })}
      </div>
    </div>
  );
}

/* ── Transaction row ────────────────────────────────────────────── */

function TxRow({
  tx,
  index,
  threshold,
  canWrite,
  busy,
  safeAddress,
  account,
  onApprove,
  onRevoke,
  onExecute,
}: {
  tx: SafeTx;
  index: number;
  threshold: number;
  canWrite: boolean;
  busy: string | null;
  safeAddress: string;
  account: string | null;
  onApprove: () => void;
  onRevoke: () => void;
  onExecute: (value?: bigint) => void;
}) {
  const [sim, setSim] = useState<Simulation | null>(null);
  const [simulating, setSimulating] = useState(false);

  async function runSimulation() {
    if (!account) return;
    setSimulating(true);
    setSim(null);
    try {
      setSim(await simulateExecute(safeAddress, tx.id, account));
    } finally {
      setSimulating(false);
    }
  }

  /** Never send a transaction that we already know reverts. */
  async function simulateThenExecute() {
    if (!account) return onExecute();
    setSimulating(true);
    try {
      const result = await simulateExecute(safeAddress, tx.id, account);
      setSim(result);
      if (result.state === 'will-revert') return; // stop before the wallet prompt
    } finally {
      setSimulating(false);
    }
    onExecute();
  }

  const expired = tx.expiresAt !== 0 && tx.expiresAt * 1000 <= Date.now();
  const ready = tx.approvals >= threshold;
  const open = !tx.executed && !tx.cancelled && !tx.stale && !expired;

  // Status is carried by an icon and a word, never by colour alone.
  const state = tx.executed
    ? { tone: 'ok' as const, icon: <CheckIcon size={13} />, label: 'Executed' }
    : tx.cancelled
      ? { tone: 'neutral' as const, icon: <XIcon size={13} />, label: 'Cancelled' }
      : tx.stale
        ? { tone: 'danger' as const, icon: <AlertIcon size={13} />, label: 'Voided by config change' }
        : expired
          ? { tone: 'neutral' as const, icon: <ClockIcon size={13} />, label: 'Expired' }
          : ready
            ? { tone: 'ok' as const, icon: <ShieldCheckIcon size={13} />, label: 'Ready to execute' }
            : { tone: 'warn' as const, icon: <ClockIcon size={13} />, label: 'Awaiting approvals' };


  return (
    <li
      className="animate-row-in rounded-lg border border-hairline bg-surface-2/50 p-4 transition-colors"
      // Cap the stagger so a long queue does not crawl in.
      style={{ animationDelay: `${Math.min(index, 6) * 45}ms` }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs tabular text-muted">#{tx.id}</span>
        <Badge tone={state.tone} icon={state.icon}>
          {state.label}
        </Badge>
      </div>

      {tx.isBatch ? (
        <div className="mt-3">
          <p className="text-sm text-muted">
            Batch of <span className="tabular text-primary">{tx.callCount}</span> calls, executed
            atomically — all succeed or none do.
          </p>
          <ol className="mt-2 space-y-1.5">
            {tx.calls.map((call, i) => (
              <li
                key={i}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-hairline bg-base/40 px-3 py-2 text-sm"
              >
                <span className="text-2xs tabular text-muted">{i + 1}</span>
                <code className="text-secondary">{shortAddress(call.to, 8, 6)}</code>
                <span className="tabular text-primary">{formatUsdc(call.value)} USDC</span>
                {call.data && call.data !== '0x' && (
                  <code className="truncate text-xs text-muted" title={call.data}>
                    {call.data.slice(0, 18)}…
                  </code>
                )}
              </li>
            ))}
          </ol>
        </div>
      ) : (
      <dl className="mt-3 grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-[auto_1fr]">
        <dt className="text-muted">To</dt>
        <dd>
          <AddressChip address={tx.to} short={shortAddress(tx.to, 10, 6)} explorerHref={explorerAddress(tx.to)} label="destination" />
        </dd>

        <dt className="text-muted">Value</dt>
        <dd className="tabular text-primary">{formatUsdc(tx.value)} USDC</dd>

        {tx.data && tx.data !== '0x' && (
          <>
            <dt className="text-muted">Calldata</dt>
            <dd className="truncate font-mono text-xs text-secondary" title={tx.data}>
              {tx.data.slice(0, 26)}…
            </dd>
          </>
        )}

        {tx.expiresAt !== 0 && (
          <>
            <dt className="text-muted">Expires</dt>
            <dd className="text-secondary">{formatRelativeTime(tx.expiresAt)}</dd>
          </>
        )}
      </dl>
      )}

      {tx.isBatch && tx.expiresAt !== 0 && (
        <p className="mt-2 text-sm text-muted">
          Expires <span className="text-secondary">{formatRelativeTime(tx.expiresAt)}</span>
        </p>
      )}

      <QuorumMeter approvals={tx.approvals} threshold={threshold} settled={!open} />

      {/* Simulation result — what the transaction will actually do, before
          anyone signs it. */}
      {sim && (
        <div
          className={`mt-4 animate-row-in rounded-lg border p-3 text-sm ${
            sim.state === 'ok'
              ? 'border-ok/30 bg-ok/8'
              : sim.state === 'will-revert'
                ? 'border-danger/30 bg-danger/8'
                : 'border-warn/30 bg-warn/8'
          }`}
        >
          {sim.state === 'ok' ? (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <span className="inline-flex items-center gap-1.5 font-medium text-ok">
                <CheckIcon size={14} />
                Simulated successfully
              </span>
              <span className="text-muted">
                Gas <span className="tabular text-secondary">{sim.gas.toString()}</span>
              </span>
              <span className="text-muted">
                Cost ≈ <span className="tabular text-secondary">{formatUsdc(sim.feeWei, 6)} USDC</span>
              </span>
            </div>
          ) : sim.state === 'will-revert' ? (
            <div>
              <p className="inline-flex items-center gap-1.5 font-medium text-danger">
                <AlertIcon size={14} />
                This will fail — not sent
              </p>
              <p className="mt-1 leading-relaxed text-secondary">{sim.reason}</p>

              {/* Underfunding is fixable in one step: execute() is payable, so
                  the shortfall rides along with the execution. */}
              {sim.shortfall !== undefined && canWrite && (
                <Button
                  size="sm"
                  variant="primary"
                  className="mt-3"
                  loading={busy === `execute-${tx.id}`}
                  onClick={() => onExecute(sim.shortfall)}
                  icon={<WalletIcon size={15} />}
                >
                  Add {formatUsdc(sim.shortfall)} USDC and execute
                </Button>
              )}
            </div>
          ) : (
            <p className="text-secondary">
              The call succeeds, but the gas cost could not be estimated. {sim.reason}
            </p>
          )}
        </div>
      )}

      {open && canWrite && (
        <div className="mt-4 flex flex-wrap gap-2">
          {tx.youApproved ? (
            <Button size="sm" variant="secondary" loading={busy === `revoke-${tx.id}`} onClick={onRevoke} icon={<XIcon size={15} />}>
              Revoke approval
            </Button>
          ) : (
            <Button size="sm" variant="secondary" loading={busy === `approve-${tx.id}`} onClick={onApprove} icon={<CheckIcon size={15} />}>
              Approve
            </Button>
          )}

          {ready && (
            <Button size="sm" variant="ghost" loading={simulating} onClick={runSimulation}>
              Simulate
            </Button>
          )}

          <Button
            size="sm"
            variant="primary"
            disabled={!ready}
            loading={busy === `execute-${tx.id}` || simulating}
            onClick={simulateThenExecute}
            icon={busy === `execute-${tx.id}` || simulating ? undefined : <SendIcon size={15} />}
          >
            Execute
          </Button>
          {!ready && (
            <span className="self-center text-xs text-muted">
              {threshold - tx.approvals} more approval{threshold - tx.approvals === 1 ? '' : 's'} needed
            </span>
          )}
        </div>
      )}

      {tx.stale && (
        <p className="mt-3 text-xs leading-relaxed text-muted">
          The owner set or threshold changed after this was proposed, so its approvals no longer
          represent the current committee. Propose it again.
        </p>
      )}
    </li>
  );
}
