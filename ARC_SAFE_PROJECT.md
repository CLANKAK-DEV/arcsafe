# 🔐 ArcSafe — Multi-Signature Wallet for Arc Chain

> **⚠️ This document is out of date. See [README.md](README.md) for current status.**
>
> Corrections to what is written below:
> - **The contract is not deployed.** The deploy transaction reverted out of
>   gas (status `0x0`). `0xB81E…9C00` holds no bytecode, so the "Live Website",
>   "Contract" and "Explorer" links below all point at an empty address.
> - **The "🛡 Security" section was wrong.** The original contract let any
>   single owner call `changeThreshold(1)` and drain the safe. Fixed, with
>   regression tests.
> - **The frontend is now Next.js**, not a single HTML page.
> - The chain ID is `5042002`. Other values quoted in this repo were wrong.
> - It is **not** Gnosis-Safe-compatible: there are no EIP-712 off-chain
>   signatures, and the interface differs.

---

## 🎯 What It Is

Instead of 1 wallet controlling funds, you need N out of M owners to sign.

```
┌─────────────────────────────────┐
│  SAFE: 0xB81E...9C00            │
│  💰 20 ARC                      │
│                                 │
│  👤 Owner 1 ──┐                 │
│  👤 Owner 2 ──┼─ 2 of 3 needed │
│  👤 Owner 3 ──┘  to move funds │
└─────────────────────────────────┘

Flow:
Owner 1 → "Send 5 ARC to Alice" → submits TX
Owner 2 → ✅ Approves
Owner 3 → ─ (not needed, 2/3 met)
→ 🚀 EXECUTED! 5 ARC sent
```

---

## 🛠 Tech Stack

| Layer | Tech |
|-------|------|
| **Contract** | Solidity 0.8.24 (180 lines) |
| **Chain** | Arc Testnet (5042002) |
| **Frontend** | Pure HTML/JS (no build) |
| **Connect** | MetaMask via ethers.js |
| **Storage** | Fully on-chain (no backend) |

---

## 🌟 Why It Matters For Arc

❌ No multi-sig existed on Arc → ✅ You built the **FIRST** one.

**Use cases:**
- 🏦 DAO treasuries → 3 of 5 sign to spend
- 👥 Team wallets → 2 of 3 sign for payments
- 🔒 Personal security → 2 devices protect funds
- 🏗 Project launches → Multi-sig for token pools

---

## 📂 Project Files

```
/home/ubuntu/arc-safe/
├── contracts/ArcSafe.sol      ← Smart contract
├── scripts/deploy.js           ← Hardhat deploy script
├── frontend/public/index.html  ← Live UI
├── hardhat.config.js           ← Arc RPC config
└── README.md                   ← This file
```

---

## 🔗 Live Links

| | Link |
|---|---|
| 🌐 **Live Website** | http://43.156.233.238/arcsafe/ |
| 📦 **Contract** | `0xB81E936BE2dfee71d52EFeCa6eacbfcbAF969C00` |
| 🔍 **Explorer** | https://testnet.arcscan.app/address/0xB81E936BE2dfee71d52EFeCa6eacbfcbAF969C00 |
| 📤 **Deploy TX** | https://testnet.arcscan.app/tx/0xe55a6eb4f961a5406e348c2db5b45e9c3ae8a8d95794eb51605ae26d45962ed7 |

---

## 🚀 How To Test

1. Open http://43.156.233.238/arcsafe/
2. Click **🧪 TEST DEMO SAFE**
3. MetaMask will ask to add Arc Testnet → approve
4. Test: submit TX → approve → execute when 2 of 3 owners signed

**Arc Testnet RPC:** `https://arc-testnet.rpc.thirdweb.com` (Chain ID: `5042002`)

---

## 🏗 Deploy Your Own

```bash
cd /home/ubuntu/arc-safe
export PRIVATE_KEY="0x..."
npx hardhat run scripts/deploy.js --network arc
```

Edit `scripts/deploy.js` to set your owners and threshold.

---

## 🛡 Security

- ✅ Standard Solidity 0.8.24 (auto overflow checks)
- ✅ Events emitted for all state changes
- ✅ Zero-address checks on owners
- ✅ Threshold validation (1 ≤ threshold ≤ owners.length)
- ✅ No delegatecall, no assembly, no external dependencies
- ✅ Only 180 lines — easy to audit

---

## 💰 Revenue Model

- **Free:** Create up to 3 safes
- **Pro:** $10/mo unlimited safes + priority support
- **Enterprise:** Custom deployment + audit

or

- **Gas fee:** 0.1 ARC per safe creation

---

## 📝 Community Launch

1. Deployed on Arc testnet ✅
2. Audit (optional — simple contract, low risk)
3. Deploy on Arc mainnet
4. Post in Arc Discord `#ecosystem` channel
5. Tag Arc team on X/Twitter
6. Write docs: "How DAOs use ArcSafe for treasury"

---

*Built by SoftNox — July 2026*
