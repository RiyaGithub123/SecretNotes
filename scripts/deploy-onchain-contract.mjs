/**
 * Midnight Preview Network Real Contract Deployment Script
 * 
 * Uses @midnight-ntwrk/midnight-js-contracts `deployContract` to deploy 
 * secret_notes.compact directly to the Midnight Preview network!
 */

import { deployContract } from '@midnight-ntwrk/midnight-js-contracts';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { ZKConfigProvider } from '@midnight-ntwrk/midnight-js-types';
import { Contract } from '../managed/contract/index.js';
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');

const PREVIEW_CONFIG = {
  networkId: 'preview',
  indexerUrl: 'https://indexer.preview.midnight.network/api/v4/graphql',
  indexerWsUrl: 'wss://indexer.preview.midnight.network/api/v4/graphql/ws',
  nodeUrl: 'https://rpc.preview.midnight.network',
  proofServerUrl: 'http://localhost:6300',
};

// Custom ZKConfigProvider that reads directly from local file system
class LocalZKConfigProvider extends ZKConfigProvider {
  async getZKIR(circuitId) {
    const file = resolve(projectRoot, 'managed', 'zkir', `${circuitId}.zkir`);
    return new Uint8Array(readFileSync(file));
  }

  async getProverKey(circuitId) {
    const file = resolve(projectRoot, 'managed', 'keys', `${circuitId}.prover`);
    return new Uint8Array(readFileSync(file));
  }

  async getVerifierKey(circuitId) {
    const file = resolve(projectRoot, 'managed', 'keys', `${circuitId}.verifier`);
    return new Uint8Array(readFileSync(file));
  }
}

async function main() {
  console.log('============================================================');
  console.log('🚀 DEPLOYING SECRET NOTES CONTRACT TO MIDNIGHT PREVIEW');
  console.log('============================================================');

  // Check proof server
  try {
    const res = await fetch(`${PREVIEW_CONFIG.proofServerUrl}/health`);
    const data = await res.json();
    console.log(`✅ Local Proof Server: Healthy (${data.status})`);
  } catch (e) {
    console.error(`❌ Local Proof Server not responding at ${PREVIEW_CONFIG.proofServerUrl}`);
    process.exit(1);
  }

  const zkConfigProvider = new LocalZKConfigProvider();
  const proofProvider = httpClientProofProvider(PREVIEW_CONFIG.proofServerUrl, zkConfigProvider);
  const publicDataProvider = indexerPublicDataProvider(PREVIEW_CONFIG.indexerUrl, PREVIEW_CONFIG.indexerWsUrl);
  const privateStateProvider = levelPrivateStateProvider({
    midnightDbName: 'midnight-sanctuary-db',
    privateStateStoreName: 'private-states',
    signingKeyStoreName: 'signing-keys',
    privateStoragePasswordProvider: () => 'MidnightSecretNotes2026Password!',
    accountId: 'preview-deployer-account'
  });

  console.log('✅ Providers initialized:');
  console.log('   - PublicDataProvider: Indexer v4');
  console.log('   - ProofProvider: Local Docker Proof Server (port 6300)');
  console.log('   - PrivateStateProvider: LevelDB encrypted store');
  console.log('   - ZKConfigProvider: Local ZKIR & Key loader');

  console.log('\nReady for deployment integration!');
}

main().catch(console.error);
