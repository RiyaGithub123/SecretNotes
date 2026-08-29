import React from 'react';
import { CheckCircle2, Zap, XCircle } from 'lucide-react';
import type { TxReceipt } from '../hooks/useMidnightContract';

interface ProofReceiptProps {
  receipt: TxReceipt;
}

function receiptStatusColor(s: TxReceipt['status']) {
  return s === 'confirmed' ? 'text-emerald-400 border-emerald-500/40 bg-emerald-950/30' :
    s === 'local_verified' ? 'text-[#f4e4bc] border-[#d4af37]/40 bg-[#d4af37]/10' :
    'text-red-400 border-red-500/40 bg-red-950/20';
}

function receiptStatusLabel(s: TxReceipt['status']) {
  return s === 'confirmed' ? '✅ Confirmed On-Chain (1AM Prover)' :
    s === 'local_verified' ? '⚡ 1AM WASM ZK Proof Verified' :
    '❌ ZK Proof Failed';
}

/**
 * ProofReceipt — Displays ZK proof execution results with
 * circuit name, witness data, execution time, and status.
 */
export function ProofReceipt({ receipt }: ProofReceiptProps) {
  return (
    <div className={`p-6 rounded-2xl neo-card border shadow-2xl space-y-4 ${receiptStatusColor(receipt.status)}`}>
      <div className="flex items-center justify-between border-b border-current/20 pb-3">
        <span className="text-xs font-cinzel font-bold uppercase tracking-widest flex items-center gap-2.5">
          {receipt.status === 'confirmed' ? <CheckCircle2 className="w-5 h-5" /> :
           receipt.status === 'local_verified' ? <Zap className="w-5 h-5" /> :
           <XCircle className="w-5 h-5" />}
          {receiptStatusLabel(receipt.status)}
        </span>
        <span className="text-xs font-mono opacity-80">{receipt.timestamp}</span>
      </div>

      <div className="space-y-2 font-mono text-xs text-[#e5dec9]">
        <div className="flex flex-col sm:flex-row sm:items-center gap-1">
          <span className="font-bold min-w-[140px]">Circuit:</span>
          <span className="text-[#f4e4bc] bg-[#030806] px-2.5 py-1 rounded border border-current/20">
            {'</> '}{receipt.circuit}
          </span>
        </div>

        {receipt.witnessHex && (
          <div className="flex flex-col sm:flex-row sm:items-center gap-1">
            <span className="font-bold min-w-[140px]">Witness (Private):</span>
            <span className="text-[#c5bca3] break-all">{receipt.witnessHex}</span>
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center gap-1">
          <span className="font-bold min-w-[140px]">Status:</span>
          <span className="font-bold">{receipt.statusMessage}</span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-1">
          <span className="font-bold min-w-[140px]">Execution Time:</span>
          <span>{receipt.executionMs}ms</span>
        </div>

        {receipt.receiptHash && (
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 pt-1">
            <span className="font-bold min-w-[140px]">Receipt Hash:</span>
            <span className="text-[#d4af37] break-all">{String(receipt.receiptHash)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
