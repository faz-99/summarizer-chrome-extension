// Vercel serverless function to forward requests to OpenRouter.
// Deploy to Vercel and set the environment variable OPENROUTER_API_KEY to your OpenRouter key.
// The function expects the same body as the OpenRouter Chat Completions endpoint.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const OPENROUTER_URL = 'https://api.openrouter.ai/v1/chat/completions';
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'Server misconfigured: OPENROUTER_API_KEY not set' });
    return;
  }

  try {
    // Forward request body to OpenRouter
    const response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(req.body)
    });

    const text = await response.text();
    // Forward status and body
    res.status(response.status).setHeader('content-type', 'application/json');
    res.send(text);
  } catch (err) {
    console.error('Proxy error:', err);
    res.status(502).json({ error: 'Proxy error', detail: String(err) });
  }
}
