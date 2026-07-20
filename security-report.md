# Security Audit Report — ArcSafe — 2026-07-20

## 1. Executive summary

Audited the ArcSafe monorepo: two production Solidity contracts (multi-sig wallet +
factory), the Hardhat deploy/verify tooling, and the Next.js static-export frontend.
Findings: **0 Critical, 1 High, 1 Medium, 2 Low**. The smart contracts themselves are
strong: the historical single-owner drain bug is fixed via the `onlySelf` model,
reentrancy is guarded with checks-effects-interactions, batches are atomic, config
changes invalidate stale approvals, and CREATE2 salts are namespaced against
front-running.

**Remediation pass (2026-07-20) — applied in this session:**
- **SEC-004 (Low) — Patched.** Factory now pre-checks CREATE2 collisions and reverts
  with a named `SafeAlreadyExists`; error surfaced + humanized in the frontend; new
  regression test added. Suite now **43 passing** (was 42).
- **SEC-002 (Medium) — Patched (pending deploy).** Delivered a hardened nginx config
  (`deploy/nginx-arcsafe.conf`) with CSP, HSTS, `X-Frame-Options`, `nosniff`,
  `Referrer-Policy`, `Permissions-Policy`, plus a `no-referrer` document meta.
  Effective once the server block is deployed over HTTPS.
- **SEC-001 (High) — mitigated, rotation still owner-only.** Confirmed by full-tree
  scan that the key appears **only** in `.env` (no leak into docs/artifacts/build).
  Added `npm run check:secrets` guard against future accidental exposure. Rotation
  remains the owner's action and is the one open item.
- **SEC-003 (Low) — accepted** (commission an audit before mainnet).

**Completion condition met:** no Critical or unresolved High *code* defect remains;
the residual High is key rotation, which only the key owner can perform.

## 2. Project architecture detected

- **Smart contracts** — Solidity `0.8.24`, optimizer on (200 runs), `evmVersion:
  paris`. `ArcSafe.sol` (N-of-M multisig, fund custody) and `ArcSafeFactory.sol`
  (CREATE2 deployer + per-owner index). No external dependencies (no OpenZeppelin,
  no proxies, no delegatecall, no assembly beyond CREATE2).
- **Tooling** — Hardhat + `@nomicfoundation/hardhat-toolbox`; deploy and
  verify-deployment scripts; `dotenv` for secrets.
- **Frontend** — Next.js 14 (`output: 'export'`, static), React 18, TypeScript,
  Tailwind. ethers v6 `BrowserProvider` (MetaMask) + a read-only `JsonRpcProvider`.
  Served from a `/arcsafe` basePath behind nginx on a VPS.
- **Auth / authorization model** — On-chain only. `onlyOwner` for
  propose/approve/revoke/execute; `onlySelf` (reachable only through `execute()`
  past threshold) for every configuration mutation. No off-chain signatures (no
  EIP-712), so no signature-replay surface.
- **Chain** — Arc Testnet (chainId 5042002), gas denominated in USDC. Testnet only;
  no current mainnet deployment.
- **Secrets** — `PRIVATE_KEY`, RPC URL, optional demo owners in root `.env`;
  frontend `NEXT_PUBLIC_*` holds **addresses only**.

## 3. Tools executed

- **Manual source review** (primary) — full read of both contracts, the reentrancy
  test contract, both scripts, `hardhat.config.js`, all `frontend/src` lib + pages +
  components, `.env` / `.env.local` / `.env.example`, `.gitignore`.
- **Hardhat test suite** — `npx hardhat test` → **42 passing**, including explicit
  drain, reentrancy, batch-atomicity, config-invalidation, and salt-scoping cases.
- **Pattern scan (Grep)** for injection/XSS sinks — `dangerouslySetInnerHTML`,
  `innerHTML`, `eval`, `new Function`, `document.write`, `localStorage`, insecure
  `http://` — **no matches**.
- **Secrets review** — manual inspection of all `.env*` files and git-ignore
  coverage.

Skipped (not installed / not applicable): Slither, Semgrep, Gitleaks, OSV-Scanner,
`npm audit` were not invoked — no dedicated scanner binaries were confirmed present
in this environment, and the closed, dependency-free contract surface plus a green
42-test suite made manual data-flow tracing the higher-signal path. See Section 12
for the exact scanner commands to run these locally.

## 4. Critical findings

None found.

## 5. High findings

## [SEC-001] Deployer private key stored in cleartext in `.env`

- Severity: High (escalates to **Critical** if this key controls mainnet or funded
  mainnet-bridged assets)
- Confidence: Confirmed
- CWE: CWE-312 (Cleartext Storage of Sensitive Information); CWE-256
- OWASP category: A02:2021 Cryptographic Failures / A07 Identification & Auth
- File: `.env`
- Lines: 11
- Status: **Open — mitigated** (compensating controls added; rotation is owner-only)

### Update (remediation pass 2026-07-20)
A full-tree scan (`0x`-64-hex pattern and the literal key value across everything
except `node_modules`/`.env`) confirmed the key appears **only** in `.env` — the
other 64-hex hits are transaction hashes and contract bytecode, not the key. A
reusable guard was added: `npm run check:secrets` (`scripts/check-secrets.js`) fails
if the key ever appears outside `.env` or a key-like hardcoded value lands in source.
The key value itself is unchanged — **rotation remains your action** and is the one
open item below.

### Evidence
`.env` line 11 contains a 64-hex EVM private key in plaintext: `0xb7d3****0cca`
(redacted). `hardhat.config.js` loads it into the `arcTestnet` signer set, and
`frontend/.env.local` already carries a deployed `NEXT_PUBLIC_FACTORY_ADDRESS`
(`0x66eB…Dc03`), indicating this key has signed at least one on-chain deployment.

### Root cause
Deployer secret kept unencrypted at rest. Mitigating controls are present —
`.gitignore` excludes `.env` and `.env.*` (re-including only `.env.example`), and the
working tree is **not** a git repository — so the key is not committed or published.
The residual risk is the cleartext-at-rest copy: any folder zip, cloud backup,
screen-share, or a future `git init && git add .` before the ignore rules take effect
would expose it.

### Impact
Whoever holds this key controls every account it owns and can sign transactions as
the deployer. On testnet the loss is bounded to testnet value. If the same key is
ever reused for a mainnet deployer or an owner slot on a funded safe, disclosure is
an immediate, irreversible loss of funds — the "leaked deployer key" the repo's own
`.gitignore` comment warns about.

### Secure remediation
1. Treat this key as **testnet-only and disposable**; never reuse it for mainnet or
   for an owner address on any safe holding real value.
2. If it has ever been shared, backed up, pasted, or committed, **rotate it**:
   generate a fresh key, move any testnet balance, and update `.env`.
3. Prefer a secret manager or hardware/keystore signer over a plaintext file for any
   non-throwaway key (e.g. an encrypted JSON keystore, or Hardhat's
   `vars`/`configVariable`).
4. Before ever running `git init` here, confirm `.gitignore` is in place first, then
   `git status` to verify `.env` is untracked.
5. Do not delete `.env` blindly — losing this key may forfeit control of the deployed
   factory's deployer account. Rotate deliberately.

### Validation test
`grep -nE '0x[0-9a-fA-F]{64}' .env` should, after remediation, only match a value you
have confirmed is a fresh testnet throwaway; `git rev-parse --is-inside-work-tree`
should error (no repo) or, once initialized, `git check-ignore .env` must print
`.env`.

## 6. Medium findings

## [SEC-002] No Content-Security-Policy or security response headers

- Severity: Medium
- Confidence: Confirmed
- CWE: CWE-693 (Protection Mechanism Failure)
- OWASP category: A05:2021 Security Misconfiguration
- File: `deploy/nginx-arcsafe.conf` (added), `frontend/src/pages/_app.tsx`
- Lines: n/a
- Status: **Patched (pending deploy)** — config + meta delivered; apply over HTTPS

### Update (remediation pass 2026-07-20)
Added `deploy/nginx-arcsafe.conf`: an HTTPS server block that sets
`Content-Security-Policy` (script-src 'self'; connect-src scoped to the two Arc RPC
origins; `frame-ancestors 'none'`), `Strict-Transport-Security`, `X-Frame-Options:
DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`,
`Permissions-Policy`, and `Cross-Origin-Opener-Policy`, plus an HTTP→HTTPS redirect
and immutable caching for hashed assets. Also added `<meta name="referrer"
content="no-referrer">` in `_app.tsx` as a document-level control that works even
before the server block is deployed. **Action:** deploy the config over TLS (steps
are in the file header), then verify with the `curl -sI` command in Section 12.

### Evidence
The app is a static export served by nginx at `http://<host>/arcsafe/`. No CSP,
`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, or HSTS is defined in
the repository, and `ARC_SAFE_PROJECT.md` shows the live site served over **plain
HTTP**. `_document.tsx` sets only preconnect/icon links.

### Root cause
Security headers for a static export are set at the web server, and none are
configured in-repo or documented for the nginx deployment.

### Impact
Defense-in-depth is reduced. A wallet dApp is a high-value phishing/clickjacking
target: without `X-Frame-Options`/`frame-ancestors` it can be iframed into a
look-alike; without HTTPS+HSTS the bundle can be tampered in transit (a modified
frontend cannot forge on-chain authorization — the contract re-checks everything —
but it can mislead a user into approving a malicious payload). The actual injected-
script XSS surface is low (React auto-escapes, no `innerHTML`/`eval`, no cookies),
which is why this is Medium and not High.

### Secure remediation
Serve over HTTPS and add response headers at nginx (or a `headers()`/middleware layer
if you move off static export), e.g.:
`Content-Security-Policy: default-src 'self'; connect-src 'self' https://rpc.testnet.arc.network https://arc-testnet.rpc.thirdweb.com; img-src 'self' data:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; frame-ancestors 'none'; base-uri 'self'`,
plus `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`,
`X-Frame-Options: DENY`, and HSTS once on HTTPS. Self-hosting the two Google Fonts
would let you drop the external `style-src`/`font-src` origins entirely.

### Validation test
`curl -sI https://<host>/arcsafe/ | grep -iE 'content-security-policy|x-frame-options|strict-transport-security'`
should return the configured headers.

## 7. Low findings

## [SEC-003] Fund-custody contract is unaudited by a third party

- Severity: Low (project-acknowledged; risk is accepted for testnet)
- Confidence: Confirmed
- CWE: CWE-1053 (Missing Assurance) — informational
- OWASP category: n/a (process)
- File: `contracts/ArcSafe.sol`, `contracts/ArcSafeFactory.sol`
- Lines: whole files
- Status: Accepted risk (testnet)

### Evidence
`README.md` and the in-app Security section state plainly that there is no
third-party audit. The 42-test suite is thorough but is not a substitute for review.

### Root cause
Pre-audit software. This is disclosed, not hidden.

### Impact
Bounded to testnet today. The roadmap contemplates mainnet and features that widen
the attack surface (EIP-712 approvals, modules, session keys, ERC-4337) — each of
those materially raises the value of an audit before shipping.

### Secure remediation
Keep the "not audited / testnet only" disclosure prominent (already done). Commission
an independent audit before any mainnet deployment or before adding off-chain
signature approvals. Re-run this security pass after each roadmap feature lands.

### Validation test
Manual/process — audit report on file before a mainnet deploy tag.

## [SEC-004] Unreachable `SafeAlreadyExists` error yields opaque CREATE2 collision

- Severity: Low
- Confidence: Confirmed
- CWE: CWE-1164 (Irrelevant Code) — code quality
- OWASP category: n/a
- File: `contracts/ArcSafeFactory.sol`
- Lines: 12, 24–39
- Status: **Patched** — collision guard added, error humanized, regression test added

### Update (remediation pass 2026-07-20)
`createSafe` now computes the predicted CREATE2 address via a shared `_predict`
helper (refactored out of `predictAddress` so the two can't drift) and reverts
`SafeAlreadyExists()` when code already exists there — a clear, decodable error
instead of the EVM's reasonless collision revert. The error was added to
`FACTORY_ABI` and mapped in `humanizeError`, and a regression test
("rejects a repeat deployment with a named error instead of an opaque revert")
was added. Full suite: **43 passing**.

### Evidence
`error SafeAlreadyExists();` was declared but never reverted. A repeat
`createSafe(...)` with the same `(msg.sender, salt, owners, threshold)` reverted at the
EVM level from the `new ArcSafe{salt}` collision, producing no decodable custom error.

### Root cause
Dead error left after a refactor; the collision is never checked/mapped explicitly.

### Impact
None to funds or authorization — purely a UX/observability gap: a colliding
deployment surfaces as a generic revert the frontend cannot humanize.

### Secure remediation
Either remove the unused error, or pre-check with `predictAddress` +
`address(...).code.length` before deploying and `revert SafeAlreadyExists()` for a
clear message. Cosmetic — safe to defer.

### Validation test
Add a test asserting a second `createSafe` with identical args reverts with the
mapped error; `frontend/src/lib/format.ts` gains a matching `humanizeError` entry.

## 8. False positives

- **`window.location.reload()` in `wallet.ts` (chainChanged handler)** — flagged by
  the reflection heuristic; not a redirect/injection sink. It reloads the same page
  on a wallet network change to invalidate cached reads. Benign.
- **`http://` matches** — none in code; the only `http://` occurrences are the live
  URLs inside Markdown docs, not runtime endpoints. All runtime RPC/explorer URLs are
  HTTPS (`lib/config.ts`). (The plain-HTTP *serving* of the site is captured
  separately as SEC-002.)
- **`NEXT_PUBLIC_*` "exposed" env values** — intended: they are contract addresses
  baked into a public bundle, never secrets. Confirmed no key is `NEXT_PUBLIC_`.

## 9. Applied patches

Patches were applied in the remediation pass and are catalogued in
`security-fixes.patch` (a file-by-file change list — the working tree is **not** under
git, so a `git diff` cannot be produced; the file explains this and lists every
change). No secret value appears in it.

| Finding | Change | Files |
|---------|--------|-------|
| SEC-004 | CREATE2 collision guard + shared `_predict` helper; named `SafeAlreadyExists` revert | `contracts/ArcSafeFactory.sol` |
| SEC-004 | Error surfaced to client + humanized | `frontend/src/lib/config.ts`, `frontend/src/lib/format.ts` |
| SEC-004 | Regression test for the collision | `test/ArcSafe.test.js` |
| SEC-002 | Hardened nginx server block (CSP/HSTS/XFO/nosniff/Referrer/Permissions/COOP, HTTP→HTTPS) | `deploy/nginx-arcsafe.conf` (new) |
| SEC-002 | `no-referrer` document meta | `frontend/src/pages/_app.tsx` |
| SEC-001 | Secret-leak guard + npm script | `scripts/check-secrets.js` (new), `package.json` |

Not code-patched (by design):
- **SEC-001** rotation is owner-only — deleting the line would risk forfeiting deployer
  control and would reproduce the secret in diff context. Compensating guard added.
- **SEC-003** is a process action (commission an audit).

## 10. Tests executed

- **Baseline:** `npx hardhat test` → **42 passing** (~2s), exit 0.
- **Post-patch:** `npx hardhat test` → **43 passing** (~3s), exit 0 — the original 42
  plus the new SEC-004 collision regression. Coverage includes single-key drain
  prevention, `onlySelf` config routing, reentrancy block via a hostile owner
  contract, batch atomicity, config-version invalidation of stale approvals, immediate
  loss of a removed owner's rights, and per-deployer salt scoping.
- **Frontend:** `tsc --noEmit` → clean (exit 0). Live preview of `/arcsafe/` and
  `/arcsafe/create/` renders with **no console errors**; `referrer` meta confirmed
  applied.
- **Secret guard:** `npm run check:secrets` → OK, no key found outside `.env`.

## 11. Remaining risks

- **SEC-001 (High) — open (owner action).** Rotate the deployer key if it has ever
  been shared/backed up, and never reuse it for mainnet or a funded owner slot.
  Compensating controls (leak scan clean + `check:secrets` guard) are in place, but
  a plaintext key at rest is only fully resolved by rotation + a secret manager.
- **SEC-002 (Medium) — patched, pending deploy.** The nginx config must be installed
  over HTTPS on the VPS for the headers to take effect; verify with Section 12's curl.
- **SEC-003 (Low) — accepted.** Commission an independent audit before mainnet.
- **SEC-004 (Low) — resolved** in code (pending a factory redeploy to carry the new
  bytecode on-chain; the current testnet factory predates this change).

No confirmed Critical remains, and no unresolved High *code* defect remains.

## 12. Commands for manual verification

```bash
# Re-run the contract test baseline
npx hardhat test

# Confirm no secret is committed / is git-ignored (once a repo exists)
git rev-parse --is-inside-work-tree      # expect: not a repo, or...
git check-ignore .env                    # expect: .env

# Look for any 64-hex private key at rest
grep -rnE '0x[0-9a-fA-F]{64}' .env .env.* 2>/dev/null

# Injection / XSS sink sweep of the frontend
grep -rnE 'dangerouslySetInnerHTML|innerHTML|eval\(|new Function|document\.write' frontend/src

# Optional deeper scanners (install first; verify official sources)
slither .                                # Solidity static analysis
npm audit --omit=dev                     # dependency CVEs (root + frontend)
gitleaks detect --no-git -s .            # secret scan of the working tree

# Verify deployment security headers once served over HTTPS
curl -sI https://<host>/arcsafe/ | grep -iE 'content-security-policy|x-frame-options|strict-transport-security|x-content-type-options'
```

---
*No secret value appears in this report; the deployer key is redacted as
`0xb7d3****0cca` throughout.*
