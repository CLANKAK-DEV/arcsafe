/**
 * Chain and contract configuration.
 *
 * Verified live on 2026-07-19 against https://rpc.testnet.arc.network:
 *   eth_chainId  -> 0x4cef52 = 5042002
 *   eth_gasPrice -> 0x5017ff700 = 21.5 Gwei (docs state a 20 Gwei testnet floor)
 *
 * Gas token: USDC, not "ARC". Arc is Circle's stablecoin chain and denominates
 * all fees in USDC. Per the Arc docs, the native balance uses 18 decimals for
 * gas accounting and native transfers, while the same underlying balance is
 * also exposed through a 6-decimal ERC-20 interface. We only ever touch the
 * native side, so 18 decimals — and therefore ethers' formatEther — is correct.
 *
 * The repo previously carried three conflicting chain IDs (5042002, 5042,
 * 50420) and labelled the currency "ARC" throughout. Only 5042002 answers.
 */

export const ARC_TESTNET = {
  chainId: 5042002,
  chainIdHex: '0x4cef52',
  name: 'Arc Testnet',
  currency: { name: 'USD Coin', symbol: 'USDC', decimals: 18 },
  // Official endpoint first; the thirdweb gateway is a fallback and returns
  // identical chainId and gasPrice.
  rpcUrls: ['https://rpc.testnet.arc.network', 'https://arc-testnet.rpc.thirdweb.com'],
  explorer: 'https://testnet.arcscan.app',
} as const;

/** Shape MetaMask expects from wallet_addEthereumChain. */
export const ARC_CHAIN_PARAMS = {
  chainId: ARC_TESTNET.chainIdHex,
  chainName: ARC_TESTNET.name,
  nativeCurrency: ARC_TESTNET.currency,
  rpcUrls: [...ARC_TESTNET.rpcUrls],
  blockExplorerUrls: [ARC_TESTNET.explorer],
};

/**
 * Set after a deployment that has been verified with:
 *   SAFE=0x... npm run verify:deployment
 *
 * Deliberately empty by default. The previous build shipped a hard-coded
 * address whose deployment transaction had reverted, so every call returned
 * "0x" and the UI silently showed an empty safe. The app now checks for
 * bytecode before trusting any address — see lib/safe.ts.
 */
export const SAFE_ADDRESS = process.env.NEXT_PUBLIC_SAFE_ADDRESS ?? '';
export const FACTORY_ADDRESS = process.env.NEXT_PUBLIC_FACTORY_ADDRESS ?? '';

export const explorerAddress = (addr: string) => `${ARC_TESTNET.explorer}/address/${addr}`;
export const explorerTx = (hash: string) => `${ARC_TESTNET.explorer}/tx/${hash}`;

export const ARCSAFE_ABI = [
  // Views
  'function getOwners() view returns (address[])',
  'function ownerCount() view returns (uint256)',
  'function isOwner(address) view returns (bool)',
  'function threshold() view returns (uint256)',
  'function txCount() view returns (uint256)',
  'function configVersion() view returns (uint96)',
  'function hasApproved(uint256, address) view returns (bool)',
  'function isExecutable(uint256) view returns (bool)',
  'function getTransaction(uint256) view returns (tuple(address to, uint256 value, bytes data, uint64 expiresAt, uint32 approvals, bool executed, bool cancelled, bool stale, address proposer, bool isBatch, uint256 callCount))',
  'function getBatchCalls(uint256) view returns (tuple(address to, uint256 value, bytes data)[])',
  'function batchLength(uint256) view returns (uint256)',

  // Proposal lifecycle
  'function submit(address to, uint256 value, bytes data, uint64 expiresAt) returns (uint256)',
  'function submitBatch(tuple(address to, uint256 value, bytes data)[] calls, uint64 expiresAt) returns (uint256)',
  'function approve(uint256 txId)',
  'function revoke(uint256 txId)',
  'function execute(uint256 txId) payable returns (bytes)',

  // Config — only callable by the safe itself, i.e. through execute()
  'function addOwner(address owner, uint256 newThreshold)',
  'function removeOwner(address owner, uint256 newThreshold)',
  'function swapOwner(address oldOwner, address newOwner)',
  'function changeThreshold(uint256 newThreshold)',
  'function cancel(uint256 txId)',

  // Custom errors.
  //
  // These must be declared or ethers cannot decode a revert, and every failure
  // surfaces as the useless "execution reverted (unknown custom error)".
  // humanizeError() maps these names to plain sentences.
  'error NotOwner()',
  'error OnlySafe()',
  'error InvalidOwner()',
  'error DuplicateOwner()',
  'error InvalidThreshold()',
  'error OwnerCountBelowThreshold()',
  'error NoOwners()',
  'error TxNotFound()',
  'error TxAlreadyExecuted()',
  'error TxCancelled()',
  'error TxExpired()',
  'error TxStale()',
  'error AlreadyApproved()',
  'error NotApproved()',
  'error BelowThreshold()',
  'error ZeroTarget()',
  'error Reentrancy()',
  'error ExecutionFailed(bytes reason)',
  'error EmptyBatch()',
  'error BatchTooLarge()',
  'error BatchCallFailed(uint256 index, bytes reason)',

  // Events
  'event Deposited(address indexed sender, uint256 amount)',
  'event Submitted(uint256 indexed txId, address indexed proposer, address indexed to, uint256 value, uint64 expiresAt)',
  'event BatchSubmitted(uint256 indexed txId, address indexed proposer, uint256 callCount, uint256 totalValue, uint64 expiresAt)',
  'event Approved(uint256 indexed txId, address indexed owner, uint256 approvals)',
  'event Revoked(uint256 indexed txId, address indexed owner, uint256 approvals)',
  'event Executed(uint256 indexed txId, bytes returnData)',
  'event OwnerAdded(address indexed owner)',
  'event OwnerRemoved(address indexed owner)',
  'event ThresholdChanged(uint256 previous, uint256 current)',
] as const;

export const FACTORY_ABI = [
  'function createSafe(address[] owners, uint256 threshold, bytes32 salt) returns (address)',
  'function predictAddress(address deployer, address[] owners, uint256 threshold, bytes32 salt) view returns (address)',
  'function safesOf(address owner) view returns (address[])',
  'function safeCount() view returns (uint256)',

  // Custom errors — declared so ethers can decode a factory revert instead of
  // surfacing "unknown custom error". humanizeError() maps these to sentences.
  'error NoOwners()',
  'error SafeAlreadyExists()',

  'event SafeDeployed(address indexed safe, address indexed deployer, address[] owners, uint256 threshold, bytes32 salt)',
] as const;
