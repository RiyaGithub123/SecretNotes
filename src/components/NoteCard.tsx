import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import type { StoredNote } from '../midnight-onchain';

interface NoteCardProps {
  note: StoredNote;
  index: number;
  onUsePassphrase: (passphrase: string) => void;
}

/**
 * NoteCard — Displays a single stored vault note with hash,
 * creation timestamp, on-chain status badge, and copy-to-clipboard.
 */
export function NoteCard({ note, index, onUsePassphrase }: NoteCardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyHash = async () => {
    try {
      await navigator.clipboard.writeText(note.noteHash);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.warn('Copy failed:', e);
    }
  };

  return (
    <div className="p-3.5 rounded-xl bg-[#07080b] border border-[#d4af37]/20 flex items-center justify-between gap-3 hover:border-[#d4af37]/40 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono text-[#d4af37]">#{index + 1}</span>
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
      <div className="flex items-center gap-2">
        <button
          onClick={handleCopyHash}
          className="text-[10px] font-mono text-[#c5bca3] hover:text-[#f4e4bc] transition cursor-pointer p-1"
          title="Copy hash"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
        <button
          onClick={() => onUsePassphrase(note.passphrase)}
          className="text-[10px] font-mono text-[#d4af37] hover:text-[#f4e4bc] underline transition cursor-pointer whitespace-nowrap"
        >
          Use Passphrase
        </button>
      </div>
    </div>
  );
}
