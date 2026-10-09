const base = process.env.API_URL ?? 'http://127.0.0.1:3000';
try {
  const responses = await Promise.all(['manual-a', 'manual-b'].map(async (key) => {
    const response = await fetch(`${base}/reservations`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer demo-alpha',
        'Content-Type': 'application/json',
        'Idempotency-Key': key,
      },
      body: JSON.stringify({ itemId: 'desk', quantity: 2 }),
    });
    return { key, status: response.status, body: await response.json() };
  }));
  console.log(JSON.stringify(responses, null, 2));
  const stock = await fetch(`${base}/inventory/desk`, {
    headers: { Authorization: 'Bearer demo-alpha' },
  });
  console.log('Remaining stock:', await stock.json());
  console.log('Expected from fresh fixtures: statuses 201 and 409; availability 1.');
} catch (error) {
  console.error('Start the app with npm start before running the reproduction.', error.message);
  process.exitCode = 1;
}
