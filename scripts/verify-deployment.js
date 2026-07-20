const hre = require('hardhat');

/**
 * Independently verify that an address holds a working ArcSafe.
 *
 * Usage:  SAFE=0x... npx hardhat run scripts/verify-deployment.js --network arcTestnet
 *
 * Run this before putting any address in a README, on a website, or in a
 * submission. A contract address means nothing until eth_getCode is non-empty.
 */
async function main() {
  const address = process.env.SAFE;
  if (!address) throw new Error('Set SAFE=0x... in the environment.');

  const { ethers } = hre;
  const net = await ethers.provider.getNetwork();
  console.log(`Checking ${address} on chainId ${net.chainId}`);

  const code = await ethers.provider.getCode(address);
  if (code === '0x') {
    console.error('\nFAIL: no bytecode at this address. Nothing is deployed here.');
    process.exitCode = 1;
    return;
  }
  console.log(`  bytecode   ${(code.length - 2) / 2} bytes`);

  const safe = await ethers.getContractAt('ArcSafe', address);
  const [owners, threshold, txCount, balance] = await Promise.all([
    safe.getOwners(),
    safe.threshold(),
    safe.txCount(),
    ethers.provider.getBalance(address),
  ]);

  console.log(`  owners     ${owners.length}`);
  owners.forEach((o, i) => console.log(`    ${i + 1}. ${o}`));
  console.log(`  threshold  ${threshold} of ${owners.length}`);
  console.log(`  txCount    ${txCount}`);
  console.log(`  balance    ${ethers.formatEther(balance)} USDC`);

  if (threshold === 0n || threshold > BigInt(owners.length)) {
    console.error('\nFAIL: threshold is out of range.');
    process.exitCode = 1;
    return;
  }

  console.log('\nOK: live ArcSafe.');
}

main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
