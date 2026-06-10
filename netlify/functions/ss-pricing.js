exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };
  try {
    const { styleNum } = JSON.parse(event.body);

    const credentials = Buffer.from(
      `${process.env.SS_ACCOUNT_NUM}:${process.env.SS_API_KEY}`
    ).toString('base64');

    // Try Canadian endpoint
    const url = `https://api-ca.ssactivewear.com/v2/products/${styleNum}?part=prices`;

    const res = await fetch(url, {
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`S&S API error: ${res.status} — ${text.slice(0,300)}`);
    }
    const data = await res.json();
    return { statusCode: 200, body: JSON.stringify(data) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
