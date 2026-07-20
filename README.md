<div align="center">

# ArcSafe

**An N-of-M multi-signature wallet for Arc — Circle's stablecoin chain.**

A [SoftNox](https://arcsafe.vercel.app) product.

Changing the owner set or the signature threshold is itself a multi-sig
transaction. No single owner can lower the bar and move funds alone.

[**Live app**](https://arcsafe.vercel.app) · [Documentation](DOCUMENTATION.md) · [Security audit](security-report.md)

![License](https://img.shields.io/badge/license-MIT-blue)
![Tests](https://img.shields.io/badge/tests-43%20passing-brightgreen)
![Network](https://img.shields.io/badge/Arc%20Testnet-5042002-1B3E63)
![Solidity](https://img.shields.io/badge/Solidity-0.8.24-363636)
![Hosted on Vercel](https://img.shields.io/badge/hosted-Vercel-black)

</div>

---

> **Status: live on Arc Testnet. Unaudited — do not custody real value.**
>
> | | |
> |---|---|
> | Live app | **https://arcsafe.vercel.app** |
> | `ArcSafeFactory` | [`0x66eB8Aa020f9625b14Fee89c7E9a16Fe62C2Dc03`](https://testnet.arcscan.app/address/0x66eB8Aa020f9625b14Fee89c7E9a16Fe62C2Dc03) |
> | Deployed | 2026-07-19, 2,821,827 gas |
> | Verified | `eth_getCode` returns 12,827 bytes, byte-for-byte identical to this repo's build |
> | Tests | 43 passing · internal audit: 0 Critical |
>
> Anyone can create their own safe through that factory. It has no owner and no
> admin functions. Testnet only — not audited, do not custody real value.

---

## Why the security model matters

The obvious way to write a multi-sig has a hole in it:

```solidity
function changeThreshold(uint256 t) external onlyOwner {
    threshold = t;
}
```

`onlyOwner` means *any one* owner. In a 2-of-3 safe, owner 1 acting alone can
call `changeThreshold(1)`, propose a transfer of the whole balance, approve it
themselves, and execute. The "2 of 3" is decorative.

ArcSafe splits the two capabilities:

| Guard | Who passes it | What it protects |
|---|---|---|
| `onlyOwner` | any single owner | propose, approve, revoke, execute |
| `onlySelf` | only `address(this)` | add/remove/swap owner, change threshold, cancel |

`onlySelf` is only reachable through `execute()`, which already enforces the
threshold. Configuration changes therefore inherit the quorum requirement by
construction rather than by convention.

Additional properties, each covered by a test:

- **Stale approvals expire.** Every owner-set or threshold change bumps
  `configVersion`. Transactions proposed under an older config revert with
  `TxStale`, so approvals can never outlive the committee that gave them.
- **Reentrancy guarded.** `executed` is set before the external call, and the
  call sits behind a lock. Verified with a hostile owner contract that tries to
  re-enter `execute()` on payout.
- **Optional expiry.** A proposal may carry a deadline.
- **O(1) approval tally.** Counted incrementally rather than by looping the
  owner array on every execution.

---

## Quick start

```bash
npm install
npm test          # 43 tests
npm run build     # compile contracts
```

Frontend:

```bash
cd frontend
npm install
npm run dev       # http://localhost:3000/arcsafe/
```

---

## Layout

```
contracts/
  ArcSafe.sol            core wallet
  ArcSafeFactory.sol     CREATE2 deployer + per-owner index
  test/Reenterer.sol     hostile contract used by the reentrancy test
scripts/
  deploy.js              deploys, then verifies bytecode actually landed
  verify-deployment.js   independently check any address
test/
  ArcSafe.test.js        43 tests
frontend/                Next.js static export
  legacy/index.html      the previous single-file UI, kept for reference
```

---

## How it is used

ArcSafe is permissionless. You deploy **one factory**, once. After that anyone
creates their own safe from the web UI, choosing their own owners.

```
you:   deploy ArcSafeFactory  ──┐
                                ├─► users create their own safes through it
anyone: /create → own owners  ──┘
```

The factory has no owner, no admin function and no upgrade path. Deploying it
grants no authority over the safes created through it — asserted by the test
`gives the factory deployer no authority over safes created through it`.

No user's address needs to appear anywhere in this repo.

---

## Deploying

```bash
# fill PRIVATE_KEY in .env first
npm run deploy:testnet
```

Copy the printed `NEXT_PUBLIC_FACTORY_ADDRESS` into `frontend/.env.local`, rebuild the frontend, and confirm independently:

```bash
SAFE=0x... npm run verify:deployment
```

### Read this before deploying

The previous deployment attempt **reverted and was reported as successful.**
Transaction
[`0xe55a6eb4…62ed7`](https://testnet.arcscan.app/tx/0xe55a6eb4f961a5406e348c2db5b45e9c3ae8a8d95794eb51605ae26d45962ed7)
shows:

```
status   0x0                      reverted
gasUsed  0x1e8480 (2,000,000)     == gas limit, i.e. out of gas
```

A contract-creation receipt carries a `contractAddress` field **whether or not
the creation succeeded**. That address (`0xB81E93…9C00`) was copied into the
README, `deployed_address.txt` and the live site — but `eth_getCode` on it
returns `0x`. There was never a contract there.

Two things now prevent a repeat:

1. `scripts/deploy.js` estimates gas up front, then re-reads `eth_getCode`
   after deploying and throws if the address is empty.
2. The frontend checks for bytecode before rendering a safe, and shows an
   explicit "No contract at this address" state instead of an empty dashboard.

The root cause was the gas limit. Code deposit alone costs 200 gas/byte, before
constructor execution, and the old contract's runtime was 9,687 bytes ≈ 1.94M
against a 2,000,000 limit.

Current sizes, measured at the live deployment:

| | Runtime | Code deposit | Deploy estimate |
|---|---|---|---|
| `ArcSafe` | 9,754 bytes | 1.95M gas | — |
| `ArcSafeFactory` | 12,827 bytes | 2.57M gas | **2,821,827 gas actual** |

The factory embeds ArcSafe's creation code, which is why it is the larger of
the two and the one that actually gets deployed. Note it needs ~2.84M gas —
**the original 2,000,000 limit would have failed here too.** The configured
limit is 6,000,000, and both contracts are far below the 24,576-byte EIP-170
cap.

### Hosting the frontend

The interface is a static export holding **no secrets** (only the public
`NEXT_PUBLIC_FACTORY_ADDRESS` is baked in), so it can be served anywhere.

**Vercel (current live host — recommended).** Free HTTPS + HSTS, and the app
serves at the domain root automatically. Security headers come from
[`frontend/vercel.json`](frontend/vercel.json).

```bash
cd frontend
vercel --prod --yes -b NEXT_PUBLIC_FACTORY_ADDRESS=0x66eB8Aa020f9625b14Fee89c7E9a16Fe62C2Dc03
```

**VPS / nginx (serves under `/arcsafe/`).** Build locally, copy `out/`, and
install [`deploy/nginx-arcsafe.conf`](deploy/nginx-arcsafe.conf), which sets the
same CSP / HSTS / X-Frame-Options headers.

Never put `PRIVATE_KEY` in any frontend host — the UI does not use it.

---

## Security

The contracts, tooling, and frontend went through an internal audit — full
findings in [`security-report.md`](security-report.md) (§14 of the
[documentation](DOCUMENTATION.md#14-security-audit)).

**Result: 0 Critical, 1 High, 1 Medium, 2 Low.** The High is the plaintext
deployer key in `.env` (gitignored; rotation is the operator's action); the
Medium (security headers) and one Low (an opaque CREATE2 collision revert) are
patched. Before sharing the repo:

```bash
npm run check:secrets   # fails if the deployer key appears outside .env
```

`.env` is gitignored and never committed. If the deployer key has ever been
shared, rotate it, and never reuse it for mainnet or a funded owner slot.

---

## Network

Arc is Circle's chain for onchain finance with stablecoins. Values below are
from [docs.arc.io](https://docs.arc.io/) and confirmed against a live node on
2026-07-19.

| | |
|---|---|
| Network | Arc Testnet |
| Chain ID | `5042002` (`0x4cef52`) |
| RPC | `https://rpc.testnet.arc.network` |
| Explorer | `https://testnet.arcscan.app` |
| Gas token | **USDC**, 18 decimals natively |
| Gas price | 21.5 Gwei observed; docs state a 20 Gwei testnet floor |
| EVM baseline | Osaka |

### Gas is paid in USDC, not "ARC"

There is no token called ARC. Arc denominates all transaction fees in USDC.
The native balance uses **18 decimals** for gas accounting and native transfers,
while the same underlying balance is also exposed through a standard 6-decimal
ERC-20 interface. This project only touches the native side, so `formatEther`
is the correct conversion — but every user-facing label says USDC.

### Arc-specific behaviour that affects this contract

- **A native transfer can revert with a sufficient balance.** Transfers to the
  zero address, to burn addresses, or to Circle-blocklisted addresses are
  rejected by the chain. `ArcSafe.submit` already refuses `address(0)`, and the
  UI explains this case when `ExecutionFailed` comes back.
- **`PREVRANDAO` returns 0.** There is no onchain randomness. ArcSafe does not
  use any.
- **Blob transactions are unsupported** and `BLOBHASH` returns 0. Not used here.
- **The base fee goes to the block beneficiary** rather than being burned.

### Corrections this replaced

The repo previously carried three conflicting chain IDs — `5042002`, `5042` and
`50420`. Only `5042002` answers. The old RPC `https://rpc-testnet-1.arc.network`
is a near-miss for the real host and returns nothing.

`evmVersion` stays at `paris` even though Arc baselines on Osaka and therefore
supports `PUSH0`. That is deliberate conservatism after one deployment was
already lost on this chain, not a compatibility requirement; raising it to
`cancun` is safe once a deployment has succeeded.

---

## Testing

```bash
npm test                    # 43 tests
REPORT_GAS=true npm test    # with gas report
npm run coverage            # coverage
```

The suite includes a `SECURITY` block that reproduces the original attack step
by step and asserts it fails at each stage — including an end-to-end attempt
where a lone owner tries to drain a funded safe, with the balance checked
afterwards.

---

## Already shipped

Listed explicitly because these appear on many multi-sig roadmaps and are done
here:

- **Transaction queue with full status model** — Awaiting approvals, Ready to
  execute, Executed, Cancelled, Expired, and *Voided by config change*. The last
  one has no equivalent in most implementations: it marks proposals whose
  approving committee no longer exists.
- **ERC-721 / ERC-1155 custody** — receiver hooks are implemented, so NFTs sent
  to a safe are accepted rather than stuck or rejected. ERC-165 is advertised.
- **Atomic batch transactions** — `submitBatch` bundles up to 32 calls into one
  proposal. Approvers see the exact ordered list via `getBatchCalls`, and a
  failure in any leg reverts the whole batch rather than leaving it half
  applied. Covered by an atomicity test that asserts a successful first leg is
  rolled back when a later one fails.
- **Simulation before signing** — the UI dry-runs `execute` with `staticCall`
  against live state and refuses to open the wallet prompt for a transaction
  that would revert, naming the failing batch leg by index. This is the
  blind-signing mitigation.
- **Gas estimation** — cost in USDC is shown before signing, estimated only
  after simulation succeeds.
- **Arbitrary contract calls** — the safe is a full account. Any ERC-20 / 721 /
  1155 transfer is already possible today via the calldata field; what is
  missing is a token-picker UI, not contract capability.
- **Expiry on proposals**, revocable approvals, and deterministic CREATE2
  addresses through the factory.

---

## Future improvements

Not started unless noted. Ordered by what actually unblocks the most value.

### Highest impact

- **EIP-712 off-chain signature approvals.** The single biggest gap versus
  Safe. Today every approval is its own on-chain transaction; with EIP-712,
  signatures are collected off-chain and submitted once at execution. Removes
  most of the gas cost and most of the coordination friction.

### Asset and history UX

- **First-class ERC-20 / ERC-721 / ERC-1155 management** — token balances,
  pickers and transfer forms, instead of hand-encoded calldata. *(Contract-side
  support already exists; this is UI work.)*
- **Event indexer** for fast history queries. History is currently read straight
  from the contract and paginated to the most recent 25 transactions, which will
  not scale.
- **Activity timeline** covering the complete history of wallet actions.
- **Notifications** for pending approvals, executions, and other events.

### Access control

- **Role-based permissions** — Owner, Executor, Observer.
- **Timelock** on sensitive operations, so a passing config change has a
  mandatory delay before it takes effect.
- **Configurable daily spending limits.**
- **Guardian / social recovery.**
- **Session keys** for temporary delegated permissions.

### Platform

- **Modules / plugins** in the style of Safe, for extensibility without
  redeploying the core contract.
- **ERC-4337 account abstraction** integration.
- **Multi-chain support** beyond Arc.

### Before any of it

- **A third-party audit.** Nothing above matters if the core is unsound, and
  every item on this list widens the attack surface. The audit should come
  before the features, not after.

---

## Licence

MIT © SoftNox.

Testnet software. Not audited. Do not custody assets of real value.

ArcSafe is a product of SoftNox.
