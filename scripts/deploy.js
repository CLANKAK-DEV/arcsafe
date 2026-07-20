const hre = require('hardhat');

/**
 * Deploy ArcSafeFactory — the one shared contract this product needs.
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

async function assertDeployed(label, address) {
  const code = await hre.ethers.provider.getCode(address);
  if (code === '0x' || code === '0x0') {
    throw new Error(
      `${label} reported address ${address} but there is NO CODE there. ` +
        `The creation transaction reverted — check the gas limit and evmVersion.`,
    );
  }
  return (code.length - 2) / 2;
}

async function main() {
  const { ethers, network } = hre;

  const [deployer] = await ethers.getSigners();
  if (!deployer) throw new Error('No signer. Set PRIVATE_KEY in .env.');

  const balance = await ethers.provider.getBalance(deployer.address);
  const chainId = (await ethers.provider.getNetwork()).chainId;

  console.log('Deploying ArcSafe infrastructure');
  console.log(`  network   ${network.name} (chainId ${chainId})`);
  console.log(`  deployer  ${deployer.address}`);
  console.log(`  balance   ${ethers.formatEther(balance)} USDC`);

  if (balance === 0n) throw new Error('Deployer has zero balance — fund it before deploying.');

  // ── ArcSafeFactory — the product ───────────────────────────────────
  const FactoryFactory = await ethers.getContractFactory('ArcSafeFactory');
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
  const factoryBytes = await assertDeployed('ArcSafeFactory', factoryAddress);

  console.log('\nDeployed and verified on-chain:');
  console.log(`  ArcSafeFactory  ${factoryAddress}  (${factoryBytes} bytes, ${receipt.gasUsed} gas)`);

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
    await assertDeployed('Demo ArcSafe', demoAddress);

    console.log(`  Demo ArcSafe    ${demoAddress}  (${THRESHOLD} of ${OWNERS.length})`);
  }

  // ── What to do next ────────────────────────────────────────────────
  console.log('\nSet this in frontend/.env.local, then rebuild the frontend:');
  console.log(`  NEXT_PUBLIC_FACTORY_ADDRESS=${factoryAddress}`);
  if (demoAddress) console.log(`  NEXT_PUBLIC_SAFE_ADDRESS=${demoAddress}`);
  console.log('\nUsers create their own safes from the web UI. No further deployments needed.');
}

main().catch((error) => {
  console.error('\nDeployment failed:', error.message);
  process.exitCode = 1;
});
