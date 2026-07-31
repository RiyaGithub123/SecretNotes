# 🔒 Midnight-ZKSecretNotes (Level 1 & Level 2 Complete Challenge)

A privacy-preserving decentralized secret message board built on the **Midnight Network** using **Compact v0.31.1**, **Zero-Knowledge proofs**, and **React + Vite**.

> ### ⚡ "Proved without revealing your input"
> Knowledge of a note's private secret passphrase is verified in-browser using Midnight's Compact ZK circuits (`unlock_note`). State mutations are submitted on-chain without ever revealing the private passphrase.

---

## 🌐 Live Demo & Deployed Preprod Smart Contract

- **Live Demo DApp**: [https://midnight-zk-vault.vercel.app](https://midnight-zk-vault.vercel.app)
- **Preprod Contract Address**: `0xed90a7d8941adafa9bdb4a2bb01d100b70d3907f`
- **Deployment Tx Hash**: `0x934fd0bf5b5706b105593f8e88688e2126e396b85031650b946be3c78fdc56a3`
- **Preprod Explorer**: [https://indexer.preprod.midnight.network/contract/0xed90a7d8941adafa9bdb4a2bb01d100b70d3907f](https://indexer.preprod.midnight.network/contract/0xed90a7d8941adafa9bdb4a2bb01d100b70d3907f)
- **Network**: Midnight Preprod Testnet
- **Proof Server Endpoint**: `http://localhost:6300`
- **Indexer API**: `https://indexer.preprod.midnight.network/api/v1/graphql`

---

## 🌟 Key Architecture & Features

- **Compact Smart Contract (`contract/secret_notes.compact`)**: Built with Compact compiler v0.31.1 targeting Midnight Preprod.
- **Public Ledger vs. Private Witness Separation**:
  - **Public Ledger State**:
    - `export ledger note_unlocked: Boolean` (Tracks unlock status)
    - `export ledger note_hash: Bytes<32>` (On-chain hash commitment of secret note)
    - `export ledger unlock_count: Uint<64>` (On-chain count of verified unlocks)
  - **Private Witness**:
    - `witness passphrase(): Bytes<32>` (Kept 100% private locally on user device)
- **Local ZK Proof Execution**: Powered by Docker Proof Server (`http://localhost:6300`) and `@midnight-ntwrk/compact-runtime`.
- **Wallet Connector Hook**: Integrates with 1AM / 1AIM Wallet (`window.midnight['1am']`) and Lace Wallet on Midnight Preprod.
- **UI Contract Deployer**: Deploy contract instances directly to Midnight Preprod with real-time feedback.

---

## 📂 Project Structure

```
midnight-zk-secret-notes/
├── contract/
│   └── secret_notes.compact        # Compact v0.31.1 smart contract & circuits
├── managed/                         # Generated TS bindings and ZKIR circuits
│   ├── contract/
│   ├── compiler/
│   └── zkir/
├── test/
│   └── secret_notes.test.ts        # Vitest unit test suite (3 passing tests)
├── scripts/
│   ├── deploy.ts                   # Preprod network deployment script (TS)
│   └── deploy.js                   # Terminal contract deployer script (ESM)
├── src/
│   ├── App.tsx                     # Main DApp UI & Wallet Connector
│   ├── main.tsx                    # React entrypoint
│   └── index.css                   # Cyber Emerald glassmorphism styles
├── README.md                       # Documentation
├── package.json
└── vite.config.ts
```

---

## 🛠️ Local Setup & Testing Instructions

### 1. Install Dependencies
```bash
npm install
```

### 2. Compile Compact Smart Contract
```bash
npm run compile
```

### 3. Run Unit Tests (Vitest)
```bash
npm test
```
*Executes 3 unit tests verifying contract initialization, valid ZK passphrase unlock, and invalid passphrase assertion rejection.*

### 4. Start Frontend DApp
```bash
npm run dev
```
Open `http://localhost:3000` to view the Midnight DApp.

### 5. Execute Terminal Deployment Script
```bash
npm run deploy
```

---

## 🔐 Privacy Model & Zero-Knowledge Security Guarantees

### Privacy Model Overview
Midnight's hybrid privacy model enforces strict separation between public on-chain ledger state and client-side private witness inputs:
- **Private Witness**: The secret passphrase remains exclusively on the client device inside the web browser runtime. It is processed locally inside Compact Zero-Knowledge circuits and is **never** transmitted across network boundaries or broadcast on-chain.
- **On-Chain Verifiable Proofs**: The browser generates a cryptographic ZK proof validating knowledge of the secret passphrase against the published note hash (`SHA-256`).
- **Public State Integrity**: Only the verification status (`note_unlocked`) and total unlock count (`unlock_count`) are published on the Midnight public ledger.

| Data Field | Visibility | Description |
| :--- | :--- | :--- |
| `passphrase` | 🔒 **PRIVATE** | Evaluated strictly inside local ZK circuit. Never leaves browser. |
| `note_hash` | 🌐 **PUBLIC** | On-chain 32-byte cryptographic hash of secret note. |
| `note_unlocked` | 🌐 **PUBLIC** | On-chain boolean set to `true` when valid ZK proof is verified. |
| `unlock_count` | 🌐 **PUBLIC** | On-chain counter incremented upon successful ZK proof verification. |
