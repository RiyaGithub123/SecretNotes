# 🏛️ Midnight Sanctuary (Neoclassical ZK Secret Vault)

> **Tagline**: *"Proved without revealing your input — A Production-Grade Full-Stack Zero-Knowledge Secret Vault built on Midnight Network using Compact v0.31.1 & 1AM Wallet."*

---

## 📌 QUICK LINKS & DEPLOYED RESOURCES (AT A GLANCE)

| Resource | Link / Value |
| :--- | :--- |
| 🚀 **Live Production DApp (Vercel)** | **[https://secret-notes-wheat.vercel.app/](https://secret-notes-wheat.vercel.app/)** |
| 📺 **Video Tutorial & Walkthrough** | **[Watch on YouTube](https://www.youtube.com/watch?v=Dya9d4rNDtY)** |
| 📜 **Deployed Smart Contract Address** | `6eeb7f81a17880d57c4e46ae93b39eefc68459a0219e309bf896a1e7f011d5dd` |
| 🌐 **Target Network** | **Midnight Preprod Network** (`preprod`) |
| 📡 **Indexer GraphQL Endpoint** | `https://indexer.preprod.midnight.network/api/v4/graphql` |
| 📡 **Indexer WebSocket Endpoint** | `wss://indexer.preprod.midnight.network/api/v4/graphql/ws` |
| 🌐 **Substrate RPC Node** | `https://rpc.preprod.midnight.network` |
| 📂 **GitHub Repository** | **[https://github.com/RiyaGithub123/SecretNotes](https://github.com/RiyaGithub123/SecretNotes)** |

---

## 🌟 What is Midnight Sanctuary?

**Midnight Sanctuary** is a privacy-preserving decentralized secret vault application built on the **Midnight Network** using **Compact v0.31.1**, **Zero-Knowledge proofs (ZKPs)**, **1AM Wallet (In-Browser WASM Prover)**, and **React + TypeScript + Vite**.

It allows users to store confidential secret notes on-chain while keeping the underlying secret passphrase **100% private**. The passphrase is NEVER transmitted across any network or recorded on the public ledger. Instead, it is evaluated strictly inside an in-browser Zero-Knowledge (ZK) proving environment powered by WebAssembly (WASM).

---

## 🔒 Zero-Knowledge Privacy & Verification Matrix

| State / Field | On-Chain Visibility | Description |
| :--- | :--- | :--- |
| `passphrase` | 🔒 **PRIVATE WITNESS** | Evaluated strictly inside local WASM ZK circuit. Never leaves browser extension. |
| `secret_message` | 🔒 **CLIENT VAULT** | Stored in local vault & decrypted only upon successful ZK proof verification. |
| `note_hash` | 🌐 **PUBLIC LEDGER** | On-chain 32-byte SHA-256 hash commitment of secret note. |
| `note_unlocked` | 🌐 **PUBLIC LEDGER** | On-chain boolean set to `true` when valid ZK proof is verified. |
| `unlock_count` | 🌐 **PUBLIC LEDGER** | On-chain counter incremented upon successful ZK proof verification. |

---

## 🏗️ Full-Stack Modular Architecture

The application is structured into clean, decoupled layers following modern frontend and Web3 engineering practices:

```
midnight-sanctuary/
├── contract/                          # Compact Smart Contract source
│   └── secret_notes.compact           # Compact v0.31.1 ZK circuit definitions
├── managed/                           # Compiled Compact artifacts & keys
│   ├── compiler/                      # Compiler metadata
│   ├── contract/                      # TypeScript ledger bindings & index.js
│   ├── keys/                          # Prover & verifier proving keys (.prover, .verifier)
│   └── zkir/                          # Zero-Knowledge Intermediate Representation (.zkir)
├── public/                            # Static public assets & proving keys
├── scripts/                           # Deployment & CLI verification utilities
│   ├── deploy-official.ts             # On-chain contract deployment script
│   └── wallet-state.ts                # Bech32m wallet generator & state management
├── src/                               # Frontend DApp source code
│   ├── components/                    # Modular, reusable UI components
│   │   ├── NetworkBadge.tsx           # Preprod network status indicator
│   │   ├── NoteCard.tsx               # Stored note vault item with copy-to-clipboard
│   │   ├── ProofReceipt.tsx           # ZK proof execution receipt & circuit breakdown
│   │   ├── Toast.tsx                  # Non-blocking user feedback notification system
│   │   └── WalletStatus.tsx           # 1AM Wallet connection state & controls
│   ├── hooks/                         # Custom React hooks
│   │   ├── useMidnightContract.ts     # Circuit execution, ledger state & WASM runtime
│   │   └── useWallet.ts               # 1AM Wallet discovery, connection & address parser
│   ├── config.ts                      # Centralized network endpoints & contract configuration
│   ├── deploy-config.json             # Live deployment metadata (Preprod contract address)
│   ├── index.css                      # Neoclassical golden styling & micro-animations
│   ├── main.tsx                       # React application entry point
│   ├── midnight-onchain.ts            # Indexer GraphQL client & BrowserPrivateStateProvider
│   └── App.tsx                        # Main application container
├── test/                              # Automated test suite
│   └── secret_notes.test.ts           # Vitest unit test suite (8 comprehensive tests)
├── package.json                       # Dependencies & build scripts
├── tailwind.config.js                 # Tailwind CSS configuration
├── tsconfig.json                      # TypeScript configuration
├── vercel.json                        # Vercel deployment configuration with WASM headers
└── vite.config.ts                     # Vite build configuration (WASM & top-level await)
```

---

## ⚡ Smart Contract & Circuit Architecture (Compact v0.31.1)

The application utilizes two core ZK circuits defined in Compact (`contract/secret_notes.compact`):

### 1️⃣ **Circuit I: `setup_note(initial_hash: Bytes<32>)`**
- **Purpose**: Establishes a secret note commitment on the Midnight ledger.
- **Mechanism**: The user's secret passphrase is hashed (`SHA-256`). The resulting 32-byte hash commitment (`note_hash`) is written to the public ledger state.
- **State Impact**: Sets `note_hash = initial_hash`, `note_unlocked = false`, `unlock_count = 0`.

### 2️⃣ **Circuit II: `unlock_note(provided_passphrase: Bytes<32>)`**
- **Purpose**: Unlocks the note on-chain by proving knowledge of the private passphrase.
- **Mechanism**: Evaluates `provided_passphrase == passphrase()` inside the ZK prover via an assert statement. If the witness matches, the ZK proof is valid.
- **State Impact**: Flips `note_unlocked = true` and increments `unlock_count = unlock_count + 1` **without disclosing the private passphrase**.

```compact
pragma language_version >= 0.23.0;

import CompactStandardLibrary;

export ledger note_unlocked: Boolean;
export ledger note_hash: Bytes<32>;
export ledger unlock_count: Uint<64>;

witness passphrase(): Bytes<32>;

export circuit setup_note(initial_hash: Bytes<32>): [] {
    note_hash = disclose(initial_hash);
    note_unlocked = false;
    unlock_count = 0;
}

export circuit unlock_note(provided_passphrase: Bytes<32>): Boolean {
    const secret = passphrase();
    assert(disclose(provided_passphrase == secret), "Invalid passphrase provided");
    note_unlocked = true;
    unlock_count = disclose((unlock_count + 1) as Uint<64>);
    return disclose(note_unlocked);
}
```

---

## 📖 Step-by-Step User Guide (How to Use the App)

### Prerequisites
1. Install **Google Chrome** or a Chromium-based browser.
2. Install the **1AM Wallet Browser Extension** for Midnight Network.
3. Switch your 1AM Wallet network to **Midnight Preprod Network**.
4. Obtain test tokens from the [Midnight Preprod Faucet](https://faucet.preprod.midnight.network/) if needed.

---

### Step 1: Connect Your 1AM Wallet
1. Visit **[https://secret-notes-wheat.vercel.app/](https://secret-notes-wheat.vercel.app/)**.
2. Click **"Connect 1AM Wallet"** in the top right header.
3. Approve the connection request in your 1AM Wallet extension popup.
4. Once connected, your wallet address and connection badge will turn active green.

---

### Step 2: Circuit I — Store a Secret Note
1. In the **Circuit I: setup_note** card:
2. Enter a **Secret Passphrase** (e.g. `my_confidential_vault_passphrase_2026`).
3. Enter your **Secret Vault Payload** message (e.g. *“The master decryption key is stored safely.”*).
4. Click **"Execute setup_note & Commit Hash"**.
5. The 1AM Wallet WASM prover evaluates the circuit locally, generates the SHA-256 commitment hash, and saves the note to your vault with a confirmation toast notification.

---

### Step 3: Circuit II — Unlock Note with Zero-Knowledge Proof
1. In the **Circuit II: unlock_note** card:
2. Enter the **Secret Passphrase** you set in Circuit I (or click *"Auto-fill from Circuit I"* / select from your Stored Notes Vault).
3. Click **"Generate & Submit Unlock ZK Proof"**.
4. The ZK engine evaluates your passphrase as a private witness locally inside WebAssembly.
5. Upon successful proof generation:
   - Your secret message payload is revealed on screen.
   - The verified proof count increments on the ledger.
   - A real-time ZK transaction receipt displays execution time and proof parameters.

---

## 🧪 Automated Testing Suite

The smart contract includes a comprehensive unit test suite written with **Vitest**:

```bash
# Run all automated unit tests
npm test
```

### Test Coverage Summary:
- ✅ `1. setup_note initializes the public ledger state correctly`
- ✅ `2. unlock_note succeeds with matching passphrase witness and updates ledger state`
- ✅ `3. unlock_note rejects invalid passphrase via ZK circuit assertion failure`
- ✅ `4. multiple sequential unlocks increment the unlock_count correctly`
- ✅ `5. setup_note overwrites the previous note hash when called again`
- ✅ `6. setup_note followed by unlock resets state correctly on re-setup`
- ✅ `7. unlock_note returns true as the result value on success`
- ✅ `8. note_hash persists across multiple unlock operations`

---

## 🛠️ Local Development & Running Locally

```bash
# 1. Clone the repository
git clone https://github.com/RiyaGithub123/SecretNotes.git
cd SecretNotes

# 2. Install dependencies
npm install

# 3. Run unit tests
npm test

# 4. Start local development server
npm run dev
```

Open **[http://localhost:3000](http://localhost:3000)** in Chrome with 1AM Wallet installed.

---

## 🚀 Building & Production Deployment

```bash
# Type check and build production bundle
npm run build

# Preview production build locally
npm run preview
```

---

## 📜 Git Commit Journey

The repository reflects an incremental, iterative development process:

```
* feat: deploy updated full-stack dApp to Vercel production
* docs: update README with full-stack architecture, file tree, test guides, and commit history
* test: expand Compact smart contract test suite to 8 comprehensive unit tests
* feat: implement centralized config module and integrate components into App.tsx
* feat: add ProofReceipt and non-blocking Toast notification system
* feat: create modular UI components WalletStatus, NetworkBadge, and NoteCard
* refactor: extract custom hooks useWallet and useMidnightContract for state management
* docs: update README.md with Vercel live URL, YouTube video link, contract address, and step-by-step user guide
* refactor: remove redundant deploy smart contract button and show active on-chain contract address
* fix: initialize contract context on mount so Circuit 2 unlock works after page refresh
* fix: replace levelPrivateStateProvider with BrowserPrivateStateProvider to remove Node LevelDB dependency in browser bundle
* fix: resolve TypeError Class extends value undefined by removing extends ZKConfigProvider in BrowserZKConfigProvider
* feat: enforce secret phrase uniqueness, refresh persistence, and Preprod indexer sync
* feat: add indexer validation check and update contractAction query format
* feat: complete Preprod contract deployment and save contract address to deploy-config.json
* feat: implement mentor CLI deployment workflow targeting Preprod network
* feat: complete real Midnight SDK smart contract deployment integration with 1AM wallet and proof server
* feat: integrate on-chain module into App.tsx - note registry, wallet config, revealed messages persist across refresh
* feat: add real ZKIR artifacts, on-chain integration module, and deploy config for Midnight Preview
* ux: add Auto-fill button and explicit diagnostic logging for Circuit II passphrase mismatch
* fix: rehydrate circuit state from localStorage on page refresh to fix Circuit 2 failures
* fix: resolve React error #31 by safely stringifying address objects
* feat: integrate 1AM Wallet ProofStation WASM prover for Docker-free end-user experience
* config: optimize vercel.json for fast deployment
* fix: remove all fake data, require wallet connection, add real on-chain submission via 1AM API
* feat: implement mentor-matching transaction receipt card and Indexer verification
* style: refine UI with human-readable ledger labels, live SHA-256 hash display, and 1AM WASM prover badge
* feat: persist on-chain ledger state and secret notes across page refreshes in localStorage
* config: add vercel.json configuration for Vercel deployment with WASM headers
* feat: rebrand application to Midnight Sanctuary with fresh on-chain contract deployment
* refactor: implement official Midnight DApp Connector flow with zero mock fallbacks
* feat: integrate seed wallet contract deployment on Midnight Preprod testnet
```

---

## 📜 License & Acknowledgments

Built with ❤️ for the **Midnight Network Developer Ecosystem** using **Compact v0.31.1**, **1AM Wallet**, and **Midnight Preprod Testnet**.
