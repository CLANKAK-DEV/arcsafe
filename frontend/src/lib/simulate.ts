import { Contract, JsonRpcProvider, type BrowserProvider } from 'ethers';
import { ARCSAFE_ABI, ARC_TESTNET } from './config';
import { formatUsdc, humanizeError } from './format';

const reader = new JsonRpcProvider(ARC_TESTNET.rpcUrls[0], ARC_TESTNET.chainId, {
  staticNetwork: true,
  // Arc's RPC mishandles JSON-RPC batches — see the note in useSafe.ts.
  // This matters most here: simulation pairs estimateGas with getFeeData, and a
  // batched failure would look like "this transaction will revert".
  batchMaxCount: 1,
});

export type Simulation =
  | { state: 'ok'; gas: bigint; feeWei: bigint }
  /** `shortfall` is set when the only problem is the safe being underfunded —
   *  the UI can then offer to attach that amount to execute() and fix it in
   *  one transaction. */
  | { state: 'will-revert'; reason: string; shortfall?: bigint }
  | { state: 'unknown'; reason: string };

/**
 * Dry-run `execute(txId)` before asking anyone to sign it.
 *
 * `staticCall` runs the transaction against current state on the node and
 * discards the result, so a batch that would revert on its third leg is caught
 * here rather than after the gas is spent. Without this, approving a multi-sig
 * transaction means approving an opaque payload and hoping — the blind-signing
 * problem that has drained a lot of real multi-sigs.
 *
 * The caller's address matters: `execute` is `onlyOwner`, so the simulation is
 * only meaningful when run as the account that will actually send it.
 */
/**
 * Returns a human explanation if the safe cannot cover what the transaction
 * spends, or null if funding is not the problem.
 *
 * Covers batches too: a batch reverts if the *total* across its legs exceeds
 * the balance, even when each individual leg looks affordable.
 */
async function insufficientBalance(
  safe: Contract,
  safeAddress: string,
  txId: number,
): Promise<{ reason: string; shortfall: bigint } | null> {
  try {
    const [info, balance] = [await safe.getTransaction(txId), await reader.getBalance(safeAddress)];

    let required: bigint = info.isBatch ? 0n : (info.value as bigint);
    if (info.isBatch) {
      const calls = (await safe.getBatchCalls(txId)) as Array<{ value: bigint }>;
      required = calls.reduce((sum, c) => sum + c.value, 0n);
    }

    if (required > balance) {
      const shortfall = required - balance;
      return {
        shortfall,
        reason:
          `The safe holds ${formatUsdc(balance)} USDC but this transaction spends ` +
          `${formatUsdc(required)} USDC — ${formatUsdc(shortfall)} short.`,
      };
    }
    return null;
  } catch {
    return null; // fall back to the raw revert reason
  }
}

export async function simulateExecute(
  safeAddress: string,
  txId: number,
  from: string,
): Promise<Simulation> {
  const safe = new Contract(safeAddress, ARCSAFE_ABI, reader);

  try {
    await safe.execute.staticCall(txId, { from });
  } catch (e) {
    // "The call reverted" is technically true and practically useless. By far
    // the most common cause is the safe not holding enough to cover the
    // transfer, so check that explicitly and say so with real numbers.
    const short = await insufficientBalance(safe, safeAddress, txId);
    if (short) return { state: 'will-revert', reason: short.reason, shortfall: short.shortfall };
    return { state: 'will-revert', reason: humanizeError(e) };
  }

  // Only estimate once the call is known to succeed — estimateGas on a
  // reverting call just reproduces the same failure with a worse message.
  try {
    const [gas, feeData] = await Promise.all([
      safe.execute.estimateGas(txId, { from }),
      reader.getFeeData(),
    ]);

    const price = feeData.maxFeePerGas ?? feeData.gasPrice ?? 0n;
    return { state: 'ok', gas, feeWei: gas * price };
  } catch (e) {
    // The call succeeds but we could not price it. Still safe to proceed.
    return { state: 'unknown', reason: humanizeError(e) };
  }
}

