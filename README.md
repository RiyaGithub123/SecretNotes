# 🏛️ Midnight Sanctuary (Neoclassical ZK Secret Vault)

> **Tagline**: *"Proved without revealing your input — A Neoclassical Zero-Knowledge Secret Vault built on Midnight Network using Compact v0.31.1."*

---

## 📌 QUICK LINKS & DEPLOYED RESOURCES (AT A GLANCE)

| Resource | Link / Value |
| :--- | :--- |
| 🚀 **Live Production DApp (Vercel)** | **[https://secret-notes-wheat.vercel.app/](https://secret-notes-wheat.vercel.app/)** |
| 📺 **Video Tutorial & Walkthrough** | **[Watch on YouTube](https://www.youtube.com/watch?v=Dya9d4rNDtY)** |
| 📜 **Deployed Smart Contract Address** | `6eeb7f81a17880d57c4e46ae93b39eefc68459a0219e309bf896a1e7f011d5dd` |
| 🌐 **Target Network** | **Midnight Preprod Network** (`preprod`) |
| 📡 **Indexer GraphQL Endpoint** | `https://indexer.preprod.midnight.network/api/v1/graphql` |
| 📡 **Indexer WebSocket Endpoint** | `wss://indexer.preprod.midnight.network/api/v1/graphql/ws` |
| 📂 **GitHub Repository** | **[https://github.com/RiyaGithub123/SecretNotes](https://github.com/RiyaGithub123/SecretNotes)** |

---

## 🌟 What is Midnight Sanctuary?

**Midnight Sanctuary** is a privacy-preserving decentralized secret vault built on the **Midnight Network** using **Compact v0.31.1**, **Zero-Knowledge proofs (ZKPs)**, **1AM Wallet**, and **React + Vite**.

It allows users to store confidential secret notes on-chain while keeping the underlying secret passphrase **100% private**. The passphrase is NEVER transmitted across any network or recorded on the public ledger. Instead, it is evaluated strictly inside an in-browser Zero-Knowledge (ZK) proving environment.

---

## 🔒 Zero-Knowledge Privacy & Verification Matrix

| State / Field | On-Chain Visibility | Description |
| :--- | :--- | :--- |
| `passphrase` | 🔒 **PRIVATE WITNESS** | Evaluated strictly inside local WASM ZK circuit. Never leaves browser. |
| `secret_message` | 🔒 **CLIENT VAULT** | Encrypted locally & decrypted only upon successful ZK proof verification. |
| `note_hash` | 🌐 **PUBLIC LEDGER** | On-chain 32-byte SHA-256 hash commitment of secret note. |
| `note_unlocked` | 🌐 **PUBLIC LEDGER** | On-chain boolean set to `true` when valid ZK proof is verified. |
| `unlock_count` | 🌐 **PUBLIC LEDGER** | On-chain counter incremented upon successful ZK proof verification. |

---

## ⚡ Smart Contract & Circuit Architecture (Compact v0.31.1)

The application utilizes two core ZK circuits defined in Compact (`contract/src/index.compact`):

### 1️⃣ **Circuit I: `setup_note(initial_hash: Bytes<32>)`**
- **Purpose**: Establishes a secret note commitment on the Midnight ledger.
- **Mechanism**: The user's secret passphrase is hashed locally (`SHA-256`). The resulting 32-byte hash commitment (`note_hash`) is written to the ledger state.
- **State Impact**: Sets `note_hash = initial_hash`, `note_unlocked = false`, `unlock_count = 0`.

### 2️⃣ **Circuit II: `unlock_note(provided_passphrase: Bytes<32>)`**
- **Purpose**: Unlocks the note on-chain by proving knowledge of the private passphrase.
- **Mechanism**: Evaluates `SHA-256(provided_passphrase)` inside the ZK prover. If the calculated hash matches `note_hash` on-chain, the ZK proof evaluates to `true`.
- **State Impact**: Flips `note_unlocked = true` and increments `unlock_count = unlock_count + 1` **without disclosing the passphrase**.

---

## 📖 Step-by-Step User Guide (How to Use the App)

### Prerequisites
1. Install **Google Chrome** or a Chromium-based browser.
2. Install the **1AM Wallet Browser Extension** for Midnight Network.
3. Switch your 1AM Wallet network to **Midnight Preprod Network**.
4. Obtain test tokens from the Midnight Preprod Faucet if needed.

---

### Step 1: Connect Your 1AM Wallet
1. Visit **[https://secret-notes-wheat.vercel.app/](https://secret-notes-wheat.vercel.app/)**.
2. Click **"CONNECT 1AM WALLET"** in the top right header.
3. Approve the connection request in your 1AM Wallet extension popup.
4. Once connected, your wallet address and connection badge will turn active green.

---

### Step 2: Circuit I — Store a Secret Note
1. Navigate to **Circuit 1: Store Secret Note**.
2. Enter a **Secret Passphrase** (e.g. `midnight_secret_passcode_2026`).
3. Enter your **Secret Message** (e.g. *“The private vault key is stored in vault alpha.”*).
4. Click **"ENCRYPT & COMMIT NOTE (CIRCUIT I)"**.
5. The 1AM Wallet WASM prover generates a Zero-Knowledge proof and commits your SHA-256 hash to the Midnight Preprod ledger.

---

### Step 3: Circuit II — Unlock Note with Zero-Knowledge Proof
1. Navigate to **Circuit 2: Unlock Note**.
2. Enter the **Secret Passphrase** you set in Circuit 1.
3. Click **"EXECUTE ZK PROOF & UNLOCK (CIRCUIT II)"**.
4. The ZK engine evaluates your passphrase as a private witness locally.
5. Upon successful proof generation, your secret message is revealed on screen and the contract state on Midnight Preprod updates automatically!

---

## 🛠️ Local Development & Running Locally

If you want to run the project on your local machine:

```bash
# 1. Clone the repository
git clone https://github.com/RiyaGithub123/SecretNotes.git
cd SecretNotes

# 2. Install dependencies
npm install

# 3. Start local development server
npm run dev
```

Open **[http://localhost:3000](http://localhost:3000)** in Chrome.

---

## 🚀 Building & Deploying to Vercel

```bash
# Production Build
npm run build

# Deploy via Vercel CLI (optional)
npx vercel --prod
```

Or connect the GitHub repository `https://github.com/RiyaGithub123/SecretNotes` directly to Vercel for automatic CI/CD deployments!

---

## 📹 Video Tutorial & Walkthrough

Watch the full video demonstration and architectural explanation on YouTube:  
👉 **[Watch Video Tutorial on YouTube](https://www.youtube.com/watch?v=Dya9d4rNDtY)**

---

## 📜 License & Acknowledgments

Built with ❤️ for the **Midnight Network Developer Ecosystem** using **Compact v0.31.1** & **1AM Wallet**.
