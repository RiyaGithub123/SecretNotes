import { deployContract } from '@midnight-ntwrk/midnight-js-contracts';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { FetchZkConfigProvider } from '@midnight-ntwrk/midnight-js-fetch-zk-config-provider';
import { Contract } from '../managed/contract/index.js';

console.log('Testing SDK imports...');
console.log('deployContract function type:', typeof deployContract);
console.log('levelPrivateStateProvider function type:', typeof levelPrivateStateProvider);
console.log('indexerPublicDataProvider function type:', typeof indexerPublicDataProvider);
console.log('httpClientProofProvider function type:', typeof httpClientProofProvider);
console.log('FetchZkConfigProvider class type:', typeof FetchZkConfigProvider);
console.log('Contract class type:', typeof Contract);
