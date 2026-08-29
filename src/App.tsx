import React, { useState, useCallback } from 'react';
import {
  Shield, Lock, Unlock, KeyRound, Cpu, Wallet, CheckCircle2,
  AlertCircle, RefreshCw, ExternalLink, Zap, EyeOff, Sparkles,
  FileCode2, Database, Copy, Check, Terminal, Bug, LogOut,
  Crown, Hash, Globe, Server, AlertTriangle, XCircle, Loader2
} from 'lucide-react';

// Hooks
import { useWallet } from './hooks/useWallet';
import { useMidnightContract } from './hooks/useMidnightContract';

// Components
import { WalletStatus } from './components/WalletStatus';
import { NetworkBadge } from './components/NetworkBadge';
import { NoteCard } from './components/NoteCard';
import { ProofReceipt } from './components/ProofReceipt';
import { ToastContainer, showToast } from './components/Toast';

// Config
import { NETWORK, CONTRACT, APP } from './config';

declare global {
  interface Window {
    midnight?: Record<string, any>;
  }
}

export default function App() {
  const [statusLog, setStatusLog] = useState<string[]>([]);

  const addLog = useCallback((msg: string) => {
    console.log('[Midnight DApp]', msg);
    setStatusLog(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev.slice(0, 19)]);
  }, []);

  // Use extracted hooks
  const wallet = useWallet(addLog);
  const contract = useMidnightContract(addLog);

  // Wrapper handlers that pass wallet state to contract hook
  const onSetupNote = async () => {
    await contract.handleSetupNote(wallet.walletConnected, wallet.walletApi);
    showToast('ZK proof executed — note committed to vault', 'success');
  };

  const onUnlockNote = async () => {
    await contract.handleUnlockNote(wallet.walletConnected, wallet.walletApi);
    if (contract.revealedMessage) {
      showToast('Vault unlocked — secret payload revealed!', 'success');
    }
  };

  const onConnect = async () => {
    await wallet.handleConnect();
    showToast('1AM Wallet connected successfully', 'success');
  };

  const onDisconnect = () => {
    wallet.handleDisconnect();
    showToast('Wallet disconnected', 'info');
  };

  return (
    <div className="min-h-screen bg-[#08090c] text-[#f7f4eb] font-playfair pb-24 pt-10 px-4 sm:px-6 lg:px-12 max-w-7xl mx-auto space-y-10">

      {/* TOAST NOTIFICATIONS */}
      <ToastContainer />

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
              <NetworkBadge networkId={NETWORK.id} isConnected={wallet.walletConnected} />
            </div>
            <p className="text-sm text-[#c5bca3] font-garamond italic text-base tracking-wide">
              Proved without revealing your input — Powered by 1AM Wallet In-Browser WASM Prover & Compact v{APP.compactVersion}.
            </p>
          </div>
        </div>

        {/* 1AM Wallet Connection */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          <WalletStatus
            walletConnected={wallet.walletConnected}
            displayAddress={wallet.displayAddress}
            isConnecting={wallet.isConnecting}
            onConnect={onConnect}
            onDisconnect={onDisconnect}
          />
        </div>
      </header>

      {/* PROVER ENGINE STATUS BAR */}
      <section className="neo-card rounded-2xl p-5 border border-[#d4af37]/30 bg-[#0d0f15]/90">
        <div className="flex items-center justify-between text-xs font-cinzel font-bold text-[#d4af37] uppercase tracking-widest mb-4">
          <span className="flex items-center gap-2.5">
            <Cpu className="w-4 h-4 text-[#d4af37]" /> Zero-Knowledge Proving Architecture
          </span>
          <span className="text-[11px] font-mono text-emerald-400">
            {wallet.walletConnected ? '1AM ProofStation Enabled (Docker-Free)' : 'Connect 1AM Wallet to Enable Prover'}
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-mono">
          <div className="flex items-center gap-3 p-3.5 rounded-xl bg-[#07080b] border border-[#d4af37]/20">
            <Zap className={`w-4 h-4 ${wallet.walletConnected ? 'text-emerald-400' : 'text-amber-400'}`} />
            <div>
              <p className="text-[10px] font-cinzel uppercase text-[#c5bca3]">Prover Engine</p>
              <p className="text-xs text-[#f4e4bc] font-bold">{APP.prover}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3.5 rounded-xl bg-[#07080b] border border-[#d4af37]/20">
            <Globe className="w-4 h-4 text-[#d4af37]" />
            <div>
              <p className="text-[10px] font-cinzel uppercase text-[#c5bca3]">Target Blockchain</p>
              <p className="text-xs text-[#f4e4bc] font-bold">Midnight {NETWORK.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3.5 rounded-xl bg-[#07080b] border border-[#d4af37]/20">
            <FileCode2 className="w-4 h-4 text-emerald-400" />
            <div className="min-w-0">
              <p className="text-[10px] font-cinzel uppercase text-[#c5bca3]">Deployed Smart Contract</p>
              <p className="text-xs text-[#f4e4bc] font-bold truncate max-w-[200px]" title={CONTRACT.address}>
                {CONTRACT.address ? `${CONTRACT.address.slice(0, 14)}...` : 'Not deployed'}
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
                <span className={`text-lg font-cinzel font-bold flex items-center gap-3 ${contract.ledgerState.note_unlocked ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {contract.ledgerState.note_unlocked ? <><Unlock className="w-6 h-6" /> UNLOCKED</> : <><Lock className="w-6 h-6" /> LOCKED</>}
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
                {String(contract.ledgerState.note_hash || '') || <span className="text-[#555]">Run setup_note to generate commitment</span>}
              </p>
            </div>

            {/* Verified ZK Proofs */}
            <div className="p-5 rounded-2xl neo-card space-y-2 border border-[#d4af37]/20">
              <p className="text-[11px] font-cinzel font-bold uppercase tracking-widest text-[#d4af37]">Verified ZK Proofs</p>
              <div className="flex items-baseline justify-between pt-1">
                <span className="text-4xl font-mono font-bold text-white font-cinzel">{contract.ledgerState.unlock_count}</span>
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
            {!wallet.walletConnected && (
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
                  <input type="text" value={contract.secretPassphrase}
                    onChange={(e) => contract.setSecretPassphrase(e.target.value)}
                    placeholder="Enter secret passphrase..."
                    className="w-full px-4 py-3 bg-[#07080b] border border-[#d4af37]/30 rounded-xl text-sm font-mono text-[#f4e4bc] focus:outline-none focus:border-[#d4af37]" />
                  {contract.liveComputedHash && (
                    <p className="text-[10px] font-mono text-[#c5bca3] truncate mt-1.5">
                      SHA-256: <span className="text-[#d4af37]">{contract.truncateHash(contract.liveComputedHash)}</span>
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-cinzel font-bold text-[#d4af37] uppercase tracking-wider mb-2">
                    Secret Vault Payload
                  </label>
                  <input type="text" value={contract.noteMessage}
                    onChange={(e) => contract.setNoteMessage(e.target.value)}
                    placeholder="Private note message..."
                    className="w-full px-4 py-3 bg-[#07080b] border border-[#d4af37]/30 rounded-xl text-sm text-[#f7f4eb] focus:outline-none focus:border-[#d4af37]" />
                </div>
              </div>

              <button onClick={onSetupNote}
                disabled={contract.isExecutingProof || !wallet.walletConnected || !contract.secretPassphrase}
                className={`w-full py-3.5 rounded-xl text-xs flex items-center justify-center gap-2.5 cursor-pointer transition
                  ${wallet.walletConnected ? 'neo-btn-outline' : 'bg-[#1a1a1a] text-[#555] border border-[#333] cursor-not-allowed'}
                  disabled:opacity-40`}>
                {contract.isExecutingProof ? <Loader2 className="w-4 h-4 animate-spin text-[#d4af37]" /> : <KeyRound className="w-4 h-4 text-[#d4af37]" />}
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
                  {contract.secretPassphrase && (
                    <button type="button"
                      onClick={() => contract.setPassphraseInput(contract.secretPassphrase)}
                      className="text-[10px] font-mono text-[#d4af37] hover:text-[#f4e4bc] underline transition cursor-pointer">
                      Auto-fill from Circuit I
                    </button>
                  )}
                </div>
                <input type="password" placeholder="Enter secret passphrase to generate ZK proof..."
                  value={contract.passphraseInput} onChange={(e) => contract.setPassphraseInput(e.target.value)}
                  className="w-full px-4 py-3.5 bg-[#07080b] border border-[#d4af37]/50 rounded-xl text-sm font-mono text-white placeholder-[#7a7058] focus:outline-none focus:border-[#f4e4bc]" />
              </div>

              <button onClick={onUnlockNote}
                disabled={contract.isExecutingProof || !wallet.walletConnected || !contract.passphraseInput}
                className={`w-full py-4 rounded-xl text-xs flex items-center justify-center gap-2.5 cursor-pointer transition
                  ${wallet.walletConnected ? 'neo-btn-gold' : 'bg-[#1a1a1a] text-[#555] border border-[#333] cursor-not-allowed'}
                  disabled:opacity-40`}>
                {contract.isExecutingProof ? <Loader2 className="w-4 h-4 animate-spin text-[#08090c]" /> : <Zap className="w-4 h-4 fill-current text-[#08090c]" />}
                <span className="text-[#08090c] font-black uppercase">Generate & Submit Unlock ZK Proof</span>
              </button>
            </div>

            {/* TRANSACTION RECEIPT */}
            {contract.activeReceipt && (
              <ProofReceipt receipt={contract.activeReceipt} />
            )}

            {/* Revealed Secret Payload */}
            {contract.revealedMessage && (
              <div className="p-6 rounded-2xl neo-card-gold border border-[#d4af37]/60 text-[#f7f4eb] space-y-3">
                <div className="flex items-center gap-2.5 font-cinzel font-bold text-base text-[#f4e4bc]">
                  <Unlock className="w-5 h-5 text-[#d4af37]" /> 🔓 Secret Vault Payload Revealed:
                </div>
                <p className="text-sm font-mono text-[#f7f4eb] bg-[#07080b] p-4 rounded-xl border border-[#d4af37]/40 whitespace-pre-wrap">
                  "{contract.revealedMessage}"
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* STORED NOTES VAULT */}
      {contract.storedNotes.length > 0 && (
        <section className="neo-card rounded-2xl p-5 border border-[#d4af37]/30 bg-[#0d0f15]/90 space-y-3">
          <div className="flex items-center justify-between text-xs font-cinzel font-bold text-[#d4af37] uppercase tracking-widest">
            <span className="flex items-center gap-2.5"><Database className="w-4 h-4" /> Secret Notes Vault ({contract.storedNotes.length} notes)</span>
          </div>
          <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
            {contract.storedNotes.map((note, idx) => (
              <NoteCard
                key={idx}
                note={note}
                index={idx}
                onUsePassphrase={(p) => contract.setPassphraseInput(p)}
              />
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
          {APP.name} • Compact v{APP.compactVersion} & 1AM ProofStation WASM • Docker-Free End-User Architecture
        </p>
        <p className="text-[#998f75]">
          Only note_unlocked, note_hash, and unlock_count are disclosed. Passphrase stays inside your 1AM browser extension.
        </p>
      </footer>
    </div>
  );
}
