async function testQuery() {
  const addr = 'e14f573f181e52f1a6be8e7abcc65de1ad7e13709909b1680d8a5e71f6229348';
  const query = `{ contractAction(address: "${addr}") { address state unshieldedBalances { amount tokenType } } }`;
  
  const res = await fetch('https://indexer.preprod.midnight.network/api/v4/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  
  const data = await res.json();
  console.log('Indexer Response:', JSON.stringify(data, null, 2));
}

testQuery().catch(console.error);
