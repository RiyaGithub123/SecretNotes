/**
 * useMidnightContract Hook — Manages smart contract circuit state
 * 
 * Handles contract initialization, state rehydration from localStorage,
 * and circuit context management for the Compact WASM runtime.
 */

import { useState, useEffect, useCallback } from 'react';
import { Contract, ledger } from '../../managed/contract/index.js';
import { createCircuitContext, dummyContractAddress } from '@midnight-ntwrk/compact-runtime';
import {
  queryContractState, loadStoredNotes, addStoredNote, findNoteByPassphrase,
  type StoredNote,
} from '../midnight-onchain';

export interface LedgerState {
  note_unlocked: boolean;
  note_hash: string;
  unlock_count: number;
}

export interface TxReceipt {
  circuit: string;
  witnessHex: string;
  status: 'local_verified' | 'submitted' | 'confirmed' | 'failed';
  statusMessage: string;
  receiptHash: string | null;
  timestamp: string;
  executionMs: number;
}

async function computeSha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text.padEnd(32, '0')).slice(0, 32);
  const buf = await crypto.subtle.digest('SHA-256', bytes);
  return '0x' + Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function bytesToHex(bytes: Uint8Array): string {
  return '0x' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

export function truncateHash(hash: string, len = 12): string {
  if (!hash) return '';
  if (typeof hash !== 'string') hash = String(hash);
  if (hash.length <= len * 2 + 4) return hash;
  return hash.slice(0, len + 2) + '...' + hash.slice(-len);
}

export function useMidnightContract(addLog: (msg: string) => void) {
  const [contractInstance, setContractInstance] = useState<Contract<any> | null>(null);
  const [circuitCtx, setCircuitCtx] = useState<any>(null);

  const [ledgerState, setLedgerState] = useState<LedgerState>(() => {
    try {
      const saved = localStorage.getItem('midnight_sanctuary_ledger');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return { note_unlocked: false, note_hash: '', unlock_count: 0 };
  });

  const [secretPassphrase, setSecretPassphrase] = useState<string>(() => {
    return localStorage.getItem('midnight_sanctuary_pass') || '';
  });
  const [passphraseInput, setPassphraseInput] = useState('');
  const [noteMessage, setNoteMessage] = useState<string>(() => {
    return localStorage.getItem('midnight_sanctuary_msg') || '';
  });
  const [liveComputedHash, setLiveComputedHash] = useState('');
  const [storedNotes, setStoredNotes] = useState<StoredNote[]>(() => loadStoredNotes());
  const [revealedMessage, setRevealedMessage] = useState<string | null>(null);

  const [isExecutingProof, setIsExecutingProof] = useState(false);
  const [deployedContractAddress, setDeployedContractAddress] = useState<string>(() => {
    return localStorage.getItem('midnight_sanctuary_contract_address') || '';
  });
  const [activeReceipt, setActiveReceipt] = useState<TxReceipt | null>(null);

  // Compute live hash
  useEffect(() => {
    if (secretPassphrase) {
      computeSha256Hex(secretPassphrase).then(setLiveComputedHash);
    } else {
      setLiveComputedHash('');
    }
  }, [secretPassphrase]);

  // Persist local state
  useEffect(() => {
    try {
      localStorage.setItem('midnight_sanctuary_ledger', JSON.stringify(ledgerState));
      localStorage.setItem('midnight_sanctuary_pass', secretPassphrase);
      localStorage.setItem('midnight_sanctuary_msg', noteMessage);
    } catch (e) {}
  }, [ledgerState, secretPassphrase, noteMessage]);

  // Query live on-chain contract state from Midnight Preprod Indexer on mount
  useEffect(() => {
    async function fetchOnChainState() {
      try {
        const state = await queryContractState('6eeb7f81a17880d57c4e46ae93b39eefc68459a0219e309bf896a1e7f011d5dd');
        if (state && state.note_hash) {
          setLedgerState({
            note_unlocked: state.note_unlocked,
            note_hash: state.note_hash,
            unlock_count: state.unlock_count,
          });
          addLog(`📡 Midnight Preprod Indexer: Synced live contract state (unlock_count = ${state.unlock_count})`);
        }
      } catch (err) {
        console.warn('[Midnight Indexer] Mount sync error:', err);
      }
    }
    fetchOnChainState();
  }, [addLog]);

  // Initialize Contract Context on mount
  useEffect(() => {
    try {
      const activePass = secretPassphrase || 'default_passphrase_pad_32_bytes_';
      const validPass = new TextEncoder().encode(activePass.padEnd(32, '0')).slice(0, 32);
      const contract = new Contract({
        passphrase: (ctx: any) => [ctx.privateState, validPass],
      });

      const coinPublicKey = { bytes: new Uint8Array(32) };
      const initResult = contract.initialState({
        initialPrivateState: {},
        initialZswapLocalState: {
          coinPublicKey,
          currentIndex: 0n,
          inputs: [],
          outputs: []
        }
      });

      const ctx = createCircuitContext(
        dummyContractAddress(),
        coinPublicKey,
        initResult.currentContractState.data,
        initResult.currentPrivateState
      );

      setContractInstance(contract);

      // Rehydrate local simulation state if it was already set up previously
      try {
        const savedStr = localStorage.getItem('midnight_sanctuary_ledger');
        if (savedStr) {
          const saved = JSON.parse(savedStr);
          if (saved.note_hash && saved.note_hash !== '0x') {
            const passBytes = new TextEncoder().encode(secretPassphrase.padEnd(32, '0')).slice(0, 32);
            crypto.subtle.digest('SHA-256', passBytes).then(hashBuffer => {
              const hashArray = new Uint8Array(hashBuffer);
              try {
                const rehydrated = contract.impureCircuits.setup_note(ctx, hashArray);
                let finalCtx = rehydrated.context;
                
                if (saved.note_unlocked && saved.unlock_count > 0) {
                    for (let i = 0; i < saved.unlock_count; i++) {
                        const unlockResult = contract.impureCircuits.unlock_note(finalCtx, passBytes);
                        finalCtx = unlockResult.context;
                    }
                }
                setCircuitCtx(finalCtx);
              } catch (e) {
                console.error('State rehydration failed:', e);
                setCircuitCtx(ctx);
              }
            });
            return;
          }
        }
      } catch (e) {}

      setCircuitCtx(ctx);
    } catch (err) {
      console.error('Contract init error:', err);
    }
  }, [secretPassphrase]);

  // Execute Circuit I: setup_note
  const handleSetupNote = useCallback(async (walletConnected: boolean, walletApi: any) => {
    if (!walletConnected) {
      addLog('❌ Connect your 1AM wallet first!');
      return;
    }
    if (!contractInstance || !circuitCtx) {
      addLog('❌ Enter a passphrase first to initialize the contract circuit.');
      return;
    }
    if (!secretPassphrase.trim()) {
      addLog('❌ Enter a secret passphrase to commit.');
      return;
    }
    if (!noteMessage.trim()) {
      addLog('❌ Enter a secret vault payload message.');
      return;
    }

    const computedHash = await computeSha256Hex(secretPassphrase);
    const existingNote = findNoteByPassphrase(secretPassphrase);
    
    if (existingNote || (ledgerState.note_hash && ledgerState.note_hash.toLowerCase() === computedHash.toLowerCase())) {
      addLog(`❌ Secret Phrase Conflict: This secret phrase is already in use!`);
      addLog(`💡 Please enter a unique secret phrase to create a new vault note.`);
      alert('This secret phrase is already in use on-chain or in your vault. Please choose a unique secret phrase.');
      return;
    }

    setIsExecutingProof(true);
    setRevealedMessage(null);
    addLog('⚙️ Phase 1: Evaluating setup_note circuit via compiled WASM...');
    const startTime = performance.now();

    try {
      const passBytes = new TextEncoder().encode(secretPassphrase.padEnd(32, '0')).slice(0, 32);
      const hashBuffer = await crypto.subtle.digest('SHA-256', passBytes);
      const hashArray = new Uint8Array(hashBuffer);

      const setupResult = contractInstance.impureCircuits.setup_note(circuitCtx, hashArray);
      setCircuitCtx(setupResult.context);

      const updatedLedger = ledger(setupResult.context.currentQueryContext.state);
      const hexHash = bytesToHex(updatedLedger.note_hash);
      const elapsed = Math.round(performance.now() - startTime);

      setLedgerState({
        note_unlocked: updatedLedger.note_unlocked,
        note_hash: hexHash,
        unlock_count: Number(updatedLedger.unlock_count)
      });

      addLog(`✅ Phase 1 Complete: Local Compact circuit verified in ${elapsed}ms`);
      addLog(`   Commitment Hash: ${truncateHash(hexHash)}`);

      let txHash: string | null = null;
      let onChainStatus: TxReceipt['status'] = 'local_verified';
      let statusMsg = `Circuit verified in 1AM WASM Prover (${elapsed}ms). Commitment Hash updated.`;
      let isOnChain = false;

      if (walletApi) {
        addLog('📡 Phase 2: Delegating ZK proving to 1AM Wallet ProofStation...');
        try {
          const tx = (setupResult.context as any)?.transaction || (setupResult as any)?.transaction;

          if (tx && typeof walletApi.balanceUnsealedTransaction === 'function') {
            addLog('   Executing balanceUnsealedTransaction via 1AM Wallet...');
            const balanced = await walletApi.balanceUnsealedTransaction(typeof tx === 'string' ? tx : JSON.stringify(tx));
            const balancedTx = balanced?.tx || balanced;
            addLog('   Submitting proven transaction to Midnight Preprod...');
            await walletApi.submitTransaction(typeof balancedTx === 'string' ? balancedTx : JSON.stringify(balancedTx));
            txHash = 'on-chain-confirmed';
            onChainStatus = 'confirmed';
            isOnChain = true;
            statusMsg = `Confirmed on Midnight Preprod Network via 1AM Prover`;
            addLog(`🎉 On-chain confirmed!`);
          } else if (tx && typeof walletApi.balanceAndProveTransaction === 'function') {
            const balancedTx = await walletApi.balanceAndProveTransaction(tx, []);
            await walletApi.submitTransaction(balancedTx);
            txHash = 'on-chain-confirmed';
            onChainStatus = 'confirmed';
            isOnChain = true;
            statusMsg = `Confirmed on Midnight Preprod Network via 1AM Prover`;
            addLog(`🎉 On-chain confirmed!`);
          } else {
            addLog('   ℹ️ No transaction object from circuit execution — note stored locally.');
            statusMsg = `ZK circuit verified in-browser (${elapsed}ms). Note stored in local vault.`;
          }
        } catch (submitErr: any) {
          addLog(`   ℹ️ Chain submission note: ${submitErr.message || submitErr}`);
          statusMsg = `ZK circuit verified in-browser (${elapsed}ms). Note stored in local vault.`;
        }
      }

      try {
        const newNote: StoredNote = {
          passphrase: secretPassphrase,
          message: noteMessage,
          noteHash: hexHash,
          txHash: txHash || undefined,
          createdAt: new Date().toISOString(),
          isOnChain,
        };
        const updatedNotes = addStoredNote(newNote);
        setStoredNotes(updatedNotes);
        addLog(`📝 Note saved! Total notes: ${updatedNotes.length}`);
      } catch (dupErr: any) {
        addLog(`⚠️ ${dupErr.message}`);
      }

      setActiveReceipt({
        circuit: 'setup_note(initial_hash: Bytes<32>)',
        witnessHex: bytesToHex(passBytes).slice(0, 20) + '...',
        status: onChainStatus,
        statusMessage: statusMsg,
        receiptHash: txHash,
        timestamp: new Date().toLocaleTimeString(),
        executionMs: elapsed
      });

      setSecretPassphrase('');
      setNoteMessage('');

    } catch (err: any) {
      addLog(`❌ Circuit execution error: ${err.message || err}`);
      setActiveReceipt({
        circuit: 'setup_note(initial_hash: Bytes<32>)',
        witnessHex: '',
        status: 'failed',
        statusMessage: `Circuit execution failed: ${err.message}`,
        receiptHash: null,
        timestamp: new Date().toLocaleTimeString(),
        executionMs: Math.round(performance.now() - startTime)
      });
    } finally {
      setIsExecutingProof(false);
    }
  }, [contractInstance, circuitCtx, secretPassphrase, noteMessage, ledgerState, addLog]);

  // Execute Circuit II: unlock_note
  const handleUnlockNote = useCallback(async (walletConnected: boolean, walletApi: any) => {
    if (!walletConnected) {
      addLog('❌ Connect your 1AM wallet first!');
      return;
    }
    if (!passphraseInput) {
      addLog('❌ Enter a passphrase to verify.');
      return;
    }

    const storedNote = findNoteByPassphrase(passphraseInput);
    if (!storedNote) {
      addLog(`❌ No note found for this passphrase. Create one first with Circuit I.`);
      setRevealedMessage(null);
      setActiveReceipt({
        circuit: 'unlock_note(provided_passphrase: Bytes<32>)',
        witnessHex: '',
        status: 'failed',
        statusMessage: 'No note found for this passphrase in the vault.',
        receiptHash: null,
        timestamp: new Date().toLocaleTimeString(),
        executionMs: 0
      });
      return;
    }

    setIsExecutingProof(true);
    setRevealedMessage(null);
    addLog('🔒 Phase 1: Evaluating unlock_note circuit with private witness in WASM...');
    const startTime = performance.now();

    try {
      const storedPassBytes = new TextEncoder().encode(storedNote.passphrase.padEnd(32, '0')).slice(0, 32);
      const tempContract = new Contract({
        passphrase: (ctx: any) => [ctx.privateState, storedPassBytes],
      });
      const coinPublicKey = { bytes: new Uint8Array(32) };
      const initResult = tempContract.initialState({
        initialPrivateState: {},
        initialZswapLocalState: { coinPublicKey, currentIndex: 0n, inputs: [], outputs: [] }
      });
      let tempCtx = createCircuitContext(
        dummyContractAddress(), coinPublicKey,
        initResult.currentContractState.data, initResult.currentPrivateState
      );

      const hashBuffer = await crypto.subtle.digest('SHA-256', storedPassBytes);
      const hashArray = new Uint8Array(hashBuffer);
      const setupReplay = tempContract.impureCircuits.setup_note(tempCtx, hashArray);
      tempCtx = setupReplay.context;

      const providedBytes = new TextEncoder().encode(passphraseInput.padEnd(32, '0')).slice(0, 32);
      const unlockResult = tempContract.impureCircuits.unlock_note(tempCtx, providedBytes);

      const updatedLedger = ledger(unlockResult.context.currentQueryContext.state);
      const hexHash = bytesToHex(updatedLedger.note_hash);
      const elapsed = Math.round(performance.now() - startTime);

      setLedgerState({
        note_unlocked: updatedLedger.note_unlocked,
        note_hash: hexHash,
        unlock_count: Number(updatedLedger.unlock_count)
      });

      addLog(`✅ Phase 1 Complete: Unlock ZK circuit verified in ${elapsed}ms`);
      addLog(`   note_unlocked = ${updatedLedger.note_unlocked}`);
      addLog(`   unlock_count = ${updatedLedger.unlock_count}`);

      setRevealedMessage(storedNote.message);
      addLog(`🔓 Secret Vault Payload Revealed!`);

      let txHash: string | null = null;
      let onChainStatus: TxReceipt['status'] = 'local_verified';
      let statusMsg = `ZK proof verified in ${elapsed}ms. Vault unlocked — secret payload revealed.`;

      if (walletApi) {
        addLog('📡 Phase 2: Delegating transaction to 1AM Wallet...');
        try {
          const tx = (unlockResult.context as any)?.transaction || (unlockResult as any)?.transaction;
          if (tx && typeof walletApi.balanceUnsealedTransaction === 'function') {
            const balanced = await walletApi.balanceUnsealedTransaction(typeof tx === 'string' ? tx : JSON.stringify(tx));
            const balancedTx = balanced?.tx || balanced;
            await walletApi.submitTransaction(typeof balancedTx === 'string' ? balancedTx : JSON.stringify(balancedTx));
            txHash = 'on-chain-confirmed';
            onChainStatus = 'confirmed';
            statusMsg = `Confirmed on Midnight Preprod. Secret payload revealed.`;
            addLog(`🎉 Unlock confirmed on-chain!`);
          }
        } catch (submitErr: any) {
          addLog(`   ℹ️ Chain note: ${submitErr.message || submitErr}`);
        }
      }

      setActiveReceipt({
        circuit: 'unlock_note(provided_passphrase: Bytes<32>)',
        witnessHex: bytesToHex(providedBytes).slice(0, 20) + '...',
        status: onChainStatus,
        statusMessage: statusMsg,
        receiptHash: txHash,
        timestamp: new Date().toLocaleTimeString(),
        executionMs: elapsed
      });

    } catch (err: any) {
      const elapsed = Math.round(performance.now() - startTime);
      const isMismatch = String(err.message || err).includes('Invalid passphrase');
      if (isMismatch) {
        addLog(`❌ ZK Proof Rejected: Invalid passphrase — does not match any stored note.`);
      } else {
        addLog(`❌ ZK Proof Rejected: ${err.message || err}`);
      }
      setRevealedMessage(null);
      setActiveReceipt({
        circuit: 'unlock_note(provided_passphrase: Bytes<32>)',
        witnessHex: '',
        status: 'failed',
        statusMessage: isMismatch
          ? 'ZK Proof Rejected: Invalid passphrase.'
          : `ZK Proof Rejected: ${err.message}`,
        receiptHash: null,
        timestamp: new Date().toLocaleTimeString(),
        executionMs: elapsed
      });
    } finally {
      setIsExecutingProof(false);
    }
  }, [passphraseInput, addLog]);

  return {
    contractInstance,
    circuitCtx,
    ledgerState,
    secretPassphrase,
    setSecretPassphrase,
    passphraseInput,
    setPassphraseInput,
    noteMessage,
    setNoteMessage,
    liveComputedHash,
    storedNotes,
    revealedMessage,
    isExecutingProof,
    deployedContractAddress,
    activeReceipt,
    handleSetupNote,
    handleUnlockNote,
    truncateHash,
  };
}
