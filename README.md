# 🔒 Midnight-ZKSecretNotes (Level 1 & Level 2 Complete Challenge)

A privacy-preserving decentralized secret message board built on the **Midnight Network** using **Compact v0.31.1**, **Zero-Knowledge proofs**, and **React + Vite**.

> ### ⚡ "Proved without revealing your input"
> Knowledge of a note's private secret passphrase is verified in-browser using Midnight's Compact ZK circuits (`unlock_note`). State mutations are submitted on-chain without ever revealing the private passphrase.

---

## 📜 Deployed Preprod Smart Contract

- **Contract Address**: `0x8d5b11016c1b4357c791537d336b54ee9f59f895`
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

## 🔐 Zero-Knowledge Security Guarantees

| Data Field | Visibility | Description |
| :--- | :--- | :--- |
| `passphrase` | 🔒 **PRIVATE** | Evaluated strictly inside local ZK circuit. Never leaves browser. |
| `note_hash` | 🌐 **PUBLIC** | On-chain 32-byte cryptographic hash of secret note. |
| `note_unlocked` | 🌐 **PUBLIC** | On-chain boolean set to `true` when valid ZK proof is verified. |
| `unlock_count` | 🌐 **PUBLIC** | On-chain counter incremented upon successful ZK proof verification. |
