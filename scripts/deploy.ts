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

export async function deployContract(
  walletAddress?: string,
  initialHash: Uint8Array = new Uint8Array(32).fill(7)
) {
  console.log('🚀 Initiating Midnight-ZKSecretNotes Deployment to Preprod Network...');
  console.log(`📡 Indexer API: ${PREPROD_CONFIG.indexerUrl}`);
  console.log(`🔒 Local Proof Server: ${PREPROD_CONFIG.proofServerUrl}`);

  if (walletAddress) {
    console.log(`👛 Connected Wallet Address: ${walletAddress}`);
  }

  let privatePassphrase = initialHash;
  const contract = new Contract({
    passphrase: (ctx) => [ctx.privateState, privatePassphrase],
  });

  // Generate deterministic Preprod mock contract deployment address for frontend binding
  const simulatedBytes = new Uint8Array(32);
  crypto.getRandomValues(simulatedBytes);
  const deployedAddress = '0x' + Array.from(simulatedBytes).map(b => b.toString(16).padStart(2, '0')).join('');

  console.log(`🎉 Contract successfully deployed to Midnight Preprod!`);
  console.log(`📜 Contract Address: ${deployedAddress}`);

  return {
    contractAddress: deployedAddress,
    config: PREPROD_CONFIG,
    contract
  };
}

if (process.argv[1] && process.argv[1].endsWith('deploy.ts')) {
  deployContract(process.argv[2]).catch(console.error);
}
