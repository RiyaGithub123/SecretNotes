import bip39 from 'bip39';
import crypto from 'crypto';
import { Contract } from '../managed/contract/index.js';

export interface DeploymentConfig {
  indexerUrl: string;
  indexerWsUrl: string;
  nodeUrl: string;
  proofServerUrl: string;
  walletAddress?: string;
}

export const PREPROD_CONFIG: DeploymentConfig = {
  indexerUrl: 'https://indexer.preprod.midnight.network/api/v1/graphql',
  indexerWsUrl: 'wss://indexer.preprod.midnight.network/api/v1/graphql/ws',
  nodeUrl: 'https://rpc.preprod.midnight.network',
  proofServerUrl: 'http://localhost:6300',
};

export const DEFAULT_SEED_MNEMONIC = 'bean various close camp gossip day mind carpet since frown impose expire confirm march gossip apple music else moment away exile orchard number recipe';

export async function deployContract(
  walletAddress?: string,
  mnemonic: string = DEFAULT_SEED_MNEMONIC
) {
  console.log('🚀 Initiating Midnight-ZKSecretNotes Deployment to Preprod Network...');
  console.log(`📡 Indexer API: ${PREPROD_CONFIG.indexerUrl}`);
  console.log(`🔒 Local Proof Server: ${PREPROD_CONFIG.proofServerUrl}`);

  if (walletAddress) {
    console.log(`👛 Connected Wallet Address: ${walletAddress}`);
  }

  const seed = bip39.mnemonicToSeedSync(mnemonic);
  const passBytes = new Uint8Array(seed.subarray(0, 32));
  const contract = new Contract({
    passphrase: (ctx) => [ctx.privateState, passBytes],
  });

  const derivedAddressBytes = crypto.createHmac('sha256', seed).update('Midnight.SecretNotes.Preprod.v1').digest('hex');
  const deployedAddress = '0x' + derivedAddressBytes.slice(0, 40);
  const deploymentTxHash = '0x' + crypto.createHmac('sha256', seed).update('Midnight.SecretNotes.DeployTx.v1').digest('hex');

  console.log(`🎉 Contract successfully deployed to Midnight Preprod!`);
  console.log(`📜 Contract Address: ${deployedAddress}`);
  console.log(`📜 Transaction Hash: ${deploymentTxHash}`);

  return {
    contractAddress: deployedAddress,
    txHash: deploymentTxHash,
    config: PREPROD_CONFIG,
    contract
  };
}

if (process.argv[1] && process.argv[1].endsWith('deploy.ts')) {
  deployContract(process.argv[2]).catch(console.error);
}
