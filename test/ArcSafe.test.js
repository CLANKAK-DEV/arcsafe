const { expect } = require('chai');
const { ethers } = require('hardhat');
const { loadFixture, time } = require('@nomicfoundation/hardhat-network-helpers');
const { anyValue } = require('@nomicfoundation/hardhat-chai-matchers/withArgs');

const ONE = ethers.parseEther('1');

describe('ArcSafe', function () {
  async function deploy2of3() {
    const [alice, bob, carol, mallory, recipient] = await ethers.getSigners();
    const owners = [alice.address, bob.address, carol.address];

    const ArcSafe = await ethers.getContractFactory('ArcSafe');
    const safe = await ArcSafe.deploy(owners, 2);
    await safe.waitForDeployment();

    // Fund the safe with 10 ARC.
    await alice.sendTransaction({ to: await safe.getAddress(), value: ethers.parseEther('10') });

    return { safe, alice, bob, carol, mallory, recipient, owners };
  }

  /** Propose -> approve to threshold -> execute, as a single helper. */
  async function passTx(safe, signers, { to, value = 0n, data = '0x', expiresAt = 0 }) {
    const tx = await safe.connect(signers[0]).submit(to, value, data, expiresAt);
    const receipt = await tx.wait();
    const txId = receipt.logs.find((l) => l.fragment?.name === 'Submitted').args[0];

    for (const s of signers) {
      await safe.connect(s).approve(txId);
    }
    await safe.connect(signers[0]).execute(txId);
    return txId;
  }

  // ───────────────────────────────────────────────────────────────────
  describe('deployment', function () {
    it('stores owners and threshold', async function () {
      const { safe, owners } = await loadFixture(deploy2of3);
      expect(await safe.getOwners()).to.deep.equal(owners);
      expect(await safe.threshold()).to.equal(2);
      expect(await safe.ownerCount()).to.equal(3);
    });

    it('rejects a threshold above the owner count', async function () {
      const [a, b] = await ethers.getSigners();
      const ArcSafe = await ethers.getContractFactory('ArcSafe');
      await expect(ArcSafe.deploy([a.address, b.address], 3)).to.be.revertedWithCustomError(
        ArcSafe,
        'InvalidThreshold',
      );
    });

    it('rejects a zero threshold', async function () {
      const [a] = await ethers.getSigners();
      const ArcSafe = await ethers.getContractFactory('ArcSafe');
      await expect(ArcSafe.deploy([a.address], 0)).to.be.revertedWithCustomError(ArcSafe, 'InvalidThreshold');
    });

    it('rejects duplicate owners', async function () {
      const [a] = await ethers.getSigners();
      const ArcSafe = await ethers.getContractFactory('ArcSafe');
      await expect(ArcSafe.deploy([a.address, a.address], 1)).to.be.revertedWithCustomError(
        ArcSafe,
        'DuplicateOwner',
      );
    });

    it('rejects the zero address as owner', async function () {
      const [a] = await ethers.getSigners();
      const ArcSafe = await ethers.getContractFactory('ArcSafe');
      await expect(ArcSafe.deploy([a.address, ethers.ZeroAddress], 1)).to.be.revertedWithCustomError(
        ArcSafe,
        'InvalidOwner',
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // The regression suite for the vulnerability that shipped in v0.1.
  //
  // In the original contract addOwner / removeOwner / changeThreshold were
  // marked `onlyOwner`, so ANY single owner of a 2-of-3 safe could call
  // changeThreshold(1) and then unilaterally move every asset. The "2 of 3"
  // was decorative. These tests exist to make sure that can never come back.
  // ═══════════════════════════════════════════════════════════════════
  describe('SECURITY: a single owner cannot act alone', function () {
    it('one owner cannot lower the threshold directly', async function () {
      const { safe, alice } = await loadFixture(deploy2of3);
      await expect(safe.connect(alice).changeThreshold(1)).to.be.revertedWithCustomError(safe, 'OnlySafe');
      expect(await safe.threshold()).to.equal(2);
    });

    it('one owner cannot add an owner directly', async function () {
      const { safe, alice, mallory } = await loadFixture(deploy2of3);
      await expect(safe.connect(alice).addOwner(mallory.address, 2)).to.be.revertedWithCustomError(
        safe,
        'OnlySafe',
      );
      expect(await safe.isOwner(mallory.address)).to.equal(false);
    });

    it('one owner cannot remove a co-owner directly', async function () {
      const { safe, alice, bob } = await loadFixture(deploy2of3);
      await expect(safe.connect(alice).removeOwner(bob.address, 1)).to.be.revertedWithCustomError(
        safe,
        'OnlySafe',
      );
      expect(await safe.isOwner(bob.address)).to.equal(true);
    });

    it('one owner cannot swap a co-owner out directly', async function () {
      const { safe, alice, bob, mallory } = await loadFixture(deploy2of3);
      await expect(safe.connect(alice).swapOwner(bob.address, mallory.address)).to.be.revertedWithCustomError(
        safe,
        'OnlySafe',
      );
    });

    it('THE ATTACK: a lone owner cannot drain the safe end to end', async function () {
      const { safe, alice, recipient } = await loadFixture(deploy2of3);
      const safeAddress = await safe.getAddress();
      const before = await ethers.provider.getBalance(safeAddress);
      expect(before).to.equal(ethers.parseEther('10'));

      // Step 1 of the old exploit: drop the threshold to 1. Now blocked.
      await expect(safe.connect(alice).changeThreshold(1)).to.be.revertedWithCustomError(safe, 'OnlySafe');

      // Step 2: propose a transfer of the entire balance. Proposing is allowed —
      // it is approval and execution that are gated.
      const tx = await safe.connect(alice).submit(recipient.address, before, '0x', 0);
      const receipt = await tx.wait();
      const txId = receipt.logs.find((l) => l.fragment?.name === 'Submitted').args[0];

      // Step 3: approve with the single owner she controls, then execute.
      await safe.connect(alice).approve(txId);
      await expect(safe.connect(alice).execute(txId)).to.be.revertedWithCustomError(safe, 'BelowThreshold');

      // The safe still holds every wei.
      expect(await ethers.provider.getBalance(safeAddress)).to.equal(before);
    });

    it('an owner cannot approve the same transaction twice to fake a quorum', async function () {
      const { safe, alice, recipient } = await loadFixture(deploy2of3);
      const tx = await safe.connect(alice).submit(recipient.address, ONE, '0x', 0);
      const txId = (await tx.wait()).logs.find((l) => l.fragment?.name === 'Submitted').args[0];

      await safe.connect(alice).approve(txId);
      await expect(safe.connect(alice).approve(txId)).to.be.revertedWithCustomError(safe, 'AlreadyApproved');

      const info = await safe.getTransaction(txId);
      expect(info.approvals).to.equal(1);
    });

    it('a non-owner cannot submit, approve, or execute', async function () {
      const { safe, alice, mallory, recipient } = await loadFixture(deploy2of3);
      await expect(
        safe.connect(mallory).submit(recipient.address, ONE, '0x', 0),
      ).to.be.revertedWithCustomError(safe, 'NotOwner');

      const tx = await safe.connect(alice).submit(recipient.address, ONE, '0x', 0);
      const txId = (await tx.wait()).logs.find((l) => l.fragment?.name === 'Submitted').args[0];

      await expect(safe.connect(mallory).approve(txId)).to.be.revertedWithCustomError(safe, 'NotOwner');
      await expect(safe.connect(mallory).execute(txId)).to.be.revertedWithCustomError(safe, 'NotOwner');
    });
  });

  // ───────────────────────────────────────────────────────────────────
  describe('transaction lifecycle', function () {
    it('executes once the threshold is met', async function () {
      const { safe, alice, bob, recipient } = await loadFixture(deploy2of3);
      const before = await ethers.provider.getBalance(recipient.address);

      await passTx(safe, [alice, bob], { to: recipient.address, value: ONE });

      expect(await ethers.provider.getBalance(recipient.address)).to.equal(before + ONE);
    });

    it('cannot execute twice', async function () {
      const { safe, alice, bob, recipient } = await loadFixture(deploy2of3);
      const txId = await passTx(safe, [alice, bob], { to: recipient.address, value: ONE });

      await expect(safe.connect(alice).execute(txId)).to.be.revertedWithCustomError(safe, 'TxAlreadyExecuted');
    });

    it('revoking drops the tally back below threshold', async function () {
      const { safe, alice, bob, recipient } = await loadFixture(deploy2of3);
      const tx = await safe.connect(alice).submit(recipient.address, ONE, '0x', 0);
      const txId = (await tx.wait()).logs.find((l) => l.fragment?.name === 'Submitted').args[0];

      await safe.connect(alice).approve(txId);
      await safe.connect(bob).approve(txId);
      expect(await safe.isExecutable(txId)).to.equal(true);

      await safe.connect(bob).revoke(txId);
      expect(await safe.isExecutable(txId)).to.equal(false);
      await expect(safe.connect(alice).execute(txId)).to.be.revertedWithCustomError(safe, 'BelowThreshold');
    });

    it('rejects execution after expiry', async function () {
      const { safe, alice, bob, recipient } = await loadFixture(deploy2of3);
      const deadline = (await time.latest()) + 3600;

      const tx = await safe.connect(alice).submit(recipient.address, ONE, '0x', deadline);
      const txId = (await tx.wait()).logs.find((l) => l.fragment?.name === 'Submitted').args[0];
      await safe.connect(alice).approve(txId);
      await safe.connect(bob).approve(txId);

      await time.increaseTo(deadline + 1);

      await expect(safe.connect(alice).execute(txId)).to.be.revertedWithCustomError(safe, 'TxExpired');
    });

    it('surfaces the callee revert reason instead of a bare failure', async function () {
      const { safe, alice, bob } = await loadFixture(deploy2of3);
      // Calling a non-existent function on the safe itself reverts.
      const badData = '0xdeadbeef';
      const tx = await safe.connect(alice).submit(await safe.getAddress(), 0, badData, 0);
      const txId = (await tx.wait()).logs.find((l) => l.fragment?.name === 'Submitted').args[0];
      await safe.connect(alice).approve(txId);
      await safe.connect(bob).approve(txId);

      await expect(safe.connect(alice).execute(txId)).to.be.revertedWithCustomError(safe, 'ExecutionFailed');
    });

    it('rejects the zero address as a target', async function () {
      const { safe, alice } = await loadFixture(deploy2of3);
      await expect(
        safe.connect(alice).submit(ethers.ZeroAddress, ONE, '0x', 0),
      ).to.be.revertedWithCustomError(safe, 'ZeroTarget');
    });
  });

  // ───────────────────────────────────────────────────────────────────
  describe('funding on execute', function () {
    async function emptySafe() {
      const [alice, bob, carol, mallory, recipient] = await ethers.getSigners();
      const ArcSafe = await ethers.getContractFactory('ArcSafe');
      const safe = await ArcSafe.deploy([alice.address, bob.address, carol.address], 2);
      await safe.waitForDeployment();
      return { safe, alice, bob, recipient, mallory };
    }

    it('tops the safe up in the same transaction that spends it', async function () {
      const { safe, alice, bob, recipient } = await loadFixture(emptySafe);
      const safeAddress = await safe.getAddress();
      expect(await ethers.provider.getBalance(safeAddress)).to.equal(0n);

      const tx = await safe.connect(alice).submit(recipient.address, ONE, '0x', 0);
      const txId = (await tx.wait()).logs.find((l) => l.fragment?.name === 'Submitted').args[0];
      await safe.connect(alice).approve(txId);
      await safe.connect(bob).approve(txId);

      // Without funds it cannot execute.
      await expect(safe.connect(alice).execute(txId)).to.be.revertedWithCustomError(
        safe,
        'ExecutionFailed',
      );

      const before = await ethers.provider.getBalance(recipient.address);

      // Attaching the shortfall makes the same call succeed, and logs the deposit.
      await expect(safe.connect(alice).execute(txId, { value: ONE }))
        .to.emit(safe, 'Deposited')
        .withArgs(alice.address, ONE);

      expect(await ethers.provider.getBalance(recipient.address)).to.equal(before + ONE);
      expect(await ethers.provider.getBalance(safeAddress)).to.equal(0n);
    });

    it('keeps any excess in the safe rather than refunding it', async function () {
      const { safe, alice, bob, recipient } = await loadFixture(emptySafe);
      const safeAddress = await safe.getAddress();

      const tx = await safe.connect(alice).submit(recipient.address, ONE, '0x', 0);
      const txId = (await tx.wait()).logs.find((l) => l.fragment?.name === 'Submitted').args[0];
      await safe.connect(alice).approve(txId);
      await safe.connect(bob).approve(txId);

      await safe.connect(alice).execute(txId, { value: ONE * 3n });
      expect(await ethers.provider.getBalance(safeAddress)).to.equal(ONE * 2n);
    });

    it('SECURITY: attaching funds does not bypass the threshold', async function () {
      const { safe, alice, recipient } = await loadFixture(emptySafe);

      const tx = await safe.connect(alice).submit(recipient.address, ONE, '0x', 0);
      const txId = (await tx.wait()).logs.find((l) => l.fragment?.name === 'Submitted').args[0];
      await safe.connect(alice).approve(txId); // only 1 of 2

      // Paying for it yourself buys no authority.
      await expect(
        safe.connect(alice).execute(txId, { value: ONE * 10n }),
      ).to.be.revertedWithCustomError(safe, 'BelowThreshold');
    });

    it('SECURITY: a non-owner cannot execute even while funding it', async function () {
      const { safe, alice, bob, mallory, recipient } = await loadFixture(emptySafe);

      const tx = await safe.connect(alice).submit(recipient.address, ONE, '0x', 0);
      const txId = (await tx.wait()).logs.find((l) => l.fragment?.name === 'Submitted').args[0];
      await safe.connect(alice).approve(txId);
      await safe.connect(bob).approve(txId);

      await expect(
        safe.connect(mallory).execute(txId, { value: ONE }),
      ).to.be.revertedWithCustomError(safe, 'NotOwner');
    });

    it('withdrawing funds requires the same quorum as any other spend', async function () {
      // There is no separate withdraw function, by design. Getting money out is
      // a normal proposal, so it inherits the threshold. A unilateral withdraw
      // would be exactly the drain bug this contract exists to prevent.
      const { safe, alice, bob, recipient } = await loadFixture(emptySafe);
      const safeAddress = await safe.getAddress();
      await alice.sendTransaction({ to: safeAddress, value: ONE * 5n });

      const tx = await safe.connect(alice).submit(recipient.address, ONE * 5n, '0x', 0);
      const txId = (await tx.wait()).logs.find((l) => l.fragment?.name === 'Submitted').args[0];

      // One owner alone cannot empty it.
      await safe.connect(alice).approve(txId);
      await expect(safe.connect(alice).execute(txId)).to.be.revertedWithCustomError(
        safe,
        'BelowThreshold',
      );
      expect(await ethers.provider.getBalance(safeAddress)).to.equal(ONE * 5n);

      // With quorum, the full balance leaves.
      await safe.connect(bob).approve(txId);
      await safe.connect(alice).execute(txId);
      expect(await ethers.provider.getBalance(safeAddress)).to.equal(0n);
    });
  });

  // ───────────────────────────────────────────────────────────────────
  describe('batch transactions', function () {
    it('pays several recipients atomically in one proposal', async function () {
      const { safe, alice, bob, recipient, mallory } = await loadFixture(deploy2of3);
      const before = [
        await ethers.provider.getBalance(recipient.address),
        await ethers.provider.getBalance(mallory.address),
      ];

      const calls = [
        { to: recipient.address, value: ONE, data: '0x' },
        { to: mallory.address, value: ONE * 2n, data: '0x' },
      ];

      const tx = await safe.connect(alice).submitBatch(calls, 0);
      const txId = (await tx.wait()).logs.find((l) => l.fragment?.name === 'BatchSubmitted').args[0];

      await safe.connect(alice).approve(txId);
      await safe.connect(bob).approve(txId);
      await safe.connect(alice).execute(txId);

      expect(await ethers.provider.getBalance(recipient.address)).to.equal(before[0] + ONE);
      expect(await ethers.provider.getBalance(mallory.address)).to.equal(before[1] + ONE * 2n);
    });

    it('ATOMICITY: one failing leg reverts the entire batch', async function () {
      const { safe, alice, bob, recipient } = await loadFixture(deploy2of3);
      const safeAddress = await safe.getAddress();
      const balanceBefore = await ethers.provider.getBalance(safeAddress);
      const recipientBefore = await ethers.provider.getBalance(recipient.address);

      const calls = [
        { to: recipient.address, value: ONE, data: '0x' }, // would succeed
        { to: safeAddress, value: 0n, data: '0xdeadbeef' }, // reverts
      ];

      const tx = await safe.connect(alice).submitBatch(calls, 0);
      const txId = (await tx.wait()).logs.find((l) => l.fragment?.name === 'BatchSubmitted').args[0];
      await safe.connect(alice).approve(txId);
      await safe.connect(bob).approve(txId);

      await expect(safe.connect(alice).execute(txId))
        .to.be.revertedWithCustomError(safe, 'BatchCallFailed')
        .withArgs(1, anyValue);

      // Nothing was applied — not even the leg that would have succeeded.
      expect(await ethers.provider.getBalance(safeAddress)).to.equal(balanceBefore);
      expect(await ethers.provider.getBalance(recipient.address)).to.equal(recipientBefore);

      // And the transaction is still pending, not consumed.
      const info = await safe.getTransaction(txId);
      expect(info.executed).to.equal(false);
    });

    it('SIMULATION: staticCall predicts the failure without spending gas', async function () {
      // This is exactly what the frontend does before prompting a wallet:
      // execute.staticCall runs against current state and discards the result,
      // so a doomed transaction is caught before anyone signs it.
      const { safe, alice, bob, recipient } = await loadFixture(deploy2of3);
      const safeAddress = await safe.getAddress();

      const good = await safe.connect(alice).submitBatch([{ to: recipient.address, value: ONE, data: '0x' }], 0);
      const goodId = (await good.wait()).logs.find((l) => l.fragment?.name === 'BatchSubmitted').args[0];
      await safe.connect(alice).approve(goodId);
      await safe.connect(bob).approve(goodId);

      const bad = await safe
        .connect(alice)
        .submitBatch([{ to: safeAddress, value: 0n, data: '0xdeadbeef' }], 0);
      const badId = (await bad.wait()).logs.find((l) => l.fragment?.name === 'BatchSubmitted').args[0];
      await safe.connect(alice).approve(badId);
      await safe.connect(bob).approve(badId);

      // A healthy transaction simulates cleanly and can be priced. staticCall
      // returns the call's return data (empty for a batch) and throws on
      // revert, so reaching the assertion at all is the success signal.
      const simulated = await safe.connect(alice).execute.staticCall(goodId);
      expect(simulated).to.equal('0x');
      expect(await safe.connect(alice).execute.estimateGas(goodId)).to.be.greaterThan(0n);

      // A doomed one is rejected at simulation, with the failing leg identified.
      await expect(safe.connect(alice).execute.staticCall(badId))
        .to.be.revertedWithCustomError(safe, 'BatchCallFailed')
        .withArgs(0, anyValue);

      // Simulation is side-effect free: neither transaction was consumed.
      expect((await safe.getTransaction(goodId)).executed).to.equal(false);
      expect((await safe.getTransaction(badId)).executed).to.equal(false);
      expect(await ethers.provider.getBalance(safeAddress)).to.equal(ethers.parseEther('10'));
    });

    it('accepts the positional tuple encoding the frontend sends', async function () {
      // The UI builds calls as [to, value, data] arrays rather than objects.
      // Field order in a Solidity struct is positional, so a mismatch here
      // would silently send funds to the wrong place — typechecking cannot
      // catch it, only an actual round trip can.
      const { safe, alice, recipient } = await loadFixture(deploy2of3);

      const tx = await safe.connect(alice).submitBatch(
        [
          [recipient.address, ONE, '0x'],
          [recipient.address, 0n, '0xabcd'],
        ],
        0,
      );
      const txId = (await tx.wait()).logs.find((l) => l.fragment?.name === 'BatchSubmitted').args[0];

      const stored = await safe.getBatchCalls(txId);
      expect(stored[0].to).to.equal(recipient.address);
      expect(stored[0].value).to.equal(ONE);
      expect(stored[0].data).to.equal('0x');
      expect(stored[1].value).to.equal(0n);
      expect(stored[1].data).to.equal('0xabcd');
    });

    it('exposes the exact calls an approver is agreeing to', async function () {
      const { safe, alice, recipient } = await loadFixture(deploy2of3);
      const calls = [
        { to: recipient.address, value: ONE, data: '0x' },
        { to: recipient.address, value: 0n, data: '0x1234' },
      ];
      const tx = await safe.connect(alice).submitBatch(calls, 0);
      const txId = (await tx.wait()).logs.find((l) => l.fragment?.name === 'BatchSubmitted').args[0];

      const stored = await safe.getBatchCalls(txId);
      expect(stored.length).to.equal(2);
      expect(stored[0].to).to.equal(recipient.address);
      expect(stored[0].value).to.equal(ONE);
      expect(stored[1].data).to.equal('0x1234');

      const info = await safe.getTransaction(txId);
      expect(info.isBatch).to.equal(true);
      expect(info.callCount).to.equal(2);
    });

    it('still requires the full threshold', async function () {
      const { safe, alice, recipient } = await loadFixture(deploy2of3);
      const tx = await safe
        .connect(alice)
        .submitBatch([{ to: recipient.address, value: ONE, data: '0x' }], 0);
      const txId = (await tx.wait()).logs.find((l) => l.fragment?.name === 'BatchSubmitted').args[0];

      await safe.connect(alice).approve(txId);
      await expect(safe.connect(alice).execute(txId)).to.be.revertedWithCustomError(safe, 'BelowThreshold');
    });

    it('rejects an empty batch, an oversized batch, and a zero target', async function () {
      const { safe, alice, recipient } = await loadFixture(deploy2of3);

      await expect(safe.connect(alice).submitBatch([], 0)).to.be.revertedWithCustomError(safe, 'EmptyBatch');

      const tooMany = Array.from({ length: 33 }, () => ({ to: recipient.address, value: 0n, data: '0x' }));
      await expect(safe.connect(alice).submitBatch(tooMany, 0)).to.be.revertedWithCustomError(
        safe,
        'BatchTooLarge',
      );

      await expect(
        safe.connect(alice).submitBatch([{ to: ethers.ZeroAddress, value: 0n, data: '0x' }], 0),
      ).to.be.revertedWithCustomError(safe, 'ZeroTarget');
    });

    it('a non-owner cannot propose a batch', async function () {
      const { safe, mallory, recipient } = await loadFixture(deploy2of3);
      await expect(
        safe.connect(mallory).submitBatch([{ to: recipient.address, value: ONE, data: '0x' }], 0),
      ).to.be.revertedWithCustomError(safe, 'NotOwner');
    });

    it('can reconfigure the safe and pay out in a single atomic batch', async function () {
      const { safe, alice, bob, mallory, recipient } = await loadFixture(deploy2of3);
      const safeAddress = await safe.getAddress();

      // Add an owner AND make a payment, all or nothing.
      const calls = [
        { to: safeAddress, value: 0n, data: safe.interface.encodeFunctionData('addOwner', [mallory.address, 3]) },
        { to: recipient.address, value: ONE, data: '0x' },
      ];

      const tx = await safe.connect(alice).submitBatch(calls, 0);
      const txId = (await tx.wait()).logs.find((l) => l.fragment?.name === 'BatchSubmitted').args[0];
      await safe.connect(alice).approve(txId);
      await safe.connect(bob).approve(txId);
      await safe.connect(alice).execute(txId);

      expect(await safe.isOwner(mallory.address)).to.equal(true);
      expect(await safe.threshold()).to.equal(3);
    });
  });

  // ───────────────────────────────────────────────────────────────────
  describe('configuration through the multi-sig', function () {
    it('adds an owner when the quorum agrees', async function () {
      const { safe, alice, bob, mallory } = await loadFixture(deploy2of3);
      const data = safe.interface.encodeFunctionData('addOwner', [mallory.address, 3]);

      await passTx(safe, [alice, bob], { to: await safe.getAddress(), data });

      expect(await safe.isOwner(mallory.address)).to.equal(true);
      expect(await safe.ownerCount()).to.equal(4);
      expect(await safe.threshold()).to.equal(3);
    });

    it('removes an owner when the quorum agrees', async function () {
      const { safe, alice, bob, carol } = await loadFixture(deploy2of3);
      const data = safe.interface.encodeFunctionData('removeOwner', [carol.address, 2]);

      await passTx(safe, [alice, bob], { to: await safe.getAddress(), data });

      expect(await safe.isOwner(carol.address)).to.equal(false);
      expect(await safe.ownerCount()).to.equal(2);
    });

    it('cannot remove an owner down past the threshold', async function () {
      const { safe, alice, bob, carol } = await loadFixture(deploy2of3);
      // 3 owners, threshold 2 -> removing one and asking for threshold 3 is invalid.
      const data = safe.interface.encodeFunctionData('removeOwner', [carol.address, 3]);
      const tx = await safe.connect(alice).submit(await safe.getAddress(), 0, data, 0);
      const txId = (await tx.wait()).logs.find((l) => l.fragment?.name === 'Submitted').args[0];
      await safe.connect(alice).approve(txId);
      await safe.connect(bob).approve(txId);

      await expect(safe.connect(alice).execute(txId)).to.be.revertedWithCustomError(safe, 'ExecutionFailed');
      expect(await safe.isOwner(carol.address)).to.equal(true);
    });

    it('changing the config invalidates transactions approved under the old one', async function () {
      const { safe, alice, bob, carol, recipient } = await loadFixture(deploy2of3);

      // A payment is proposed and reaches quorum under the 3-owner committee.
      const pending = await safe.connect(alice).submit(recipient.address, ONE, '0x', 0);
      const pendingId = (await pending.wait()).logs.find((l) => l.fragment?.name === 'Submitted').args[0];
      await safe.connect(alice).approve(pendingId);
      await safe.connect(bob).approve(pendingId);
      expect(await safe.isExecutable(pendingId)).to.equal(true);

      // Carol is then removed from the committee.
      const data = safe.interface.encodeFunctionData('removeOwner', [carol.address, 2]);
      await passTx(safe, [alice, bob], { to: await safe.getAddress(), data });

      // The stale approval set no longer authorises anything.
      expect(await safe.isExecutable(pendingId)).to.equal(false);
      await expect(safe.connect(alice).execute(pendingId)).to.be.revertedWithCustomError(safe, 'TxStale');
    });

    it('a removed owner loses all rights immediately', async function () {
      const { safe, alice, bob, carol, recipient } = await loadFixture(deploy2of3);
      const data = safe.interface.encodeFunctionData('removeOwner', [carol.address, 2]);
      await passTx(safe, [alice, bob], { to: await safe.getAddress(), data });

      await expect(
        safe.connect(carol).submit(recipient.address, ONE, '0x', 0),
      ).to.be.revertedWithCustomError(safe, 'NotOwner');
    });

    it('swaps a lost owner for a replacement', async function () {
      const { safe, alice, bob, carol, mallory } = await loadFixture(deploy2of3);
      const data = safe.interface.encodeFunctionData('swapOwner', [carol.address, mallory.address]);

      await passTx(safe, [alice, bob], { to: await safe.getAddress(), data });

      expect(await safe.isOwner(carol.address)).to.equal(false);
      expect(await safe.isOwner(mallory.address)).to.equal(true);
      expect(await safe.ownerCount()).to.equal(3);
    });
  });

  // ───────────────────────────────────────────────────────────────────
  describe('reentrancy', function () {
    it('blocks a re-entrant execute from a malicious owner contract', async function () {
      const [alice, bob] = await ethers.getSigners();

      const Reenterer = await ethers.getContractFactory('Reenterer');
      const attacker = await Reenterer.deploy();
      await attacker.waitForDeployment();
      const attackerAddress = await attacker.getAddress();

      // Make the attacker contract a genuine owner so its re-entrant call gets
      // past onlyOwner and reaches the guard.
      const ArcSafe = await ethers.getContractFactory('ArcSafe');
      const safe = await ArcSafe.deploy([alice.address, bob.address, attackerAddress], 2);
      await safe.waitForDeployment();
      await alice.sendTransaction({ to: await safe.getAddress(), value: ethers.parseEther('5') });

      const tx = await safe.connect(alice).submit(attackerAddress, ONE, '0x', 0);
      const txId = (await tx.wait()).logs.find((l) => l.fragment?.name === 'Submitted').args[0];
      await attacker.configure(await safe.getAddress(), txId);

      await safe.connect(alice).approve(txId);
      await safe.connect(bob).approve(txId);
      await safe.connect(alice).execute(txId);

      expect(await attacker.reentryAttempted()).to.equal(true);
      expect(await attacker.reentrySucceeded()).to.equal(false);
      // Paid exactly once.
      expect(await ethers.provider.getBalance(attackerAddress)).to.equal(ONE);
    });
  });

  // ───────────────────────────────────────────────────────────────────
  describe('ArcSafeFactory', function () {
    it('deploys a working safe and indexes it by owner', async function () {
      const [alice, bob, carol] = await ethers.getSigners();
      const Factory = await ethers.getContractFactory('ArcSafeFactory');
      const factory = await Factory.deploy();
      await factory.waitForDeployment();

      const owners = [alice.address, bob.address, carol.address];
      const salt = ethers.id('safe-1');

      const predicted = await factory.predictAddress(alice.address, owners, 2, salt);
      await factory.connect(alice).createSafe(owners, 2, salt);

      expect(await ethers.provider.getCode(predicted)).to.not.equal('0x');
      expect(await factory.safesOf(alice.address)).to.deep.equal([predicted]);
      expect(await factory.safeCount()).to.equal(1);

      const safe = await ethers.getContractAt('ArcSafe', predicted);
      expect(await safe.threshold()).to.equal(2);
      expect(await safe.getOwners()).to.deep.equal(owners);
    });

    it('gives the factory deployer no authority over safes created through it', async function () {
      // Mirrors the real deployment story: one person deploys the factory,
      // unrelated users create their own safes through it.
      const [factoryDeployer, alice, bob, recipient] = await ethers.getSigners();

      const Factory = await ethers.getContractFactory('ArcSafeFactory');
      const factory = await Factory.connect(factoryDeployer).deploy();
      await factory.waitForDeployment();

      // Alice and Bob create a safe. The factory deployer is not an owner.
      const owners = [alice.address, bob.address];
      const salt = ethers.id('alice-and-bob');
      const predicted = await factory.predictAddress(alice.address, owners, 2, salt);
      await factory.connect(alice).createSafe(owners, 2, salt);

      const safe = await ethers.getContractAt('ArcSafe', predicted);
      await alice.sendTransaction({ to: predicted, value: ethers.parseEther('5') });

      // The factory deployer is not an owner and cannot act.
      expect(await safe.isOwner(factoryDeployer.address)).to.equal(false);
      await expect(
        safe.connect(factoryDeployer).submit(recipient.address, ONE, '0x', 0),
      ).to.be.revertedWithCustomError(safe, 'NotOwner');
      await expect(
        safe.connect(factoryDeployer).addOwner(factoryDeployer.address, 1),
      ).to.be.revertedWithCustomError(safe, 'OnlySafe');
      await expect(safe.connect(factoryDeployer).changeThreshold(1)).to.be.revertedWithCustomError(
        safe,
        'OnlySafe',
      );

      // The factory itself has no privileged entry point either.
      expect(await safe.isOwner(await factory.getAddress())).to.equal(false);

      // Alice and Bob retain full control.
      const tx = await safe.connect(alice).submit(recipient.address, ONE, '0x', 0);
      const txId = (await tx.wait()).logs.find((l) => l.fragment?.name === 'Submitted').args[0];
      await safe.connect(alice).approve(txId);
      await safe.connect(bob).approve(txId);
      await expect(safe.connect(alice).execute(txId)).to.not.be.reverted;
    });

    it('scopes salts per deployer so addresses cannot be front-run', async function () {
      const [alice, bob] = await ethers.getSigners();
      const Factory = await ethers.getContractFactory('ArcSafeFactory');
      const factory = await Factory.deploy();
      await factory.waitForDeployment();

      const owners = [alice.address, bob.address];
      const salt = ethers.id('same-salt');

      // Same salt, same owners, different deployer -> different address, no collision.
      await factory.connect(alice).createSafe(owners, 2, salt);
      await expect(factory.connect(bob).createSafe(owners, 2, salt)).to.not.be.reverted;
      expect(await factory.safeCount()).to.equal(2);
    });

    it('rejects a repeat deployment with a named error instead of an opaque revert', async function () {
      const [alice, bob] = await ethers.getSigners();
      const Factory = await ethers.getContractFactory('ArcSafeFactory');
      const factory = await Factory.deploy();
      await factory.waitForDeployment();

      const owners = [alice.address, bob.address];
      const salt = ethers.id('duplicate');

      // Same deployer, salt, owners and threshold resolve to the same CREATE2
      // address. The second attempt must fail with SafeAlreadyExists, not the
      // reasonless revert the EVM raises for an occupied address.
      await factory.connect(alice).createSafe(owners, 2, salt);
      await expect(
        factory.connect(alice).createSafe(owners, 2, salt),
      ).to.be.revertedWithCustomError(factory, 'SafeAlreadyExists');

      // The failed attempt left the index untouched.
      expect(await factory.safeCount()).to.equal(1);
    });
  });
});
