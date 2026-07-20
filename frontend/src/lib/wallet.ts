import { BrowserProvider, type Eip1193Provider } from 'ethers';
import { useCallback, useEffect, useState } from 'react';
import { ARC_CHAIN_PARAMS, ARC_TESTNET } from './config';
import { humanizeError } from './format';

declare global {
  interface Window {
    ethereum?: Eip1193Provider & {
      on?: (event: string, handler: (...args: any[]) => void) => void;
      removeListener?: (event: string, handler: (...args: any[]) => void) => void;
    };
  }
}

export type WalletState = {
  account: string | null;
  chainId: number | null;
  provider: BrowserProvider | null;
  connecting: boolean;
  error: string | null;
  hasWallet: boolean;
  onArc: boolean;
  connect: () => Promise<void>;
  switchToArc: () => Promise<void>;
};

export function useWallet(): WalletState {
  const [account, setAccount] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasWallet, setHasWallet] = useState(false);
  const [provider, setProvider] = useState<BrowserProvider | null>(null);

  /**
   * Built once, in an effect, and held in state.
   *
   * Constructing `new BrowserProvider(...)` inline during render returns a new
   * object identity every render. Anything that lists the provider as an effect
   * dependency then re-runs on every render — and if that effect sets state
   * (as the safe loader does when it flips to "loading"), the two spin forever
   * and the UI never leaves its skeleton.
   */
  useEffect(() => {
    if (typeof window === 'undefined' || !window.ethereum) return;
    setHasWallet(true);
    setProvider(new BrowserProvider(window.ethereum));
  }, []);

  /** Re-read state after the user changes account or network in the wallet UI. */
  useEffect(() => {
    const eth = typeof window !== 'undefined' ? window.ethereum : undefined;
    if (!eth?.on) return;

    const onAccounts = (accounts: string[]) => setAccount(accounts[0] ?? null);
    // A chain change invalidates every cached contract read, so reload rather
    // than risk showing one network's data under another network's header.
    const onChain = (hex: string) => {
      setChainId(Number.parseInt(hex, 16));
      window.location.reload();
    };

    eth.on('accountsChanged', onAccounts);
    eth.on('chainChanged', onChain);
    return () => {
      eth.removeListener?.('accountsChanged', onAccounts);
      eth.removeListener?.('chainChanged', onChain);
    };
  }, []);

  /** Restore an existing authorisation without prompting. */
  useEffect(() => {
    const eth = typeof window !== 'undefined' ? window.ethereum : undefined;
    if (!eth) return;

    (async () => {
      try {
        const accounts = (await eth.request({ method: 'eth_accounts' })) as string[];
        if (accounts?.length) setAccount(accounts[0]);
        const hex = (await eth.request({ method: 'eth_chainId' })) as string;
        setChainId(Number.parseInt(hex, 16));
      } catch {
        /* wallet locked or unavailable — stay disconnected */
      }
    })();
  }, []);

  const connect = useCallback(async () => {
    const eth = window.ethereum;
    if (!eth) {
      setError('No Ethereum wallet detected. Install MetaMask to continue.');
      return;
    }
    setConnecting(true);
    setError(null);
    try {
      const accounts = (await eth.request({ method: 'eth_requestAccounts' })) as string[];
      setAccount(accounts[0] ?? null);
      const hex = (await eth.request({ method: 'eth_chainId' })) as string;
      setChainId(Number.parseInt(hex, 16));
    } catch (e) {
      setError(humanizeError(e));
    } finally {
      setConnecting(false);
    }
  }, []);

  const switchToArc = useCallback(async () => {
    const eth = window.ethereum;
    if (!eth) return;
    setError(null);
    try {
      await eth.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: ARC_TESTNET.chainIdHex }] });
    } catch (e) {
      // 4902 = chain unknown to the wallet. Adding it is the correct recovery,
      // and only then is retrying the switch meaningful.
      const code = (e as { code?: number })?.code;
      if (code === 4902) {
        try {
          await eth.request({ method: 'wallet_addEthereumChain', params: [ARC_CHAIN_PARAMS] });
        } catch (addErr) {
          setError(humanizeError(addErr));
        }
      } else {
        setError(humanizeError(e));
      }
    }
  }, []);

  return {
    account,
    chainId,
    provider,
    connecting,
    error,
    hasWallet,
    onArc: chainId === ARC_TESTNET.chainId,
    connect,
    switchToArc,
  };
}
