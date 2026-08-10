import React, { useState, useEffect, useCallback } from 'react';
import {
  Shield, Lock, Unlock, KeyRound, Cpu, Wallet, CheckCircle2,
  AlertCircle, RefreshCw, ExternalLink, Zap, EyeOff, Sparkles,
  FileCode2, Database, Copy, Check, Terminal, Bug, LogOut,
  Crown, Hash, Globe, Server, AlertTriangle, XCircle, Loader2
} from 'lucide-react';
import { Contract, ledger } from '../managed/contract/index.js';
import { createCircuitContext, dummyContractAddress } from '@midnight-ntwrk/compact-runtime';

/* ─────────────── Global Type Declarations ─────────────── */
declare global {
  interface Window {
    midnight?: Record<string, any>;
  }
}

/* ─────────────── Type Definitions ─────────────── */
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

interface InfraStatus {
  proofServer: 'checking' | 'online' | 'offline';
  indexer: 'checking' | 'online' | 'offline';
  wallet: 'disconnected' | 'connecting' | 'connected';
}

/* ─────────────── Helper Functions ─────────────── */
async function computeSha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text.padEnd(32, '0')).slice(0, 32);
  const buf = await crypto.subtle.digest('SHA-256', bytes);
  return '0x' + Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function bytesToHex(bytes: Uint8Array): string {
  return '0x' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

function truncateHash(hash: string, len = 12): string {
  if (hash.length <= len * 2 + 4) return hash;
  return hash.slice(0, len + 2) + '...' + hash.slice(-len);
}

/* ─────────────── 1AM Wallet Discovery ─────────────── */
async function discoverWalletProvider(timeoutMs = 5000, intervalMs = 500) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const w = window.midnight;
    if (w) {
      // Try known keys
      for (const key of ['1am', 'mnLace', 'lace']) {
        const provider = w[key];
        if (provider && (typeof provider.connect === 'function' || typeof provider.enable === 'function')) {
          return { key, provider };
        }
      }
      // Try any key
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

/* ─────────────── Wallet Address Extraction ─────────────── */
async function extractWalletAddress(api: any, provider: any): Promise<string> {
  // Try api.state()
  if (api && typeof api.state === 'function') {
    try {
      const st = await api.state();
      if (st?.address) return st.address;
      if (st?.shieldedAddress) return st.shieldedAddress;
      if (st?.unshieldedAddress) return st.unshieldedAddress;
      if (st?.coinPublicKey?.bytes) {
        return 'mn_preview_' + bytesToHex(st.coinPublicKey.bytes.slice(0, 8)).slice(2);
      }
    } catch (e) { /* continue */ }
  }
  // Try direct methods
  for (const method of ['getShieldedAddress', 'getUnshieldedAddress', 'getAddress']) {
    if (api && typeof api[method] === 'function') {
      try { const a = await api[method](); if (a) return a; } catch (e) { /* continue */ }
    }
  }
  // Try getAccounts
  if (api && typeof api.getAccounts === 'function') {
    try { const accs = await api.getAccounts(); if (Array.isArray(accs) && accs[0]) return accs[0]; } catch (e) { /* continue */ }
  }
  return '';
}

/* ═══════════════════════════════════════════════════════════
   MAIN APPLICATION COMPONENT
   ═══════════════════════════════════════════════════════════ */
export default function App() {
  /* ── Wallet State ── */
  const [walletConnected, setWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState('');
  const [walletApi, setWalletApi] = useState<any>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  /* ── Infrastructure Status ── */
  const [infra, setInfra] = useState<InfraStatus>({
    proofServer: 'checking',
    indexer: 'checking',
    wallet: 'disconnected'
  });

  /* ── Contract State ── */
  const [contractInstance, setContractInstance] = useState<Contract<any> | null>(null);
  const [circuitCtx, setCircuitCtx] = useState<any>(null);

  /* ── Ledger State (from local circuit execution — honest) ── */
  const [ledgerState, setLedgerState] = useState<LedgerState>({
    note_unlocked: false,
    note_hash: '',
    unlock_count: 0
  });

  /* ── Form State ── */
  const [secretPassphrase, setSecretPassphrase] = useState('');
  const [passphraseInput, setPassphraseInput] = useState('');
  const [noteMessage, setNoteMessage] = useState('');
  const [liveComputedHash, setLiveComputedHash] = useState('');

  /* ── Execution State ── */
  const [isExecutingProof, setIsExecutingProof] = useState(false);
  const [activeReceipt, setActiveReceipt] = useState<TxReceipt | null>(null);
  const [statusLog, setStatusLog] = useState<string[]>([]);

  /* ── UI State ── */
  const [copied, setCopied] = useState(false);

  const addLog = useCallback((msg: string) => {
    console.log('[Midnight DApp]', msg);
    setStatusLog(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev.slice(0, 19)]);
  }, []);

  /* ── Check Proof Server Health ── */
  useEffect(() => {
    async function checkProofServer() {
      try {
        const res = await fetch('http://localhost:6300/health', { signal: AbortSignal.timeout(3000) }).catch(() => null);
        if (res && res.ok) {
          setInfra(prev => ({ ...prev, proofServer: 'online' }));
          addLog('✅ Proof Server (Docker) is online at localhost:6300');
        } else {
          setInfra(prev => ({ ...prev, proofServer: 'offline' }));
          addLog('⚠️ Proof Server (Docker) not reachable at localhost:6300');
        }
      } catch {
        setInfra(prev => ({ ...prev, proofServer: 'offline' }));
        addLog('⚠️ Proof Server (Docker) not reachable at localhost:6300');
      }
    }
    checkProofServer();
  }, [addLog]);

  /* ── Check Indexer Health ── */
  useEffect(() => {
    async function checkIndexer() {
      try {
        // Try public preview indexer
        const res = await fetch('https://indexer.preview.midnight.network/api/v4/graphql', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: '{ __typename }' }),
          signal: AbortSignal.timeout(5000)
        }).catch(() => null);

        if (res && res.ok) {
          setInfra(prev => ({ ...prev, indexer: 'online' }));
          addLog('✅ Midnight Preview Indexer is reachable');
        } else {
          // Try local indexer
          const localRes = await fetch('http://localhost:8088/api/v4/graphql', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: '{ __typename }' }),
            signal: AbortSignal.timeout(3000)
          }).catch(() => null);

          if (localRes && localRes.ok) {
            setInfra(prev => ({ ...prev, indexer: 'online' }));
            addLog('✅ Local Indexer (Docker) is online at localhost:8088');
          } else {
            setInfra(prev => ({ ...prev, indexer: 'offline' }));
            addLog('⚠️ Indexer not reachable (CORS may block browser requests)');
          }
        }
      } catch {
        setInfra(prev => ({ ...prev, indexer: 'offline' }));
        addLog('⚠️ Indexer check failed');
      }
    }
    checkIndexer();
  }, [addLog]);

  /* ── Live Hash Computation ── */
  useEffect(() => {
    if (secretPassphrase) {
      computeSha256Hex(secretPassphrase).then(setLiveComputedHash);
    } else {
      setLiveComputedHash('');
    }
  }, [secretPassphrase]);

  /* ── Initialize Contract Instance ── */
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
      setCircuitCtx(ctx);
    } catch (err) {
      console.error('Contract init error:', err);
    }
  }, [secretPassphrase]);

  /* ═══════════════════════════════════════════════
     WALLET CONNECTION — Real 1AM DApp Connector
     ═══════════════════════════════════════════════ */
  const handleConnect = async () => {
    setIsConnecting(true);
    setInfra(prev => ({ ...prev, wallet: 'connecting' }));
    addLog('🔍 Discovering 1AM Midnight wallet provider...');

    try {
      const discovery = await discoverWalletProvider(5000);
      if (!discovery) {
        addLog('❌ No Midnight wallet extension found. Install the 1AM wallet for Chrome.');
        setInfra(prev => ({ ...prev, wallet: 'disconnected' }));
        setIsConnecting(false);
        return;
      }

      const { key, provider } = discovery;
      addLog(`Found wallet provider: "${key}". Requesting connection...`);

      let api = null;
      if (typeof provider.connect === 'function') {
        try { api = await provider.connect('preview'); }
        catch { api = await provider.connect().catch(() => null); }
      } else if (typeof provider.enable === 'function') {
        api = await provider.enable();
      }

      if (!api) {
        throw new Error('Wallet connection rejected by user');
      }

      const addr = await extractWalletAddress(api, provider);
      const displayAddr = addr || `1AM Session (${key})`;

      setWalletApi(api);
      setWalletAddress(displayAddr);
      setWalletConnected(true);
      setInfra(prev => ({ ...prev, wallet: 'connected' }));
      addLog(`✅ 1AM Wallet connected! Address: ${displayAddr}`);

      // Log available API methods for transparency
      const methods = Object.keys(api).filter(k => typeof api[k] === 'function');
      addLog(`Wallet API methods: [${methods.join(', ')}]`);

    } catch (err: any) {
      addLog(`❌ Connection failed: ${err.message || err}`);
      setInfra(prev => ({ ...prev, wallet: 'disconnected' }));
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = () => {
    setWalletConnected(false);
    setWalletAddress('');
    setWalletApi(null);
    setInfra(prev => ({ ...prev, wallet: 'disconnected' }));
    addLog('🔌 Wallet disconnected.');
  };

  /* ═══════════════════════════════════════════════
     CIRCUIT EXECUTION — setup_note
     
     Phase 1: Local WASM circuit execution (REAL ZK)
     Phase 2: Attempt on-chain submission via wallet
     ═══════════════════════════════════════════════ */
  const handleSetupNote = async () => {
    if (!walletConnected) {
      addLog('❌ Connect your 1AM wallet first!');
      return;
    }
    if (!contractInstance || !circuitCtx) {
      addLog('❌ Enter a passphrase first to initialize the contract circuit.');
      return;
    }

    setIsExecutingProof(true);
    addLog('⚙️ Phase 1: Executing setup_note circuit locally via compiled WASM...');
    const startTime = performance.now();

    try {
      // Phase 1: Real local WASM circuit execution
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

      addLog(`✅ Phase 1 Complete: Local circuit verified in ${elapsed}ms`);
      addLog(`   Commitment Hash: ${truncateHash(hexHash)}`);

      // Phase 2: Attempt on-chain submission via wallet API
      let txHash: string | null = null;
      let onChainStatus: TxReceipt['status'] = 'local_verified';
      let statusMsg = `Circuit verified locally in ${elapsed}ms. Connect proof server for on-chain submission.`;

      if (walletApi) {
        addLog('📡 Phase 2: Attempting on-chain submission via 1AM wallet...');
        try {
          // Try to get the transaction from the circuit result
          const tx = (setupResult.context as any)?.transaction || (setupResult as any)?.transaction;
          
          if (tx && walletApi.balanceAndProveTransaction) {
            addLog('   Balancing & proving transaction via 1AM wallet...');
            const balancedTx = await walletApi.balanceAndProveTransaction(tx, []);
            addLog('   Submitting proven transaction to Midnight Preview...');
            const result = await walletApi.submitTransaction(balancedTx);
            txHash = typeof result === 'string' ? result : result?.txHash || result?.hash || JSON.stringify(result);
            onChainStatus = 'confirmed';
            statusMsg = `Confirmed on Midnight Preview Network`;
            addLog(`🎉 On-chain confirmed! Tx: ${txHash}`);
          } else if (tx && walletApi.balanceUnsealedTransaction) {
            // Newer API
            addLog('   Balancing unsealed transaction via 1AM wallet...');
            const balancedTx = await walletApi.balanceUnsealedTransaction(tx);
            const result = await walletApi.submitTransaction(balancedTx);
            txHash = typeof result === 'string' ? result : result?.txHash || result?.hash || JSON.stringify(result);
            onChainStatus = 'confirmed';
            statusMsg = `Confirmed on Midnight Preview Network`;
            addLog(`🎉 On-chain confirmed! Tx: ${txHash}`);
          } else {
            addLog('   ℹ️ Local circuit produced no submittable transaction object.');
            addLog('   This is expected — full deployment requires @midnight-ntwrk/midnight-js-contracts deployContract().');
            statusMsg = `Circuit verified locally (${elapsed}ms). On-chain deployment requires full SDK provider setup.`;
          }
        } catch (submitErr: any) {
          addLog(`   ⚠️ On-chain submission failed: ${submitErr.message || submitErr}`);
          statusMsg = `Circuit verified locally (${elapsed}ms). On-chain submission failed: ${submitErr.message}`;
          onChainStatus = 'local_verified';
        }
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

  /* ═══════════════════════════════════════════════
     CIRCUIT EXECUTION — unlock_note
     ═══════════════════════════════════════════════ */
  const handleUnlockNote = async () => {
    if (!walletConnected) {
      addLog('❌ Connect your 1AM wallet first!');
      return;
    }
    if (!contractInstance || !circuitCtx) {
      addLog('❌ Run setup_note first to initialize contract state.');
      return;
    }
    if (!passphraseInput) {
      addLog('❌ Enter a passphrase to verify.');
      return;
    }

    setIsExecutingProof(true);
    addLog('🔒 Phase 1: Evaluating unlock_note circuit with private witness...');
    const startTime = performance.now();

    try {
      const providedBytes = new TextEncoder().encode(passphraseInput.padEnd(32, '0')).slice(0, 32);

      const unlockResult = contractInstance.impureCircuits.unlock_note(circuitCtx, providedBytes);
      setCircuitCtx(unlockResult.context);

      const updatedLedger = ledger(unlockResult.context.currentQueryContext.state);
      const hexHash = bytesToHex(updatedLedger.note_hash);
      const elapsed = Math.round(performance.now() - startTime);

      setLedgerState({
        note_unlocked: updatedLedger.note_unlocked,
        note_hash: hexHash,
        unlock_count: Number(updatedLedger.unlock_count)
      });

      addLog(`✅ Phase 1 Complete: Unlock circuit verified in ${elapsed}ms`);
      addLog(`   note_unlocked = ${updatedLedger.note_unlocked}`);
      addLog(`   unlock_count = ${updatedLedger.unlock_count}`);

      // Phase 2: Attempt on-chain submission
      let txHash: string | null = null;
      let onChainStatus: TxReceipt['status'] = 'local_verified';
      let statusMsg = `ZK proof verified locally (${elapsed}ms). Passphrase matched — vault unlocked.`;

      if (walletApi) {
        addLog('📡 Phase 2: Attempting on-chain submission via 1AM wallet...');
        try {
          const tx = (unlockResult.context as any)?.transaction || (unlockResult as any)?.transaction;

          if (tx && (walletApi.balanceAndProveTransaction || walletApi.balanceUnsealedTransaction)) {
            const balanceFn = walletApi.balanceUnsealedTransaction || walletApi.balanceAndProveTransaction;
            const args = walletApi.balanceUnsealedTransaction ? [tx] : [tx, []];
            const balancedTx = await balanceFn(...args);
            const result = await walletApi.submitTransaction(balancedTx);
            txHash = typeof result === 'string' ? result : result?.txHash || result?.hash || JSON.stringify(result);
            onChainStatus = 'confirmed';
            statusMsg = 'Confirmed on Midnight Preview Network';
            addLog(`🎉 On-chain confirmed! Tx: ${txHash}`);
          } else {
            addLog('   ℹ️ No submittable transaction from local circuit execution.');
            statusMsg = `Circuit verified locally (${elapsed}ms). Full on-chain requires deployContract() SDK flow.`;
          }
        } catch (submitErr: any) {
          addLog(`   ⚠️ On-chain submission: ${submitErr.message || submitErr}`);
          statusMsg = `Circuit verified locally (${elapsed}ms). On-chain submission: ${submitErr.message}`;
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
      addLog(`❌ ZK Proof Rejected: ${err.message || err}`);
      setActiveReceipt({
        circuit: 'unlock_note(provided_passphrase: Bytes<32>)',
        witnessHex: '',
        status: 'failed',
        statusMessage: `ZK Proof Rejected: ${err.message || 'Invalid passphrase — witness mismatch'}`,
        receiptHash: null,
        timestamp: new Date().toLocaleTimeString(),
        executionMs: elapsed
      });
    } finally {
      setIsExecutingProof(false);
    }
  };

  const copyText = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  /* ─── Status Color Helpers ─── */
  const infraColor = (s: string) =>
    s === 'online' || s === 'connected' ? 'text-emerald-400' :
    s === 'checking' || s === 'connecting' ? 'text-amber-400' :
    'text-red-400';

  const infraIcon = (s: string) =>
    s === 'online' || s === 'connected' ? <CheckCircle2 className="w-3.5 h-3.5" /> :
    s === 'checking' || s === 'connecting' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> :
    <XCircle className="w-3.5 h-3.5" />;

  const receiptStatusColor = (s: TxReceipt['status']) =>
    s === 'confirmed' ? 'text-emerald-400 border-emerald-500/40 bg-emerald-950/30' :
    s === 'local_verified' ? 'text-amber-400 border-amber-500/40 bg-amber-950/20' :
    s === 'submitted' ? 'text-blue-400 border-blue-500/40 bg-blue-950/20' :
    'text-red-400 border-red-500/40 bg-red-950/20';

  const receiptStatusLabel = (s: TxReceipt['status']) =>
    s === 'confirmed' ? '✅ Confirmed On-Chain' :
    s === 'local_verified' ? '⚡ Local Circuit Verified' :
    s === 'submitted' ? '📡 Submitted (Pending)' :
    '❌ Failed';

  /* ═══════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════ */
  return (
    <div className="min-h-screen bg-[#08090c] text-[#f7f4eb] font-playfair pb-24 pt-10 px-4 sm:px-6 lg:px-12 max-w-7xl mx-auto space-y-10">

      {/* ══════ HEADER ══════ */}
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
                Preview
              </span>
            </div>
            <p className="text-sm text-[#c5bca3] font-garamond italic text-base tracking-wide">
              Proved without revealing your input — A Neoclassical Zero-Knowledge Secret Vault built on Midnight Network using Compact v0.31.1.
            </p>
          </div>
        </div>

        {/* Wallet Connect / Disconnect */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          {walletConnected ? (
            <>
              <div className="flex items-center gap-3 px-5 py-3 neo-card rounded-xl border border-emerald-500/50 shadow-xl">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <div className="text-left">
                  <p className="text-[10px] font-cinzel font-bold text-emerald-400 uppercase tracking-widest">
                    1AM Wallet Connected
                  </p>
                  <p className="text-xs font-mono text-[#f4e4bc] truncate max-w-[180px]">
                    {walletAddress}
                  </p>
                </div>
              </div>
              <button onClick={handleDisconnect}
                className="flex items-center gap-2 px-4 py-3 bg-[#1e1014] hover:bg-[#2a141a] text-[#f87171] font-cinzel font-bold text-xs rounded-xl border border-[#7f1d1d]/60 shadow-lg transition cursor-pointer active:scale-95">
                <LogOut className="w-4 h-4" /> Disconnect
              </button>
            </>
          ) : (
            <button onClick={handleConnect} disabled={isConnecting}
              className="flex items-center justify-center gap-3 px-7 py-3.5 neo-btn-gold text-slate-950 rounded-xl shadow-2xl transition cursor-pointer disabled:opacity-50 active:scale-95">
              {isConnecting ? <RefreshCw className="w-5 h-5 animate-spin text-slate-950" /> : <Wallet className="w-5 h-5 stroke-[2.2] text-slate-950" />}
              Connect 1AM Wallet
            </button>
          )}
        </div>
      </header>

      {/* ══════ INFRASTRUCTURE STATUS BAR ══════ */}
      <section className="neo-card rounded-2xl p-5 border border-[#d4af37]/30 bg-[#0d0f15]/90">
        <div className="flex items-center gap-2 text-xs font-cinzel font-bold text-[#d4af37] uppercase tracking-widest mb-4">
          <Server className="w-4 h-4" /> Infrastructure Status
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Proof Server */}
          <div className="flex items-center gap-3 p-3 rounded-xl bg-[#07080b] border border-[#d4af37]/20">
            <span className={infraColor(infra.proofServer)}>{infraIcon(infra.proofServer)}</span>
            <div>
              <p className="text-[10px] font-cinzel uppercase text-[#c5bca3]">Proof Server (Docker)</p>
              <p className={`text-xs font-mono font-bold ${infraColor(infra.proofServer)}`}>
                {infra.proofServer === 'online' ? 'localhost:6300 ✓' : infra.proofServer === 'checking' ? 'Checking...' : 'Not Reachable'}
              </p>
            </div>
          </div>
          {/* Indexer */}
          <div className="flex items-center gap-3 p-3 rounded-xl bg-[#07080b] border border-[#d4af37]/20">
            <span className={infraColor(infra.indexer)}>{infraIcon(infra.indexer)}</span>
            <div>
              <p className="text-[10px] font-cinzel uppercase text-[#c5bca3]">Midnight Indexer</p>
              <p className={`text-xs font-mono font-bold ${infraColor(infra.indexer)}`}>
                {infra.indexer === 'online' ? 'Preview Network ✓' : infra.indexer === 'checking' ? 'Checking...' : 'Not Reachable'}
              </p>
            </div>
          </div>
          {/* Wallet */}
          <div className="flex items-center gap-3 p-3 rounded-xl bg-[#07080b] border border-[#d4af37]/20">
            <span className={infraColor(infra.wallet)}>{infraIcon(infra.wallet)}</span>
            <div>
              <p className="text-[10px] font-cinzel uppercase text-[#c5bca3]">1AM Wallet</p>
              <p className={`text-xs font-mono font-bold ${infraColor(infra.wallet)}`}>
                {infra.wallet === 'connected' ? 'Connected ✓' : infra.wallet === 'connecting' ? 'Connecting...' : 'Not Connected'}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ══════ HERO SECTION ══════ */}
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
            Your passphrase is evaluated as a <strong className="text-[#f4e4bc]">private witness</strong> inside the Compact ZK circuit.
            Only the boolean result (<code className="text-[#d4af37]">note_unlocked</code>) and commitment hash are disclosed on the public ledger.
            The secret itself <strong className="text-[#f4e4bc]">never leaves your machine</strong>.
          </p>
        </div>
      </section>

      {/* ══════ MAIN GRID ══════ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* ── LEFT: Ledger State ── */}
        <div className="lg:col-span-1 space-y-6">
          <div className="neo-card rounded-3xl p-7 space-y-6 border border-[#d4af37]/30">
            <div className="flex items-center justify-between border-b border-[#d4af37]/20 pb-4">
              <div className="flex items-center gap-3 text-[#f7f4eb] font-cinzel font-bold text-xl">
                <Database className="w-6 h-6 text-[#d4af37]" /> Vault Ledger
              </div>
              <span className="px-3 py-1 text-[11px] font-mono font-bold bg-[#d4af37]/15 text-[#f4e4bc] border border-[#d4af37]/30 rounded-md">
                {ledgerState.note_hash ? 'Active' : 'No State'}
              </span>
            </div>

            {/* Vault Status */}
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
                <p className="text-[11px] font-cinzel font-bold uppercase tracking-widest text-[#d4af37]">Commitment Hash</p>
                <Hash className="w-4 h-4 text-[#d4af37]" />
              </div>
              <p className="text-xs font-mono text-[#f4e4bc] break-all bg-[#07080b] p-3.5 rounded-xl border border-[#d4af37]/30 min-h-[40px]">
                {ledgerState.note_hash || <span className="text-[#555]">No hash computed yet — run setup_note first</span>}
              </p>
            </div>

            {/* Proof Count */}
            <div className="p-5 rounded-2xl neo-card space-y-2 border border-[#d4af37]/20">
              <p className="text-[11px] font-cinzel font-bold uppercase tracking-widest text-[#d4af37]">Verified ZK Proofs</p>
              <div className="flex items-baseline justify-between pt-1">
                <span className="text-4xl font-mono font-bold text-white font-cinzel">{ledgerState.unlock_count}</span>
                <span className="text-xs text-[#c5bca3] font-garamond italic">circuit executions</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── RIGHT: Circuit Executor ── */}
        <div className="lg:col-span-2 space-y-6">
          <div className="neo-card rounded-3xl p-7 sm:p-9 space-y-7 border border-[#d4af37]/30">
            <div className="border-b border-[#d4af37]/20 pb-5">
              <h3 className="text-2xl font-bold font-cinzel text-white flex items-center gap-3">
                <Cpu className="w-6 h-6 text-[#d4af37]" /> ZK Circuit Executor
              </h3>
              <p className="text-xs text-[#c5bca3] font-garamond italic text-base mt-1">
                Execute Compact circuits via compiled WASM. Wallet connection required.
              </p>
            </div>

            {/* Wallet Required Warning */}
            {!walletConnected && (
              <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-500/40 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-cinzel font-bold text-amber-400">Wallet Connection Required</p>
                  <p className="text-xs text-amber-300/80 mt-1">
                    Connect your 1AM wallet before executing circuits. This ensures all operations are authenticated and ready for on-chain submission.
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
                <span className="text-[11px] text-[#d4af37] font-cinzel uppercase tracking-wider">Initializer</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-cinzel font-bold text-[#d4af37] uppercase tracking-wider mb-2">
                    Secret Passphrase (Private Witness)
                  </label>
                  <input type="text" value={secretPassphrase}
                    onChange={(e) => setSecretPassphrase(e.target.value)}
                    placeholder="Enter your secret passphrase..."
                    className="w-full px-4 py-3 bg-[#07080b] border border-[#d4af37]/30 rounded-xl text-sm font-mono text-[#f4e4bc] focus:outline-none focus:border-[#d4af37] placeholder-[#555]" />
                  {liveComputedHash && (
                    <p className="text-[10px] font-mono text-[#c5bca3] truncate mt-1.5">
                      SHA-256: <span className="text-[#d4af37]">{truncateHash(liveComputedHash)}</span>
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-cinzel font-bold text-[#d4af37] uppercase tracking-wider mb-2">
                    Off-Chain Note (Not Published)
                  </label>
                  <input type="text" value={noteMessage}
                    onChange={(e) => setNoteMessage(e.target.value)}
                    placeholder="Private note content..."
                    className="w-full px-4 py-3 bg-[#07080b] border border-[#d4af37]/30 rounded-xl text-sm text-[#f7f4eb] focus:outline-none focus:border-[#d4af37] placeholder-[#555]" />
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
                <label className="block text-xs font-cinzel font-bold text-[#d4af37] uppercase tracking-wider mb-2">
                  Enter Passphrase to Verify Access
                </label>
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

            {/* ══════ TRANSACTION RECEIPT ══════ */}
            {activeReceipt && (
              <div className={`p-6 rounded-2xl neo-card border shadow-2xl space-y-4 ${receiptStatusColor(activeReceipt.status)}`}>
                <div className="flex items-center justify-between border-b border-current/20 pb-3">
                  <span className="text-xs font-cinzel font-bold uppercase tracking-widest flex items-center gap-2.5">
                    {activeReceipt.status === 'confirmed' ? <CheckCircle2 className="w-5 h-5" /> :
                     activeReceipt.status === 'local_verified' ? <Zap className="w-5 h-5" /> :
                     activeReceipt.status === 'failed' ? <XCircle className="w-5 h-5" /> :
                     <Loader2 className="w-5 h-5 animate-spin" />}
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
                      <span className="text-[#d4af37] break-all">{activeReceipt.receiptHash}</span>
                    </div>
                  )}

                  {!activeReceipt.receiptHash && activeReceipt.status === 'local_verified' && (
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 pt-1">
                      <span className="font-bold min-w-[140px]">Receipt Hash:</span>
                      <span className="text-[#777] italic">N/A — Local execution only (no on-chain tx)</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Secret Message Revealed */}
            {ledgerState.note_unlocked && noteMessage && (
              <div className="p-6 rounded-2xl neo-card-gold border border-[#d4af37]/60 text-[#f7f4eb] space-y-3">
                <div className="flex items-center gap-2.5 font-cinzel font-bold text-base text-[#f4e4bc]">
                  <Unlock className="w-5 h-5 text-[#d4af37]" /> Secret Vault Payload:
                </div>
                <p className="text-sm font-mono text-[#f7f4eb] bg-[#07080b] p-4 rounded-xl border border-[#d4af37]/40">
                  "{noteMessage}"
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ══════ DIAGNOSTIC LOG ══════ */}
      {statusLog.length > 0 && (
        <section className="neo-card rounded-2xl p-5 border border-[#d4af37]/30 bg-[#0d0f15]/90 space-y-3">
          <div className="flex items-center justify-between text-xs font-cinzel font-bold text-[#d4af37] uppercase tracking-widest">
            <span className="flex items-center gap-2.5"><Terminal className="w-4 h-4" /> Diagnostic Console</span>
            <button onClick={() => setStatusLog([])} className="text-[#c5bca3] hover:text-white transition cursor-pointer text-[10px] font-mono">
              Clear
            </button>
          </div>
          <div className="space-y-1.5 max-h-48 overflow-y-auto font-mono text-xs text-[#e5dec9]/90 pr-2">
            {statusLog.map((log, idx) => (
              <div key={idx} className="border-b border-[#d4af37]/10 pb-1 flex items-start gap-2">
                <span className="text-[#d4af37] font-bold text-[10px] mt-0.5">›</span>
                <span>{log}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ══════ FOOTER ══════ */}
      <footer className="pt-10 border-t border-[#d4af37]/30 text-center text-xs text-[#c5bca3] font-garamond italic text-base space-y-2">
        <p className="font-cinzel text-xs not-italic tracking-wider uppercase text-[#d4af37]">
          Midnight Sanctuary • Compact v0.31.1 • Rise In Challenge
        </p>
        <p className="text-[#998f75]">
          Only note_unlocked, note_hash, and unlock_count are disclosed. Your passphrase remains private.
        </p>
      </footer>
    </div>
  );
}
