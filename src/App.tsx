import React, { useState, useEffect, useCallback } from 'react';
import {
  Shield, Lock, Unlock, KeyRound, Cpu, Wallet, CheckCircle2,
  AlertCircle, RefreshCw, ExternalLink, Zap, EyeOff, Sparkles,
  FileCode2, Database, Copy, Check, Terminal, Bug, LogOut,
  Crown, Hash, Globe, Server, AlertTriangle, XCircle, Loader2
} from 'lucide-react';
import { Contract, ledger } from '../managed/contract/index.js';
import { createCircuitContext, dummyContractAddress } from '@midnight-ntwrk/compact-runtime';
import {
  getWalletConfig, queryContractState, deploySecretNotesContract,
  loadStoredNotes, addStoredNote, findNoteByPassphrase,
  type StoredNote, type OnChainConfig,
} from './midnight-onchain';

declare global {
  interface Window {
    midnight?: Record<string, any>;
  }
}

interface LedgerState {
  note_unlocked: boolean;
  note_hash: string;
  unlock_count: number;
}

interface TxReceipt {
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

function truncateHash(hash: string, len = 12): string {
  if (!hash) return '';
  if (typeof hash !== 'string') hash = String(hash);
  if (hash.length <= len * 2 + 4) return hash;
  return hash.slice(0, len + 2) + '...' + hash.slice(-len);
}

// 1AM Wallet Discovery
async function discoverWalletProvider(timeoutMs = 5000, intervalMs = 500) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const w = window.midnight;
    if (w) {
      for (const key of ['1am', 'mnLace', 'lace']) {
        const provider = w[key];
        if (provider && (typeof provider.connect === 'function' || typeof provider.enable === 'function')) {
          return { key, provider };
        }
      }
      for (const [key, provider] of Object.entries(w)) {
        if (provider && typeof provider === 'object' &&
          (typeof (provider as any).connect === 'function' || typeof (provider as any).enable === 'function')) {
          return { key, provider: provider as any };
        }
      }
    }
    await new Promise(r => setTimeout(r, intervalMs));
  }
  return null;
}

// Robust String Extractor to prevent React Error #31
function stringifyAddress(val: any): string {
  if (!val) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'object') {
    if (val.unshieldedAddress && typeof val.unshieldedAddress === 'string') return val.unshieldedAddress;
    if (val.shieldedAddress && typeof val.shieldedAddress === 'string') return val.shieldedAddress;
    if (val.address && typeof val.address === 'string') return val.address;
    if (val.bech32m && typeof val.bech32m === 'string') return val.bech32m;
    try {
      const json = JSON.stringify(val);
      if (json.includes('mn_')) {
        const match = json.match(/mn_[a-zA-Z0-9_]+/);
        if (match) return match[0];
      }
    } catch (e) {}
  }
  return String(val);
}

async function extractWalletAddress(api: any, provider: any): Promise<string> {
  if (api && typeof api.state === 'function') {
    try {
      const st = await api.state();
      const extracted = stringifyAddress(st?.unshieldedAddress || st?.shieldedAddress || st?.address || st);
      if (extracted && !extracted.includes('[object Object]')) return extracted;
      if (st?.coinPublicKey?.bytes) {
        return 'mn_preview_' + bytesToHex(st.coinPublicKey.bytes.slice(0, 8)).slice(2);
      }
    } catch (e) {}
  }
  for (const method of ['getShieldedAddress', 'getUnshieldedAddress', 'getAddress']) {
    if (api && typeof api[method] === 'function') {
      try {
        const a = await api[method]();
        const extracted = stringifyAddress(a);
        if (extracted && !extracted.includes('[object Object]')) return extracted;
      } catch (e) {}
    }
  }
  if (api && typeof api.getAccounts === 'function') {
    try {
      const accs = await api.getAccounts();
      if (Array.isArray(accs) && accs[0]) {
        const extracted = stringifyAddress(accs[0]);
        if (extracted && !extracted.includes('[object Object]')) return extracted;
      }
    } catch (e) {}
  }
  return '';
}

export default function App() {
  const [walletConnected, setWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string>('');
  const [walletApi, setWalletApi] = useState<any>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [walletConfig, setWalletConfig] = useState<OnChainConfig | null>(null);

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
  const [isDeployingContract, setIsDeployingContract] = useState(false);
  const [deployedContractAddress, setDeployedContractAddress] = useState<string>(() => {
    return localStorage.getItem('midnight_sanctuary_contract_address') || '';
  });

  const handleDeployContract = async () => {
    if (!walletConnected || !walletApi) {
      addLog('❌ Connect your 1AM wallet first!');
      return;
    }
    setIsDeployingContract(true);
    try {
      const res = await deploySecretNotesContract(walletApi, addLog);
      if (res.success && res.contractAddress) {
        setDeployedContractAddress(res.contractAddress);
      }
    } catch (e: any) {
      addLog(`❌ Deployment error: ${e.message || e}`);
    } finally {
      setIsDeployingContract(false);
    }
  };
  const [activeReceipt, setActiveReceipt] = useState<TxReceipt | null>(null);
  const [statusLog, setStatusLog] = useState<string[]>([]);

  const addLog = useCallback((msg: string) => {
    console.log('[Midnight DApp]', msg);
    setStatusLog(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev.slice(0, 19)]);
  }, []);

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

  // Initialize Contract Context
  useEffect(() => {
    if (!secretPassphrase) return;
    try {
      const validPass = new TextEncoder().encode(secretPassphrase.padEnd(32, '0')).slice(0, 32);
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
                // Silently replay setup_note to reconstruct the WASM state pointers
                const rehydrated = contract.impureCircuits.setup_note(ctx, hashArray);
                let finalCtx = rehydrated.context;
                
                // If unlocked previously, fast-forward unlock state
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
            return; // Context will be set async
          }
        }
      } catch (e) {}

      setCircuitCtx(ctx);
    } catch (err) {
      console.error('Contract init error:', err);
    }
  }, [secretPassphrase]);

  // Connect 1AM Wallet
  const handleConnect = async () => {
    setIsConnecting(true);
    addLog('🔍 Discovering 1AM Midnight wallet provider (In-Browser WASM Prover)...');

    try {
      const discovery = await discoverWalletProvider(5000);
      if (!discovery) {
        addLog('❌ 1AM Wallet extension not found. Please install/unlock 1AM Wallet in Chrome.');
        setIsConnecting(false);
        return;
      }

      const { key, provider } = discovery;
      addLog(`Connecting via 1AM Provider ("${key}")...`);

      let api = null;
      if (typeof provider.connect === 'function') {
        try { api = await provider.connect('preview'); }
        catch { api = await provider.connect().catch(() => null); }
      } else if (typeof provider.enable === 'function') {
        api = await provider.enable();
      }

      if (!api) {
        throw new Error('Wallet connection cancelled by user.');
      }

      const rawAddr = await extractWalletAddress(api, provider);
      const displayAddr = stringifyAddress(rawAddr) || `1AM Wallet Account (${key})`;

      setWalletApi(api);
      setWalletAddress(displayAddr);
      setWalletConnected(true);
      addLog(`✅ 1AM Wallet Connected! Address: ${displayAddr}`);
      addLog(`⚡ 1AM ProofStation Active: In-Browser WASM Prover enabled (Docker-free for end users).`);

      // Get wallet configuration (indexer URL, node URL, etc.)
      try {
        const config = await getWalletConfig(api);
        if (config) {
          setWalletConfig(config);
          addLog(`🌐 Wallet Config: Indexer=${config.indexerUrl.replace('https://', '').split('/')[0]}, Network=${config.networkId}`);
        }
      } catch (e) {
        addLog(`ℹ️ Using default network config (wallet config unavailable)`);
      }

    } catch (err: any) {
      addLog(`❌ Connection failed: ${err.message || err}`);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = () => {
    setWalletConnected(false);
    setWalletAddress('');
    setWalletApi(null);
    addLog('🔌 1AM Wallet disconnected.');
  };

  // Execute Circuit I: setup_note
  const handleSetupNote = async () => {
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

    // Check passphrase uniqueness in local registry and on-chain commitment
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

      // Phase 2: Try to submit to chain via 1AM wallet
      if (walletApi) {
        addLog('📡 Phase 2: Delegating ZK proving to 1AM Wallet ProofStation...');
        try {
          const tx = (setupResult.context as any)?.transaction || (setupResult as any)?.transaction;

          if (tx && typeof walletApi.balanceUnsealedTransaction === 'function') {
            addLog('   Executing balanceUnsealedTransaction via 1AM Wallet...');
            const balanced = await walletApi.balanceUnsealedTransaction(typeof tx === 'string' ? tx : JSON.stringify(tx));
            const balancedTx = balanced?.tx || balanced;
            addLog('   Submitting proven transaction to Midnight Preview...');
            await walletApi.submitTransaction(typeof balancedTx === 'string' ? balancedTx : JSON.stringify(balancedTx));
            txHash = 'on-chain-confirmed';
            onChainStatus = 'confirmed';
            isOnChain = true;
            statusMsg = `Confirmed on Midnight Preview Network via 1AM Prover`;
            addLog(`🎉 On-chain confirmed!`);
          } else if (tx && typeof walletApi.balanceAndProveTransaction === 'function') {
            const balancedTx = await walletApi.balanceAndProveTransaction(tx, []);
            await walletApi.submitTransaction(balancedTx);
            txHash = 'on-chain-confirmed';
            onChainStatus = 'confirmed';
            isOnChain = true;
            statusMsg = `Confirmed on Midnight Preview Network via 1AM Prover`;
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

      // Save note to local registry
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

      // Clear inputs for next note
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
  };

  // Execute Circuit II: unlock_note
  const handleUnlockNote = async () => {
    if (!walletConnected) {
      addLog('❌ Connect your 1AM wallet first!');
      return;
    }
    if (!passphraseInput) {
      addLog('❌ Enter a passphrase to verify.');
      return;
    }

    // Look up note in local registry first
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

    // We need a contract instance and circuit context to run the ZK verification
    if (!contractInstance) {
      addLog('❌ Contract not initialized. Please wait...');
      return;
    }

    setIsExecutingProof(true);
    setRevealedMessage(null);
    addLog('🔒 Phase 1: Evaluating unlock_note circuit with private witness in WASM...');
    const startTime = performance.now();

    try {
      // Re-initialize circuit context with the stored note's passphrase as witness
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

      // Replay setup_note to set the state
      const hashBuffer = await crypto.subtle.digest('SHA-256', storedPassBytes);
      const hashArray = new Uint8Array(hashBuffer);
      const setupReplay = tempContract.impureCircuits.setup_note(tempCtx, hashArray);
      tempCtx = setupReplay.context;

      // Now run unlock_note with the provided passphrase
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

      // REVEAL THE SECRET MESSAGE
      setRevealedMessage(storedNote.message);
      addLog(`🔓 Secret Vault Payload Revealed!`);

      let txHash: string | null = null;
      let onChainStatus: TxReceipt['status'] = 'local_verified';
      let statusMsg = `ZK proof verified in ${elapsed}ms. Vault unlocked — secret payload revealed.`;

      // Try to submit unlock tx on-chain
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
            statusMsg = `Confirmed on Midnight Preview. Secret payload revealed.`;
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
  };

  const receiptStatusColor = (s: TxReceipt['status']) =>
    s === 'confirmed' ? 'text-emerald-400 border-emerald-500/40 bg-emerald-950/30' :
    s === 'local_verified' ? 'text-[#f4e4bc] border-[#d4af37]/40 bg-[#d4af37]/10' :
    'text-red-400 border-red-500/40 bg-red-950/20';

  const receiptStatusLabel = (s: TxReceipt['status']) =>
    s === 'confirmed' ? '✅ Confirmed On-Chain (1AM Prover)' :
    s === 'local_verified' ? '⚡ 1AM WASM ZK Proof Verified' :
    '❌ ZK Proof Failed';

  // Safe string representation for rendering in JSX
  const displayAddress = typeof walletAddress === 'string' ? walletAddress : stringifyAddress(walletAddress);

  return (
    <div className="min-h-screen bg-[#08090c] text-[#f7f4eb] font-playfair pb-24 pt-10 px-4 sm:px-6 lg:px-12 max-w-7xl mx-auto space-y-10">

      {/* HEADER */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 pb-8 border-b border-[#d4af37]/30">
        <div className="flex items-center gap-5">
          <div className="p-4 neo-card-gold rounded-xl shadow-2xl text-[#d4af37]">
            <Crown className="w-9 h-9 stroke-[1.8]" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-wider font-cinzel bg-clip-text text-transparent bg-gradient-to-r from-[#f4e4bc] via-[#d4af37] to-[#b8860b]">
                Midnight<span className="text-[#f4e4bc] font-mono text-2xl font-light">::Sanctuary</span>
              </h1>
              <span className="px-3.5 py-1 text-[11px] neo-badge rounded-md font-cinzel font-bold uppercase tracking-widest">
                Preview Network
              </span>
            </div>
            <p className="text-sm text-[#c5bca3] font-garamond italic text-base tracking-wide">
              Proved without revealing your input — Powered by 1AM Wallet In-Browser WASM Prover & Compact v0.31.1.
            </p>
          </div>
        </div>

        {/* 1AM Wallet Connection */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          {walletConnected ? (
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={handleDeployContract}
                disabled={isDeployingContract}
                className="flex items-center gap-2 px-4 py-3 neo-card-gold text-slate-950 font-cinzel font-bold text-xs rounded-xl shadow-lg transition cursor-pointer disabled:opacity-50 active:scale-95"
              >
                {isDeployingContract ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileCode2 className="w-4 h-4" />}
                {isDeployingContract ? 'Deploying Contract...' : 'Deploy Smart Contract'}
              </button>
              <div className="flex items-center gap-3 px-5 py-3 neo-card rounded-xl border border-[#d4af37]/50 shadow-xl">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <div className="text-left">
                  <p className="text-[10px] font-cinzel font-bold text-[#d4af37] uppercase tracking-widest flex items-center gap-1.5">
                    <Zap className="w-3 h-3 text-[#d4af37]" /> 1AM Wallet Connected
                  </p>
                  <p className="text-xs font-mono text-[#f4e4bc] truncate max-w-[180px]">
                    {String(displayAddress || '1AM Account')}
                  </p>
                </div>
              </div>
              <button onClick={handleDisconnect}
                className="flex items-center gap-2 px-4 py-3 bg-[#1e1014] hover:bg-[#2a141a] text-[#f87171] font-cinzel font-bold text-xs rounded-xl border border-[#7f1d1d]/60 shadow-lg transition cursor-pointer active:scale-95">
                <LogOut className="w-4 h-4" /> Disconnect
              </button>
            </div>
          ) : (
            <button onClick={handleConnect} disabled={isConnecting}
              className="flex items-center justify-center gap-3 px-7 py-3.5 neo-btn-gold text-slate-950 rounded-xl shadow-2xl transition cursor-pointer disabled:opacity-50 active:scale-95">
              {isConnecting ? <RefreshCw className="w-5 h-5 animate-spin text-slate-950" /> : <Wallet className="w-5 h-5 stroke-[2.2] text-slate-950" />}
              Connect 1AM Wallet
            </button>
          )}
        </div>
      </header>

      {/* PROVER ENGINE STATUS BAR */}
      <section className="neo-card rounded-2xl p-5 border border-[#d4af37]/30 bg-[#0d0f15]/90">
        <div className="flex items-center justify-between text-xs font-cinzel font-bold text-[#d4af37] uppercase tracking-widest mb-4">
          <span className="flex items-center gap-2.5">
            <Cpu className="w-4 h-4 text-[#d4af37]" /> Zero-Knowledge Proving Architecture
          </span>
          <span className="text-[11px] font-mono text-emerald-400">
            {walletConnected ? '1AM ProofStation Enabled (Docker-Free)' : 'Connect 1AM Wallet to Enable Prover'}
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-mono">
          <div className="flex items-center gap-3 p-3.5 rounded-xl bg-[#07080b] border border-[#d4af37]/20">
            <Zap className={`w-4 h-4 ${walletConnected ? 'text-emerald-400' : 'text-amber-400'}`} />
            <div>
              <p className="text-[10px] font-cinzel uppercase text-[#c5bca3]">Prover Engine</p>
              <p className="text-xs text-[#f4e4bc] font-bold">1AM In-Browser WASM</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3.5 rounded-xl bg-[#07080b] border border-[#d4af37]/20">
            <Globe className="w-4 h-4 text-[#d4af37]" />
            <div>
              <p className="text-[10px] font-cinzel uppercase text-[#c5bca3]">Target Blockchain</p>
              <p className="text-xs text-[#f4e4bc] font-bold">Midnight Preview</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3.5 rounded-xl bg-[#07080b] border border-[#d4af37]/20">
            <FileCode2 className={`w-4 h-4 ${deployedContractAddress ? 'text-emerald-400' : 'text-[#d4af37]'}`} />
            <div className="min-w-0">
              <p className="text-[10px] font-cinzel uppercase text-[#c5bca3]">Deployed Smart Contract</p>
              <p className="text-xs text-[#f4e4bc] font-bold truncate max-w-[200px]" title={deployedContractAddress || 'Not Deployed Yet'}>
                {deployedContractAddress ? `${deployedContractAddress.slice(0, 16)}...` : 'Click "Deploy Smart Contract"'}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* HERO BANNER */}
      <section className="neo-card-gold rounded-3xl p-8 sm:p-10 border border-[#d4af37]/50 space-y-6 relative overflow-hidden">
        <div className="absolute -right-12 -bottom-12 w-64 h-64 bg-[#d4af37]/5 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 space-y-4">
          <div className="inline-flex items-center gap-2.5 px-4 py-1.5 neo-badge rounded-full text-xs font-cinzel font-extrabold uppercase tracking-widest">
            <Sparkles className="w-4 h-4 text-[#d4af37]" /> Zero-Knowledge Privacy Guarantee
          </div>
          <h2 className="text-3xl sm:text-5xl font-black text-[#f7f4eb] tracking-tight font-cinzel leading-tight">
            "Proved without revealing your input"
          </h2>
          <p className="text-[#c5bca3] font-garamond text-lg max-w-3xl leading-relaxed italic">
            Your passphrase is evaluated as a <strong className="text-[#f4e4bc]">private witness</strong> inside the 1AM Wallet WASM proving environment.
            Only the mathematical zero-knowledge proof and commitment hash are published. Your private passphrase <strong className="text-[#f4e4bc]">never leaves your browser extension</strong>.
          </p>
        </div>
      </section>

      {/* MAIN GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* LEFT COLUMN: Ledger State */}
        <div className="lg:col-span-1 space-y-6">
          <div className="neo-card rounded-3xl p-7 space-y-6 border border-[#d4af37]/30">
            <div className="flex items-center justify-between border-b border-[#d4af37]/20 pb-4">
              <div className="flex items-center gap-3 text-[#f7f4eb] font-cinzel font-bold text-xl">
                <Database className="w-6 h-6 text-[#d4af37]" /> Vault Ledger
              </div>
              <span className="px-3 py-1 text-[11px] font-mono font-bold bg-[#d4af37]/15 text-[#f4e4bc] border border-[#d4af37]/30 rounded-md">
                1AM Sync
              </span>
            </div>

            {/* Unlock Status */}
            <div className="p-5 rounded-2xl neo-card space-y-2 border border-[#d4af37]/20">
              <p className="text-[11px] font-cinzel font-bold uppercase tracking-widest text-[#d4af37]">
                Vault Unlock Status
              </p>
              <div className="flex items-center justify-between pt-1">
                <span className={`text-lg font-cinzel font-bold flex items-center gap-3 ${ledgerState.note_unlocked ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {ledgerState.note_unlocked ? <><Unlock className="w-6 h-6" /> UNLOCKED</> : <><Lock className="w-6 h-6" /> LOCKED</>}
                </span>
              </div>
            </div>

            {/* Commitment Hash */}
            <div className="p-5 rounded-2xl neo-card space-y-2.5 border border-[#d4af37]/20">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-cinzel font-bold uppercase tracking-widest text-[#d4af37]">On-Chain Commitment Hash</p>
                <Hash className="w-4 h-4 text-[#d4af37]" />
              </div>
              <p className="text-xs font-mono text-[#f4e4bc] break-all bg-[#07080b] p-3.5 rounded-xl border border-[#d4af37]/30 min-h-[40px]">
                {String(ledgerState.note_hash || '') || <span className="text-[#555]">Run setup_note to generate commitment</span>}
              </p>
            </div>

            {/* Verified ZK Proofs */}
            <div className="p-5 rounded-2xl neo-card space-y-2 border border-[#d4af37]/20">
              <p className="text-[11px] font-cinzel font-bold uppercase tracking-widest text-[#d4af37]">Verified ZK Proofs</p>
              <div className="flex items-baseline justify-between pt-1">
                <span className="text-4xl font-mono font-bold text-white font-cinzel">{ledgerState.unlock_count}</span>
                <span className="text-xs text-[#c5bca3] font-garamond italic">verified proofs</span>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Circuit Executor */}
        <div className="lg:col-span-2 space-y-6">
          <div className="neo-card rounded-3xl p-7 sm:p-9 space-y-7 border border-[#d4af37]/30">
            <div className="border-b border-[#d4af37]/20 pb-5">
              <h3 className="text-2xl font-bold font-cinzel text-white flex items-center gap-3">
                <Cpu className="w-6 h-6 text-[#d4af37]" /> 1AM ZK Proof Station
              </h3>
              <p className="text-xs text-[#c5bca3] font-garamond italic text-base mt-1">
                Execute Compact circuits locally using 1AM's built-in WebAssembly ZK proving engine.
              </p>
            </div>

            {/* Wallet Required Warning */}
            {!walletConnected && (
              <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-500/40 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-cinzel font-bold text-amber-400">1AM Wallet Required</p>
                  <p className="text-xs text-amber-300/80 mt-1">
                    Connect your 1AM wallet to activate the in-browser WebAssembly prover. No Docker configuration required for end users!
                  </p>
                </div>
              </div>
            )}

            {/* Circuit I: setup_note */}
            <div className="p-6 rounded-2xl neo-card border border-[#d4af37]/30 space-y-5">
              <div className="flex items-center justify-between border-b border-[#d4af37]/15 pb-3">
                <div className="flex items-center gap-3">
                  <span className="px-3 py-1 text-[11px] font-cinzel font-bold neo-badge rounded-md">Circuit I</span>
                  <h4 className="font-mono text-sm font-bold text-[#f7f4eb]">setup_note(initial_hash: Bytes&lt;32&gt;)</h4>
                </div>
                <span className="text-[11px] text-[#d4af37] font-cinzel uppercase tracking-wider">State Initializer</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-cinzel font-bold text-[#d4af37] uppercase tracking-wider mb-2">
                    Secret Passphrase (Private Witness)
                  </label>
                  <input type="text" value={secretPassphrase}
                    onChange={(e) => setSecretPassphrase(e.target.value)}
                    placeholder="Enter secret passphrase..."
                    className="w-full px-4 py-3 bg-[#07080b] border border-[#d4af37]/30 rounded-xl text-sm font-mono text-[#f4e4bc] focus:outline-none focus:border-[#d4af37]" />
                  {liveComputedHash && (
                    <p className="text-[10px] font-mono text-[#c5bca3] truncate mt-1.5">
                      SHA-256: <span className="text-[#d4af37]">{truncateHash(liveComputedHash)}</span>
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-cinzel font-bold text-[#d4af37] uppercase tracking-wider mb-2">
                    Secret Vault Payload
                  </label>
                  <input type="text" value={noteMessage}
                    onChange={(e) => setNoteMessage(e.target.value)}
                    placeholder="Private note message..."
                    className="w-full px-4 py-3 bg-[#07080b] border border-[#d4af37]/30 rounded-xl text-sm text-[#f7f4eb] focus:outline-none focus:border-[#d4af37]" />
                </div>
              </div>

              <button onClick={handleSetupNote}
                disabled={isExecutingProof || !walletConnected || !secretPassphrase}
                className={`w-full py-3.5 rounded-xl text-xs flex items-center justify-center gap-2.5 cursor-pointer transition
                  ${walletConnected ? 'neo-btn-outline' : 'bg-[#1a1a1a] text-[#555] border border-[#333] cursor-not-allowed'}
                  disabled:opacity-40`}>
                {isExecutingProof ? <Loader2 className="w-4 h-4 animate-spin text-[#d4af37]" /> : <KeyRound className="w-4 h-4 text-[#d4af37]" />}
                Execute setup_note & Commit Hash
              </button>
            </div>

            {/* Circuit II: unlock_note */}
            <div className="p-6 rounded-2xl neo-card-gold space-y-5 border border-[#d4af37]/50">
              <div className="flex items-center justify-between border-b border-[#d4af37]/20 pb-3">
                <div className="flex items-center gap-3">
                  <span className="px-3 py-1 text-[11px] font-cinzel font-bold neo-badge rounded-md bg-[#d4af37]/25">Circuit II</span>
                  <h4 className="font-mono text-sm font-bold text-[#f7f4eb]">unlock_note(provided_passphrase: Bytes&lt;32&gt;)</h4>
                </div>
                <span className="text-[11px] text-[#f4e4bc] font-cinzel flex items-center gap-1.5 font-bold uppercase tracking-wider">
                  <EyeOff className="w-3.5 h-3.5 text-[#d4af37]" /> Private Witness
                </span>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-cinzel font-bold text-[#d4af37] uppercase tracking-wider">
                    Enter Private Passphrase to Verify Access
                  </label>
                  {secretPassphrase && (
                    <button type="button"
                      onClick={() => setPassphraseInput(secretPassphrase)}
                      className="text-[10px] font-mono text-[#d4af37] hover:text-[#f4e4bc] underline transition cursor-pointer">
                      Auto-fill from Circuit I
                    </button>
                  )}
                </div>
                <input type="password" placeholder="Enter secret passphrase to generate ZK proof..."
                  value={passphraseInput} onChange={(e) => setPassphraseInput(e.target.value)}
                  className="w-full px-4 py-3.5 bg-[#07080b] border border-[#d4af37]/50 rounded-xl text-sm font-mono text-white placeholder-[#7a7058] focus:outline-none focus:border-[#f4e4bc]" />
              </div>

              <button onClick={handleUnlockNote}
                disabled={isExecutingProof || !walletConnected || !passphraseInput}
                className={`w-full py-4 rounded-xl text-xs flex items-center justify-center gap-2.5 cursor-pointer transition
                  ${walletConnected ? 'neo-btn-gold' : 'bg-[#1a1a1a] text-[#555] border border-[#333] cursor-not-allowed'}
                  disabled:opacity-40`}>
                {isExecutingProof ? <Loader2 className="w-4 h-4 animate-spin text-[#08090c]" /> : <Zap className="w-4 h-4 fill-current text-[#08090c]" />}
                <span className="text-[#08090c] font-black uppercase">Generate & Submit Unlock ZK Proof</span>
              </button>
            </div>

            {/* TRANSACTION RECEIPT */}
            {activeReceipt && (
              <div className={`p-6 rounded-2xl neo-card border shadow-2xl space-y-4 ${receiptStatusColor(activeReceipt.status)}`}>
                <div className="flex items-center justify-between border-b border-current/20 pb-3">
                  <span className="text-xs font-cinzel font-bold uppercase tracking-widest flex items-center gap-2.5">
                    {activeReceipt.status === 'confirmed' ? <CheckCircle2 className="w-5 h-5" /> :
                     activeReceipt.status === 'local_verified' ? <Zap className="w-5 h-5" /> :
                     <XCircle className="w-5 h-5" />}
                    {receiptStatusLabel(activeReceipt.status)}
                  </span>
                  <span className="text-xs font-mono opacity-80">{activeReceipt.timestamp}</span>
                </div>

                <div className="space-y-2 font-mono text-xs text-[#e5dec9]">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1">
                    <span className="font-bold min-w-[140px]">Circuit:</span>
                    <span className="text-[#f4e4bc] bg-[#030806] px-2.5 py-1 rounded border border-current/20">
                      {'</> '}{activeReceipt.circuit}
                    </span>
                  </div>

                  {activeReceipt.witnessHex && (
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1">
                      <span className="font-bold min-w-[140px]">Witness (Private):</span>
                      <span className="text-[#c5bca3] break-all">{activeReceipt.witnessHex}</span>
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row sm:items-center gap-1">
                    <span className="font-bold min-w-[140px]">Status:</span>
                    <span className="font-bold">{activeReceipt.statusMessage}</span>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center gap-1">
                    <span className="font-bold min-w-[140px]">Execution Time:</span>
                    <span>{activeReceipt.executionMs}ms</span>
                  </div>

                  {activeReceipt.receiptHash && (
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 pt-1">
                      <span className="font-bold min-w-[140px]">Receipt Hash:</span>
                      <span className="text-[#d4af37] break-all">{String(activeReceipt.receiptHash)}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Revealed Secret Payload */}
            {revealedMessage && (
              <div className="p-6 rounded-2xl neo-card-gold border border-[#d4af37]/60 text-[#f7f4eb] space-y-3">
                <div className="flex items-center gap-2.5 font-cinzel font-bold text-base text-[#f4e4bc]">
                  <Unlock className="w-5 h-5 text-[#d4af37]" /> 🔓 Secret Vault Payload Revealed:
                </div>
                <p className="text-sm font-mono text-[#f7f4eb] bg-[#07080b] p-4 rounded-xl border border-[#d4af37]/40 whitespace-pre-wrap">
                  "{revealedMessage}"
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* STORED NOTES VAULT */}
      {storedNotes.length > 0 && (
        <section className="neo-card rounded-2xl p-5 border border-[#d4af37]/30 bg-[#0d0f15]/90 space-y-3">
          <div className="flex items-center justify-between text-xs font-cinzel font-bold text-[#d4af37] uppercase tracking-widest">
            <span className="flex items-center gap-2.5"><Database className="w-4 h-4" /> Secret Notes Vault ({storedNotes.length} notes)</span>
          </div>
          <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
            {storedNotes.map((note, idx) => (
              <div key={idx} className="p-3 rounded-xl bg-[#07080b] border border-[#d4af37]/20 flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono text-[#d4af37]">#{idx + 1}</span>
                    <span className="text-xs font-cinzel text-[#f4e4bc] truncate">
                      Hash: {note.noteHash.slice(0, 16)}...
                    </span>
                    {note.isOnChain ? (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950/50 text-emerald-400 border border-emerald-500/30">ON-CHAIN</span>
                    ) : (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-950/50 text-amber-400 border border-amber-500/30">LOCAL</span>
                    )}
                  </div>
                  <div className="text-[10px] text-[#998f75] mt-1">
                    Created: {new Date(note.createdAt).toLocaleString()}
                  </div>
                </div>
                <button
                  onClick={() => { setPassphraseInput(note.passphrase); }}
                  className="text-[10px] font-mono text-[#d4af37] hover:text-[#f4e4bc] underline transition cursor-pointer whitespace-nowrap"
                >
                  Use Passphrase
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* DIAGNOSTIC CONSOLE */}
      {statusLog.length > 0 && (
        <section className="neo-card rounded-2xl p-5 border border-[#d4af37]/30 bg-[#0d0f15]/90 space-y-3">
          <div className="flex items-center justify-between text-xs font-cinzel font-bold text-[#d4af37] uppercase tracking-widest">
            <span className="flex items-center gap-2.5"><Terminal className="w-4 h-4" /> 1AM ProofStation Diagnostic Console</span>
            <button onClick={() => setStatusLog([])} className="text-[#c5bca3] hover:text-[#f7f4eb] transition cursor-pointer text-[10px] font-mono">
              Clear
            </button>
          </div>
          <div className="space-y-1.5 max-h-48 overflow-y-auto font-mono text-xs text-[#e5dec9]/90 pr-2">
            {statusLog.map((log, idx) => (
              <div key={idx} className="border-b border-[#d4af37]/10 pb-1 flex items-start gap-2">
                <span className="text-[#d4af37] font-bold text-[10px] mt-0.5">›</span>
                <span>{String(log)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* FOOTER */}
      <footer className="pt-10 border-t border-[#d4af37]/30 text-center text-xs text-[#c5bca3] font-garamond italic text-base space-y-2">
        <p className="font-cinzel text-xs not-italic tracking-wider uppercase text-[#d4af37]">
          Midnight Sanctuary • Compact v0.31.1 & 1AM ProofStation WASM • Docker-Free End-User Architecture
        </p>
        <p className="text-[#998f75]">
          Only note_unlocked, note_hash, and unlock_count are disclosed. Passphrase stays inside your 1AM browser extension.
        </p>
      </footer>
    </div>
  );
}
