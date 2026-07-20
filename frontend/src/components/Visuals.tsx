import { CheckIcon, ClockIcon, LockIcon, ShieldCheckIcon, UsersIcon } from './Icons';

type Tone = 'ok' | 'warn' | 'muted';

function toneClasses(tone: Tone) {
  if (tone === 'ok') return 'border-ok/35 bg-ok/12 text-ok';
  if (tone === 'warn') return 'border-warn/35 bg-warn/12 text-warn';
  return 'border-hairline bg-surface-2 text-muted';
}

export function QuorumNetworkVisual() {
  const owners = [
    { label: 'Owner 1', state: 'Proposed', tone: 'ok' as const, x: 18, y: 28 },
    { label: 'Owner 2', state: 'Approved', tone: 'ok' as const, x: 82, y: 28 },
    { label: 'Owner 3', state: 'Idle', tone: 'muted' as const, x: 50, y: 82 },
  ];

  return (
    <div className="card overflow-hidden shadow-lift">
      <div className="border-b border-hairline bg-surface-2/55 px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-primary">Live quorum model</p>
            <p className="mt-1 text-xs text-muted">2 approvals unlock execution. Rule changes use the same path.</p>
          </div>
          <span className="rounded-md border border-ok/30 bg-ok/12 px-2.5 py-1 text-xs font-medium text-ok">
            2 of 3
          </span>
        </div>
      </div>

      <div className="relative p-5">
        <svg
          viewBox="0 0 100 100"
          role="img"
          aria-label="Two owner approvals flow into the ArcSafe before execution is enabled."
          className="mx-auto aspect-square w-full max-w-[360px]"
        >
          <path d="M18 28 C32 45 39 48 50 54" className="stroke-ok" strokeWidth="1.4" fill="none" />
          <path d="M82 28 C68 45 61 48 50 54" className="stroke-ok" strokeWidth="1.4" fill="none" />
          <path d="M50 82 C50 69 50 64 50 58" className="text-muted" stroke="currentColor" strokeWidth="1" strokeDasharray="2 3" fill="none" />
          <circle cx="50" cy="55" r="17" className="fill-surface stroke-hairline-strong" strokeWidth="1.2" />
          <path
            d="M50 42l10 4v7c0 6.5-4.1 11.8-10 13.8C44.1 64.8 40 59.5 40 53v-7z"
            className="fill-accent/20 stroke-accent"
            strokeWidth="1.1"
          />
          <path d="M45.5 54l3 3 6-7" className="stroke-ok" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          {owners.map((owner) => (
            <g key={owner.label}>
              <circle
                cx={owner.x}
                cy={owner.y}
                r="10"
                className={owner.tone === 'ok' ? 'fill-ok/12 stroke-ok/60' : 'fill-surface-2 stroke-hairline'}
                strokeWidth="1.2"
              />
              <circle cx={owner.x} cy={owner.y} r="3.2" className={owner.tone === 'ok' ? 'fill-ok' : 'fill-muted'} />
            </g>
          ))}
        </svg>

        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          {owners.map((owner) => (
            <div key={owner.label} className="rounded-md border border-hairline bg-surface-2/60 p-3">
              <p className="text-xs font-medium text-primary">{owner.label}</p>
              <p className={owner.tone === 'ok' ? 'mt-1 text-xs text-ok' : 'mt-1 text-xs text-muted'}>
                {owner.state}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-3 flex items-center justify-between gap-3 rounded-md border border-ok/30 bg-ok/8 px-3 py-2.5">
          <span className="inline-flex items-center gap-2 text-sm font-medium text-ok">
            <ShieldCheckIcon size={16} />
            Execution enabled
          </span>
          <CheckIcon size={17} className="text-ok" />
        </div>
      </div>
    </div>
  );
}

export function ThresholdPreview({ owners, threshold }: { owners: string[]; threshold: number }) {
  const count = Math.max(owners.filter(Boolean).length, 1);
  const required = Math.min(Math.max(threshold, 1), count);
  const strong = required > 1 && count > 1;

  return (
    <div className="rounded-card border border-hairline bg-surface-2/55 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-primary">Threshold preview</p>
          <p className="mt-1 text-xs text-muted">How many keys must agree before funds move.</p>
        </div>
        <span className={`rounded-md border px-2.5 py-1 text-xs font-medium ${strong ? toneClasses('ok') : toneClasses('warn')}`}>
          {required} of {count}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
        {Array.from({ length: count }, (_, i) => {
          const filled = i < required;
          return (
            <span
              key={i}
              className={`flex h-14 flex-col items-center justify-center rounded-md border text-xs ${
                filled ? 'border-ok/35 bg-ok/12 text-ok' : 'border-hairline bg-base/35 text-muted'
              }`}
            >
              <UsersIcon size={15} />
              <span className="mt-1 tabular">{i + 1}</span>
            </span>
          );
        })}
      </div>

      <div className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-secondary">
        {strong ? <LockIcon size={16} className="mt-0.5 shrink-0 text-ok" /> : <ClockIcon size={16} className="mt-0.5 shrink-0 text-warn" />}
        <p>
          {strong
            ? 'This safe requires more than one owner for every transfer and every owner or threshold change.'
            : 'A one-signature threshold behaves like a normal wallet. Add owners and raise the threshold for multi-sig protection.'}
        </p>
      </div>
    </div>
  );
}

export function OperationsMap({
  owners,
  threshold,
  pending,
  ready,
}: {
  owners: number;
  threshold: number;
  pending: number;
  ready: number;
}) {
  const waiting = Math.max(pending - ready, 0);
  const columns = [
    { label: 'Owners', value: owners, tone: 'muted' as const },
    { label: 'Threshold', value: threshold, tone: 'ok' as const },
    { label: 'Waiting', value: waiting, tone: waiting ? ('warn' as const) : ('muted' as const) },
    { label: 'Executable', value: ready, tone: ready ? ('ok' as const) : ('muted' as const) },
  ];

  return (
    <div className="rounded-card border border-hairline bg-surface-2/55 p-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {columns.map((item) => (
          <div key={item.label} className={`rounded-md border p-3 ${toneClasses(item.tone)}`}>
            <p className="text-2xs uppercase tracking-wider opacity-80">{item.label}</p>
            <p className="mt-1 text-2xl font-semibold tabular">{item.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-[auto_1fr_auto_1fr_auto] items-center gap-2 text-xs text-muted">
        <span className="grid h-8 w-8 place-items-center rounded-full border border-hairline bg-base/40">1</span>
        <span className="h-px bg-hairline" />
        <span className="grid h-8 w-8 place-items-center rounded-full border border-hairline bg-base/40">2</span>
        <span className={ready ? 'h-px bg-ok' : 'h-px bg-hairline'} />
        <span className={`grid h-8 w-8 place-items-center rounded-full border ${ready ? 'border-ok/40 bg-ok/12 text-ok' : 'border-hairline bg-base/40'}`}>
          3
        </span>
      </div>
      <div className="mt-2 grid grid-cols-3 text-xs text-muted">
        <span>Propose</span>
        <span className="text-center">Approve</span>
        <span className="text-right">Execute</span>
      </div>
    </div>
  );
}
