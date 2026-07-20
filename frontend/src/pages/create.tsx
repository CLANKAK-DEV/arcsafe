import { isAddress } from 'ethers';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useMemo, useState } from 'react';
import { CheckIcon, ExternalIcon, ShieldCheckIcon, UsersIcon, WalletIcon, XIcon } from '../components/Icons';
import { SiteFooter, SiteHeader } from '../components/Shell';
import { ThresholdPreview } from '../components/Visuals';
import { Badge, Button, Callout, Card, Field, linkButtonClass } from '../components/ui';
import { ARC_TESTNET, explorerAddress, explorerTx } from '../lib/config';
import { humanizeError, shortAddress } from '../lib/format';
import { createSafe, factoryConfigured } from '../lib/useFactory';
import { useMounted } from '../lib/useMounted';
import { useWallet } from '../lib/wallet';

export default function CreatePage() {
  const mounted = useMounted();
  const wallet = useWallet();
  const router = useRouter();

  // Start with the connected account as the first owner — the overwhelmingly
  // common case, and it stops people creating a safe they are locked out of.
  const [owners, setOwners] = useState<string[]>(['', '']);
  const [threshold, setThreshold] = useState(2);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ safe: string; txHash: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filled = owners.map((o) => o.trim()).filter(Boolean);

  const ownerErrors = useMemo(
    () =>
      owners.map((raw, i) => {
        const value = raw.trim();
        if (!value) return undefined;
        if (!isAddress(value)) return 'Not a valid address. Check the EIP-55 capitalisation.';
        const firstIndex = owners.findIndex((o) => o.trim().toLowerCase() === value.toLowerCase());
        if (firstIndex !== i) return 'Duplicate — this address is already an owner.';
        return undefined;
      }),
    [owners],
  );

  /**
   * The threshold actually in effect, clamped to the current owner count.
   *
   * `threshold` is what the user last picked; removing owners can leave it
   * above what is now selectable. Deriving the clamped value rather than
   * mutating state keeps the buttons, the summary and the submitted value from
   * ever disagreeing with each other.
   */
  const effectiveThreshold = Math.min(Math.max(threshold, 1), Math.max(filled.length, 1));

  const youAreOwner =
    !!wallet.account && filled.some((o) => o.toLowerCase() === wallet.account!.toLowerCase());

  const valid =
    filled.length >= 1 &&
    !ownerErrors.some(Boolean) &&
    effectiveThreshold >= 1 &&
    effectiveThreshold <= filled.length &&
    wallet.onArc &&
    !!wallet.provider &&
    factoryConfigured;

  function updateOwner(index: number, value: string) {
    setOwners((prev) => prev.map((o, i) => (i === index ? value : o)));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid || !wallet.provider) return;

    setBusy(true);
    setError(null);
    try {
      const created = await createSafe(wallet.provider, filled, effectiveThreshold);
      setResult(created);
    } catch (err) {
      setError(humanizeError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Head>
        <title>Create a safe — ArcSafe</title>
        <meta name="description" content="Deploy your own multi-signature safe on Arc in one transaction." />
      </Head>

      <SiteHeader
        right={
          <Link href="/app/" className={linkButtonClass('secondary', 'sm')}>
            Open dashboard
          </Link>
        }
      />

      <main id="main" className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <h1 className="text-3xl font-bold tracking-tight text-primary">Create a safe</h1>
        <p className="mt-3 max-w-xl text-base leading-relaxed text-secondary">
          Choose who controls it and how many of them must agree. The safe is deployed to your own
          address on {ARC_TESTNET.name} — nobody else, including whoever deployed the factory, can
          alter it.
        </p>

        {!mounted ? (
          // Matches the prerendered HTML exactly so hydration cannot mismatch.
          <div className="mt-8 space-y-4" aria-busy="true" aria-label="Loading">
            <div className="skeleton h-64" />
            <div className="skeleton h-40" />
          </div>
        ) : result ? (
          <SuccessPanel result={result} onOpen={() => router.push(`/app/?safe=${result.safe}`)} />
        ) : (
          <>
            {!factoryConfigured && (
              <div className="mt-6">
                <Callout tone="danger" title="No factory configured">
                  <p>
                    Set <code className="text-primary">NEXT_PUBLIC_FACTORY_ADDRESS</code> in{' '}
                    <code className="text-primary">frontend/.env.local</code> and rebuild. Deploy the
                    factory once with <code className="text-primary">npm run deploy:testnet</code>.
                  </p>
                </Callout>
              </div>
            )}

            {!wallet.account && factoryConfigured && (
              <div className="mt-6">
                <Callout title="Connect a wallet to continue">
                  <p>Creating a safe is an on-chain transaction, so it needs a funded account.</p>
                  <Button
                    variant="primary"
                    size="sm"
                    className="mt-3"
                    loading={wallet.connecting}
                    onClick={wallet.connect}
                    icon={<WalletIcon size={15} />}
                  >
                    Connect wallet
                  </Button>
                </Callout>
              </div>
            )}

            {wallet.account && !wallet.onArc && (
              <div className="mt-6">
                <Callout title="Wrong network">
                  <p>
                    Switch to {ARC_TESTNET.name} (chain {ARC_TESTNET.chainId}) to deploy.
                  </p>
                  <Button variant="secondary" size="sm" className="mt-3" onClick={wallet.switchToArc}>
                    Switch network
                  </Button>
                </Callout>
              </div>
            )}

            <form onSubmit={submit} className="mt-8 space-y-6">
              <ThresholdPreview owners={filled} threshold={effectiveThreshold} />

              <Card title={`Owners (${filled.length})`}>
                <div className="space-y-4">
                  {owners.map((owner, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <div className="flex-1">
                        <Field
                          label={`Owner ${i + 1}`}
                          mono
                          placeholder="0x…"
                          value={owner}
                          error={ownerErrors[i]}
                          onChange={(e) => updateOwner(i, e.target.value)}
                          spellCheck={false}
                          autoComplete="off"
                        />
                      </div>
                      {owners.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            setOwners((prev) => prev.filter((_, idx) => idx !== i));
                            setThreshold((t) => Math.max(1, Math.min(t, owners.length - 1)));
                          }}
                          aria-label={`Remove owner ${i + 1}`}
                          className="mt-[26px] grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-hairline text-muted transition hover:border-danger/40 hover:text-danger"
                        >
                          <XIcon size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <Button type="button" variant="secondary" size="sm" onClick={() => setOwners((p) => [...p, ''])}>
                    Add owner
                  </Button>
                  {wallet.account && !youAreOwner && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const emptyIndex = owners.findIndex((o) => !o.trim());
                        if (emptyIndex >= 0) updateOwner(emptyIndex, wallet.account!);
                        else setOwners((p) => [...p, wallet.account!]);
                      }}
                    >
                      Add my address
                    </Button>
                  )}
                </div>

                {wallet.account && filled.length > 0 && !youAreOwner && (
                  <p className="mt-4 rounded-lg border border-warn/30 bg-warn/8 px-3 py-2.5 text-xs leading-relaxed text-secondary">
                    Your connected account is not in this list. You will pay to deploy this safe but
                    will not be able to propose or approve anything in it.
                  </p>
                )}
              </Card>

              <Card title="Threshold">
                <p className="text-sm leading-relaxed text-secondary">
                  How many owners must approve before a transaction can execute.
                </p>

                <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Required approvals">
                  {Array.from({ length: Math.max(filled.length, 1) }, (_, i) => i + 1).map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setThreshold(n)}
                      aria-pressed={effectiveThreshold === n}
                      className={`h-11 min-w-11 rounded-lg border px-4 text-sm font-medium tabular transition ${
                        effectiveThreshold === n
                          ? 'border-accent bg-accent/15 text-primary'
                          : 'border-hairline bg-surface-2 text-secondary hover:border-hairline-strong'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>

                {filled.length === 0 ? (
                  // Showing "2 of —" here claimed a threshold that no button
                  // could select, against an owner count that did not exist yet.
                  <p className="mt-4 text-sm text-muted">
                    Add owner addresses above to choose a threshold.
                  </p>
                ) : (
                  <p className="mt-4 text-sm text-secondary">
                    <span className="font-semibold text-primary">
                      {effectiveThreshold} of {filled.length}
                    </span>{' '}
                    signature{effectiveThreshold === 1 ? '' : 's'} required.
                  </p>
                )}

                {effectiveThreshold === 1 && filled.length > 1 && (
                  <p className="mt-3 rounded-lg border border-warn/30 bg-warn/8 px-3 py-2.5 text-xs leading-relaxed text-secondary">
                    A threshold of 1 means any single owner can move the funds alone. That is not
                    multi-signature protection.
                  </p>
                )}
                {filled.length === 1 && (
                  <p className="mt-3 text-xs leading-relaxed text-muted">
                    A single-owner safe works, but behaves like a normal wallet. Add a second owner
                    to get the protection this contract is for.
                  </p>
                )}
              </Card>

              {error && (
                <Callout tone="danger" title="Could not create the safe">
                  {error}
                </Callout>
              )}

              <div className="flex items-center gap-3">
                <Button type="submit" variant="primary" disabled={!valid} loading={busy} icon={<ShieldCheckIcon size={17} />}>
                  {busy ? 'Deploying…' : 'Create safe'}
                </Button>
                <span className="text-xs text-muted">One transaction. You pay gas.</span>
              </div>
            </form>
          </>
        )}
      </main>

      <SiteFooter />
    </>
  );
}

function SuccessPanel({ result, onOpen }: { result: { safe: string; txHash: string }; onOpen: () => void }) {
  return (
    <div className="mt-8 space-y-4">
      <Card>
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-ok/30 bg-ok/12 text-ok">
            <CheckIcon size={20} />
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-primary">Safe deployed</h2>
            <p className="mt-1 text-sm text-secondary">
              Verified on-chain. Share this address with your co-owners.
            </p>
          </div>
        </div>

        <dl className="mt-5 space-y-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-hairline bg-surface-2/60 px-3 py-2.5">
            <dt className="text-muted">Safe address</dt>
            <dd>
              <code className="text-primary">{result.safe}</code>
            </dd>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-hairline bg-surface-2/60 px-3 py-2.5">
            <dt className="text-muted">Transaction</dt>
            <dd>
              <code className="text-secondary">{shortAddress(result.txHash, 10, 8)}</code>
            </dd>
          </div>
        </dl>

        <div className="mt-5 flex flex-wrap gap-3">
          <Button variant="primary" onClick={onOpen}>
            Open this safe
          </Button>
          <a
            href={explorerAddress(result.safe)}
            target="_blank"
            rel="noreferrer noopener"
            className={linkButtonClass('secondary')}
          >
            <ExternalIcon size={16} />
            View on explorer
          </a>
          <a
            href={explorerTx(result.txHash)}
            target="_blank"
            rel="noreferrer noopener"
            className={linkButtonClass('ghost')}
          >
            Deployment tx
          </a>
        </div>
      </Card>

      <Card title="Next">
        <ul className="space-y-2 text-sm leading-relaxed text-secondary">
          <li className="flex gap-2">
            <UsersIcon size={16} className="mt-0.5 shrink-0 text-accent" />
            Send the safe address to your co-owners so they can load it.
          </li>
          <li className="flex gap-2">
            <Badge tone="neutral">2</Badge>
            Fund the safe by sending USDC to its address like any other account.
          </li>
        </ul>
      </Card>
    </div>
  );
}
