# ArcSafe — Full Documentation

An N-of-M multi-signature wallet for **Arc**, Circle's chain for onchain finance
with stablecoins.

> **Status: live on Arc Testnet. Unaudited. Do not custody real value.**
>
> | | |
> |---|---|
> | Live app | **https://arcsafe.vercel.app** (HTTPS, security headers, hosted on Vercel) |
> | `ArcSafeFactory` | [`0x66eB8Aa020f9625b14Fee89c7E9a16Fe62C2Dc03`](https://testnet.arcscan.app/address/0x66eB8Aa020f9625b14Fee89c7E9a16Fe62C2Dc03) |
> | Network | Arc Testnet, chain ID `5042002` |
> | Verified | 12,827 bytes on-chain, byte-for-byte identical to this repo's build |
> | Tests | 43 passing |
> | Security | Internal audit complete — 0 Critical, see [§14](#14-security-audit) and `security-report.md` |

---

## Contents

1. [The problem this solves](#1-the-problem-this-solves)
2. [How it works](#2-how-it-works)
3. [Security model](#3-security-model)
4. [Contract reference](#4-contract-reference)
5. [Frontend architecture](#5-frontend-architecture)
6. [Setup](#6-setup)
7. [Deployment](#7-deployment)
8. [Using it — step by step](#8-using-it--step-by-step)
9. [Testing](#9-testing)
10. [Arc chain specifics](#10-arc-chain-specifics)
11. [Troubleshooting](#11-troubleshooting)
12. [What is not built](#12-what-is-not-built)
13. [Change history](#13-change-history)
14. [Security audit](#14-security-audit)

---

## 1. The problem this solves

A multi-signature wallet holds funds that require **N of M** owners to agree
before anything moves. The point is that no single compromised key loses the
money.

The subtle part is not the approval counting — it is **who may change the
rules**. The obvious implementation has a hole:

```solidity
function changeThreshold(uint256 t) external onlyOwner {
    threshold = t;
}
```

`onlyOwner` means *any one* owner. In a 2-of-3 safe, owner 1 acting alone can:

```
changeThreshold(1)      → now 1 signature suffices
submit(attacker, all)   → propose taking everything
approve()  execute()    → done, alone
```

The "2 of 3" was decorative. **This exact bug shipped in v0.1 of this project.**
Everything below exists to make it impossible.

---

## 2. How it works

### The three-step flow

```
   ┌──────────┐      ┌──────────┐      ┌──────────┐
   │ PROPOSE  │ ───► │ APPROVE  │ ───► │ EXECUTE  │
   └──────────┘      └──────────┘      └──────────┘
   any owner         each owner,        any owner,
   costs gas,        revocable          only once the
   authorises        until executed     tally ≥ threshold
   nothing
```

Every rule is enforced **in the contract**, not the interface. A modified
frontend changes nothing.

### Two contracts

| Contract | Role | Deployed |
|---|---|---|
| `ArcSafeFactory` | Public infrastructure. Creates safes, indexes them by owner. No owner, no admin functions, no upgrade path. | **Once**, by anyone |
| `ArcSafe` | One per safe. Holds the funds, enforces the quorum. | Per user, via the factory |

```
you:    deploy ArcSafeFactory ──┐
                                ├──► anyone creates their own safe
users:  /create → own owners  ──┘
```

Deploying the factory grants **no authority** over safes created through it.
This is asserted by the test
`gives the factory deployer no authority over safes created through it`.

---

## 3. Security model

### The core rule

Two guards, deliberately separated:

| Guard | Passed by | Protects |
|---|---|---|
| `onlyOwner` | any single owner | propose, approve, revoke, execute |
| `onlySelf` | only `address(this)` | add/remove/swap owner, change threshold, cancel |

```solidity
modifier onlySelf() {
    if (msg.sender != address(this)) revert OnlySafe();
    _;
}
```

`onlySelf` is only reachable **through `execute()`**, which already enforces the
threshold. So configuration changes inherit the quorum requirement *by
construction* — not by remembering to add a check.

To add an owner, the safe sends a transaction **to itself**:

```
submit(to: safeAddress, data: addOwner(newOwner, newThreshold))
  → approve × threshold
  → execute
```

### Other properties

| Property | Mechanism |
|---|---|
| **Stale approvals expire** | Any owner/threshold change bumps `configVersion`. Transactions proposed under an older version revert `TxStale`. Approvals can never outlive the committee that gave them. |
| **Reentrancy guarded** | `executed = true` is written *before* the external call, and the call sits behind a `nonReentrant` lock. Tested with a hostile owner contract that re-enters on payout. |
| **Atomic batches** | A batch reverts entirely if any leg fails. No half-applied state. |
| **Optional expiry** | A proposal may carry a deadline, so a forgotten transaction cannot be resurrected months later. |
| **O(1) approval tally** | Counted incrementally on approve/revoke rather than looping owners at execution. |
| **No delegatecall** | The safe never executes foreign code in its own context. |
| **No dependencies** | No OpenZeppelin, no proxies, no libraries. Everything is auditable in one file. |

### There is deliberately no `withdraw()`

Getting money out **is** a normal proposal: `submit` → `approve` → `execute`
with your own address as destination. It therefore inherits the threshold.

A separate `withdraw()` would either require the quorum — identical to what
already exists, but more code and more attack surface — or skip it, which is
precisely the drain bug above wearing a different name.

Asserted by `withdrawing funds requires the same quorum as any other spend`.

### Funding on execute is safe

`execute` is `payable`, so an underfunded proposal can be topped up in the same
transaction that spends it. This grants no new authority: **value only ever
flows into the safe**, and the threshold check is untouched. Two tests pin this:

```
✔ SECURITY: attaching funds does not bypass the threshold
✔ SECURITY: a non-owner cannot execute even while funding it
```

---

## 4. Contract reference

### `ArcSafe`

#### Proposal lifecycle

| Function | Guard | Notes |
|---|---|---|
| `submit(address to, uint256 value, bytes data, uint64 expiresAt) → uint256` | `onlyOwner` | Returns `txId`. `expiresAt = 0` means no expiry. Rejects `to == address(0)`. |
| `submitBatch(Call[] calls, uint64 expiresAt) → uint256` | `onlyOwner` | Up to **32** calls, executed atomically. |
| `approve(uint256 txId)` | `onlyOwner` | One approval per owner. |
| `revoke(uint256 txId)` | `onlyOwner` | Valid right up until execution. |
| `execute(uint256 txId) payable → bytes` | `onlyOwner` + `nonReentrant` | Requires `approvals ≥ threshold`. Any attached value is added to the safe first. |
| `cancel(uint256 txId)` | `onlySelf` | Requires quorum, like any config change. |

```solidity
struct Call { address to; uint256 value; bytes data; }
```

#### Configuration — quorum only

| Function | Guard |
|---|---|
| `addOwner(address owner, uint256 newThreshold)` | `onlySelf` |
| `removeOwner(address owner, uint256 newThreshold)` | `onlySelf` |
| `swapOwner(address oldOwner, address newOwner)` | `onlySelf` |
| `changeThreshold(uint256 newThreshold)` | `onlySelf` |

All four bump `configVersion`, invalidating pending proposals.

#### Views

| Function | Returns |
|---|---|
| `getOwners()` | `address[]` |
| `ownerCount()` | `uint256` |
| `isOwner(address)` | `bool` |
| `threshold()` | `uint256` |
| `txCount()` | `uint256` |
| `configVersion()` | `uint96` |
| `hasApproved(uint256 txId, address owner)` | `bool` |
| `isExecutable(uint256 txId)` | `bool` — the single source of truth for "can this run now" |
| `getTransaction(uint256 txId)` | `TxView` struct |
| `getBatchCalls(uint256 txId)` | `Call[]` — the exact list an approver agreed to |
| `batchLength(uint256 txId)` | `uint256` |

```solidity
struct TxView {
    address to; uint256 value; bytes data;
    uint64 expiresAt; uint32 approvals;
    bool executed; bool cancelled; bool stale;
    address proposer; bool isBatch; uint256 callCount;
}
```

> Returned as a struct rather than eleven separate values: that many returns
> exhausts the EVM stack ("stack too deep"), and named fields are far harder to
> mis-decode on the client than positional ones.

#### Token custody

`onERC721Received`, `onERC1155Received`, `onERC1155BatchReceived`,
`supportsInterface` — NFTs sent to a safe are accepted, not stuck or rejected.

#### Errors

Every failure is a named custom error. **These must be declared in any client
ABI** or ethers reports the useless `execution reverted (unknown custom error)`.

| Error | Meaning |
|---|---|
| `NotOwner()` | Caller is not an owner |
| `OnlySafe()` | Config change attempted directly instead of via quorum |
| `BelowThreshold()` | Not enough approvals yet |
| `AlreadyApproved()` / `NotApproved()` | Duplicate approve / revoke without approval |
| `TxNotFound()` / `TxAlreadyExecuted()` / `TxCancelled()` / `TxExpired()` | Lifecycle states |
| `TxStale()` | Owners or threshold changed after this was proposed |
| `InvalidOwner()` / `DuplicateOwner()` / `InvalidThreshold()` / `OwnerCountBelowThreshold()` / `NoOwners()` | Configuration validation |
| `ZeroTarget()` | Destination is `address(0)` |
| `Reentrancy()` | Re-entrant `execute` blocked |
| `ExecutionFailed(bytes reason)` | The destination call reverted |
| `EmptyBatch()` / `BatchTooLarge()` | Batch must be 1–32 calls |
| `BatchCallFailed(uint256 index, bytes reason)` | Which leg of a batch failed |

#### Events

`Deposited`, `Submitted`, `BatchSubmitted`, `Approved`, `Revoked`, `Executed`,
`Cancelled`, `OwnerAdded`, `OwnerRemoved`, `OwnerSwapped`, `ThresholdChanged`,
`ConfigVersionBumped`.

### `ArcSafeFactory`

| Function | Notes |
|---|---|
| `createSafe(address[] owners, uint256 threshold, bytes32 salt) → address` | CREATE2. Salt is namespaced by `msg.sender` so nobody can front-run your address. Pre-checks the target address and reverts `SafeAlreadyExists()` on a collision, rather than the opaque EVM revert. |
| `predictAddress(address deployer, address[] owners, uint256 threshold, bytes32 salt) → address` | Compute the address before paying. Shares the internal `_predict` helper with `createSafe`, so the guard and the predictor can never drift. |
| `safesOf(address owner) → address[]` | Discovery hint — membership at creation time. Read `isOwner()` on the safe for truth. |
| `safeCount() → uint256` | |
| `allSafes(uint256 offset, uint256 limit) → address[]` | Paginated. |

Errors: `NoOwners()`, `SafeAlreadyExists()` — both declared in the frontend
`FACTORY_ABI` and mapped by `humanizeError`, so a factory revert reads as a
sentence rather than `unknown custom error`.

---

## 5. Frontend architecture

Next.js 14, pages router, **static export** (`output: 'export'`), served from
`/arcsafe/`.

```
frontend/src/
├── pages/
│   ├── index.tsx      landing — security model, specs, roadmap
│   ├── create.tsx     deploy your own safe via the factory
│   └── app.tsx        dashboard — funds, owners, proposals, execution
├── lib/
│   ├── config.ts      chain config + ABIs (including custom errors)
│   ├── wallet.ts      MetaMask connection, network switching
│   ├── useSafe.ts     reads a safe; verifies bytecode before trusting it
│   ├── useFactory.ts  create + "my safes" discovery
│   ├── simulate.ts    dry-run execute before signing
│   ├── format.ts      USDC formatting, error humanising
│   └── useMounted.ts  hydration guard for wallet-dependent pages
└── components/
    ├── Logo.tsx       Arc mark, drawn as vector
    ├── Icons.tsx      SVG icon set — no emoji
    ├── ui.tsx         Button, Card, Field, Badge, Callout, Stat
    ├── Visuals.tsx    quorum diagram, threshold preview
    └── Shell.tsx      header, footer

frontend/
├── tailwind.config.js   design tokens (see below)
├── src/globals.css      base layer, grid, metallic headline
├── vercel.json          security headers for Vercel hosting
└── ../deploy/nginx-arcsafe.conf   equivalent headers for a VPS
```

### Design system — derived from the mark

The palette is taken directly from the Arc logo: a silver-to-white arch on a
deep navy field. Every component references a **semantic token**
(`bg-surface`, `text-secondary`, `text-accent`), never a raw hex, so a retheme
is a single change in `tailwind.config.js`.

| Token | Value | Role |
|---|---|---|
| `base` → `surface-3` | `#060D18` → `#1B2A40` | Navy surfaces, dark to light |
| `primary` / `secondary` / `muted` | `#E9F0F8` / `#9BB0C7` / `#7C90A8` | Cool-silver type |
| `silver` (light/DEFAULT/dark) | `#FFFFFF` / `#DCE7F2` / `#8FA5BD` | The arch gradient |
| `accent` (DEFAULT/strong/dim) | `#6BA5DC` / `#4A87C4` / `#12314F` | Steel blue |
| `ok` / `warn` / `danger` | `#4FD1A0` / `#F0B84B` / `#F0717A` | Semantic state |

All type/accent pairs are WCAG-AA verified against the navy base (ratios noted
in `tailwind.config.js`). The `.text-arch` headline uses a narrow near-white
gradient clipped to the text for the logo's metallic sheen, with a solid
fallback for forced-colours and print.

### Design decisions worth knowing

**Reads never go through the wallet.** All contract reads use a direct
`JsonRpcProvider` against Arc. If reads went through MetaMask and the user was
on another network, a perfectly good safe would report "no contract".

**Bytecode is checked before trusting any address.** An address with no code
answers every `eth_call` with `0x`, which ethers decodes as empty rather than
throwing — so a dead address renders as a safe with zero owners and no error.
This is the exact failure that went unnoticed for weeks in v0.1.

**Simulation before signing.** `execute.staticCall` runs against live state
first. A transaction that would revert never reaches the wallet prompt, and the
failing batch leg is named by index. This is the blind-signing mitigation.

**Colour never carries meaning alone.** Every status has an icon and a word.

---

## 6. Setup

Requires Node 18+.

```bash
git clone <repo> && cd arcproject
npm install

cd frontend && npm install && cd ..
```

Copy the env templates:

```bash
cp .env.example .env
cp frontend/.env.example frontend/.env.local
```

`.env` (contracts — **secret**, gitignored):

```ini
PRIVATE_KEY=0x...                                  # deployer only
ARC_TESTNET_RPC=https://rpc.testnet.arc.network
DEPLOY_DEMO_SAFE=false
```

`frontend/.env.local` (**public** — baked into the bundle, addresses only):

```ini
NEXT_PUBLIC_FACTORY_ADDRESS=0x66eB8Aa020f9625b14Fee89c7E9a16Fe62C2Dc03
NEXT_PUBLIC_SAFE_ADDRESS=
BASE_PATH=/arcsafe
```

Run it:

```bash
cd frontend
npm run dev      # http://localhost:3000/arcsafe/
```

---

## 7. Deployment

A factory is already live, so **most people never need this**. To deploy your
own:

```bash
npm run deploy:testnet
SAFE=0x... npm run verify:deployment    # independent check
```

The script estimates gas up front, then re-reads `eth_getCode` after deploying
and **throws if the address is empty**.

### Why that check exists

The original deployment **reverted and was reported as successful**:

```
status   0x0                      reverted
gasUsed  0x1e8480 (2,000,000)     == gas limit → out of gas
```

A contract-creation receipt carries a `contractAddress` field **whether or not
creation succeeded**. That address went into the README, `deployed_address.txt`
and the live site — while `eth_getCode` returned `0x`. There was never a
contract there.

**Never trust an address until `eth_getCode` is non-empty.**

Current sizes:

| | Runtime | Deploy gas |
|---|---|---|
| `ArcSafe` | 9,754 bytes | — |
| `ArcSafeFactory` | 12,827 bytes | 2,821,827 |

The factory embeds ArcSafe's creation code, which is why it is larger. Note it
needs ~2.82M gas — **the original 2,000,000 limit would have failed here too.**
Configured limit is 6,000,000. EIP-170 caps runtime at 24,576 bytes.

### Hosting the frontend

The interface is a static export — it holds **no secrets** (only the public
`NEXT_PUBLIC_FACTORY_ADDRESS` is baked in), so it can be served anywhere. Two
supported targets:

**Vercel (current live deployment — recommended).** Free HTTPS + HSTS, and the
`basePath` resolves to the domain root automatically (Next sets `VERCEL=1` at
build time; the gitignored `.env.local` that pins `/arcsafe` locally is not
uploaded). Security headers come from `frontend/vercel.json`.

```bash
cd frontend
vercel                # first run: log in, links the project
vercel --prod --yes -b NEXT_PUBLIC_FACTORY_ADDRESS=0x66eB8Aa020f9625b14Fee89c7E9a16Fe62C2Dc03
```

- Set `NEXT_PUBLIC_FACTORY_ADDRESS` in Vercel's project env (or pass it with
  `-b` as above) — `.env.local` is not uploaded.
- **Never** put `PRIVATE_KEY` in Vercel. The frontend does not use it.
- Leave `BASE_PATH` unset so the app serves at root.

**VPS / nginx (serves under `/arcsafe/`).** Build locally, copy `out/`, install
the provided server block, which sets the same CSP/HSTS/X-Frame-Options headers:

```bash
BASE_PATH=/arcsafe npm --prefix frontend run build
rsync -a frontend/out/ user@host:/var/www/arcsafe/
# then install deploy/nginx-arcsafe.conf and reload nginx (steps in the file)
```

Verify either target:

```bash
curl -sI https://<host>/ | grep -iE 'content-security-policy|strict-transport-security|x-frame-options'
```

### Secret hygiene

Before sharing or committing the repo, run the guard:

```bash
npm run check:secrets    # fails if the .env key appears anywhere but .env
```

`.env` (with the deployer key) is gitignored and lives at the repo root —
outside `frontend/`, so a frontend deploy never uploads it. Rotate the key if it
has ever been shared, and never reuse it for mainnet or a funded owner slot.

---

## 8. Using it — step by step

### Prepare

**Add Arc Testnet to MetaMask:**

| Field | Value |
|---|---|
| Network name | Arc Testnet |
| RPC URL | `https://rpc.testnet.arc.network` |
| Chain ID | `5042002` |
| Currency symbol | `USDC` |
| Explorer | `https://testnet.arcscan.app` |

**Get testnet USDC:** https://faucet.circle.com

Create **three** accounts in MetaMask and fund at least two — a real multi-sig
test needs more than one signer.

### Create a safe

`/arcsafe/create/` → connect → enter owners → pick threshold → **Create**.

Prefer **2-of-3** over 2-of-2. With 2-of-2, losing either key freezes the safe
permanently, because changing the owners itself needs both signatures.

### Fund it

On the dashboard, use **Add funds**. The destination is filled in from the safe
you loaded — you never copy an address, which is where typos and clipboard
hijacking bite.

> No contract on any EVM chain can pull funds from your wallet without your
> signature. That is a protection, not a limitation. A deposit is always a
> transfer you approve.

### Move money

1. **Propose** — destination, amount, optional calldata, optional expiry
2. **Approve** — as each owner. Switch accounts in MetaMask
3. **Execute** — enabled only once the tally reaches the threshold

With only one approval on a 2-of-N safe, Execute is **refused**:
`Not enough approvals yet — 1 of 2`. That refusal is the entire product.

### Batches

Click **Add another call** to add legs. The card retitles to
"Propose a batch (N calls)" with an *Atomic* badge and a running total.

All legs succeed or none do. If any would fail, simulation catches it, names the
leg, and your wallet never opens.

### Change owners

Owner changes are proposals like any other. Propose a call to the safe's **own
address** with `addOwner` / `removeOwner` / `swapOwner` / `changeThreshold`
calldata, then approve and execute.

Note this invalidates every pending proposal (`TxStale`) — by design, since
those approvals came from a committee that no longer exists.

---

## 9. Testing

```bash
npm test                    # 43 tests
REPORT_GAS=true npm test    # with gas report
npm run coverage
```

| Suite | Covers |
|---|---|
| `deployment` | Constructor validation, duplicates, zero address, bad thresholds |
| `SECURITY: a single owner cannot act alone` | The original drain attack, end to end |
| `transaction lifecycle` | Submit, approve, revoke, execute, expiry, revert surfacing |
| `funding on execute` | Payable execute, excess handling, threshold still enforced |
| `batch transactions` | Atomicity, simulation, tuple encoding, bounds |
| `configuration through the multi-sig` | Owner changes, stale invalidation |
| `reentrancy` | Hostile owner contract re-entering on payout |
| `ArcSafeFactory` | CREATE2, indexing, salt scoping, deployer has no authority, duplicate-deploy reverts `SafeAlreadyExists` |

Two tests are worth singling out:

**`THE ATTACK: a lone owner cannot drain the safe end to end`** — walks the
original exploit step by step against a funded safe and checks the balance
afterwards.

**`accepts the positional tuple encoding the frontend sends`** — the UI encodes
batch calls as `[to, value, data]` arrays. Solidity structs are positional, so
swapping two fields would send funds to the wrong address with TypeScript
perfectly happy. Only a round trip catches that.

---

## 10. Arc chain specifics

Verified against a live node on 2026-07-19 and [docs.arc.io](https://docs.arc.io/).

| | |
|---|---|
| Chain ID | `5042002` (`0x4cef52`) |
| RPC | `https://rpc.testnet.arc.network` |
| Explorer | `https://testnet.arcscan.app` |
| Gas token | **USDC**, 18 decimals natively |
| Gas price | ~21.5 Gwei; docs state a 20 Gwei testnet floor |
| EVM baseline | Osaka |

### Gas is paid in USDC — there is no "ARC" token

Arc denominates all fees in USDC. The native balance uses **18 decimals** for
gas accounting and native transfers, while the same balance is also exposed
through a 6-decimal ERC-20 interface. This project only touches the native
side, so `formatEther` is correct — but every label says USDC.

### Behaviour that affects this contract

- **A native transfer can revert with a sufficient balance.** Transfers to the
  zero address, burn addresses, or Circle-blocklisted addresses are rejected by
  the chain. `submit` already refuses `address(0)`, and the UI explains the
  blocklist case on `ExecutionFailed`.
- **`PREVRANDAO` returns 0** — no onchain randomness. Not used here.
- **Blob transactions unsupported**, `BLOBHASH` returns 0. Not used here.
- **Base fee goes to the block beneficiary** rather than being burned.

### ⚠️ Arc's RPC does not support JSON-RPC batching

**This is not in Arc's documentation.** Ethers groups concurrent calls into one
batched request by default. Arc returns those without data, and ethers reports
`missing revert data` — so every `Promise.all` of contract reads fails.

Every provider in this project sets:

```ts
new JsonRpcProvider(url, chainId, { staticNetwork: true, batchMaxCount: 1 })
```

If you write new client code against Arc, **do this or your reads will fail
intermittently and confusingly.**

---

## 11. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `missing revert data` | Arc rejects batched JSON-RPC | `batchMaxCount: 1` on the provider |
| `execution reverted (unknown custom error)` | Custom errors not declared in the client ABI | Add the `error ...` entries to your ABI |
| `No contract at this address` | Address holds no bytecode — deployment reverted, or wrong address | Check `eth_getCode`; redeploy with adequate gas |
| Dashboard stuck on loading skeleton | Corrupted `.next` | `rmdir /s /q .next` then `npm run dev` |
| `missing required error components` | A production build is sitting in `.next` | Same — clear `.next`. Never run `next build` while `next dev` is running |
| `'rm' is not recognized...` | Unix command in Windows CMD | `rmdir /s /q .next`, or PowerShell `Remove-Item -Recurse -Force .next` |
| `Port 3000 is in use` | Another dev server running | Kill it, or accept the offered port |
| Deploy fails `No signer` | `PRIVATE_KEY` empty or you edited the wrong copy | Check `D:\arcproject\.env`, not the VPS copy |
| `PRIVATE_KEY must be 0x + 64 hex` | Truncated paste, quotes, or missing `0x` | Re-paste cleanly |
| `insufficient funds for gas` | Deployer has no USDC | https://faucet.circle.com |
| Transaction says it will fail, safe has 0 balance | The safe is empty | Use **Add funds**, or the one-click *Add N USDC and execute* |
| `BASE_PATH` becomes a Windows path | Git Bash rewrites leading slashes | Use the default, or prefix `MSYS_NO_PATHCONV=1` |

---

## 12. What is not built

Stated plainly so nothing here is overclaimed.

**No third-party audit.** Everything below widens the attack surface; none of it
should ship before the core is reviewed.

| Not built | Note |
|---|---|
| EIP-712 off-chain signatures | The biggest gap versus Safe. Every approval is currently its own on-chain transaction. |
| Token pickers (ERC-20/721/1155 UI) | Contract support exists; transfers work today via calldata. |
| Event indexer | History is read straight from the contract, capped at the most recent 25. |
| Activity timeline, notifications | — |
| Roles (Owner/Executor/Observer) | — |
| Timelock on sensitive operations | — |
| Daily spending limits | — |
| Guardians / social recovery | Deliberately deferred — delegated-authority features are where multi-sigs get drained. |
| Session keys | Same. |
| Modules / plugins | Same, more so: arbitrary code execution surface. |
| ERC-4337 | Needs bundler infrastructure. |
| Multi-chain | Needs per-chain deployments. |

---

## 13. Change history

Every item below was found by running the real thing, not by reading code.

| Fixed | What it was |
|---|---|
| **Drainable contract** | `addOwner`/`removeOwner`/`changeThreshold` were `onlyOwner`. Any single owner could set the threshold to 1 and take everything. Now `onlySelf`. |
| **Deployment that never happened** | v0.1's deploy tx reverted out of gas (`status 0x0`), yet its address was published everywhere. `eth_getCode` returned `0x`. |
| **Wrong chain config** | Three conflicting chain IDs (`5042002`, `5042`, `50420`) and a dead RPC host. Only `5042002` answers. |
| **Wrong currency** | Everything was labelled "ARC". Arc's gas token is USDC. The maths was right (18 decimals natively); the labels were not. |
| **RPC batching** | Arc rejects batched JSON-RPC; every `Promise.all` read failed with `missing revert data`. |
| **Undecodable errors** | Custom errors were missing from the client ABI, so every revert read `unknown custom error`. |
| **Infinite render loop** | A `BrowserProvider` constructed during render changed identity every render, retriggering the effect that set state. |
| **Invalid HTML** | `<button>` nested inside `<a>` — the header CTA silently did not render. |
| **Vulnerable artifacts on disk** | `build/` held compiled, deployable bytecode of the pre-fix drainable contract. Removed. |
| **Unreachable feature** | `submitBatch` shipped in the contract with no UI to create a batch. |
| **Bad checksum** | An owner address failed EIP-55 validation and had been sitting in the deploy script unnoticed. |
| **Opaque CREATE2 collision** | A repeat `createSafe` reverted with no decodable reason. Now pre-checked and reverts `SafeAlreadyExists()` (SEC-004). |
| **Missing security headers** | No CSP/HSTS/X-Frame-Options were served. Added via `vercel.json` and `deploy/nginx-arcsafe.conf` (SEC-002). |
| **Plaintext-key exposure risk** | Added `npm run check:secrets` guard; confirmed the key appears only in `.env` (SEC-001). |

Also this cycle: the UI was rethemed to the logo palette (navy + metallic
silver), and the frontend was deployed to production on Vercel at
**https://arcsafe.vercel.app** with HTTPS and full security headers.

---

## 14. Security audit

An internal audit (see `security-report.md` / `security-report.json`) reviewed
the contracts, deploy tooling, and frontend. **Result: 0 Critical, 1 High,
1 Medium, 2 Low.** The contracts were found sound — the drain bug is fixed,
reentrancy is guarded, batches are atomic, config changes invalidate stale
approvals, and salts are front-run-scoped.

| ID | Sev | Finding | Status |
|---|---|---|---|
| SEC-001 | High | Deployer private key in cleartext in `.env` | Mitigated — leak-scan clean + `check:secrets` guard; **rotation is owner-only** |
| SEC-002 | Medium | No CSP / security headers; site was HTTP | **Patched** — `vercel.json` + nginx config; HTTPS live on Vercel |
| SEC-003 | Low | No third-party audit | Accepted — commission one before mainnet |
| SEC-004 | Low | Opaque CREATE2 collision revert | **Patched** — named `SafeAlreadyExists` + test |

Open owner actions: rotate the deployer key if ever shared; commission an
external audit before mainnet; redeploy the factory to carry the SEC-004 fix
on-chain (existing safe addresses are unaffected).

Re-run the checks yourself:

```bash
npm test               # 43 passing
npm run check:secrets  # no key outside .env
curl -sI https://arcsafe.vercel.app/ | grep -i content-security-policy
```

---

## Licence

MIT © SoftNox.

**Testnet software. Not audited. Do not custody assets of real value.**

*ArcSafe is a product of SoftNox.*
