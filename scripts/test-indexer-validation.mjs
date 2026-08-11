async function testQuery() {
  const addr = '6eeb7f81a17880d57c4e46ae93b39eefc68459a0219e309bf896a1e7f011d5dd';
  const query = `{ contractAction(address: "${addr}") { address state unshieldedBalances { amount tokenType } } }`;
  
  const res = await fetch('https://indexer.preprod.midnight.network/api/v4/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  
  const data = await res.json();
  console.log('✅ ON-CHAIN INDEXER CONFIRMATION:', JSON.stringify(data, null, 2));
}

testQuery().catch(console.error);
