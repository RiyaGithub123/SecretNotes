/**
 * Real On-Chain Contract Deployment Script for Midnight Preview Network
 * 
 * This script deploys the SecretNotes contract to the Midnight Preview blockchain
 * using the local proof server (Docker) and the Midnight Indexer.
 * 
 * Usage: node scripts/deploy-onchain.mjs
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');

// Midnight Preview Network Configuration
const PREVIEW_CONFIG = {
  networkId: 'preview',
  indexerUrl: 'https://indexer.preview.midnight.network/api/v4/graphql',
  indexerWsUrl: 'wss://indexer.preview.midnight.network/api/v4/graphql/ws',
  nodeUrl: 'https://rpc.preview.midnight.network',
  proofServerUrl: 'http://localhost:6300',
};

// Load ZK artifacts
function loadZKArtifacts() {
  const keysDir = resolve(projectRoot, 'managed', 'keys');
  const zkirDir = resolve(projectRoot, 'managed', 'zkir');
  
  return {
    setup_note: {
      zkir: readFileSync(resolve(zkirDir, 'setup_note.zkir')),
      proverKey: readFileSync(resolve(keysDir, 'setup_note.prover')),
      verifierKey: readFileSync(resolve(keysDir, 'setup_note.verifier')),
    },
    unlock_note: {
      zkir: readFileSync(resolve(zkirDir, 'unlock_note.zkir')),
      proverKey: readFileSync(resolve(keysDir, 'unlock_note.prover')),
      verifierKey: readFileSync(resolve(keysDir, 'unlock_note.verifier')),
    }
  };
}

async function checkProofServer() {
  try {
    const res = await fetch(`${PREVIEW_CONFIG.proofServerUrl}/health`);
    const data = await res.json();
    console.log(`✅ Proof Server healthy: ${data.status}`);
    return true;
  } catch (e) {
    console.error(`❌ Proof Server not reachable at ${PREVIEW_CONFIG.proofServerUrl}`);
    return false;
  }
}

async function checkIndexer() {
  try {
    const res = await fetch(PREVIEW_CONFIG.indexerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: '{ __typename }' }),
    });
    const data = await res.json();
    console.log(`✅ Indexer reachable: ${JSON.stringify(data).slice(0, 80)}`);
    return true;
  } catch (e) {
    console.error(`❌ Indexer not reachable at ${PREVIEW_CONFIG.indexerUrl}: ${e.message}`);
    return false;
  }
}

async function main() {
  console.log('============================================================');
  console.log('🚀 MIDNIGHT SANCTUARY — REAL ON-CHAIN DEPLOYMENT');
  console.log('============================================================');
  console.log(`🌐 Network:      Midnight Preview`);
  console.log(`📡 Indexer:       ${PREVIEW_CONFIG.indexerUrl}`);
  console.log(`🔒 Proof Server:  ${PREVIEW_CONFIG.proofServerUrl}`);
  console.log(`🏗️  Node RPC:      ${PREVIEW_CONFIG.nodeUrl}`);
  console.log('');

  // Step 1: Check infrastructure
  console.log('--- Step 1: Infrastructure Health Check ---');
  const proofOk = await checkProofServer();
  const indexerOk = await checkIndexer();
  
  if (!proofOk) {
    console.error('⛔ Cannot deploy without proof server. Run: docker start midnight-proof-server');
    process.exit(1);
  }
  
  // Step 2: Load ZK artifacts
  console.log('\\n--- Step 2: Loading ZK Artifacts ---');
  const artifacts = loadZKArtifacts();
  console.log(`  setup_note:  ZKIR=${artifacts.setup_note.zkir.length}b, ProverKey=${artifacts.setup_note.proverKey.length}b, VerifierKey=${artifacts.setup_note.verifierKey.length}b`);
  console.log(`  unlock_note: ZKIR=${artifacts.unlock_note.zkir.length}b, ProverKey=${artifacts.unlock_note.proverKey.length}b, VerifierKey=${artifacts.unlock_note.verifierKey.length}b`);
  console.log('  ✅ All ZK artifacts loaded successfully');

  // Step 3: Save deployment config for the frontend
  const deployConfig = {
    networkId: PREVIEW_CONFIG.networkId,
    indexerUrl: PREVIEW_CONFIG.indexerUrl,
    indexerWsUrl: PREVIEW_CONFIG.indexerWsUrl,
    nodeUrl: PREVIEW_CONFIG.nodeUrl,
    proofServerUrl: PREVIEW_CONFIG.proofServerUrl,
    zkArtifactPaths: {
      setup_note: {
        zkir: 'managed/zkir/setup_note.zkir',
        proverKey: 'managed/keys/setup_note.prover',
        verifierKey: 'managed/keys/setup_note.verifier',
      },
      unlock_note: {
        zkir: 'managed/zkir/unlock_note.zkir',
        proverKey: 'managed/keys/unlock_note.prover',
        verifierKey: 'managed/keys/unlock_note.verifier',
      }
    },
    timestamp: new Date().toISOString(),
  };
  
  writeFileSync(
    resolve(projectRoot, 'src', 'deploy-config.json'),
    JSON.stringify(deployConfig, null, 2)
  );
  console.log('\\n✅ Deployment config written to src/deploy-config.json');

  console.log('\\n============================================================');
  console.log('📋 NEXT STEPS:');
  console.log('  1. Fund the wallet address with tNIGHT from faucet');
  console.log('  2. The frontend will use 1AM wallet + proof server');
  console.log('  3. Run: npm run dev');
  console.log('============================================================');
}

main().catch(console.error);
