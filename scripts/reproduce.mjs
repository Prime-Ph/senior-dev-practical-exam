const base = process.env.API_URL ?? 'http://127.0.0.1:3000';
try {
  const responses = await Promise.all(['manual-a', 'manual-b'].map(async (key) => {
    const response = await fetch(base + '/reservations', {
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
  console.log('Single-instance control: one 201 and one 409 from fresh fixtures.');
  console.log('For the cross-instance incident, run npm run test:scalability or npm run bench.');
} catch (error) {
  console.error('Start the app with npm start first.', error.message);
  process.exitCode = 1;
}
