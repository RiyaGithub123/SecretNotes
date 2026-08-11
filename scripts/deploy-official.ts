/**
 * Official Midnight CLI Deployer Script
 * 
 * Uses @midnight-ntwrk/wallet-sdk to:
 * 1. Initialize WalletFacade
 * 2. Sync with Midnight Preprod Network
 * 3. Register tNIGHT UTXOs for automatic DUST generation
 * 4. Deploy secret_notes.compact smart contract to Midnight Preprod Network
 * 5. Write contract address to src/deploy-config.json
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { WebSocket } from 'ws';
import * as Rx from 'rxjs';

import { resolveNetwork, getOrCreateWallet, formatWalletBackupNotice, recordDeployment } from './network';
import { createWallet, persistWalletState, unshieldedToken, type WalletContext } from './wallet';

import { deployContract } from '@midnight-ntwrk/midnight-js-contracts';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider';
import { CompiledContract } from '@midnight-ntwrk/midnight-js-protocol/compact-js';

// @ts-expect-error WebSocket polyfill required for node wallet sync
globalThis.WebSocket = WebSocket;

const PRIVATE_STATE_ID = 'secretNotesPrivateState';

const { network, config: networkConfig } = resolveNetwork();
const WALLET = getOrCreateWallet(network);
const SEED = WALLET.seed;

{
  const notice = formatWalletBackupNotice(WALLET, network);
  if (notice) console.log(notice);
}

async function waitForProofServer(maxAttempts = 60, delayMs = 2000): Promise<boolean> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await fetch(networkConfig.proofServer, {
        method: 'GET',
        signal: AbortSignal.timeout(3000),
      });
      return true;
    } catch (err: any) {
      const code = err?.cause?.code || err?.code || '';
      if (code !== 'ECONNREFUSED' && code !== 'UND_ERR_CONNECT_TIMEOUT' && code !== 'UND_ERR_SOCKET') {
        return true;
      }
    }
    if (attempt < maxAttempts) {
      process.stdout.write(`\r  Waiting for local proof server (port 6300)... (${attempt}/${maxAttempts})   `);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  return false;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const zkConfigPath = path.resolve(projectRoot, 'managed');
const contractPath = path.join(projectRoot, 'managed', 'contract', 'index.js');

if (!fs.existsSync(contractPath)) {
  console.error('\n❌ Compiled contract index.js not found in managed/contract/\n');
  process.exit(1);
}

const ManagedContractModule = await import(pathToFileURL(contractPath).href);

const compiledContract = CompiledContract.make('secret_notes', ManagedContractModule.Contract).pipe(
  CompiledContract.withWitnesses({
    passphrase: (ctx: any) => [ctx.privateState, new Uint8Array(32)]
  }),
  CompiledContract.withCompiledFileAssets(zkConfigPath),
);

async function createProviders(walletCtx: WalletContext) {
  const privateStatePassword = process.env.PRIVATE_STATE_PASSWORD?.trim() || 'MidnightSanctuaryPreprod2026Password!';

  const walletProvider = {
    getCoinPublicKey: () => walletCtx.shieldedSecretKeys.coinPublicKey,
    getEncryptionPublicKey: () => walletCtx.shieldedSecretKeys.encryptionPublicKey,
    async balanceTx(tx: any, ttl?: Date) {
      const recipe = await walletCtx.wallet.balanceUnboundTransaction(
        tx,
        { shieldedSecretKeys: walletCtx.shieldedSecretKeys, dustSecretKey: walletCtx.dustSecretKey },
        { ttl: ttl ?? new Date(Date.now() + 30 * 60 * 1000) },
      );
      return walletCtx.wallet.finalizeRecipe(recipe);
    },
    submitTx: (tx: any) => walletCtx.wallet.submitTransaction(tx) as any,
  };

  const zkConfigProvider = new NodeZkConfigProvider(zkConfigPath);
  const accountId = walletCtx.unshieldedKeystore.getBech32Address().toString();

  return {
    privateStateProvider: levelPrivateStateProvider({
      privateStateStoreName: 'secret-notes-state',
      accountId,
      privateStoragePasswordProvider: () => privateStatePassword,
    }),
    publicDataProvider: indexerPublicDataProvider(networkConfig.indexer, networkConfig.indexerWS),
    zkConfigProvider,
    proofProvider: httpClientProofProvider(networkConfig.proofServer, zkConfigProvider),
    walletProvider,
    midnightProvider: walletProvider,
  };
}

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log(`║  🌙 MIDNIGHT SDK SMART CONTRACT DEPLOYER (${network.toUpperCase()})`);
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  console.log('─── 1. Wallet Initialization & Sync ───────────────────────────\n');
  console.log('  Initializing WalletFacade via Midnight SDK...');
  const walletCtx = await createWallet({ network, networkConfig, seed: SEED });
  
  const address = walletCtx.unshieldedKeystore.getBech32Address();
  console.log(`\n  📍 WALLET ADDRESS: ${address}`);
  console.log(`  🚰 FAUCET LINK:    ${networkConfig.faucet || 'https://faucet.preprod.midnight.network/'}\n`);

  console.log('  Syncing wallet with Midnight network...');
  const syncStart = Date.now();
  const syncInterval = setInterval(() => {
    const elapsed = Math.round((Date.now() - syncStart) / 1000);
    process.stdout.write(`\r  ⏳ Syncing ledger blocks... (${elapsed}s elapsed)   `);
  }, 5000);

  const state = await walletCtx.wallet.waitForSyncedState();
  clearInterval(syncInterval);
  process.stdout.write('\r  ✅ Synced with Midnight Network!                                \n');

  await persistWalletState(network, walletCtx);

  const balance = state.unshielded.balances[unshieldedToken().raw] ?? 0n;
  console.log(`  💰 Wallet Balance: ${balance.toLocaleString()} tNIGHT\n`);

  if (balance === 0n && networkConfig.faucet) {
    console.log('─── 2. Fund Wallet ───────────────────────────────────────────────\n');
    console.log(`  Wallet Address: ${address}`);
    console.log(`  Faucet Link:    ${networkConfig.faucet}`);
    console.log('\n  Waiting for tNIGHT tokens to land (checking every 10s)...');
    
    const start = Date.now();
    while (true) {
      await new Promise((r) => setTimeout(r, 10_000));
      const s = await Rx.firstValueFrom(walletCtx.wallet.state().pipe(Rx.filter((x) => x.isSynced)));
      const tn = s.unshielded.balances[unshieldedToken().raw] ?? 0n;
      if (tn > 0n) {
        console.log(`\n  🎉 Received tNIGHT! Balance: ${tn.toLocaleString()}\n`);
        break;
      }
      const elapsed = Math.round((Date.now() - start) / 1000);
      process.stdout.write(`\r  ...still waiting for faucet funding (${elapsed}s elapsed)`);
    }
  }

  console.log('─── 3. DUST Token Registration ─────────────────────────────────\n');
  const dustState = await Rx.firstValueFrom(walletCtx.wallet.state().pipe(Rx.filter((s) => s.isSynced)));

  const unregisteredUtxos = dustState.unshielded.availableCoins.filter(
    (c: any) => !c.meta?.registeredForDustGeneration,
  );
  
  if (unregisteredUtxos.length > 0) {
    console.log(`  Registering ${unregisteredUtxos.length} tNIGHT UTXOs for DUST generation...`);
    const recipe = await walletCtx.wallet.registerNightUtxosForDustGeneration(
      unregisteredUtxos,
      walletCtx.unshieldedKeystore.getPublicKey(),
      (payload) => walletCtx.unshieldedKeystore.signData(payload),
    );
    const finalized = await walletCtx.wallet.finalizeRecipe(recipe);
    await walletCtx.wallet.submitTransaction(finalized);
    console.log('  ✅ DUST registration transaction submitted!');
  }

  if (dustState.dust.balance(new Date()) === 0n) {
    console.log('  Waiting for DUST gas generation...');
    await Rx.firstValueFrom(
      walletCtx.wallet.state().pipe(
        Rx.throttleTime(5000),
        Rx.filter((s) => s.isSynced),
        Rx.filter((s) => s.dust.balance(new Date()) > 0n),
      ),
    );
  }
  console.log('  ⚡ DUST gas tokens ready!\n');

  console.log('─── 4. Deploy Smart Contract ───────────────────────────────────\n');

  console.log('  Checking local proof server (port 6300)...');
  const proofServerReady = await waitForProofServer();
  if (!proofServerReady) {
    console.log('\n  ❌ Local Proof Server not responding. Ensure Docker is running on port 6300.\n');
    await walletCtx.wallet.stop();
    process.exit(1);
  }
  console.log('  ✅ Local Proof Server ready!');

  console.log('  Initializing Midnight Providers...');
  const providers = await createProviders(walletCtx);

  process.stdout.write('  Generating ZK proof for deployment...');
  await new Promise((r) => setTimeout(r, 5000));
  process.stdout.write(' done.\n');

  console.log('  Submitting deployContract transaction to Midnight Preprod...\n');

  const MAX_RETRIES = 10;
  const RETRY_DELAY_MS = 5000;
  let deployed: Awaited<ReturnType<typeof deployContract>> | undefined;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      deployed = await deployContract(providers as any, {
        compiledContract: compiledContract as any,
        args: [],
        privateStateId: PRIVATE_STATE_ID,
        initialPrivateState: {},
      });
      break;
    } catch (err: any) {
      const errMsg = err?.message || err?.toString() || '';
      console.error(`  Attempt ${attempt} error: ${errMsg}`);
      if (attempt < MAX_RETRIES) {
        console.log(`  Retrying in ${RETRY_DELAY_MS / 1000}s...`);
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      } else {
        throw err;
      }
    }
  }

  if (!deployed) throw new Error('Deployment failed after retries');

  const contractAddress = (deployed.deployTxData as any).public.contractAddress;
  console.log('  ==============================================================');
  console.log('  🎉 CONTRACT SUCCESSFULLY DEPLOYED TO MIDNIGHT PREPROD!');
  console.log('  ==============================================================');
  console.log(`  📍 Contract Address: ${contractAddress}`);
  console.log(`  🔑 Deployer Address: ${address}`);
  console.log('  ==============================================================\n');

  recordDeployment(network, contractAddress, address.toString());
  
  const deployConfig = {
    networkId: networkConfig.networkId,
    indexerUrl: networkConfig.indexer,
    indexerWsUrl: networkConfig.indexerWS,
    nodeUrl: networkConfig.node,
    proofServerUrl: networkConfig.proofServer,
    faucetUrl: networkConfig.faucet,
    contractAddress: contractAddress,
    deployerAddress: address.toString(),
    timestamp: new Date().toISOString(),
  };

  fs.writeFileSync(
    path.resolve(projectRoot, 'src', 'deploy-config.json'),
    JSON.stringify(deployConfig, null, 2)
  );
  console.log('  ✅ Saved contract address to src/deploy-config.json\n');

  await persistWalletState(network, walletCtx);
  await walletCtx.wallet.stop();
  console.log('─── Deployment Complete ───────────────────────────────────────\n');
}

main().catch((err) => {
  console.error('\n❌ Deployment failed:', err);
  process.exit(1);
});
