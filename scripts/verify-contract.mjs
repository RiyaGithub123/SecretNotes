/**
 * Midnight Network Smart Contract & Transaction Verification Script
 * 
 * Queries Midnight Indexer endpoints to validate contract presence and on-chain status.
 */

const CONTRACT_ADDRESS = 'e14f573f181e52f1a6be8e7abcc65de1ad7e13709909b1680d8a5e71f6229348';
const DEPLOYER_ADDRESS = 'mn_addr_preprod1ly92wm99e3hsmyprv4ehles5pvqr0xjceuwl6vu0celldwtt4q0sh34znp';

const ENDPOINTS = [
  {
    name: 'Preprod Indexer',
    url: 'https://indexer.preprod.midnight.network/api/v4/graphql',
  },
  {
    name: 'Preview Indexer',
    url: 'https://indexer.preview.midnight.network/api/v4/graphql',
  }
];

async function verifyContractOnEndpoint(endpoint) {
  console.log(`\n============================================================`);
  console.log(`🔍 Checking validation on ${endpoint.name}...`);
  console.log(`============================================================`);

  const queries = [
    {
      name: 'contractAction (by contract address)',
      query: `
        query {
          contractAction(address: "${CONTRACT_ADDRESS}") {
            address
            state
            transaction {
              hash
              id
              block {
                height
                hash
                timestamp
              }
            }
          }
        }
      `
    },
    {
      name: 'contract (by contract address)',
      query: `
        query {
          contract(address: "${CONTRACT_ADDRESS}") {
            address
            state
          }
        }
      `
    },
    {
      name: 'transactions (recent network transactions)',
      query: `
        query {
          transactions(offset: { limit: 5 }) {
            hash
            id
            block {
              height
              timestamp
            }
          }
        }
      `
    }
  ];

  for (const q of queries) {
    try {
      const res = await fetch(endpoint.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q.query }),
      });
      const json = await res.json();
      console.log(`\n--- Query: ${q.name} ---`);
      if (json.errors) {
        console.log('Notice:', json.errors[0]?.message);
      } else {
        console.log(JSON.stringify(json.data, null, 2));
      }
    } catch (e) {
      console.error(`Error querying ${q.name}:`, e.message);
    }
  }
}

async function main() {
  console.log(`============================================================`);
  console.log(`🌙 MIDNIGHT NETWORK CONTRACT VALIDATION CHECK`);
  console.log(`   Contract Address: ${CONTRACT_ADDRESS}`);
  console.log(`   Deployer Wallet:  ${DEPLOYER_ADDRESS}`);
  console.log(`============================================================`);

  for (const ep of ENDPOINTS) {
    await verifyContractOnEndpoint(ep);
  }
}

main().catch(console.error);
