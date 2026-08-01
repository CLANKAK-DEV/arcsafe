const hre = require('hardhat');
const deployment = require('../frontend/src/deployments/arc-testnet.json');

async function main() {
  const { ethers } = hre;
  const address = process.env.FACTORY || deployment.factory.address;
  if (!ethers.isAddress(address)) throw new Error('No valid factory address in FACTORY or the deployment registry.');

  const network = await ethers.provider.getNetwork();
  if (Number(network.chainId) !== deployment.chainId) {
    throw new Error(`Registry targets chain ${deployment.chainId}, connected to ${network.chainId}.`);
  }

  const code = await ethers.provider.getCode(address);
  if (code === '0x') throw new Error(`No contract bytecode at ${address}.`);

  const runtimeCodeHash = ethers.keccak256(code);
  if (runtimeCodeHash.toLowerCase() !== deployment.factory.runtimeCodeHash.toLowerCase()) {
    throw new Error(
      `Factory version mismatch at ${address}. Expected ${deployment.factory.runtimeCodeHash}, got ${runtimeCodeHash}.`,
    );
  }

  const factory = await ethers.getContractAt('NoxSafeFactory', address);
  const safeCount = await factory.safeCount();
  console.log(`Verified NoxSafeFactory on chain ${network.chainId}`);
  console.log(`  address       ${address}`);
  console.log(`  bytecode      ${(code.length - 2) / 2} bytes`);
  console.log(`  runtime hash  ${runtimeCodeHash}`);
  console.log(`  safes created ${safeCount}`);
}

main().catch((error) => {
  console.error(`Factory verification failed: ${error.message}`);
  process.exitCode = 1;
});
