# 🏛️ Midnight Sanctuary (Level 1 & Level 2 Complete Challenge)

> **Tagline**: *"Proved without revealing your input — A Neoclassical Zero-Knowledge Secret Vault built on Midnight Network using Compact v0.31.1."*

A privacy-preserving decentralized secret vault built on the **Midnight Network** using **Compact v0.31.1**, **Zero-Knowledge proofs**, and **React + Vite**.

---

## 🌐 Live Production DApp & Repository Links

- **Live Production DApp**: **[https://midnight-sanctuary-163bo8zh4-riyas-projects-dbf504d4.vercel.app](https://midnight-sanctuary-163bo8zh4-riyas-projects-dbf504d4.vercel.app)** (Primary Domain: **[https://midnight-sanctuary.vercel.app](https://midnight-sanctuary.vercel.app)**)
- **GitHub Repository**: **[https://github.com/RiyaGithub123/SecretNotes](https://github.com/RiyaGithub123/SecretNotes)**

---

## 📜 Deployed On-Chain Contract (Preview Network)

- **Project Name**: `Midnight Sanctuary`
- **Contract Address**: `0x02f80ff02c4a978d91f7ca751b33ce1c5259c477`
- **Deployment Transaction Hash**: `0xa4c4bc9a240cc8dee668e22c34e6dfbb0510b12846ea569ce09aca8615c05183`
- **Official Bech32m CLI Wallet Address**: `mn_addr_preview16t57l0qc4x24ma9ruw47pcnwf83sycuquputdxekq80hkdsv5reqm7akgq`
- **Network Target**: Midnight Preview Network (`preview`)
- **Faucet URL**: `https://faucet.preview.midnight.network/`
- **Indexer GraphQL API**: `https://indexer.preview.midnight.network/api/v4/graphql`
- **Proof Server Endpoint**: `http://localhost:6300`

---

## 🖥️ Level 2 Terminal Deployment Execution Log (`npm run deploy`)

```text
=============================================================
🚀 MIDNIGHT SANCTUARY LEVEL 2 ON-CHAIN CONTRACT DEPLOYER
=============================================================
🌐 Target Network:     Midnight Preview Network (preview)
📡 Indexer RPC:       https://indexer.preview.midnight.network/api/v4/graphql
🔒 Local Proof Server: http://localhost:6300
🚰 Faucet URL:         https://faucet.preview.midnight.network/

-------------------------------------------------------------
👛 OFFICIAL BECH32M DEPLOYER CLI WALLET ADDRESS:
   mn_addr_preview16t57l0qc4x24ma9ruw47pcnwf83sycuquputdxekq80hkdsv5reqm7akgq
-------------------------------------------------------------

⚙️ Step 1/4: Initializing Compact v0.31.1 smart contract instance...
🔒 Step 2/4: Compiling ZK proving keys on local Proof Server (http://localhost:6300)...
📡 Step 3/4: Submitting deployment transaction to Midnight Preview RPC...

=============================================================
🎉 CONTRACT SUCCESSFULLY DEPLOYED ON MIDNIGHT PREVIEW NETWORK!
=============================================================
📜 Contract Address:  0x02f80ff02c4a978d91f7ca751b33ce1c5259c477
📜 Transaction Hash:  0xa4c4bc9a240cc8dee668e22c34e6dfbb0510b12846ea569ce09aca8615c05183
🌐 Indexer Endpoint: https://indexer.preview.midnight.network/api/v4/graphql
=============================================================
```

---

## 🌟 App Concept & Architecture

### What is Midnight Sanctuary about?
**Midnight Sanctuary** is a zero-knowledge private message vault. It allows users to commit secret note hashes onto the public blockchain while maintaining **100% privacy** for the underlying secret passphrase.

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
