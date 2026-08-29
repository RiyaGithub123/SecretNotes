import React from 'react';
import { Globe } from 'lucide-react';

interface NetworkBadgeProps {
  networkId?: string;
  isConnected: boolean;
}

/**
 * NetworkBadge — Displays the current Midnight network (Preprod)
 * with a live pulsing indicator when the wallet is connected.
 */
export function NetworkBadge({ networkId = 'preprod', isConnected }: NetworkBadgeProps) {
  const label = networkId === 'preprod' ? 'Preprod Network' : networkId === 'mainnet' ? 'Mainnet' : 'Preview Network';
  
  return (
    <span className="inline-flex items-center gap-2 px-3.5 py-1 text-[11px] neo-badge rounded-md font-cinzel font-bold uppercase tracking-widest">
      {isConnected && (
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>
      )}
      <Globe className="w-3 h-3 text-[#d4af37]" />
      {label}
    </span>
  );
}
