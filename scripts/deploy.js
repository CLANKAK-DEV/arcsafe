const hre = require('hardhat');
const fs = require('node:fs');
const path = require('node:path');

/**
 * Deploy NoxSafeFactory — the one shared contract this product needs.
 *
 * The factory is public infrastructure: it has no owner, no admin function and
 * no upgrade path. Whoever deploys it gains no authority over the safes other
 * people create through it. Each safe's owners are set by whoever calls
 * createSafe(), and only that safe's own quorum can ever change them.
 *
 * Deploy this once per network. Users then create their own safes from the
 * web UI without touching this script.
 *
 * Optionally also deploys one demo safe from OWNERS/THRESHOLD in .env, for
 * screenshots and manual testing. Off by default — a public deployment does
 * not need anyone's personal addresses baked into it.
 *
 * This script refuses to report success unless it has re-read the chain and
 * confirmed bytecode exists at the address. A creation transaction that
 * reverts still produces a `contractAddress` in its receipt.
 */

const DEPLOY_DEMO_SAFE = process.env.DEPLOY_DEMO_SAFE === 'true';
const OWNERS = (process.env.OWNERS ?? '')
  .split(',')
  .map((a) => a.trim())
  .filter(Boolean);
const THRESHOLD = Number(process.env.THRESHOLD ?? 0);

async function readDeployment(label, address) {
  const code = await hre.ethers.provider.getCode(address);
  if (code === '0x' || code === '0x0') {
    throw new Error(
      `${label} reported address ${address} but there is NO CODE there. ` +
        `The creation transaction reverted — check the gas limit and evmVersion.`,
    );
  }
  return { code, bytes: (code.length - 2) / 2, runtimeCodeHash: hre.ethers.keccak256(code) };
}

async function main() {
  const { ethers, network } = hre;

  const [deployer] = await ethers.getSigners();
  if (!deployer) throw new Error('No signer. Set PRIVATE_KEY in .env.');

  const balance = await ethers.provider.getBalance(deployer.address);
  const chainId = (await ethers.provider.getNetwork()).chainId;

  console.log('Deploying NoxSafe infrastructure');
  console.log(`  network   ${network.name} (chainId ${chainId})`);
  console.log(`  deployer  ${deployer.address}`);
  console.log(`  balance   ${ethers.formatEther(balance)} USDC`);

  if (balance === 0n) throw new Error('Deployer has zero balance — fund it before deploying.');

  // ── NoxSafeFactory — the product ───────────────────────────────────
  const FactoryFactory = await ethers.getContractFactory('NoxSafeFactory');
  const estimate = await ethers.provider.estimateGas({
    ...(await FactoryFactory.getDeployTransaction()),
    from: deployer.address,
  });
  console.log(`  estimated ${estimate.toString()} gas for the factory`);

  const factory = await FactoryFactory.deploy();
  await factory.waitForDeployment();
  const factoryAddress = await factory.getAddress();

  const receipt = await factory.deploymentTransaction().wait();
  if (receipt.status !== 1) {
    throw new Error(`Factory deployment reverted. status=${receipt.status} gasUsed=${receipt.gasUsed}`);
  }
  const factoryDeployment = await readDeployment('NoxSafeFactory', factoryAddress);

  const deploymentRecord = {
    network: 'Arc Testnet',
    chainId: Number(chainId),
    factory: {
      contract: 'NoxSafeFactory',
      version: 1,
      address: factoryAddress,
      deploymentTransaction: receipt.hash,
      deploymentBlock: receipt.blockNumber,
      runtimeCodeHash: factoryDeployment.runtimeCodeHash,
      runtimeBytecodeBytes: factoryDeployment.bytes,
    },
  };
  const registryPath = path.join(__dirname, '..', 'deployments', 'arc-testnet.json');
  fs.writeFileSync(registryPath, `${JSON.stringify(deploymentRecord, null, 2)}\n`);

  console.log('\nDeployed and verified on-chain:');
  console.log(`  NoxSafeFactory  ${factoryAddress}  (${factoryDeployment.bytes} bytes, ${receipt.gasUsed} gas)`);
  console.log(`  runtime hash    ${factoryDeployment.runtimeCodeHash}`);
  console.log(`  registry        ${registryPath}`);

  // ── Optional demo safe ─────────────────────────────────────────────
  let demoAddress = null;
  if (DEPLOY_DEMO_SAFE) {
    if (OWNERS.length === 0) throw new Error('DEPLOY_DEMO_SAFE=true but OWNERS is empty.');
    for (const owner of OWNERS) {
      if (!ethers.isAddress(owner)) {
        throw new Error(`OWNERS contains "${owner}", which is not a valid address.`);
      }
    }
    if (!Number.isInteger(THRESHOLD) || THRESHOLD < 1 || THRESHOLD > OWNERS.length) {
      throw new Error(`THRESHOLD must be a whole number in 1..${OWNERS.length}, got "${process.env.THRESHOLD}".`);
    }
    if (new Set(OWNERS.map((o) => o.toLowerCase())).size !== OWNERS.length) {
      throw new Error('Duplicate address in OWNERS');
    }
    if (THRESHOLD === 1 && OWNERS.length > 1) {
      console.warn('\n  WARNING: threshold 1 means any single owner can move funds alone.\n');
    }

    const salt = ethers.id(`demo-${Date.now()}`);
    const tx = await factory.createSafe(OWNERS, THRESHOLD, salt);
    const demoReceipt = await tx.wait();

    const event = demoReceipt.logs
      .map((l) => {
        try {
          return factory.interface.parseLog(l);
        } catch {
          return null;
        }
      })
      .find((e) => e?.name === 'SafeDeployed');
    demoAddress = event.args.safe;
    await readDeployment('Demo NoxSafe', demoAddress);

    console.log(`  Demo NoxSafe    ${demoAddress}  (${THRESHOLD} of ${OWNERS.length})`);
  }

  // ── What to do next ────────────────────────────────────────────────
  console.log('\nThe frontend now reads this verified address from deployments/arc-testnet.json.');
  if (demoAddress) console.log(`  NEXT_PUBLIC_SAFE_ADDRESS=${demoAddress}`);
  console.log('\nUsers create their own safes from the web UI. No further deployments needed.');
}

main().catch((error) => {
  console.error('\nDeployment failed:', error.message);
  process.exitCode = 1;
});
