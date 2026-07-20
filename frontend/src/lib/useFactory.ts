import { BrowserProvider, Contract, JsonRpcProvider, id, isAddress } from 'ethers';
import { useCallback, useEffect, useState } from 'react';
import { ARC_TESTNET, FACTORY_ABI, FACTORY_ADDRESS } from './config';
import { humanizeError } from './format';

/** Reads always go to the Arc RPC, never through the wallet's current network. */
const reader = new JsonRpcProvider(ARC_TESTNET.rpcUrls[0], ARC_TESTNET.chainId, {
  staticNetwork: true,
  // Arc's RPC mishandles JSON-RPC batches — see the note in useSafe.ts.
  batchMaxCount: 1,
});

export const factoryConfigured = isAddress(FACTORY_ADDRESS);

/**
 * Safes the connected account belongs to.
 *
 * The factory indexes membership at creation time. Owners can change
 * afterwards, so this is a discovery hint: the safe page reads isOwner() from
 * the safe itself for the authoritative answer.
 */
export function useMySafes(account: string | null) {
  const [safes, setSafes] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState(0);

  const reload = useCallback(() => setToken((n) => n + 1), []);

  useEffect(() => {
    if (!account || !factoryConfigured) {
      setSafes(null);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const code = await reader.getCode(FACTORY_ADDRESS);
        if (cancelled) return;
        if (code === '0x') {
          setError('The configured factory address holds no contract.');
          setSafes([]);
          return;
        }

        const factory = new Contract(FACTORY_ADDRESS, FACTORY_ABI, reader);
        const list = (await factory.safesOf(account)) as string[];
        if (cancelled) return;
        setSafes(list);
        setError(null);
      } catch (e) {
        if (cancelled) return;
        setError(humanizeError(e));
        setSafes([]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [account, token]);

  return { safes, error, reload };
}

export type CreateResult = { safe: string; txHash: string };

/**
 * Deploy a new safe through the factory.
 *
 * The salt is randomised per creation so two people choosing identical owners
 * do not collide, and so one person can hold several safes with the same
 * committee.
 */
export async function createSafe(
  wallet: BrowserProvider,
  owners: string[],
  threshold: number,
): Promise<CreateResult> {
  const signer = await wallet.getSigner();
  const factory = new Contract(FACTORY_ADDRESS, FACTORY_ABI, signer);

  const salt = id(`${await signer.getAddress()}-${Date.now()}-${Math.random()}`);

  const tx = await factory.createSafe(owners, threshold, salt);
  const receipt = await tx.wait();

  const event = receipt.logs
    .map((log: { topics: readonly string[]; data: string }) => {
      try {
        return factory.interface.parseLog(log);
      } catch {
        return null;
      }
    })
    .find((e: { name: string } | null) => e?.name === 'SafeDeployed');

  if (!event) {
    throw new Error('The safe was created but no SafeDeployed event was found in the receipt.');
  }

  return { safe: event.args.safe as string, txHash: receipt.hash as string };
}
