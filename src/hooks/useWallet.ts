/**
 * useWallet Hook — Manages 1AM Wallet connection lifecycle
 * 
 * Handles wallet discovery, connection, disconnection, and address extraction
 * for the Midnight Preprod network using the 1AM browser extension.
 */

import { useState, useCallback } from 'react';
import { getWalletConfig, type OnChainConfig } from '../midnight-onchain';

// 1AM Wallet Discovery
async function discoverWalletProvider(timeoutMs = 5000, intervalMs = 500) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const w = (window as any).midnight;
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

function bytesToHex(bytes: Uint8Array): string {
  return '0x' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
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

export interface WalletState {
  walletConnected: boolean;
  walletAddress: string;
  walletApi: any;
  isConnecting: boolean;
  walletConfig: OnChainConfig | null;
  displayAddress: string;
}

export function useWallet(addLog: (msg: string) => void) {
  const [walletConnected, setWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string>('');
  const [walletApi, setWalletApi] = useState<any>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [walletConfig, setWalletConfig] = useState<OnChainConfig | null>(null);

  const handleConnect = useCallback(async () => {
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
  }, [addLog]);

  const handleDisconnect = useCallback(() => {
    setWalletConnected(false);
    setWalletAddress('');
    setWalletApi(null);
    addLog('🔌 1AM Wallet disconnected.');
  }, [addLog]);

  const displayAddress = typeof walletAddress === 'string' ? walletAddress : stringifyAddress(walletAddress);

  return {
    walletConnected,
    walletAddress,
    walletApi,
    isConnecting,
    walletConfig,
    displayAddress,
    handleConnect,
    handleDisconnect,
  };
}
