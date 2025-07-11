// Test Brandfetch API
const BRANDFETCH_API_KEY = 'HMHMAUXlZLFR4kLzfYjWFz4CyaQ+C5sC/ZkN+rs98+Y=';
const BRANDFETCH_BASE_URL = 'https://api.brandfetch.io/v2';

async function testBrandfetch(domain) {
  console.log(`Testing Brandfetch for: ${domain}`);

  try {
    const response = await fetch(`${BRANDFETCH_BASE_URL}/brands/${domain}`, {
      headers: {
        'Authorization': `Bearer ${BRANDFETCH_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    console.log(`Status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.log(`Error response: ${errorText}`);
      return null;
    }

    const data = await response.json();
    console.log('Response data:', JSON.stringify(data, null, 2));

    return data;
  } catch (error) {
    console.error(`Error: ${error.message}`);
    return null;
  }
}

// Test with known brands
(async () => {
  await testBrandfetch('chipotle.com');
  await testBrandfetch('tacobell.com');
  await testBrandfetch('starbucks.com');
})();
