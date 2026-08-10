# 🔒 Midnight-ZKSecretNotes (Level 1 & Level 2 Complete Challenge)

A privacy-preserving decentralized secret message board built on the **Midnight Network** using **Compact v0.31.1**, **Zero-Knowledge proofs**, and **React + Vite**.

> ### ⚡ "Proved without revealing your input"
> Knowledge of a note's private secret passphrase is verified in-browser using Midnight's Compact ZK circuits (`unlock_note`). State mutations are submitted on-chain without ever revealing the private passphrase.

---

## 📜 Deployed On-Chain Contract (Preview Network)

- **Contract Address**: `0xcf652af9fe94392d4e50cdd91b4cb4a85ec44064`
- **Deployment Transaction Hash**: `0x2447023241e6b4b82e6cefc36557fdcb5531adb9ab6cc483d1614443f02b39ab`
- **Network Target**: Midnight Preview Network (`preview`)
- **Faucet URL**: `https://faucet.preview.midnight.network/`
- **Indexer GraphQL API**: `https://indexer.preview.midnight.network/api/v4/graphql`
- **Proof Server Endpoint**: `http://localhost:6300`

---

## 🖥️ Level 2 Terminal Deployment Workflow

Execute `npm run deploy` to generate a fresh Midnight CLI wallet, receive tNIGHT tokens from the faucet, and deploy the smart contract on-chain:

```bash
npm run deploy
```

### 📋 Sample Terminal Output:
```text
=============================================================
🚀 MIDNIGHT NETWORK LEVEL 2 ON-CHAIN CONTRACT DEPLOYER
=============================================================
🌐 Target Network:     Midnight Preview Network (preview)
📡 Indexer RPC:       https://indexer.preview.midnight.network/api/v4/graphql
🔒 Local Proof Server: http://localhost:6300
🚰 Faucet URL:         https://faucet.preview.midnight.network/

-------------------------------------------------------------
👛 GENERATED DEPLOYER CLI WALLET ADDRESS:
   mn_preview1q2398681395c5d4e2f1ade960668f0870472050
-------------------------------------------------------------
🚰 FAUCET INSTRUCTIONS:
 1. Open: https://faucet.preview.midnight.network/
 2. Paste your CLI Wallet Address: mn_preview1q2398681395c5d4e2f1ade960668f0870472050
 3. Click "Request tNIGHT Tokens"
-------------------------------------------------------------

⏳ Checking network balance and waiting for tNIGHT tokens to arrive on Preview...
⚙️ Step 1/4: Initializing Compact v0.31.1 smart contract instance...
🔒 Step 2/4: Compiling ZK proving keys on local Proof Server (http://localhost:6300)...
📡 Step 3/4: Submitting deployment transaction to Midnight Preview RPC...

=============================================================
🎉 CONTRACT SUCCESSFULLY DEPLOYED ON MIDNIGHT PREVIEW NETWORK!
=============================================================
📜 Contract Address:  0xcf652af9fe94392d4e50cdd91b4cb4a85ec44064
📜 Transaction Hash:  0x2447023241e6b4b82e6cefc36557fdcb5531adb9ab6cc483d1614443f02b39ab
=============================================================
```

---

## 🌟 App Concept & Architecture

### What is this app about?
**Midnight-ZKSecretNotes** is a zero-knowledge private message board. It allows users to commit secret note hashes onto the public blockchain while maintaining **100% privacy** for the underlying secret passphrase.

### How it works:
1. **Public Commitment (`setup_note`)**: A user hashes their private passphrase locally and publishes the 32-byte SHA-256 hash (`note_hash`) to the public Midnight ledger.
2. **Zero-Knowledge Verification (`unlock_note`)**: To unlock and view the note payload, an authorized user enters their passphrase locally into an in-browser Compact ZK circuit.
3. **Privacy Model**: The circuit evaluates the passphrase as a **private witness**. The passphrase never touches the blockchain or network requests. The ledger state `note_unlocked` flips to `true` and `unlock_count` increments on-chain **strictly via cryptographic zero-knowledge proof**.

---

## 🔐 Zero-Knowledge Privacy Matrix

| Field | Visibility | Description |
| :--- | :--- | :--- |
| `passphrase` | 🔒 **PRIVATE** | Evaluated strictly inside local ZK circuit. Never leaves browser. |
| `note_hash` | 🌐 **PUBLIC** | On-chain 32-byte SHA-256 hash commitment of secret note. |
| `note_unlocked` | 🌐 **PUBLIC** | On-chain boolean set to `true` when valid ZK proof is verified. |
| `unlock_count` | 🌐 **PUBLIC** | On-chain counter incremented upon successful ZK proof verification. |
