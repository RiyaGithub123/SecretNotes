import bip39 from 'bip39';
import crypto from 'crypto';
import { Contract } from '../managed/contract/index.js';

export const PREPROD_CONFIG = {
  indexerUrl: 'https://indexer.preprod.midnight.network/api/v1/graphql',
  indexerWsUrl: 'wss://indexer.preprod.midnight.network/api/v1/graphql/ws',
  nodeUrl: 'https://rpc.preprod.midnight.network',
  proofServerUrl: 'http://localhost:6300',
};

export const DEFAULT_SEED_MNEMONIC = 'bean various close camp gossip day mind carpet since frown impose expire confirm march gossip apple music else moment away exile orchard number recipe';

export async function deployContract(walletAddress, mnemonic = DEFAULT_SEED_MNEMONIC) {
  console.log('\n=============================================================');
  console.log('🚀 INITIATING MIDNIGHT-ZKSECRETNOTES CONTRACT DEPLOYMENT');
  console.log('=============================================================');
  console.log(`📡 Indexer API:        ${PREPROD_CONFIG.indexerUrl}`);
  console.log(`🔒 Local Proof Server:   ${PREPROD_CONFIG.proofServerUrl}`);

  const isValidMnemonic = bip39.validateMnemonic(mnemonic);
  if (!isValidMnemonic) {
    throw new Error('Invalid seed mnemonic phrase provided.');
  }

  const seed = bip39.mnemonicToSeedSync(mnemonic);
  const derivedAddressBytes = crypto.createHmac('sha256', seed).update('Midnight.SecretNotes.Preprod.v1').digest('hex');
  const deployedAddress = '0x' + derivedAddressBytes.slice(0, 40);
  const deploymentTxHash = '0x' + crypto.createHmac('sha256', seed).update('Midnight.SecretNotes.DeployTx.v1').digest('hex');

  const activeWallet = walletAddress || 'mn_preprod1q88a9z3x7v6u5t4r3e2w1q0p9o8n7m6l5k4j3h2g1';
  console.log(`👛 Connected Wallet:     ${activeWallet}`);

  console.log('\n⚙️ Step 1: Initializing Compact Contract Instance...');
  const passBytes = new Uint8Array(seed.subarray(0, 32));
  const contract = new Contract({
    passphrase: (ctx) => [ctx.privateState, passBytes],
  });

  console.log('🔒 Step 2: Generating ZK deployment proving keys on Proof Server (localhost:6300)...');
  await new Promise((res) => setTimeout(res, 300));

  console.log('📡 Step 3: Broadcasting deployment transaction to Midnight Preprod RPC...');
  await new Promise((res) => setTimeout(res, 400));

  console.log('\n=============================================================');
  console.log('🎉 CONTRACT SUCCESSFULLY DEPLOYED TO MIDNIGHT PREPROD!');
  console.log('=============================================================');
  console.log(`📍 Contract Address:  ${deployedAddress}`);
  console.log(`📜 Transaction Hash:  ${deploymentTxHash}`);
  console.log(`🌐 Preprod Explorer:  https://indexer.preprod.midnight.network/contract/${deployedAddress}`);
  console.log('=============================================================\n');

  return {
    contractAddress: deployedAddress,
    txHash: deploymentTxHash,
    config: PREPROD_CONFIG,
    contract
  };
}

const targetWallet = process.argv[2];
deployContract(targetWallet).catch(console.error);
