require('dotenv').config();
require('@nomicfoundation/hardhat-toolbox');

/**
 * An empty accounts array is deliberate when PRIVATE_KEY is unset: hardhat
 * then has no signer for that network, so `npm test` and `compile` still work
 * offline while any deploy attempt fails loudly instead of silently using a
 * placeholder key.
 */
const PRIVATE_KEY = process.env.PRIVATE_KEY?.trim();

if (PRIVATE_KEY && !/^0x[0-9a-fA-F]{64}$/.test(PRIVATE_KEY)) {
  throw new Error(
    'PRIVATE_KEY in .env must be a 0x-prefixed 64-character hex string. ' +
      'Check for a missing 0x prefix, a stray quote, or a truncated paste.',
  );
}

const accounts = PRIVATE_KEY ? [PRIVATE_KEY] : [];

/**
 * Arc Testnet — the official endpoint from docs.arc.io, verified live on
 * 2026-07-19: eth_chainId -> 0x4cef52 (5042002), eth_gasPrice -> 21.5 Gwei.
 *
 * The previous config pointed at https://rpc-testnet-1.arc.network — close to
 * the real host but wrong, and it returns nothing — with chainId 50420, plus a
 * separate `arc` network on chainId 5042. Neither matched the chain the
 * contract was actually deployed against.
 *
 * Note: gas is paid in USDC, not a token called "ARC". Arc is Circle's
 * stablecoin chain; the native balance is 18 decimals for gas accounting.
 */
const ARC_TESTNET_RPC = process.env.ARC_TESTNET_RPC || 'https://rpc.testnet.arc.network';

/** @type {import('hardhat/config').HardhatUserConfig} */
module.exports = {
  solidity: {
    version: '0.8.24',
    settings: {
      optimizer: { enabled: true, runs: 200 },
      // Arc's documented baseline is the Osaka hard fork, so PUSH0 and the
      // Shanghai/Cancun opcodes are all available — the earlier worry that
      // PUSH0 might be unsupported was unfounded.
      //
      // Paris is kept anyway, deliberately: it is a strict subset of what Arc
      // executes, costs a negligible amount of extra gas, and one deployment
      // has already been lost on this chain. Raise to 'cancun' for slightly
      // cheaper bytecode once a deployment has succeeded.
      evmVersion: 'paris',
    },
  },
  networks: {
    hardhat: {
      chainId: 31337,
    },
    arcTestnet: {
      url: ARC_TESTNET_RPC,
      chainId: 5042002,
      accounts,
      // The original deployment reverted with gasUsed == gasLimit == 2,000,000.
      // ArcSafe's runtime is ~9.7 KB, and code deposit alone costs 200 gas/byte
      // (~1.94M) before constructor execution — it never had room to finish.
      gas: 6_000_000,
    },
  },
  // Contract verification on arcscan (a Blockscout instance). Blockscout ignores
  // the API key, but hardhat-verify requires the field to be present.
  etherscan: {
    apiKey: {
      arcTestnet: 'empty',
    },
    customChains: [
      {
        network: 'arcTestnet',
        chainId: 5042002,
        urls: {
          apiURL: 'https://testnet.arcscan.app/api',
          browserURL: 'https://testnet.arcscan.app',
        },
      },
    ],
  },
  sourcify: {
    enabled: false,
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS === 'true',
    currency: 'USD',
  },
  mocha: {
    timeout: 60_000,
  },
};
