import React from 'react';
import { Wallet, Zap, LogOut, RefreshCw } from 'lucide-react';

interface WalletStatusProps {
  walletConnected: boolean;
  displayAddress: string;
  isConnecting: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
}

/**
 * WalletStatus — Displays the 1AM wallet connection state with
 * connect/disconnect controls and live address display.
 */
export function WalletStatus({
  walletConnected,
  displayAddress,
  isConnecting,
  onConnect,
  onDisconnect,
}: WalletStatusProps) {
  if (walletConnected) {
    return (
      <div className="flex flex-wrap items-center gap-3">
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
        <button onClick={onDisconnect}
          className="flex items-center gap-2 px-4 py-3 bg-[#1e1014] hover:bg-[#2a141a] text-[#f87171] font-cinzel font-bold text-xs rounded-xl border border-[#7f1d1d]/60 shadow-lg transition cursor-pointer active:scale-95">
          <LogOut className="w-4 h-4" /> Disconnect
        </button>
      </div>
    );
  }

  return (
    <button onClick={onConnect} disabled={isConnecting}
      className="flex items-center justify-center gap-3 px-7 py-3.5 neo-btn-gold text-slate-950 rounded-xl shadow-2xl transition cursor-pointer disabled:opacity-50 active:scale-95">
      {isConnecting ? <RefreshCw className="w-5 h-5 animate-spin text-slate-950" /> : <Wallet className="w-5 h-5 stroke-[2.2] text-slate-950" />}
      Connect 1AM Wallet
    </button>
  );
}
