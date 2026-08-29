/**
 * Centralized configuration module for Midnight Sanctuary
 * 
 * All network endpoints, contract addresses, and environment-specific
 * constants are managed here. No hardcoded strings elsewhere.
 */

import deployConfig from './deploy-config.json';

export const NETWORK = {
  id: deployConfig.networkId || 'preprod',
  name: deployConfig.networkId === 'preprod' ? 'Preprod' : 'Preview',
  indexerUrl: deployConfig.indexerUrl,
  indexerWsUrl: deployConfig.indexerWsUrl,
  nodeUrl: deployConfig.nodeUrl,
  proofServerUrl: deployConfig.proofServerUrl,
  faucetUrl: deployConfig.faucetUrl || 'https://faucet.preprod.midnight.network/',
} as const;

export const CONTRACT = {
  address: deployConfig.contractAddress,
  deployerAddress: deployConfig.deployerAddress || '',
  deployedAt: deployConfig.timestamp || '',
} as const;

export const STORAGE_KEYS = {
  ledger: 'midnight_sanctuary_ledger',
  passphrase: 'midnight_sanctuary_pass',
  message: 'midnight_sanctuary_msg',
  contractAddress: 'midnight_sanctuary_contract_address',
  notes: 'midnight_sanctuary_notes',
  privateState: 'midnight_ps_',
} as const;

export const APP = {
  name: 'Midnight Sanctuary',
  compactVersion: '0.31.1',
  prover: '1AM In-Browser WASM',
  description: 'Zero-Knowledge Secret Notes Vault on Midnight',
} as const;
