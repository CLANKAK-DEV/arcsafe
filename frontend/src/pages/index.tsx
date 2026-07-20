import Head from 'next/head';
import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  AlertIcon,
  ArrowRightIcon,
  CheckIcon,
  ClockIcon,
  FileCheckIcon,
  KeyIcon,
  LayersIcon,
  LockIcon,
  SendIcon,
  ShieldCheckIcon,
  UsersIcon,
} from '../components/Icons';
import { ArcMark } from '../components/Logo';
import { SiteFooter, SiteHeader } from '../components/Shell';
import { QuorumNetworkVisual } from '../components/Visuals';
import { Badge, Card, linkButtonClass } from '../components/ui';
import { ARC_TESTNET } from '../lib/config';

const TITLE = 'ArcSafe — multi-signature wallet for Arc';
const DESCRIPTION =
  'N-of-M multi-signature custody for Arc Chain. Owner and threshold changes are themselves multi-sig transactions, so no single key can ever move funds alone.';

export default function Landing() {
  return (
    <>
      <Head>
        <title>{TITLE}</title>
        <meta name="description" content={DESCRIPTION} />
        <meta property="og:title" content={TITLE} />
        <meta property="og:description" content={DESCRIPTION} />
        <meta property="og:type" content="website" />
      </Head>

      <SiteHeader
        right={
          // next/link applies basePath for us; a bare <a href="/app"> would 404
          // once the site is served from /arcsafe/.
          <Link href="/create/" className={linkButtonClass('primary', 'sm')}>
            <ArrowRightIcon size={15} />
            Create a safe
          </Link>
        }
      />

      <main id="main">
        <Hero />
        <FlowSection />
        <SecuritySection />
        <FeatureSection />
        <SpecSection />
        <RoadmapSection />
        <ClosingCta />
      </main>

      <SiteFooter />
    </>
  );
}

/* ── Hero ───────────────────────────────────────────────────────── */

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="mx-auto max-w-6xl px-4 pb-20 pt-16 sm:px-6 sm:pt-24">
        <div className="grid items-center gap-14 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="animate-fade-up">
            <Badge tone="accent" icon={<span className="h-1.5 w-1.5 rounded-full bg-accent" />}>
              {ARC_TESTNET.name} · Chain {ARC_TESTNET.chainId}
            </Badge>

            <h1 className="mt-5 text-[2.5rem] font-bold leading-[1.06] tracking-tight sm:text-6xl">
              <span className="text-arch">No single key</span>
              <br />
              moves the money.
            </h1>

            <p className="mt-5 max-w-xl text-lg leading-relaxed text-secondary">
              ArcSafe is an N-of-M multi-signature wallet for Arc. Changing the owners or the
              threshold is itself a multi-sig transaction — so a compromised owner cannot quietly
              lower the bar and walk out with the treasury.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/create/" className={linkButtonClass('primary')}>
                <KeyIcon size={17} />
                Create your safe
              </Link>
              <Link href="/app/" className={linkButtonClass('secondary')}>
                <ShieldCheckIcon size={17} />
                Open an existing safe
              </Link>
            </div>
            <p className="mt-3 text-sm text-muted">
              Free and permissionless. You choose the owners; nobody else can change them.
            </p>

            <dl className="mt-10 grid max-w-lg grid-cols-3 gap-4 border-t border-hairline pt-6">
              {[
                ['42', 'tests passing'],
                ['32', 'calls per atomic batch'],
                ['0', 'external dependencies'],
              ].map(([value, label]) => (
                <div key={label}>
                  <dt className="sr-only">{label}</dt>
                  <dd className="text-2xl font-semibold tabular text-primary">{value}</dd>
                  <dd className="mt-0.5 text-xs text-muted">{label}</dd>
                </div>
              ))}
            </dl>
          </div>

          <QuorumNetworkVisual />
        </div>
      </div>
    </section>
  );
}

function HeroPanel() {
  return (
    <div className="relative animate-fade-up [animation-delay:120ms]">
      {/* Decorative halo behind the mark. */}
      <div
        aria-hidden="true"
        className="absolute left-1/2 top-8 -z-10 h-64 w-64 -translate-x-1/2 rounded-full bg-accent/20 blur-3xl"
      />

      <div className="card overflow-hidden shadow-lift">
        <div className="flex flex-col items-center gap-4 border-b border-hairline bg-gradient-to-b from-surface-2/80 to-transparent px-6 py-10">
          <ArcMark size={76} />
          <div className="text-center">
            <p className="text-sm font-semibold text-primary">2 of 3 signatures required</p>
            <p className="mt-1 text-xs text-muted">Every transfer. Every config change. No exceptions.</p>
          </div>
        </div>

        <ul className="divide-y divide-hairline">
          {[
            { icon: <SendIcon size={16} />, who: 'Owner 1', what: 'proposed 5 USDC → 0x9De8…be35', tone: 'accent' as const, state: 'Proposed' },
            { icon: <CheckIcon size={16} />, who: 'Owner 2', what: 'approved · 2 of 2 reached', tone: 'ok' as const, state: 'Approved' },
            { icon: <ClockIcon size={16} />, who: 'Owner 3', what: 'not needed — quorum already met', tone: 'neutral' as const, state: 'Idle' },
          ].map((row) => (
            <li key={row.who} className="flex items-center gap-3 px-5 py-4">
              <span
                className={`grid h-9 w-9 shrink-0 place-items-center rounded-full border ${
                  row.tone === 'ok'
                    ? 'border-ok/30 bg-ok/12 text-ok'
                    : row.tone === 'accent'
                      ? 'border-accent/30 bg-accent/12 text-accent'
                      : 'border-hairline bg-surface-2 text-muted'
                }`}
              >
                {row.icon}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-primary">{row.who}</p>
                <p className="truncate text-xs text-muted">{row.what}</p>
              </div>
            </li>
          ))}
        </ul>

        <div className="flex items-center justify-between gap-3 border-t border-hairline bg-ok/8 px-5 py-4">
          <span className="text-sm font-medium text-ok">Executed on-chain</span>
          <CheckIcon size={18} className="text-ok" />
        </div>
      </div>
    </div>
  );
}

/* ── How it works ───────────────────────────────────────────────── */

function FlowSection() {
  const steps = [
    {
      icon: <SendIcon size={20} />,
      title: 'Propose',
      body: 'Any owner submits a destination, an amount and optional calldata. Proposing costs gas but authorises nothing.',
    },
    {
      icon: <UsersIcon size={20} />,
      title: 'Approve',
      body: 'Co-owners approve on-chain. Approvals are per-owner and revocable right up until execution.',
    },
    {
      icon: <ShieldCheckIcon size={20} />,
      title: 'Execute',
      body: 'Once the tally reaches the threshold, any owner can execute. The contract re-checks the count itself.',
    },
  ];

  return (
    <section id="how" className="scroll-mt-20 border-t border-hairline/70 py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading eyebrow="Flow" title="Three steps, enforced by the contract">
          The interface never decides whether something is allowed. Every rule below is checked
          on-chain, so a modified frontend changes nothing.
        </SectionHeading>

        <ol className="mt-12 grid gap-4 md:grid-cols-3">
          {steps.map((step, i) => (
            <li key={step.title}>
              <Card className="h-full">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-lg border border-hairline-strong bg-surface-2 text-accent">
                    {step.icon}
                  </span>
                  <span className="text-2xs font-semibold uppercase tracking-widest text-muted">
                    Step {i + 1}
                  </span>
                </div>
                <h3 className="mt-4 text-base font-semibold text-primary">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-secondary">{step.body}</p>
              </Card>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ── Security ───────────────────────────────────────────────────── */

function SecuritySection() {
  return (
    <section id="security" className="scroll-mt-20 border-t border-hairline/70 py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading eyebrow="Security model" title="The rule that makes it a multi-sig">
          A wallet where one owner can change the threshold is not a multi-sig — it is a shared hot
          wallet with extra steps. ArcSafe separates the two capabilities explicitly.
        </SectionHeading>

        <div className="mt-12 grid gap-4 lg:grid-cols-2">
          <Card className="border-danger/25">
            <div className="flex items-start gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-danger/30 bg-danger/12 text-danger">
                <AlertIcon size={18} />
              </span>
              <div>
                <h3 className="text-sm font-semibold text-primary">What a naive implementation does</h3>
                <p className="mt-1 text-sm text-muted">Any owner can rewrite the rules alone.</p>
              </div>
            </div>
            <pre className="mt-4 overflow-x-auto rounded-lg border border-hairline bg-base/60 p-4 text-xs leading-relaxed text-secondary">
              <code>{`function changeThreshold(uint256 t)
    external onlyOwner        // ← any single owner
{
    threshold = t;
}

// Owner 1, acting alone:
//   changeThreshold(1)
//   submit(attacker, balance)
//   approve() → execute()     // drained`}</code>
            </pre>
          </Card>

          <Card className="border-ok/25">
            <div className="flex items-start gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-ok/30 bg-ok/12 text-ok">
                <LockIcon size={18} />
              </span>
              <div>
                <h3 className="text-sm font-semibold text-primary">What ArcSafe does</h3>
                <p className="mt-1 text-sm text-muted">Config changes route through the quorum.</p>
              </div>
            </div>
            <pre className="mt-4 overflow-x-auto rounded-lg border border-hairline bg-base/60 p-4 text-xs leading-relaxed text-secondary">
              <code>{`modifier onlySelf() {
    if (msg.sender != address(this))
        revert OnlySafe();
    _;
}

function changeThreshold(uint256 t)
    external onlySelf         // ← only via execute()
{ ... }`}</code>
            </pre>
          </Card>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[
            {
              icon: <ShieldCheckIcon size={18} />,
              title: 'Stale approvals expire',
              body: 'Changing the owner set bumps a config version. Anything approved by the previous committee stops being executable.',
            },
            {
              icon: <LockIcon size={18} />,
              title: 'Reentrancy guarded',
              body: 'Execution is marked complete before the external call, and the call sits behind a guard. Verified with a hostile owner contract in the suite.',
            },
            {
              icon: <ClockIcon size={18} />,
              title: 'Optional expiry',
              body: 'A proposal can carry a deadline, so a forgotten transaction cannot be resurrected months later.',
            },
            {
              icon: <FileCheckIcon size={18} />,
              title: 'Deployment is verified',
              body: 'The app checks for bytecode before trusting an address, so a reverted deployment can never masquerade as a live safe.',
            },
          ].map((item) => (
            <Card key={item.title} className="h-full">
              <span className="grid h-9 w-9 place-items-center rounded-lg border border-hairline-strong bg-surface-2 text-accent">
                {item.icon}
              </span>
              <h3 className="mt-4 text-sm font-semibold text-primary">{item.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{item.body}</p>
            </Card>
          ))}
        </div>

        <div className="mt-4 rounded-lg border border-warn/30 bg-warn/8 p-5">
          <p className="text-sm font-semibold text-warn">Not audited</p>
          <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-secondary">
            ArcSafe has a full unit-test suite but no third-party audit. Treat it as testnet
            software. The security properties described here are enforced by tests you can run
            yourself with <code className="text-primary">npm test</code> — that is evidence, not a
            substitute for review.
          </p>
        </div>
      </div>
    </section>
  );
}

/* ── Features ───────────────────────────────────────────────────── */

function FeatureSection() {
  const features = [
    { icon: <UsersIcon size={18} />, title: 'Owner management', body: 'Add, remove or swap owners and set a new threshold in the same approved transaction.' },
    { icon: <LayersIcon size={18} />, title: 'Atomic batches', body: 'Bundle up to 32 calls into one proposal. Every leg succeeds or the whole batch reverts — no half-applied changes.' },
    { icon: <ShieldCheckIcon size={18} />, title: 'Simulation before signing', body: 'Execution is dry-run against live state first. A transaction that would revert is caught and never reaches your wallet.' },
    { icon: <LayersIcon size={18} />, title: 'Arbitrary calldata', body: 'Move USDC or call any contract. The safe is a full account, not just a transfer helper.' },
    { icon: <KeyIcon size={18} />, title: 'Deterministic factory', body: 'CREATE2 addresses you can predict before paying, with salts scoped per deployer so nobody can front-run yours.' },
    { icon: <ShieldCheckIcon size={18} />, title: 'Token custody', body: 'ERC-721 and ERC-1155 receiver hooks, so NFTs sent to the safe are not stuck or rejected.' },
    { icon: <ClockIcon size={18} />, title: 'Revocable approvals', body: 'Change your mind before execution. The tally drops immediately and the transaction stops being executable.' },
    { icon: <FileCheckIcon size={18} />, title: 'Readable failures', body: 'Custom errors are mapped to plain sentences in the UI instead of surfacing a raw revert blob.' },
  ];

  return (
    <section className="border-t border-hairline/70 py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading eyebrow="Capabilities" title="What it does today">
          Scoped deliberately. Everything listed here is implemented and covered by tests — nothing
          here is a roadmap item.
        </SectionHeading>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <Card key={f.title} className="h-full">
              <span className="grid h-9 w-9 place-items-center rounded-lg border border-hairline-strong bg-surface-2 text-accent">
                {f.icon}
              </span>
              <h3 className="mt-4 text-sm font-semibold text-primary">{f.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{f.body}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Specs ──────────────────────────────────────────────────────── */

function SpecSection() {
  const rows: Array<[string, ReactNode]> = [
    ['Network', `${ARC_TESTNET.name} (chain ID ${ARC_TESTNET.chainId})`],
    ['Gas token', 'USDC — Arc denominates all fees in USDC, 18 decimals natively'],
    ['RPC endpoint', <code key="rpc">{ARC_TESTNET.rpcUrls[0]}</code>],
    ['Language', 'Solidity 0.8.24, optimizer on, 200 runs'],
    ['EVM target', 'Paris — Arc baselines on Osaka, so this is deliberately conservative'],
    ['Runtime size', 'ArcSafe 9,754 bytes; factory 12,827 (limit 24,576)'],
    ['Test suite', '42 passing, including drain, atomicity and simulation scenarios'],
    ['Dependencies', 'None. No OpenZeppelin, no proxies, no delegatecall.'],
    ['Licence', 'MIT'],
  ];

  return (
    <section id="specs" className="scroll-mt-20 border-t border-hairline/70 py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading eyebrow="Specification" title="The details">
          Verifiable claims only. Chain ID and RPC were confirmed against a live
          <code className="mx-1 text-primary">eth_chainId</code> call, not copied from documentation.
        </SectionHeading>

        <div className="mt-12 overflow-x-auto rounded-card border border-hairline">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">ArcSafe technical specification</caption>
            <tbody className="divide-y divide-hairline">
              {rows.map(([label, value]) => (
                <tr key={label} className="bg-surface/60">
                  <th scope="row" className="w-48 px-5 py-3.5 font-medium text-muted">
                    {label}
                  </th>
                  <td className="px-5 py-3.5 text-secondary">{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

/* ── Roadmap ────────────────────────────────────────────────────── */

function RoadmapSection() {
  const groups: Array<{ title: string; note: string; items: string[] }> = [
    {
      title: 'Highest impact',
      note: 'What unblocks the most value next.',
      items: [
        'EIP-712 off-chain signature approvals — the biggest gap versus Safe',
        'Token pickers so transfers stop needing hand-encoded calldata',
      ],
    },
    {
      title: 'Assets and history',
      note: 'Contract support exists; this is interface work.',
      items: [
        'Event indexer for fast history beyond the most recent 25',
        'Activity timeline of every wallet action',
        'Notifications for pending approvals and executions',
      ],
    },
    {
      title: 'Access control',
      note: 'Finer-grained authority than a single owner set.',
      items: [
        'Roles: Owner, Executor, Observer',
        'Timelock delay on sensitive operations',
        'Configurable daily spending limits',
        'Guardian and social recovery',
        'Session keys for temporary delegated permissions',
      ],
    },
    {
      title: 'Platform',
      note: 'Extensibility without redeploying the core.',
      items: ['Modules and plugins', 'ERC-4337 account abstraction', 'Multi-chain support'],
    },
  ];

  return (
    <section id="roadmap" className="scroll-mt-20 border-t border-hairline/70 py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading eyebrow="Roadmap" title="What comes next">
          Nothing below is implemented. It is listed separately from the
          capabilities above so the two are never confused.
        </SectionHeading>

        <div className="mt-12 grid gap-4 md:grid-cols-2">
          {groups.map((group) => (
            <Card key={group.title} className="h-full">
              <h3 className="text-sm font-semibold text-primary">{group.title}</h3>
              <p className="mt-1 text-xs text-muted">{group.note}</p>
              <ul className="mt-4 space-y-2.5">
                {group.items.map((item) => (
                  <li key={item} className="flex gap-2.5 text-sm leading-relaxed text-secondary">
                    <span
                      aria-hidden="true"
                      className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-hairline-strong"
                    />
                    {item}
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>

        <div className="mt-4 rounded-lg border border-warn/30 bg-warn/8 p-5">
          <p className="text-sm font-semibold text-warn">An audit comes first</p>
          <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-secondary">
            Every item on this list widens the attack surface. None of it should
            ship before the core contract has been reviewed by a third party.
          </p>
        </div>
      </div>
    </section>
  );
}

/* ── Closing ────────────────────────────────────────────────────── */

function ClosingCta() {
  return (
    <section className="border-t border-hairline/70 py-20">
      <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
        <ArcMark size={56} />
        <h2 className="mt-6 text-3xl font-bold tracking-tight text-primary sm:text-4xl">
          Deploy one and try to break it
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-secondary">
          Create a safe with your own owners, propose a transfer, and watch the contract refuse to
          execute it until a second owner signs.
        </p>
        <div className="mt-8 flex justify-center">
          <Link href="/create/" className={linkButtonClass('primary')}>
            <ArrowRightIcon size={17} />
            Create your safe
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ── Shared ─────────────────────────────────────────────────────── */

function SectionHeading({ eyebrow, title, children }: { eyebrow: string; title: string; children?: ReactNode }) {
  return (
    <div className="max-w-2xl">
      <p className="text-2xs font-semibold uppercase tracking-[0.18em] text-accent">{eyebrow}</p>
      <h2 className="mt-3 text-3xl font-bold tracking-tight text-primary sm:text-4xl">{title}</h2>
      {children && <p className="mt-4 text-base leading-relaxed text-secondary">{children}</p>}
    </div>
  );
}
